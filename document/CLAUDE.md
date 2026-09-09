# Document Service — context for future work

This file documents the Document Service's contract for whoever builds against it next. Read this before touching `s3Storage.ts`, `rbac.ts`, or the ownership check in `documentController.ts`.

## Standard response envelope (applies to every microservice)

Every endpoint — success or error — returns exactly this shape:

```json
{ "success": boolean, "message": "human-readable string", "data": <object|array|null> }
```

Implemented with `src/utils/apiResponse.ts` (`sendSuccess`/`sendError`) and `AppError`/`errorHandler`, copied verbatim from `authentication/` and `passport/` per the cross-service convention established there. No route calls `res.json(...)` directly.

## What this service owns

Storage of arbitrary files (certificates, warranty PDFs, photos) in S3-compatible object storage, plus their metadata in MongoDB. It does **not** own identity — no password hashing, no JWT signing, no `JWT_SECRET`. Every request's identity/role is established by calling the Auth Service, never decoded locally. It also does **not** proxy file bytes through itself for download — `GET /:docId` returns a presigned URL, and the client downloads directly from S3.

## Auth Service dependency

Identical contract to `passport/src/middleware/rbac.ts` — see that service's CLAUDE.md for the full rationale. Summary: `verifyAuth` calls `POST {AUTH_SERVICE_URL}/api/auth/verify` forwarding the incoming Bearer header; missing/malformed header → local `401`; Auth Service's own `401` → passed through as this service's `401`; Auth Service unreachable → **`503`**, not `401` — don't collapse these two.

**Do not add a `JWT_SECRET` to this service or decode tokens locally** — same reasoning as `passport/`: it would create a second source of truth for token validity.

## Authorization model: ownership, not admin-only

This is the one place this service's authorization differs from `passport/`'s pattern. Passport CRUD is admin-only by role; here, **every route allows both `admin` and `user`** (`authorize(ROLES.ADMIN, ROLES.USER)`), and then `assertOwnerOrAdmin` in `documentController.ts` checks `document.uploadedBy === req.user.userId || req.user.role === 'admin'`, throwing `403` otherwise. This was a deliberate design choice (not specified verbatim in the root `CLAUDE.md`, which only says "JWT-protected endpoints") to prevent one `user` from reading, renaming, or deleting another user's document simply by guessing/enumerating a Mongo `_id` — an IDOR risk that a bare role check wouldn't close. `uploadDocument` has no ownership check to make since the document doesn't exist yet; `uploadedBy` is always set to the caller, never client-supplied.

If a future requirement needs a "shared with" concept (multiple users legitimately owning one document), extend `assertOwnerOrAdmin`, don't bypass it.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/documents/upload` | admin or user | `multipart/form-data`, field `file` (required) + `description` (optional). `data: { document }`. |
| GET | `/api/documents/:docId` | owner or admin | `data: { document, downloadUrl, expiresInSeconds }`. `404` if not found, `403` if caller isn't the owner/admin, `400` if `:docId` isn't a valid Mongo ObjectId. |
| PUT | `/api/documents/:docId` | owner or admin | Metadata only — `{ originalName?, description? }`, at least one required. Does **not** accept a new file. `data: { document }`. |
| DELETE | `/api/documents/:docId` | owner or admin | Deletes the S3 object, then the Mongo record. `data: null` on success (still `200`, not `204` — a bodyless response can't carry the envelope). |

Full request/response examples: [README.md](README.md). Interactive docs: `GET /api-docs`.

## S3 integration (`src/config/s3.ts`, `src/utils/s3Storage.ts`)

Works unchanged against real AWS S3 or any S3-compatible store (MinIO, used in `docker-compose.yml` and tests):

- `S3_ENDPOINT` unset → talks to real AWS S3 using `S3_REGION` + `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY` (or the default AWS credential chain if those are unset).
- `S3_ENDPOINT` set (e.g. `http://minio:9000`) + `S3_FORCE_PATH_STYLE=true` → talks to that S3-compatible endpoint instead. MinIO needs path-style requests; real AWS S3 doesn't.

**Failure contract — every S3 SDK call is wrapped into `AppError('Unable to reach storage service', 503)`** (`uploadToS3`, `deleteFromS3`, `getPresignedDownloadUrl` in `s3Storage.ts`), mirroring the same "upstream dependency unreachable → 503" convention `passport/` uses for the Auth Service. Unlike Passport's Kafka publish (which is fire-and-forget, logged and swallowed), **S3 failures here are NOT swallowed** — they fail the request, because the S3 write/delete is the actual point of the endpoint (there's no separate "authoritative" data store the way Mongo is authoritative over Kafka in `passport/`).

**Delete ordering is deliberate**: `deleteDocument` calls `deleteFromS3` before `document.deleteOne()`. If the S3 delete throws, the Mongo record is left in place — an orphaned S3 object (cost) is a smaller problem than an orphaned Mongo record pointing at a file that no longer exists (broken downloads). Don't reverse this order.

