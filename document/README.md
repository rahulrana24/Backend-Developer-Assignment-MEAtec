# Document Service

Document upload, metadata, and download-link microservice for the Battery Passport platform. Owns storing arbitrary files (certificates, warranty PDFs, photos, etc.) in S3-compatible object storage and their metadata in MongoDB. It does **not** own identity — every request is authenticated by delegating to the Auth Service over HTTP, never by decoding a JWT locally.

## Stack

Node.js, Express, TypeScript, MongoDB (Mongoose) for metadata, AWS SDK v3 (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) for S3-compatible storage, multer (in-memory upload parsing), axios (Auth Service HTTP client), Winston (logging), swagger-jsdoc + swagger-ui-express (API docs).

## Setup

### Local (without Docker)

1. Requires Node 20+, a running MongoDB instance, a reachable Auth Service, and an S3-compatible endpoint (real AWS S3, or a local MinIO container).
2. `npm install`
3. Copy `.env.example` to `.env`. Point `MONGO_URI` at your local Mongo, `AUTH_SERVICE_URL` at your running Auth Service (e.g. `http://localhost:4000`), and the `S3_*` vars at your storage:
   - **Local MinIO**: `docker run -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=minioadmin -e MINIO_ROOT_PASSWORD=minioadmin minio/minio server /data --console-address ":9001"`, then create the `battery-passport-documents` bucket (via the console at `http://localhost:9001` or the `mc` CLI). Keep `S3_ENDPOINT=http://localhost:9000` and `S3_FORCE_PATH_STYLE=true`.
   - **Real AWS S3**: leave `S3_ENDPOINT` blank, set `S3_REGION`/`S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` to real credentials, and `S3_BUCKET` to a bucket you own.
4. `npm run dev` — starts the service with hot reload on `http://localhost:4003`.

### Docker

From the repo root (`MEAtec/`):

1. Copy `document/.env.example` to `document/.env`. Leave `MONGO_URI`/`AUTH_SERVICE_URL`/`S3_ENDPOINT`/`S3_FORCE_PATH_STYLE` alone — `docker-compose.yml` overrides them to point at the `mongo`, `auth-service`, and `minio` containers (a `minio-init` one-shot container creates the bucket automatically).
2. `docker compose up --build`
3. The service is available at `http://localhost:4003`; Swagger UI at `http://localhost:4003/api-docs`; the MinIO console at `http://localhost:9001` (`minioadmin`/`minioadmin`).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled service (`dist/server.js`) |
| `npm test` | Run the Jest suite against an in-memory MongoDB, with the Auth Service HTTP call mocked via `nock` and the S3 client mocked via `aws-sdk-client-mock` |

## Response format

Same envelope as every other service in this platform — every endpoint, success or error, returns:

```json
{
  "success": true,
  "message": "Human-readable description of the result",
  "data": {}
}
```

Built with the same `src/utils/apiResponse.ts` (`sendSuccess`/`sendError`) and `AppError`/`errorHandler` pattern used by `authentication/` and `passport/`.

## Authentication

This service has **no `JWT_SECRET`** and never decodes a token itself. The `verifyAuth` middleware ([src/middleware/rbac.ts](src/middleware/rbac.ts)) forwards the incoming `Authorization: Bearer <token>` header to the Auth Service's `POST /api/auth/verify`, and:

- On success, attaches `{ userId, email, role }` to `req.user`.
- On the Auth Service's own `401`, propagates it as this service's `401` with the same human-readable message.
- If the Auth Service can't be reached at all (network error or timeout — `AUTH_VERIFY_TIMEOUT_MS`), returns **`503` "Unable to reach authentication service"**.

A missing or malformed `Authorization` header is rejected locally with `401` before any network call is made.

### Authorization: ownership, not just role

Unlike the Passport Service (admin-only writes), every endpoint here is open to **both** `admin` and `user` roles — a document belongs to whoever uploaded it, not to a role. `GET`/`PUT`/`DELETE` additionally check that the caller is either the document's `uploadedBy` or an `admin`, returning `403` otherwise. This prevents one user from reading, renaming, or deleting another user's document just by guessing/enumerating a Mongo id.

## API Docs

Interactive Swagger UI (request/response schemas, try-it-out) is served at `GET /api-docs` once the service is running.

## API

All endpoints are under `/api/documents` and require `Authorization: Bearer <token>` (a token issued by the Auth Service).

