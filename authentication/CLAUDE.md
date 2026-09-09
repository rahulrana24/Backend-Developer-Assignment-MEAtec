# Auth Service — context for future work

This file documents the Auth Service's contract for whoever builds against it next (a future session, or the Passport/Document services described in the root [`CLAUDE.md`](../CLAUDE.md)). Read this before wiring another service's JWT verification against it.

## Standard response envelope (applies to every microservice, not just this one)

Every endpoint in every service — success or error — must return exactly this shape, no exceptions:

```json
{ "success": boolean, "message": "human-readable string", "data": <object|array|null> }
```

- `success`: `true` for 2xx, `false` for 4xx/5xx.
- `message`: always present, human-readable.
- `data`: the payload on success; `null` on error unless there's structured detail worth returning (e.g. field-level validation errors).

This service implements it with two helpers in `src/utils/apiResponse.ts` — `sendSuccess(res, statusCode, message, data)` and `sendError(res, statusCode, message, data)` — called from every controller and from the centralized `errorHandler` (via `AppError`, which now carries an optional `data` payload alongside `message`/`statusCode`). **Copy this exact pattern (`apiResponse.ts`, `AppError`, `errorHandler`) into the Passport and Document services rather than inventing a new one** — a shared envelope only holds if every service emits it the same way. No route should ever call `res.json(...)` directly.

## What this service owns

User identity: registration, login, password hashing (bcrypt), JWT issuance and verification, and the `admin`/`user` role enum. It is the single source of truth for "who is this caller and what role do they have" — no other service should re-implement password checking or issue its own tokens.

## Integration contract for other services

To check a caller's identity from another service (e.g. Passport Service's admin-only create/update/delete), call:

```
POST /api/auth/verify
Authorization: Bearer <jwt from the client>
```

- No request body.
- `200` response: `{ "success": true, "message": "Token verified successfully", "data": { "userId": string, "email": string, "role": "admin" | "user" } }`
- `401` for any invalid state: missing header, malformed header, bad signature, expired token — response is `{ "success": false, "message": "...", "data": null }`. Treat `401` from this endpoint as "reject the caller's request with 401," not as a retryable error.

The JWT payload signed at login is exactly `{ userId, email, role }` (see `src/utils/jwt.ts`) — the same shape returned by `/verify`. Don't decode the JWT locally in another service; call `/verify` so the auth service stays the single point of trust for token validation and can rotate `JWT_SECRET` without every consumer needing to know it.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | none | Create a user. Body: `{ email, password, role }`. `data: { user }`. Does not return a token — call `/login` next. |
| POST | `/api/auth/login` | none | Body: `{ email, password }`. `data: { token, user }`. |
| POST | `/api/auth/verify` | Bearer token | No body. `data: { userId, email, role }`. |

All three responses are wrapped in the standard envelope described above — `data` here refers to the envelope's `data` field, not the raw response body.

Full request/response examples are in [README.md](README.md).

## Required env vars

`MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `PORT`. See `.env.example`. `JWT_SECRET` must be the same value used everywhere a token from this service needs to be trusted — if another service ever needs to verify tokens itself instead of calling `/verify`, it needs this same secret via a shared env/secrets mechanism (not yet built — currently `/verify` is the only supported path).

## Conventions to keep consistent across the other services when they're built

- Responses: every success path calls `sendSuccess`, every error path throws `AppError(message, statusCode, data?)` and lets the centralized `errorHandler` call `sendError` — see the envelope section above. Wrap async controllers in `asyncHandler` rather than try/catch.
- Validation: `express-validator` rules per route, checked by a shared `validate` middleware that turns validation failures into a 400 `AppError` with `data.errors` as an array of `{ field, message }`.
- Unmatched routes: a catch-all 404 handler registered after all routes (before `errorHandler`) returns the standard error envelope — never let Express fall through to its default HTML 404.
- Status codes: 201 create, 200 read/action success, 400 validation, 401 auth failure, 403 role forbidden, 409 conflict (duplicate), 500 unhandled.
- TypeScript throughout, `strict: true`, compiled to `dist/` for the Docker runtime image (see `Dockerfile`'s multi-stage build — builder compiles, runtime stage only ships `dist/` + prod deps).
- Tests: `ts-jest` + `supertest` + `mongodb-memory-server`, no mocking of Mongoose — tests run against a real (in-memory) MongoDB. See `tests/`.

## Known gaps / not yet built

- No refresh tokens — a JWT is valid until `JWT_EXPIRES_IN` elapses, no logout/revocation mechanism.
- No rate limiting on `/login` or `/register`.
- No password reset flow.
- Swagger/OpenAPI docs, Winston structured logging, and CI (GitHub Actions) are called out as bonus items in the root CLAUDE.md and haven't been done yet for this service.
