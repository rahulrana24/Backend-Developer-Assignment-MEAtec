# Passport Service — context for future work

This file documents the Passport Service's contract for whoever builds against it next (a future session, or the Document/Notification services described in the root [`CLAUDE.md`](../CLAUDE.md)).

## Standard response envelope (applies to every microservice)

Every endpoint — success or error — returns exactly this shape:

```json
{ "success": boolean, "message": "human-readable string", "data": <object|array|null> }
```

Implemented with `src/utils/apiResponse.ts` (`sendSuccess`/`sendError`) and `AppError`/`errorHandler`, copied verbatim from `authentication/` per that service's own CLAUDE.md instruction. No route calls `res.json(...)` directly.

## What this service owns

CRUD for Battery Passport records: `generalInformation`, `materialComposition`, `carbonFootprint`. It does **not** own identity — no password hashing, no JWT signing, no `JWT_SECRET`. Every request's identity/role is established by calling the Auth Service, never decoded locally.

## Auth Service dependency (read this before touching `verifyAuth`)

`src/middleware/rbac.ts`'s `verifyAuth` calls `POST {AUTH_SERVICE_URL}/api/auth/verify`, forwarding the incoming `Authorization: Bearer <token>` header, no body. It resolves three ways:

1. **No/malformed header** → local `401`, no network call at all.
2. **Auth Service reachable, responds `401`** → this service returns its own `401` with the Auth Service's message passed through.
3. **Auth Service unreachable** (DNS failure, connection refused, or timeout past `AUTH_VERIFY_TIMEOUT_MS`) → **`503` "Unable to reach authentication service."** This is deliberately a different status than case 2 — a `503` means "the platform is degraded," a `401` means "this specific caller is unauthorized." Don't collapse these into the same status code if you touch this file.

