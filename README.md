# Battery Passport Platform

A microservices backend for issuing, storing, and tracking digital "battery passports" — structured records describing a battery's origin, materials, and carbon footprint — plus the supporting documents and notifications around them. Each service is an independently deployable Node.js/TypeScript app with its own MongoDB database (or no database at all), talking to the others only over HTTP or Kafka, never by importing each other's code or sharing a database.

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
     │  Battery passport  │ │ Files in S3/MinIO  │ │                     │
     │  CRUD (Mongo)      │ │ + metadata (Mongo) │ │                     │
     └───────────┬────────┘ └────────────────────┘ └─────────────────────┘
                 │ publishes
                 │ passport.change.stream
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
| [`authentication/`](authentication/README.md) | 4000 | MongoDB (`auth-service`) | — | User registration/login, password hashing (bcrypt), JWT issuance and verification. The single source of truth for "who is this caller and what role do they have" (`admin` \| `user`). Every other service calls its `POST /api/auth/verify` instead of decoding tokens itself. |
| [`passport/`](passport/README.md) | 4001 | MongoDB (`passport-service`) | Auth Service; Kafka (optional) | CRUD for battery passport records (`generalInformation`, `materialComposition`, `carbonFootprint`). Admin-only create/update/delete, admin-or-user read. Publishes every create/update/delete to the `passport.change.stream` Kafka topic (best-effort — a Kafka outage never fails the request). |
| [`document/`](document/README.md) | 4003 | MongoDB (`document-service`) | Auth Service; S3 or MinIO | Upload, metadata update, delete, and presigned-download-link generation for arbitrary files (certificates, warranty PDFs, photos) tied to a battery passport. File bytes live in S3-compatible object storage; only metadata lives in MongoDB. Every route allows both roles, gated by document ownership (uploader or admin) rather than role alone. |
| [`notification/`](notification/README.md) | 4002 | none (stateless) | Kafka (optional); SMTP (optional) | Consumes `passport.change.stream` and emails a human-readable notification for every passport create/update/delete. The only service with no HTTP API beyond `/health` — it's a pure Kafka consumer. |

Every service that requires MongoDB gets its **own** database (`auth-service`, `passport-service`, `document-service`) — none of them share tables/collections or reach into another service's database directly.

## The one contract every service shares

Every endpoint in every service, success or error, returns the same envelope:

```json
{ "success": boolean, "message": "human-readable string", "data": <object|array|null> }
```

Built from the same `sendSuccess`/`sendError` (`src/utils/apiResponse.ts`) and `AppError`/`errorHandler` pattern in each service — copied deliberately, not shared as a library, so each service stays independently deployable with no shared runtime dependency. See any service's own `README.md`/`CLAUDE.md` for the details this file doesn't repeat.

Identity works the same way everywhere it's needed: a service with protected endpoints (`passport/`, `document/`) has **no `JWT_SECRET`** of its own — it forwards the caller's `Authorization: Bearer <token>` header to the Auth Service's `POST /api/auth/verify` and trusts the response. A `401` from that call means "this caller is unauthorized"; the Auth Service being unreachable is a distinct `503` ("the platform is degraded"), never conflated with the caller's own token being bad.

## Running everything

From this directory:

1. Copy each service's `.env.example` to `.env` (`authentication/.env`, `passport/.env`, `notification/.env`, `document/.env`) and fill in real secrets (`JWT_SECRET`, SMTP credentials, Kafka/Aiven certs if you want Kafka wired up — all optional except `JWT_SECRET`, see each service's own README).
2. `docker compose up --build`

This starts MongoDB, MinIO (S3-compatible storage, with a one-shot `minio-init` container that creates the bucket `document/` expects), and all four services, wired together via `docker-compose.yml`'s internal network — each service's `AUTH_SERVICE_URL`/`MONGO_URI`/`S3_ENDPOINT` are already pointed at the right containers, overriding whatever the `.env` file says for those specific vars.

| Endpoint | URL |
| --- | --- |
| Auth Service | `http://localhost:4000` |
| Passport Service | `http://localhost:4001` (Swagger: `/api-docs`) |
| Notification Service | `http://localhost:4002` (`/health` only) |
| Document Service | `http://localhost:4003` (Swagger: `/api-docs`) |
| MinIO console | `http://localhost:9001` (`minioadmin` / `minioadmin`) |

Kafka (Aiven, not part of `docker-compose.yml`) is optional end-to-end: leave `KAFKA_BROKER` blank in both `passport/.env` and `notification/.env` to run passport CRUD and document management with zero Kafka setup — you just won't get change-notification emails.

## A typical flow across services

1. `POST /api/auth/register` + `POST /api/auth/login` against the Auth Service → get a JWT.
2. `POST /api/passports` (admin) against the Passport Service, bearer token from step 1 → creates a passport, publishes a `passport.change.stream` event.
3. (If Kafka + SMTP are configured) the Notification Service consumes that event and emails a summary.
4. `POST /api/documents/upload` against the Document Service, same bearer token → uploads a supporting file (e.g. a warranty certificate) tied to that battery, independent of the passport record itself (no foreign-key style link is enforced between the two — a document just carries whatever `description` the caller gives it).
5. `GET /api/documents/:docId` → a presigned S3/MinIO URL to download that file directly, without proxying bytes through the service.

## Repo layout

```
authentication/   Auth Service — see authentication/README.md and authentication/CLAUDE.md
passport/         Passport Service — see passport/README.md and passport/CLAUDE.md
notification/     Notification Service — see notification/README.md and notification/CLAUDE.md
document/         Document Service — see document/README.md and document/CLAUDE.md
docker-compose.yml   MongoDB, MinIO (+ bucket init), and all four services wired together
CLAUDE.md            the original assignment spec this platform was built against
```

Each service's own `README.md` has full setup/API/architecture details; each `CLAUDE.md` documents that service's contract, the reasoning behind non-obvious decisions, and known gaps — read those before extending a service rather than re-deriving its conventions from scratch.
