# Battery Passport Microservices Assignment

Build a production-quality microservices backend using Node.js, Express, MongoDB, Kafka, AWS S3-compatible storage, and Docker.

## Services

### Auth Service
- User registration/login with bcrypt and JWT.
- Roles: `admin`, `user`.
- JWT verification and role-based middleware.
- Endpoints: `/api/auth/register`, `/api/auth/login`.

### Passport Service
- CRUD for Battery Passports.
- Admin-only create/update/delete; admin/user read.
- Verify JWT via Auth Service HTTP communication.
- Publish Kafka events:
  - `passport.created`
  - `passport.updated`
  - `passport.deleted`

### Document Service
- Upload files to S3-compatible storage.
- Store file metadata in MongoDB.
- JWT-protected endpoints.
- Support upload, metadata update, delete, and presigned download URLs.

### Notification Service
- Kafka consumer for passport events.
- Send notifications using Nodemailer or console/file logging.

## Requirements
- Each service runs independently in Docker.
- Use Docker Compose for MongoDB, Kafka, S3/MinIO, and services.
- Use `.env` for configuration/secrets.
- Implement validation, async/await, centralized error handling, and proper HTTP status codes.
- Maintain clean modular architecture.

## Bonus
Swagger, Winston logging, Jest tests, GitHub Actions CI.

Include a comprehensive README covering setup, APIs, architecture, Kafka topics, and event payloads.