**`s3Key` generation**: `documents/<crypto.randomUUID()>-<originalname>` in `uploadDocument` (`documentController.ts`), never derived from client input alone — prevents key collisions and path-traversal-via-filename concerns from ever reaching the S3 `Key`.

## GET returns a presigned URL, not a file stream

`getPresignedDownloadUrl` (`s3Storage.ts`) uses `@aws-sdk/s3-request-presigner`'s `getSignedUrl` — this does **not** make a network call; it signs a URL locally using the client's resolved credentials, valid for `PRESIGNED_URL_EXPIRY_SECONDS` (default 900s / 15 min). This is why the S3 client mock in tests (`aws-sdk-client-mock`, which intercepts `s3Client.send()`) doesn't need a case for `GetObjectCommand` — presigning never calls `.send()`. Don't switch this to actually streaming bytes through this service without reconsidering memory/bandwidth cost — the whole point of presigned URLs is that this service's process never touches the file body on download.

## Data model notes

`src/models/Document.ts` stores metadata only (`originalName`, `description?`, `mimeType`, `sizeBytes`, `s3Key`, `s3Bucket`, `uploadedBy`, `updatedBy`, timestamps) — never file bytes. `s3Key` has a `unique` index. `PUT` only ever touches `originalName`/`description`/`updatedBy` — it cannot change `s3Key`, `mimeType`, or `sizeBytes`, because those describe the object actually sitting in S3; changing them without re-uploading would make the metadata lie about the file. If a future requirement needs "replace this document's file," build it as delete-and-reupload (a new `s3Key`), not as a field on `PUT`.

## Required env vars

`PORT`, `MONGO_URI`, `AUTH_SERVICE_URL`, `AUTH_VERIFY_TIMEOUT_MS`, `LOG_LEVEL`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`, `S3_FORCE_PATH_STYLE`, `PRESIGNED_URL_EXPIRY_SECONDS`, `MAX_FILE_SIZE_MB`. See `.env.example`. No `JWT_SECRET`.

## Conventions kept consistent with `authentication/` and `passport/`

- Responses: `sendSuccess`/`AppError`+`errorHandler`. Wrap async controllers in `asyncHandler`.
- Validation: `express-validator` + the shared `validate` middleware → `AppError(msg, 400, { errors: [{field, message}] })`.
- `:docId` route params: validate with `param('docId').isMongoId()` through `validate`, not by catching a Mongoose `CastError`.
- Status codes: 201 create, 200 read/update/delete success, 400 validation, 401 auth failure, 403 ownership/role forbidden, 404 not found, 503 upstream dependency (Auth Service or S3) unreachable, 500 unhandled.
- Unmatched routes: catch-all 404 handler before `errorHandler`.
- TypeScript, `strict: true`, multi-stage Docker build (builder compiles, runtime ships `dist/` + prod deps only).
- Tests: `ts-jest` + `supertest` + `mongodb-memory-server` for the database (real, in-memory) — the **Auth Service HTTP call is mocked with `nock`**, and the **S3 client is mocked with `aws-sdk-client-mock`** (`tests/helpers/s3Mock.ts`), since both are genuine external service boundaries this service doesn't own.
- Winston logger (`src/config/logger.ts`) used everywhere instead of `console.*`.
- Swagger (`@swagger` JSDoc blocks colocated in route files, spec built from both `src/routes/*.ts` and `dist/routes/*.js`) kept current per endpoint.

## Deliberate deviation from the root CLAUDE.md spec

The root `CLAUDE.md` says JWT-protected endpoints without specifying roles (unlike Passport's explicit "admin-only create/update/delete"). This service interprets that as "any authenticated user may act on documents they own; admins may act on any document" (see Authorization model above) rather than restricting write operations to admins the way Passport does — a document is fundamentally something a `user` uploads for themselves, not an admin-curated record like a battery passport.

## Known gaps / not yet built

- **No Kafka events.** Unlike `passport/`'s `passport.change.stream`, document upload/update/delete do not publish anything. Not requested by the root spec for this service; revisit if Notification Service (or another consumer) needs to react to document lifecycle events.
- **No `GET /api/documents` list/search endpoint** — not requested. A user currently needs a document's `_id` (e.g. returned at upload time) to fetch, update, or delete it.
- **No virus/malware scanning on upload** — files are stored as-is. Fine for this assignment's scope; would matter before accepting untrusted uploads in a real production system.
- **No mime-type allowlist** — any content type is accepted, gated only by `MAX_FILE_SIZE_MB`. Not requested; add a `fileFilter` to `src/middleware/upload.ts` if the requirement appears.
- **No bucket-existence check at startup** — `docker-compose.yml`'s `minio-init` one-shot container creates the bucket for local dev; against real AWS S3, the bucket is assumed to already exist (an application shouldn't be provisioning its own S3 bucket in prod).
- **No CI (GitHub Actions)** — same gap as `authentication/` and `passport/`.
- **No rate limiting.**
- **No caching layer in front of `/api/auth/verify`** — same known gap as `passport/`.