### `POST /api/documents/upload` — admin or user

`multipart/form-data` with a `file` field (required) and an optional `description` field.

Responses: `201` `{ data: { document } }` · `400` missing file / validation failure · `401` no/invalid token · `503` Auth Service or storage service unreachable.

### `GET /api/documents/:docId` — owner or admin

Generates a time-limited presigned S3 download URL rather than proxying the file bytes through this service.

Responses: `200` `{ data: { document, downloadUrl, expiresInSeconds } }` · `400` malformed `:docId` · `401` · `403` caller is neither the uploader nor an admin · `404` not found · `503`.

### `PUT /api/documents/:docId` — owner or admin

Updates metadata only (`originalName` and/or `description`) — it does **not** accept a new file; re-upload as a new document instead. Body: `{ originalName?, description? }`, at least one field required.

Responses: `200` `{ data: { document } }` (with `updatedBy` set to the caller) · `400` · `401` · `403` · `404` · `503`.

### `DELETE /api/documents/:docId` — owner or admin

Deletes the S3 object first, then the MongoDB record — if the S3 delete fails, the metadata record is left intact rather than pointing at nothing.

Responses: `200` `{ data: null }` · `400` · `401` · `403` · `404` · `503` (S3 delete failed — record NOT deleted).

Any unmatched route returns the same envelope with `404`.

## Storage model

`src/models/Document.ts` stores metadata only — never the file bytes:

```json
{
  "_id": "66b1f0c9e1a2b3c4d5e6f7a8",
  "originalName": "warranty-certificate.pdf",
  "description": "Signed warranty certificate for BP-2024-011",
  "mimeType": "application/pdf",
  "sizeBytes": 204800,
  "s3Key": "documents/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d-warranty-certificate.pdf",
  "s3Bucket": "battery-passport-documents",
  "uploadedBy": "...",
  "updatedBy": "...",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

`s3Key` is generated server-side as `documents/<uuid>-<originalFileName>` (`crypto.randomUUID()`) — never derived from client input alone, so two uploads of a file with the same name never collide.

## Environment variables

See [`.env.example`](.env.example): `PORT`, `MONGO_URI`, `AUTH_SERVICE_URL`, `AUTH_VERIFY_TIMEOUT_MS`, `LOG_LEVEL`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `PRESIGNED_URL_EXPIRY_SECONDS`, `MAX_FILE_SIZE_MB`. No `JWT_SECRET` (see Authentication above).

## Logging

Centralized Winston logger ([src/config/logger.ts](src/config/logger.ts)) — colorized console output in development, JSON in production. Every HTTP request is logged (method, path, status, duration) and every error caught by `errorHandler` is logged with its stack trace. Writes to `logs/error.log` and `logs/combined.log` outside of tests (skipped under `NODE_ENV=test`).

## Architecture

```
src/
  server.ts             entry point — loads env, connects Mongo, starts Express
  app.ts                 express app + middleware wiring, mounts Swagger UI
  config/
    db.ts                  mongoose connection
    logger.ts               winston logger
    s3.ts                    S3Client construction (real AWS S3 or MinIO via S3_ENDPOINT)
    swagger.ts               builds/mounts the OpenAPI spec
    swaggerSchemas.ts        reusable OpenAPI component schemas (JSDoc only)
  models/Document.ts      file metadata schema — never stores file bytes
  controllers/             upload / getById / updateMetadata / delete handlers, ownership checks
  routes/                  /api/documents/* routes, with @swagger JSDoc per route
  middleware/
    rbac.ts                  verifyAuth (HTTP call to Auth Service) + authorize (role check)
    upload.ts                 multer memory-storage config (file size limit)
    requestLogger.ts          winston-based HTTP request logging
    errorHandler.ts, asyncHandler.ts, validate.ts   same pattern as authentication/ and passport/,
                                                      errorHandler.ts additionally maps multer errors to 400
  validators/              express-validator rules for upload/update bodies and :docId
  utils/
    apiResponse.ts, AppError.ts   same envelope pattern as authentication/ and passport/
    authServiceClient.ts           axios instance pointed at AUTH_SERVICE_URL
    s3Storage.ts                    upload / delete / presigned-URL helpers, wraps S3 errors as 503
  constants/roles.ts       shared ROLES/Role/ALL_ROLES
  types/                   AuthenticatedUser, req.user augmentation
```

See [CLAUDE.md](CLAUDE.md) for this service's contract and known gaps.
