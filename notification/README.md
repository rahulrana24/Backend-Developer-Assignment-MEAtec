# Notification Service

Consumes the `passport.change.stream` Kafka topic (published by `passport/`) and emails a human-readable notification for every battery passport create, update, and delete. Logs everything via Winston. Stateless — no database.

```
Aiven Kafka (passport.change.stream) → this consumer → nodemailer/SMTP → recipient inbox
```

## Stack

Node.js, Express (health check only), TypeScript, node-rdkafka (Aiven Kafka consumer over SASL_SSL), nodemailer (SMTP), Winston (logging).

## Setup

### Local (without Docker)

1. Requires Node 20+.
2. `npm install`
3. Copy `.env.example` to `.env`.
4. To actually receive events: set `KAFKA_BROKER` to your Aiven bootstrap host:port, `KAFKA_SASL_USERNAME`/`KAFKA_SASL_PASSWORD` to your Aiven SASL credentials (same service user `passport/` uses to publish), and drop the CA certificate into [`certs/`](certs/README.md) (same file `passport/certs/` uses).
5. To actually send email: set `SMTP_USER`/`SMTP_PASS` to real SMTP credentials (Gmail defaults are pre-filled; you'll need a Gmail "App Password", not your regular password). Leave `KAFKA_BROKER` or `SMTP_USER`/`SMTP_PASS` blank to skip either piece — the service still starts and `/health` still works either way.
6. `npm run dev` — starts on `http://localhost:4002`.

### Docker

From the repo root (`MEAtec/`):

1. Copy `notification/.env.example` to `notification/.env` and fill in the same values as above.
2. `docker compose up --build`
3. The service is available at `http://localhost:4002`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled service (`dist/server.js`) |
| `npm test` | Run the Jest suite — no live Kafka or SMTP connection needed |

## `GET /health`

The only HTTP endpoint, using the same response envelope as the other services:

```json
{
  "success": true,
  "message": "Notification service is healthy",
  "data": { "service": "notification-service", "timestamp": "2026-09-09T10:30:00.000Z" }
}
```

## Kafka contract

- **Topic**: `passport.change.stream` (fixed constant in [`src/config/kafka.ts`](src/config/kafka.ts), not env-configurable — same cross-service contract `passport/` publishes to)
- **Consumer group**: `notification-service-group` (also fixed)
- **`fromBeginning`**: `false` by default (`KAFKA_CONSUMER_FROM_BEGINNING` to override) — only events published after this service starts are consumed, so a fresh deploy doesn't replay the whole topic history into the inbox
- **Transport**: `node-rdkafka`'s `createReadStream()`, authenticating via SASL_SSL (SCRAM-SHA-256) — the same auth method `passport/`'s producer uses, not the mTLS client-certificate approach this service used previously

Expected message shape (produced by `passport/src/services/passportEventPublisher.ts`):

```json
{
  "eventType": "created" | "updated" | "deleted",
  "passportId": "string",
  "actor": { "userId": "string" },
  "timestamp": "ISO-8601",
  "passport": { "...": "full passport document at the time of the event" },
  "changeDescription": null
}
```

For `updated` events, `changeDescription` is `{ changedFields: string[], changes: { [field]: { before, after } } }`. See [CLAUDE.md](CLAUDE.md) for the full contract and its schema-drift risk.

## Email content

Each event produces a subject line reflecting the event type and battery identifier, an HTML email (colored header band per event type, a summary card, and — for updates — a Field/Before/After table), plus a plain-text fallback. See [`src/templates/passportChangeEmail.ts`](src/templates/passportChangeEmail.ts).

## Testing

`npm test` covers: the email template (all three event types, missing `changeDescription`, extra/unexpected fields, nested before/after values), the mailer (mocked `nodemailer`, asserts recipient/subject/content, asserts a rejected send doesn't throw), the message handler (valid event, malformed JSON, empty message — none crash), and `/health`/404. **Nothing connects to a real Kafka broker or sends a real email during tests** — the external boundaries (`node-rdkafka`, `nodemailer`) are mocked/bypassed, same approach `passport/` uses for its Auth Service HTTP dependency. Note `config/kafka.ts` itself isn't exercised by the test suite (`connectKafkaConsumer`/`disconnectKafkaConsumer` are only called from `server.ts`, which tests never import) — it's verified instead by loading the native module and compiling/running against real credentials manually, same as `passport/`'s producer.

## Known limitations

Best-effort delivery only (no retry, no dead-letter queue), and no runtime validation against the producer's actual event schema. See [CLAUDE.md](CLAUDE.md) for the full explanation of both.
