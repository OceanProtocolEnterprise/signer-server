# Deployment

The signer server has separate Docker Compose configurations for each private
key storage mode:

- `docker-compose/local/docker-compose.yml` sets `SIGNER_MODE=local` and loads private keys from
  `PRIVATE_KEYS`.

Both configurations pull `oceanenterprise/signer-server:latest`, expose the
service on host port `8443` by default, and load the container environment from
`.env`.

## Prerequisites

Copy the environment template and replace every placeholder required by the
selected mode:

```bash
cp .env.example .env
```

## Environment Configuration

| Variable             | Required | Example / Default                | Description                                                                     |
| -------------------- | -------- | -------------------------------- | ------------------------------------------------------------------------------- |
| `NODE_URI_MAP`       | ✅ Yes   |                                  | Map of node URIs for the service                                                |
| `AUTHENTIK_JWKS_URI` | ✅ Yes   |                                  | JWKS endpoint URI for Authentik                                                 |
| `AUTHENTIK_ISSUER`   | ✅ Yes   |                                  | Issuer URL for Authentik JWT validation                                         |
| `AUTHENTIK_AUDIENCE` | ✅ Yes   |                                  | Expected audience claim for JWT tokens                                          |
| `SIGNER_SERVER_PORT` | ✅ Yes   | `8443`                           | HTTPS Host port mapping                                                         |
| `PORT`               | ✅ Yes   | `3001`                           | Internal port mapping (container always listens on `3001`)                      |
| `PRIVATE_KEYS`       | ✅ Yes   | `[{"walletId":1,"key":"0x..."}]` | JSON array of wallet private keys, each with a `walletId` and hex-encoded `key` |

Do not commit `.env`; it contains signing credentials or vault credentials and
is ignored by Git.

## Operations

Start the deployment:

```bash
docker compose -f docker-compose/local/docker-compose.yml pull
docker compose -f docker-compose/local/docker-compose.yml up -d
```

Use the same Compose file for every command, `docker-compose.yml` for an environment-backed deployment.

Validate configuration without starting a container:

```bash
docker compose -f docker-compose/local/docker-compose.yml config --quiet
```
