# Battery Passport Platform

A microservices backend for issuing, storing, and tracking digital "battery passports" — structured records describing a battery's origin, materials, and carbon footprint — plus the supporting documents and notifications around them. Each service is an independently deployable Node.js/TypeScript app with its own MongoDB database (or no database at all), talking to the others only over HTTP or Kafka, never by importing each other's code or sharing a database.

## Live deployment

All four services are deployed on [Render](https://render.com) and backed by real cloud infrastructure — MongoDB Atlas, Aiven Kafka (SASL_SSL), and AWS S3 — not local containers:

| Service | Live URL | Docs |
| --- | --- | --- |
| Auth Service | https://backend-developer-assignment-meatec.onrender.com | — |
| Passport Service | https://passport-qhkl.onrender.com | [`/api-docs`](https://passport-qhkl.onrender.com/api-docs) |
| Notification Service | https://backend-developer-assignment-meatec-b8rk.onrender.com | `/health` only |
| Document Service | https://document-33qg.onrender.com | [`/api-docs`](https://document-33qg.onrender.com/api-docs) |

Verified end-to-end against this live deployment: register → login → create a passport (published to Aiven Kafka) → upload a document (landed in the real S3 bucket) → fetch it back via a presigned URL. `GET /health` on each service returns the standard envelope, e.g. `{"success":true,"message":"Service is healthy","data":{"status":"ok"}}`.

Each Render service is built directly from that service's own `Dockerfile`. The two Kafka-connected services (`passport-service`, `notification-service`) get their Aiven CA certificate via Render's **Secret Files** (mounted at `/etc/secrets/ca.pem`, referenced by the `KAFKA_SSL_CA_PATH` env var) rather than the `docker-compose.yml` volume mount used locally — see [passport/README.md](passport/README.md#deploying-to-render) for the exact steps.

## Architecture

```
                         ┌────────────────────┐
                         │   Auth Service      │  :4000
                         │  (identity, JWT)    │
                         └─────────▲───────────┘
                                   │ POST /api/auth/verify
                                   │ (every protected request, every service)
                 ┌─────────────────┼─────────────────┐
                 │                 │                 │
     ┌───────────┴───────┐ ┌───────┴───────────┐ ┌───┴─────────────────┐
     │  Passport Service  │ │ Document Service   │ │  (future services)  │
     │  :4001             │ │ :4003              │ │                     │
     │  Battery passport  │ │ Files in AWS S3    │ │                     │
     │  CRUD (Mongo Atlas)│ │ + metadata (Mongo) │ │                     │
     └───────────┬────────┘ └────────────────────┘ └─────────────────────┘
                 │ publishes
                 │ passport.change.stream (Aiven Kafka, SASL_SSL)
                 ▼
     ┌────────────────────┐
     │ Notification Service│ :4002
     │ Kafka consumer →    │
     │ email on change     │
     └──────────────────────┘
```

## Services at a glance

| Service | Port | Database | Depends on | Purpose |
| --- | --- | --- | --- | --- |
| [`authentication/`](authentication/README.md) | 4000 | MongoDB Atlas | — | User registration/login, password hashing (bcrypt), JWT issuance and verification. The single source of truth for "who is this caller and what role do they have" (`admin` \| `user`). Every other service calls its `POST /api/auth/verify` instead of decoding tokens itself. |
| [`passport/`](passport/README.md) | 4001 | MongoDB Atlas | Auth Service; Aiven Kafka (optional) | CRUD for battery passport records (`generalInformation`, `materialComposition`, `carbonFootprint`). Admin-only create/update/delete, admin-or-user read. Publishes every create/update/delete to the `passport.change.stream` Kafka topic over SASL_SSL (best-effort — a Kafka outage never fails the request). |
| [`document/`](document/README.md) | 4003 | MongoDB Atlas | Auth Service; AWS S3 (or MinIO for local dev) | Upload, metadata update, delete, and presigned-download-link generation for arbitrary files (certificates, warranty PDFs, photos). File bytes live in S3; only metadata lives in MongoDB. Every route allows both roles, gated by document ownership (uploader or admin) rather than role alone. |
| [`notification/`](notification/README.md) | 4002 | none (stateless) | Aiven Kafka (optional); SMTP (optional) | Consumes `passport.change.stream` over SASL_SSL and emails a human-readable notification for every passport create/update/delete. The only service with no HTTP API beyond `/health` — it's a pure Kafka consumer. |

Every service that requires MongoDB gets its **own** database (`auth-service`, `passport`, `document`, all on the same Atlas cluster) — none of them share collections or reach into another service's database directly.

## The one contract every service shares

Every endpoint in every service, success or error, returns the same envelope:

```json
{ "success": boolean, "message": "human-readable string", "data": <object|array|null> }
```

Built from the same `sendSuccess`/`sendError` (`src/utils/apiResponse.ts`) and `AppError`/`errorHandler` pattern in each service — copied deliberately, not shared as a library, so each service stays independently deployable with no shared runtime dependency. See any service's own `README.md`/`CLAUDE.md` for the details this file doesn't repeat.

Identity works the same way everywhere it's needed: a service with protected endpoints (`passport/`, `document/`) has **no `JWT_SECRET`** of its own — it forwards the caller's `Authorization: Bearer <token>` header to the Auth Service's `POST /api/auth/verify` and trusts the response. A `401` from that call means "this caller is unauthorized"; the Auth Service being unreachable is a distinct `503` ("the platform is degraded"), never conflated with the caller's own token being bad.

## Running locally with Docker

From this directory:

1. Copy each service's `.env.example` to `.env` (`authentication/.env`, `passport/.env`, `notification/.env`, `document/.env`) and fill in real values — a `MONGO_URI` (Atlas or local), `JWT_SECRET`, and, if you want Kafka/S3 wired up, Aiven SASL credentials + a CA cert (see [passport/certs/README.md](passport/certs/README.md)) and AWS credentials. Everything except `JWT_SECRET`/`MONGO_URI` is optional — each service degrades gracefully (logs and keeps serving `/health`) if its optional dependency isn't configured.
2. `docker compose up --build`

`docker-compose.yml` only runs the four application containers — there's no bundled MongoDB/MinIO anymore, since every service now points at real cloud infrastructure (MongoDB Atlas, Aiven Kafka, AWS S3) by default, the same infra the live Render deployment uses. The compose file overrides only `AUTH_SERVICE_URL` for `passport-service`/`document-service` (pointing at the `auth-service` container by name) and mounts each Kafka-connected service's `./certs` directory read-only for its CA certificate — everything else comes straight from each service's own `.env`.

| Endpoint | Local URL |
| --- | --- |
| Auth Service | `http://localhost:4000` |
| Passport Service | `http://localhost:4001` (Swagger: `/api-docs`) |
| Notification Service | `http://localhost:4002` (`/health` only) |
| Document Service | `http://localhost:4003` (Swagger: `/api-docs`) |

Kafka and S3 are both optional end-to-end: leave `KAFKA_BROKER` blank in `passport/.env`/`notification/.env` to run passport CRUD with zero Kafka setup (no change-notification emails); point `document/.env`'s `S3_ENDPOINT` at a local MinIO instead of real AWS if you'd rather not use a real bucket for local testing (see [document/README.md](document/README.md)).

## A typical flow across services

1. `POST /api/auth/register` + `POST /api/auth/login` against the Auth Service → get a JWT.
2. `POST /api/passports` (admin) against the Passport Service, bearer token from step 1 → creates a passport, publishes a `passport.change.stream` event.
3. (If Kafka + SMTP are configured) the Notification Service consumes that event and emails a summary.
4. `POST /api/documents/upload` against the Document Service, same bearer token → uploads a supporting file (e.g. a warranty certificate), independent of the passport record itself (no foreign-key style link is enforced between the two — a document just carries whatever `description` the caller gives it).
5. `GET /api/documents/:docId` → a presigned S3 URL to download that file directly, without proxying bytes through the service.

This exact flow is what was used to verify the live Render deployment above — swap `http://localhost:PORT` for the live URLs in the table at the top to run it against production.

## Repo layout

```
authentication/   Auth Service — see authentication/README.md and authentication/CLAUDE.md
passport/         Passport Service — see passport/README.md and passport/CLAUDE.md
notification/     Notification Service — see notification/README.md and notification/CLAUDE.md
document/         Document Service — see document/README.md and document/CLAUDE.md
docker-compose.yml   the four services wired together for local Docker use
CLAUDE.md            the original assignment spec this platform was built against
```

Each service's own `README.md` has full setup/API/architecture details; each `CLAUDE.md` documents that service's contract, the reasoning behind non-obvious decisions, and known gaps — read those before extending a service rather than re-deriving its conventions from scratch.
