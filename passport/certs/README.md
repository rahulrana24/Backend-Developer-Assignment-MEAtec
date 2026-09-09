# Aiven Kafka certificates

This service authenticates to Aiven Kafka with mTLS. Download these three files from the Aiven console (**your Kafka service → Overview → "Access Certificate" / "Access Key" / "CA Certificate"**) and place them in this directory:

- `ca.pem` — CA Certificate
- `service.cert` — Access Certificate
- `service.key` — Access Key

None of these are committed to git (`*.pem`, `*.cert`, `*.key` are gitignored here) — this file is the only tracked thing in this directory.

The default paths in [`.env.example`](../.env.example) (`KAFKA_SSL_CA_PATH`, `KAFKA_SSL_CERT_PATH`, `KAFKA_SSL_KEY_PATH`) already point here (`./certs/...`), resolved relative to the service root. That works both locally (`npm run dev` from `passport/`) and in Docker, where `docker-compose.yml` mounts this directory into the container at `/app/certs` (the container's working directory is `/app`), read-only.

If `KAFKA_BROKER` is left unset, the producer never connects and these files aren't read at all — passport create/update/delete still work, they just don't publish events.
