# Aiven Kafka CA certificate

This service consumes from the same Aiven Kafka cluster `passport-service` publishes to, over **SASL_SSL** (SCRAM-SHA-256 username/password — see `KAFKA_SASL_USERNAME`/`KAFKA_SASL_PASSWORD` in [`.env.example`](../.env.example)), not mTLS. A CA certificate is still required to verify the broker's TLS certificate during the handshake, even though there's no client certificate/key involved anymore.

Download it from the Aiven console (**your Kafka service → Overview → "CA Certificate"**) and place it here as:

- `ca.pem`

This can be the **same file** used by `passport/certs/ca.pem` — it's the same Aiven Kafka cluster, and a CA certificate has no per-user identity baked into it (unlike a client certificate). Not committed to git (`*.pem` is gitignored here) — this file is the only tracked thing in this directory.

The default path in [`.env.example`](../.env.example) (`KAFKA_SSL_CA_PATH`) points here (`./certs/ca.pem`), resolved relative to the service root — works both locally and in Docker (`docker-compose.yml` mounts this directory into the container at `/app/certs`, read-only).

If `KAFKA_BROKER` is left unset, the consumer never connects and this file isn't read — the service still starts and `/health` still works, it just never receives passport events.
