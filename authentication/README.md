# Auth Service

Authentication microservice for the Battery Passport platform. Handles user registration, login, and JWT issuance/verification for role-based access control (`admin`, `user`). Other services (Passport Service, Document Service) call `POST /api/auth/verify` to check a caller's identity and role — this service does not delegate that check to anyone else.

## Stack

Node.js, Express, TypeScript, MongoDB (Mongoose), JWT (`jsonwebtoken`), bcrypt.

## Setup

### Local (without Docker)

1. Requires Node 20+ and a running MongoDB instance.
2. `npm install`
3. Copy `.env.example` to `.env` and fill in `MONGO_URI` (pointing at your local Mongo) and a real `JWT_SECRET`.
4. `npm run dev` — starts the service with hot reload on `http://localhost:4000`.

### Docker

From the repo root (`MEAtec/`):

1. Copy `authentication/.env.example` to `authentication/.env` and set a real `JWT_SECRET`. Leave `MONGO_URI` alone — `docker-compose.yml` overrides it to point at the `mongo` container.
2. `docker compose up --build`
3. The service is available at `http://localhost:4000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run with hot reload (`ts-node-dev`) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run the compiled service (`dist/server.js`) |
| `npm test` | Run the Jest suite against an in-memory MongoDB |

## Response format

Every endpoint — success or error — returns the same envelope:

```json
{
  "success": true,
  "message": "Human-readable description of the result",
  "data": {}
}
```

- `success` — `true` for 2xx, `false` for 4xx/5xx.
- `message` — always a human-readable string.
- `data` — the payload on success (object, array, or `null`); `null` on error unless the error carries structured detail (e.g. field-level validation errors under `data.errors`).

Built with two helpers in [`src/utils/apiResponse.ts`](src/utils/apiResponse.ts) — `sendSuccess(res, statusCode, message, data)` and `sendError(res, statusCode, message, data)` — used by every controller and by the centralized error handler, so no route hand-rolls `res.json(...)`.

## API

All request/response bodies are JSON. All endpoints are under `/api/auth`.

### `POST /api/auth/register`

Creates a new user. Passwords are hashed with bcrypt before storage — the plaintext password is never persisted.

Request:
```json
{
  "email": "advisor@dealer.example.com",
  "password": "at-least-8-characters",
  "role": "user"
}
```

`role` must be `"admin"` or `"user"`.

Responses:
- `201` — user created:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "data": { "user": { "id": "...", "email": "advisor@dealer.example.com", "role": "user" } }
  }
  ```
- `400` — validation failure (bad email, short password, invalid role); `data.errors` is an array of `{ field, message }`
- `409` — a user with that email already exists

### `POST /api/auth/login`

Request:
```json
{ "email": "advisor@dealer.example.com", "password": "at-least-8-characters" }
```

Responses:
- `200`:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "token": "<jwt>",
      "user": { "id": "...", "email": "advisor@dealer.example.com", "role": "user" }
    }
  }
  ```
- `400` — validation failure
- `401` — unknown email or wrong password

### `POST /api/auth/verify`

Used by other services to verify a bearer token and read the caller's role. No request body — the token is passed via the `Authorization` header.

Request headers:
```
Authorization: Bearer <jwt>
```

Responses:
- `200`:
  ```json
  {
    "success": true,
    "message": "Token verified successfully",
    "data": { "userId": "...", "email": "advisor@dealer.example.com", "role": "user" }
  }
  ```
- `401` — missing/malformed header, invalid signature, or expired token

Any unmatched route returns the same envelope with `404` and `success: false`.

## Environment variables

See [`.env.example`](.env.example). Notably: `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, `PORT`.

## Architecture

```
src/
  server.ts        entry point — loads env, connects Mongo, starts Express
  app.ts            express app + middleware wiring
  config/db.ts      mongoose connection
  models/User.ts    email, passwordHash, role
  controllers/      register / login / verify handlers
  routes/           /api/auth/* route definitions
  middleware/        asyncHandler, centralized errorHandler, express-validator
                      result checker, authenticate/authorize (JWT + RBAC)
  validators/        request body validation rules
  utils/              jwt sign/verify, AppError (operational error class),
                      apiResponse (sendSuccess/sendError envelope helpers)
  constants/roles.ts  ROLES enum shared across the codebase
  types/express.d.ts  augments Express.Request with req.user
```

Errors are thrown as `AppError(message, statusCode, data?)` from controllers/middleware and caught by the centralized `errorHandler`, which turns them into the standard error envelope via `sendError`. Anything unexpected falls through as a `500`.

See [CLAUDE.md](CLAUDE.md) for the contract other services should rely on when integrating with this one.
