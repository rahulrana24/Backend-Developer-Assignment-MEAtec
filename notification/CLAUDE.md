# Notification Service — context for future work

This file documents the Notification Service's contract for whoever builds against or modifies it next. Read the root [`CLAUDE.md`](../CLAUDE.md) and [`passport/CLAUDE.md`](../passport/CLAUDE.md) first if you haven't — this service exists entirely to react to what `passport/` publishes.

## What this service owns

Turning `passport.change.stream` Kafka events into human-readable email notifications. Nothing else — no REST API surface beyond `GET /health`, no persistence (no MongoDB), no authentication/authorization of any kind (there's nothing here for a caller to authenticate against). It is a **Kafka consumer**, not a producer — the inverse role of `passport-service`, which publishes to this same topic but never reads it.

## Consumer identity

- `clientId`: `notification-service` (env `KAFKA_CLIENT_ID`, overridable — used for broker-side visibility/logging, not for correctness)
- `groupId`: `notification-service-group` — **hardcoded in `src/config/kafka.ts`, not env-configurable.** The group id is how Kafka tracks this consumer's committed offsets; changing it casually (or making it env-configurable and letting different environments drift) effectively resets "what's already been consumed" and can cause a burst of re-delivered (or skipped) events. Change it deliberately, not as a config knob.
- Topic: `passport.change.stream` — hardcoded constant (`KAFKA_TOPIC_PASSPORT_CHANGE` in `src/config/kafka.ts`), matching the exact same constant name/value in `passport/src/config/kafka.ts`. This is a fixed cross-service contract, not a per-environment setting — same reasoning as passport's own doc on this.
- `fromBeginning`: `false` by default (`KAFKA_CONSUMER_FROM_BEGINNING` env var to override). Default is deliberate: a fresh deploy or a new consumer group generation must not replay the entire topic history and blast the recipient's inbox with every historical event. Maps to `node-rdkafka`'s `auto.offset.reset` topic config (`'earliest'`/`'latest'`), set in the `createReadStream` call in `src/config/kafka.ts`.
- **Auth**: SASL_SSL with SCRAM-SHA-256 (`KAFKA_SASL_USERNAME`/`KAFKA_SASL_PASSWORD`), not a client certificate — matches `passport/`'s producer, which made the same switch. A CA certificate (`KAFKA_SSL_CA_PATH`) is still required to verify the broker's TLS certificate.
- **Client library**: `node-rdkafka`'s stream API (`createReadStream`, `src/config/kafka.ts`), not `kafkajs` — switched in lockstep with `passport/`'s producer. `createReadStream()` connects the underlying consumer itself; `connectKafkaConsumer()` waits for its `'ready'` event (or `KAFKA_CONNECT_TIMEOUT_MS`, default 10s) before considering the connection established, since nothing else awaits that handshake.

**A bug found and fixed while building this, don't reintroduce it**: `createReadStream()` constructs and connects the underlying consumer **synchronously**, and a bad config value throws immediately rather than via an event (confirmed locally: a `node-rdkafka` build without OpenSSL support threw `Unsupported value "sasl_ssl" for configuration property "security.protocol"` straight out of the constructor, before any event ever fired). The entire construct-and-wire-up block in `connectKafkaConsumer()` is wrapped in one `try/catch` for exactly this reason — an earlier draft only wrapped nothing, so a construction-time throw became an unhandled rejection out of `connectKafkaConsumer()`, which crashed the whole service at startup (`main().catch(...)` in `server.ts` calls `process.exit(1)`) instead of degrading gracefully like every other failure mode in the table below. If you refactor this, keep the whole block inside the `try`.

**This entire consumer path was verified against the real Aiven cluster during development** — a real SASL_SSL handshake, real messages produced by `passport/`, consumed here, and real emails sent via SMTP — not just type-checked/unit-tested (see "Testing approach" below for why `npm test` alone can't prove this). If `node-rdkafka` ever needs rebuilding locally on macOS and throws the OpenSSL error above, the fix is `CPPFLAGS=-I$(brew --prefix openssl)/include LDFLAGS=-L$(brew --prefix openssl)/lib npm rebuild node-rdkafka` (per the package's own README) — a local macOS build quirk, not a code bug; the Dockerfile's builder-stage `apk add openssl-dev` avoids it entirely in the actual deployed image.

## Best-effort delivery contract — read this before touching `kafka.ts`, `notificationHandler.ts`, or `mailer.ts`

This mirrors passport-service's own documented posture (its CLAUDE.md: "if Aiven is down at the moment of a write, that event is simply lost, logged not retried — no outbox pattern, no retry queue, no reconciliation job"). Same philosophy here, applied to consumption + email delivery:

| Condition | Behavior |
| --- | --- |
| `KAFKA_BROKER`, `KAFKA_SASL_USERNAME`, or `KAFKA_SASL_PASSWORD` unset | `connectKafkaConsumer()` logs once and returns. Service stays up, `/health` still works, no events are ever received. |
| Consumer fails to connect, or never reaches `'ready'` within `KAFKA_CONNECT_TIMEOUT_MS` (bad credentials, bad CA, Aiven unreachable) | Caught/logged as `error`, function returns — no crash, no process exit. |
| Kafka message value is empty/undefined | Logged as `warn`, skipped. |
| Kafka message JSON is malformed | `JSON.parse` failure caught in `processRawMessage`, logged as `error`, skipped. `node-rdkafka`'s default auto-commit still advances the offset — **that message is never retried or redelivered, by design.** |
| SMTP send fails (auth error, connection refused, timeout, misconfigured) | Caught inside `sendPassportChangeEmail` (`src/config/mailer.ts`), logged as `error`, returns normally — no throw, no retry, no dead-letter queue. |

**Net effect: at-most-once, no delivery guarantee.** This is appropriate for a testing/ops-visibility notification service, not for anything requiring guaranteed compliance or customer communication. If that ever changes, the fix is an outbox/retry mechanism on both the passport producer and this consumer — not something to bolt on quietly to just one side.

## Schema-drift risk (explicit, not swept under the rug)

This service assumes the **exact current shape** of `PassportChangeEvent` as published by `passport/src/services/passportEventPublisher.ts` (see `src/types/passportEvent.ts`, a hand-maintained consumer-side copy — not shared code, not a package, not validated against a schema registry). There is **no runtime validation** of an incoming message against this contract.

If the event shape changes in `passport/` (a field renamed, a new required field, `changeDescription`'s structure changed) without a corresponding update here:
- A field access that used to work now reads `undefined` — the template renders it as `'—'` or drops it silently. The email still sends, just with missing/wrong content. No error, no alert.
- A structurally incompatible change might still `JSON.parse` successfully but throw somewhere in `handlePassportChangeEvent`/the template — caught by `processRawMessage`'s outer try/catch, logged, and the message is simply skipped (no email at all), with visibility only in the log file.

**Whoever changes the event shape in `passport/` (`passport/src/services/passportEventPublisher.ts`, `passport/src/models/Passport.ts`) must manually update `notification/src/types/passportEvent.ts` and `notification/src/templates/passportChangeEmail.ts` in lockstep.** Nothing today automatically enforces or even flags this — no shared type package, no schema registry, no contract test between the two services.

## Env vars

| Var | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4002` | HTTP port for `/health` |
| `LOG_LEVEL` | `info` | Winston level |
| `KAFKA_BROKER` | *(unset)* | Aiven bootstrap host:port. Unset = Kafka disabled entirely. |
| `KAFKA_CLIENT_ID` | `notification-service` | node-rdkafka `client.id` |
| `KAFKA_CONNECT_TIMEOUT_MS` | `10000` | How long to wait for the consumer's `'ready'` event before giving up |
| `KAFKA_SASL_USERNAME` / `KAFKA_SASL_PASSWORD` | *(unset)* | SASL/SCRAM-SHA-256 credentials — same Aiven service user `passport/` uses to publish |
| `KAFKA_SSL_CA_PATH` | `./certs/ca.pem` | CA certificate, see `certs/README.md` — still required with SASL_SSL, no client cert/key needed |
| `KAFKA_CONSUMER_FROM_BEGINNING` | `false` | Replay entire topic on start if `true` |
| `SMTP_HOST` / `_PORT` / `_SECURE` | `smtp.gmail.com` / `465` / `true` | SMTP transport (Gmail defaults) |
| `SMTP_USER` / `SMTP_PASS` | *(unset)* | Real SMTP credentials — provided by whoever runs this, never hardcoded |
| `SMTP_FROM_NAME` / `SMTP_FROM_ADDRESS` | `Battery Passport Notifications` / `SMTP_USER` | From header |
| `NOTIFICATION_RECIPIENT_EMAIL` | `rahul.rana2000.rr@gmail.com` | **Test value.** Replace for anything beyond local testing — there is currently only one recipient, no per-event/per-role routing. |

No `MONGO_URI`, no `JWT_SECRET`, no `AUTH_SERVICE_URL` — this service has no database and no reason to authenticate anyone.

## File map

```
src/
  server.ts                 entry point — loads env, connects Kafka consumer, starts Express, graceful shutdown
  app.ts                     express app — GET /health only, 404, errorHandler
  config/
    logger.ts                 winston logger (defaultMeta.service = 'notification-service')
    kafka.ts                   consumer connect/disconnect (node-rdkafka stream, SASL_SSL), topic + groupId constants
    mailer.ts                  lazy nodemailer transporter, sendPassportChangeEmail()
  services/
    notificationHandler.ts     processRawMessage() + handlePassportChangeEvent() — the testable core,
                                kept free of node-rdkafka types
  templates/
    passportChangeEmail.ts     buildPassportChangeEmail(event) -> {subject, html, text}, pure function
  types/
    passportEvent.ts           consumer-side copy of PassportChangeEvent — see "Schema-drift risk" above
  utils/{AppError,apiResponse}.ts   same envelope pattern as authentication/ and passport/, for /health only
  middleware/errorHandler.ts   same pattern as the other two services
```

## Testing approach

Unit-tested: the email template (all three event types, missing `changeDescription`, unexpected extra fields, nested before/after values) — pure function, no mocks needed. The mailer, via `jest.mock('nodemailer')` — asserts `sendMail` args and that a rejection doesn't throw. The message handler, via `jest.spyOn` on the mailer module (same style as `passport/tests/passport.kafka.test.ts`) — valid event, malformed JSON, empty message. `/health` and 404 via supertest.

**Not tested, deliberately**: no real connection to Aiven Kafka, no real SMTP send. Both external boundaries are mocked/untouched, same approach `passport/` takes for its Auth Service HTTP dependency (mocked with `nock`) rather than the database (real, in-memory). There is no integration test that proves an actual email lands in an actual inbox — that has to be verified manually with real credentials (see README's Setup section). Note that `config/kafka.ts` itself isn't reached by any test — `connectKafkaConsumer`/`disconnectKafkaConsumer` are only called from `server.ts`, which the test suite never imports (it drives `app.ts` directly via supertest) — so the `node-rdkafka` native module's actual `'ready'`/`'data'`/`'event.error'` wiring is verified by manual runs against real Aiven credentials, not by `npm test`.

## Known gaps / not yet built

- No retry, no dead-letter queue, no outbox pattern — see the best-effort table above.
- No schema validation against the producer's event shape — see "Schema-drift risk" above.
- Single fixed recipient (`NOTIFICATION_RECIPIENT_EMAIL`) — no per-user/per-role routing, no subscription list, no unsubscribe mechanism.
- No email deduplication — if this consumer restarts and re-reads a message it already processed (e.g. an offset-commit race), the same email can be sent twice. Acceptable for a testing-purpose service; would need idempotency tracking (which needs persistence, which this service currently doesn't have) if that ever matters.
- No CI (GitHub Actions) — same gap as the other two services.
- No boot-time health check against Aiven or the SMTP server — `connectKafkaConsumer()` and `getTransporter()` are both lazy/best-effort, so a misconfiguration only surfaces in the logs, not as a startup failure.
- **Docker build note**: `node-rdkafka`'s native addon needs a C/C++ toolchain to compile (installed via `apk` in the Dockerfile's builder stage only) — the runtime stage copies the builder's already-compiled `node_modules` (after `npm prune --omit=dev`) instead of reinstalling, and only needs the runtime shared libraries (`libstdc++`, `openssl`). Same asymmetry as `passport/`'s Dockerfile — keep it if you touch either.