On success, `req.user = { userId, email, role }` (from the Auth Service's `/verify` response `data`), then `authorize(...roles)` checks `req.user.role`.

**Do not add a `JWT_SECRET` to this service or decode tokens locally** — that would create a second source of truth for token validity and defeat the point of centralizing verification in the Auth Service (it also can't rotate its secret without breaking this service). If per-request latency to the Auth Service becomes a problem, the fix is a short-TTL cache in front of `/verify`, not local decoding — not yet implemented (see Known gaps).

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/passports` | admin | Create. Body: `{ data: { generalInformation, materialComposition, carbonFootprint } }`. `data: { passport }`. |
| GET | `/api/passports/:id` | admin or user | `data: { passport }`. `404` if not found, `400` if `:id` isn't a valid Mongo ObjectId. |
| PUT | `/api/passports/:id` | admin | Full replace of `data` (same body/validators as create, not a partial patch). `data: { passport }`. |
| DELETE | `/api/passports/:id` | admin | `data: null` on success (still `200`, not `204` — a bodyless response can't carry the envelope). |

Every response above is wrapped in the standard envelope — `data` here means the envelope's `data` field. Full request/response examples with the exact sample body: [README.md](README.md). Interactive docs: `GET /api-docs`.

## Kafka: `passport.change.stream` (Aiven, mTLS)

Every create/update/delete publishes one message to the **`passport.change.stream`** topic on Aiven Kafka, after the MongoDB write succeeds. This deliberately does **not** match the root `CLAUDE.md`'s original three-topic naming (`passport.created`/`passport.updated`/`passport.deleted`) — the user redirected to a single unified topic with an `eventType` field distinguishing the three cases instead. If you're reconciling against the root spec, this service's actual behavior (one topic) is the current source of truth, not the root doc.

**Producer setup** (`src/config/kafka.ts`): mTLS via three files downloaded from the Aiven console (CA certificate, access certificate, access key — see [`certs/README.md`](certs/README.md)), paths given by `KAFKA_SSL_CA_PATH`/`KAFKA_SSL_CERT_PATH`/`KAFKA_SSL_KEY_PATH`. Bootstrap broker from `KAFKA_BROKER`.

**Failure contract — this is load-bearing, don't change it without re-confirming with whoever owns this decision:**
- If `KAFKA_BROKER` is unset, `connectKafkaProducer()` skips connecting entirely (logs once at startup) — local dev without Aiven access works fine, no events are published.
- If the connection attempt fails, or a `producer.send()` call fails at publish time, it's caught and logged via Winston (`logger.error`) — **never thrown**, **never surfaces to the HTTP caller**. The MongoDB write is authoritative; a passport create/update/delete must succeed on its own even if Kafka/Aiven is completely down. This was an explicit user decision, not an oversight — don't "fix" it into failing the request when Kafka is unreachable.
- `getKafkaProducer()` returns `Producer | null` rather than throwing when disconnected — `publishPassportChangeEvent` checks for `null` and just returns.

**Event schema** (message key = passport `_id`, so all events for one passport land on the same partition and stay ordered):

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

`changeDescription` is `null` for `created`/`deleted` (nothing to diff), and populated for `updated`:

```json
{
  "changedFields": ["generalInformation.batteryStatus"],
  "changes": { "generalInformation.batteryStatus": { "before": "Original", "after": "Refurbished" } }
}
```

Built by `buildChangeDescription` (`src/services/passportEventPublisher.ts`) calling `diffObjects` (`src/utils/diff.ts`) on the passport's `data` before vs. after the write. `diffObjects` is a generic recursive plain-object differ — it walks matching keys on both sides and reports every leaf whose value differs, as a flat `"dot.path": {before, after}` map. **Arrays and `Date`s are compared as whole values, not diffed element-by-element** (e.g. changing one entry in `criticalRawMaterials` reports the whole array as before/after, not an index-level diff) — this was a deliberate simplicity choice, not a limitation to "fix" without reconsidering whether callers actually need element-level array diffs.

`updatePassport` in `passportController.ts` fetches the existing document, snapshots `.toObject().data`, assigns the new `data`, and calls `.save()` (not `findByIdAndUpdate`) specifically so the "before" state is available for diffing — don't revert this back to `findByIdAndUpdate` without preserving that.

## Data model notes

`src/models/Passport.ts` types the fields shown in the sample battery-passport body (see README) with real Mongoose validation (`required`, `Number`/`Date`/`String` types), but every nested schema under `data` is declared `strict: false` — an unrecognized field survives instead of being silently dropped. This is intentional: the sample is a subset of a fuller real-world battery passport spec, and being strict here would reject legitimate future fields before anyone's decided the full schema. `warrantyPeriod` is a **string** (matches the sample's `"8"`), not a number — don't "fix" this to `Number` without checking with whoever owns the data contract.

No uniqueness constraint on `batteryIdentifier` — two passports can currently share one. Not requested; flagged as a future enhancement below.

## Required env vars

`PORT`, `MONGO_URI`, `AUTH_SERVICE_URL`, `AUTH_VERIFY_TIMEOUT_MS`, `LOG_LEVEL`, `KAFKA_BROKER`, `KAFKA_CLIENT_ID`, `KAFKA_SSL_CA_PATH`, `KAFKA_SSL_CERT_PATH`, `KAFKA_SSL_KEY_PATH`. See `.env.example`. No `JWT_SECRET` (see above). The Kafka topic name itself (`passport.change.stream`) is a constant in `src/config/kafka.ts`, not an env var — it's a fixed contract other consumers will build against, not a per-environment setting.

## Conventions to keep consistent across the remaining services

- Responses: `sendSuccess`/`AppError`+`errorHandler`, same as `authentication/`. Wrap async controllers in `asyncHandler`.
- Validation: `express-validator` + the shared `validate` middleware → `AppError(msg, 400, { errors: [{field, message}] })`.
- `:id` route params: validate with `param('id').isMongoId()` through `validate`, not by catching a Mongoose `CastError` — keeps every 400 on the same code path instead of two.
- Status codes: 201 create, 200 read/update/delete success, 400 validation, 401 auth failure, 403 role forbidden, 404 not found, 503 upstream dependency unreachable, 500 unhandled.
- Unmatched routes: catch-all 404 handler before `errorHandler`.
- TypeScript, `strict: true`, multi-stage Docker build (builder compiles, runtime ships `dist/` + prod deps only).
- Tests: `ts-jest` + `supertest` + `mongodb-memory-server` for the database (real, in-memory, not mocked) — but the **Auth Service HTTP call is mocked with `nock`**, since it's a genuine external service boundary, not something this service owns. See `tests/helpers/authMock.ts`.
- Winston logger (`src/config/logger.ts`) used everywhere instead of `console.*` — startup, DB connect, every HTTP request, every error.
- Swagger (`@swagger` JSDoc blocks colocated in route files, `src/config/swagger.ts` builds the spec from both `src/routes/*.ts` and `dist/routes/*.js` so it works unchanged in dev and in the Docker image) must be kept current when adding or changing an endpoint — don't let it drift.

## Known gaps / not yet built

- **No Kafka consumer exists yet.** `passport.change.stream` is published, but nothing reads it — the Notification Service described in the root `CLAUDE.md` doesn't exist. Events accumulate on the topic (subject to Aiven's retention) until a consumer is built.
- **No delivery guarantee beyond "best effort, log on failure."** There's no outbox pattern, no retry queue, and no reconciliation job — if Aiven is down at the moment of a write, that one event is simply lost (logged, not retried). If a consumer ever needs a complete history, this needs revisiting (e.g. an outbox table + a relay process) rather than assuming every DB write has a corresponding Kafka message.
- **`diffObjects` doesn't diff arrays element-by-element** — see the Kafka section above.
- No `GET /api/passports` list/search endpoint — not requested.
- No uniqueness constraint on `batteryIdentifier`.
- No boot-time health check against the Auth Service — the dependency is enforced by `docker-compose`'s `depends_on` (container start order) and checked per-request, not at startup.
- No CI (GitHub Actions) — same gap as `authentication/`.
- No rate limiting.
- No caching layer in front of `/api/auth/verify` — every protected request costs one HTTP round trip to the Auth Service. Fine at current scale; revisit if it becomes a bottleneck.
