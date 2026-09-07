# Signer Server Deployment in Local Mode

The signer server has a Docker Compose configuration for local mode deployment:

- `docker-compose/local/docker-compose.yml` sets `SIGNER_MODE=local` and loads private keys from
  `PRIVATE_KEYS` environment variable.

The configuration pulls `oceanenterprise/signer-server:latest`, expose the
service on host port `8443` by default, and load the container environment from
`.env`.

## Steps

1. Clone the repository from [github](https://github.com/OceanProtocolEnterprise/signer-server.git) using `git clone https://github.com/OceanProtocolEnterprise/signer-server.git`

2. Copy the environment template `.env.example` in `.env` and replace every placeholder:

```bash
cp .env.example .env
```

### Environment Configuration

| Variable             | Required | Example / Default                                                                    | Description                                                                     |
| -------------------- | -------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `NODE_URI_MAP`       | ✅ Yes   | `[{"11155111":{"key":"https://eth-sepolia.g.alchemy.com/v2/<key>","multiplier":3}}]` | Map of node URIs for the service                                                |
| `AUTHENTIK_JWKS_URI` | ✅ Yes   | `https://ocean-node-vm1-stage.oceanenterprise.io:9443/application/o/oe-market/jwks/` | JWKS endpoint URI for Authentik                                                 |
| `AUTHENTIK_ISSUER`   | ✅ Yes   | `https://ocean-node-vm1-stage.oceanenterprise.io:9443/application/o/oe-market/`      | Issuer URL for Authentik JWT validation                                         |
| `AUTHENTIK_AUDIENCE` | ✅ Yes   |                                                                                      | Expected OIDC provider client ID from Central Identity Provider                 |
| `SIGNER_SERVER_PORT` | ✅ Yes   | `8443`                                                                               | HTTPS Host port mapping                                                         |
| `PORT`               | ✅ Yes   | `3001`                                                                               | Internal port mapping (container always listens on `3001`)                      |
| `PRIVATE_KEYS`       | ✅ Yes   | `[{"walletId":1,"key":"0x..."}, {"walletId":2,"key":"0x..."}]`                       | JSON array of wallet private keys, each with a `walletId` and hex-encoded `key` |



3. Start the deployment:

```bash
cd signer-server/
docker compose -f docker-compose/local/docker-compose.yml up -d
```

## Operations
If you want to validate configuration without starting a container:

```bash
docker compose -f docker-compose/local/docker-compose.yml config --quiet
```
