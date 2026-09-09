# Passport Service

Battery Passport CRUD microservice for the Battery Passport platform. Owns creating, reading, updating, and deleting battery passport records. It does **not** own identity — every request is authenticated by delegating to the Auth Service over HTTP, never by decoding a JWT locally.

## Stack

Node.js, Express, TypeScript, MongoDB (Mongoose), axios (Auth Service HTTP client), kafkajs (Aiven Kafka producer), Winston (logging), swagger-jsdoc + swagger-ui-express (API docs).

## Setup

### Local (without Docker)

1. Requires Node 20+, a running MongoDB instance, and a reachable Auth Service.
2. `npm install`
3. Copy `.env.example` to `.env`. Point `MONGO_URI` at your local Mongo and `AUTH_SERVICE_URL` at your running Auth Service (e.g. `http://localhost:4000`).
4. Optional — to publish Kafka events, set `KAFKA_BROKER` to your Aiven bootstrap host:port and drop the three certificate files into [`certs/`](certs/README.md). Leave `KAFKA_BROKER` blank to skip Kafka entirely; passport CRUD works either way.
5. `npm run dev` — starts the service with hot reload on `http://localhost:4001`.

### Docker

From the repo root (`MEAtec/`):

1. Copy `passport/.env.example` to `passport/.env`. Leave `MONGO_URI`/`AUTH_SERVICE_URL` alone — `docker-compose.yml` overrides them to point at the `mongo` and `auth-service` containers. Set `KAFKA_BROKER` (and drop the certs into `passport/certs/`, see below) if you want Kafka publishing.
2. `docker compose up --build`
3. The service is available at `http://localhost:4001`; Swagger UI at `http://localhost:4001/api-docs`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled service (`dist/server.js`) |
| `npm test` | Run the Jest suite against an in-memory MongoDB, with the Auth Service HTTP call mocked via `nock` |

## Response format

Same envelope as the Auth Service — every endpoint, success or error, returns:

```json
{
  "success": true,
  "message": "Human-readable description of the result",
  "data": {}
}
```

Built with the same `src/utils/apiResponse.ts` (`sendSuccess`/`sendError`) and `AppError`/`errorHandler` pattern used by `authentication/`.

## Authentication

This service has **no `JWT_SECRET`** and never decodes a token itself. The `verifyAuth` middleware ([src/middleware/rbac.ts](src/middleware/rbac.ts)) forwards the incoming `Authorization: Bearer <token>` header to the Auth Service's `POST /api/auth/verify`, and:

- On success, attaches `{ userId, email, role }` to `req.user`.
- On the Auth Service's own `401`, propagates it as this service's `401` with the same human-readable message.
- If the Auth Service can't be reached at all (network error or timeout — `AUTH_VERIFY_TIMEOUT_MS`), returns **`503` "Unable to reach authentication service"** — a distinct signal from "the caller sent a bad token," so an operator can tell the two apart.

A missing or malformed `Authorization` header is rejected locally with `401` before any network call is made.

`authorize(...roles)` then checks `req.user.role` against the roles allowed for the route (`403` if not permitted).

## API Docs

Interactive Swagger UI (request/response schemas, try-it-out) is served at `GET /api-docs` once the service is running.

## API

All endpoints are under `/api/passports` and require `Authorization: Bearer <token>` (a token issued by the Auth Service).

### Sample passport body

Used as the `data` payload for both create and update:

```json
{
  "data": {
    "generalInformation": {
      "batteryIdentifier": "BP-2024-011",
      "batteryModel": { "id": "LM3-BAT-2024", "modelName": "GMC WZX1" },
      "batteryMass": 450,
      "batteryCategory": "EV",
      "batteryStatus": "Original",
      "manufacturingDate": "2024-01-15",
      "manufacturingPlace": "Gigafactory Nevada",
      "warrantyPeriod": "8",
      "manufacturerInformation": { "manufacturerName": "Tesla Inc", "manufacturerIdentifier": "TESLA-001" }
    },
    "materialComposition": {
      "batteryChemistry": "LiFePO4",
      "criticalRawMaterials": ["Lithium", "Iron"],
      "hazardousSubstances": [
        { "substanceName": "Lithium Hexafluorophosphate", "chemicalFormula": "LiPF6", "casNumber": "21324-40-3" }
      ]
    },
    "carbonFootprint": { "totalCarbonFootprint": 850, "measurementUnit": "kg CO2e", "methodology": "Life Cycle Assessment (LCA)" }
  }
}
```

`warrantyPeriod` is validated and stored as a **string**, matching the sample (`"8"`, not `8`). Fields beyond what's modeled above (e.g. an extra key inside `generalInformation`) are preserved, not stripped — the nested schemas are typed but not `strict`.

### `POST /api/passports` — admin only

