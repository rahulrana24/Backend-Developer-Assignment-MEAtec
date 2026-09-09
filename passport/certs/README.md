# Aiven Kafka CA certificate

This service authenticates to Aiven Kafka over **SASL_SSL** (SCRAM-SHA-256 username/password — see `KAFKA_SASL_USERNAME`/`KAFKA_SASL_PASSWORD` in [`.env.example`](../.env.example)), not mTLS. A CA certificate is still required to verify the broker's TLS certificate during the handshake, even though there's no client certificate/key involved anymore.

Download it from the Aiven console (**your Kafka service → Overview → "CA Certificate"**) and place it here as:

- `ca.pem`

Not committed to git (`*.pem` is gitignored here) — this file is the only tracked thing in this directory.

The default path in [`.env.example`](../.env.example) (`KAFKA_SSL_CA_PATH`) already points here (`./certs/ca.pem`), resolved relative to the service root. That works both locally (`npm run dev` from `passport/`) and in Docker, where `docker-compose.yml` mounts this directory into the container at `/app/certs` (the container's working directory is `/app`), read-only.

If `KAFKA_BROKER` is left unset, the producer never connects and this file isn't read at all — passport create/update/delete still work, they just don't publish events.
