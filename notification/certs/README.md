# Aiven Kafka certificates

This service consumes from the same Aiven Kafka cluster `passport-service` publishes to, over mTLS. Download the three files from the Aiven console (**your Kafka service → Overview → "Access Certificate" / "Access Key" / "CA Certificate"**) and place them here:

- `ca.pem` — CA Certificate
- `service.cert` — Access Certificate
- `service.key` — Access Key

These can be the **same three files** used by `passport/certs/` if your Aiven project uses one shared client identity for the whole Kafka service. If your Aiven setup provisions separate service users per client (for per-consumer ACLs), use this consumer's own certificate set instead — either way, none of these files are committed to git (`*.pem`, `*.cert`, `*.key` are gitignored; this README is the only tracked file here).

The default paths in [`.env.example`](../.env.example) (`KAFKA_SSL_CA_PATH`, `KAFKA_SSL_CERT_PATH`, `KAFKA_SSL_KEY_PATH`) point here (`./certs/...`), resolved relative to the service root — works both locally and in Docker (`docker-compose.yml` mounts this directory into the container at `/app/certs`, read-only).

If `KAFKA_BROKER` is left unset, the consumer never connects and these files aren't read — the service still starts and `/health` still works, it just never receives passport events.