Creates a passport. Body: as above.

Responses: `201` `{ data: { passport } }` · `400` validation failure (`data.errors: [{field, message}]`) · `401` no/invalid token · `403` caller is not admin · `503` Auth Service unreachable.

### `GET /api/passports/:id` — admin or user

Responses: `200` `{ data: { passport } }` · `400` malformed `:id` · `401` · `404` not found · `503`.

### `PUT /api/passports/:id` — admin only

Full replace of `data` (same validation as create). Responses: `200` `{ data: { passport } }` (with `updatedBy` set to the caller) · `400` · `401` · `403` · `404` · `503`.

### `DELETE /api/passports/:id` — admin only

Responses: `200` `{ data: null }` · `400` · `401` · `403` · `404` · `503`.

Any unmatched route returns the same envelope with `404`.

## Kafka events

Every create/update/delete publishes a message to the **`passport.change.stream`** topic on Aiven Kafka (mTLS), in addition to the normal HTTP response. This is best-effort: if Kafka/Aiven is unreachable, or `KAFKA_BROKER` isn't set, the API request still succeeds normally — the publish failure is only logged (via Winston), never surfaced to the caller. See [CLAUDE.md](CLAUDE.md) for the full rationale and the exact failure-handling contract.

Message key: the passport's `_id` (keeps all events for one passport on the same partition, so a consumer sees them in order). Message value (JSON):

```json
{
  "eventType": "created" | "updated" | "deleted",
  "passportId": "66b1f0c9e1a2b3c4d5e6f7a8",
  "actor": { "userId": "..." },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "passport": { "...": "the full passport document at the time of the event" },
  "changeDescription": null
}
```

For `updated` events, `changeDescription` is populated instead of `null`, listing exactly what changed (computed with [`src/utils/diff.ts`](src/utils/diff.ts) by comparing the passport's `data` before and after the write):

```json
{
  "changeDescription": {
    "changedFields": ["generalInformation.batteryStatus", "materialComposition.criticalRawMaterials"],
    "changes": {
      "generalInformation.batteryStatus": { "before": "Original", "after": "Refurbished" },
      "materialComposition.criticalRawMaterials": { "before": ["Lithium", "Iron"], "after": ["Lithium"] }
    }
  }
}
```

`created` and `deleted` events always carry `changeDescription: null` — there's nothing to diff against.

## Environment variables

See [`.env.example`](.env.example): `PORT`, `MONGO_URI`, `AUTH_SERVICE_URL`, `AUTH_VERIFY_TIMEOUT_MS`, `LOG_LEVEL`, `KAFKA_BROKER`, `KAFKA_CLIENT_ID`, `KAFKA_SSL_CA_PATH`, `KAFKA_SSL_CERT_PATH`, `KAFKA_SSL_KEY_PATH`. Certificate setup: [`certs/README.md`](certs/README.md).

## Logging

Centralized Winston logger ([src/config/logger.ts](src/config/logger.ts)) — colorized console output in development, JSON in production. Every HTTP request is logged (method, path, status, duration) and every error caught by `errorHandler` is logged with its stack trace. Writes to `logs/error.log` and `logs/combined.log` outside of tests (skipped under `NODE_ENV=test`).

## Architecture

```
src/
  server.ts             entry point — loads env, connects Mongo, starts Express
  app.ts                 express app + middleware wiring, mounts Swagger UI
  config/
    db.ts                 mongoose connection
    logger.ts              winston logger
    kafka.ts                Aiven Kafka producer: connect/disconnect, mTLS setup
    swagger.ts              builds/mounts the OpenAPI spec
    swaggerSchemas.ts        reusable OpenAPI component schemas (JSDoc only)
  models/Passport.ts      typed nested schema (generalInformation, materialComposition, carbonFootprint)
  controllers/            create / getById / update / delete handlers — publish Kafka events after each write
  services/
    passportEventPublisher.ts   builds & publishes passport.change.stream events, never throws
  routes/                  /api/passports/* routes, with @swagger JSDoc per route
  middleware/
    rbac.ts                 verifyAuth (HTTP call to Auth Service) + authorize (role check)
    requestLogger.ts         winston-based HTTP request logging
    errorHandler.ts, asyncHandler.ts, validate.ts   same pattern as authentication/
  validators/              express-validator rules for the nested passport body
  utils/
    apiResponse.ts, AppError.ts   same envelope pattern as authentication/
    authServiceClient.ts           axios instance pointed at AUTH_SERVICE_URL
    diff.ts                        generic before/after object diff, used to build changeDescription
  constants/roles.ts       shared ROLES/Role/ALL_ROLES
  types/                   AuthenticatedUser, req.user augmentation
```

See [CLAUDE.md](CLAUDE.md) for this service's contract and known gaps.
