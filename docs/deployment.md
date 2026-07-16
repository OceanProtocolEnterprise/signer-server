# Deployment

The signer server has separate Docker Compose configurations for each private
key storage mode:

- `docker-compose.local.yml` sets `SIGNER_MODE=local` and loads private keys from
  `PRIVATE_KEYS`.
- `docker-compose.vault.yml` sets `SIGNER_MODE=vault` and signs through an
  OpenBao instance.

Both configurations pull `oceanenterprise/signer-server:latest`, expose the
service on host port `8443` by default, and load the container environment from
`.env`.

## Prerequisites

Copy the environment template and replace every placeholder required by the
selected mode:

```bash
cp .env.example .env
```

The common required variables are `NODE_URI_MAP`, `AUTHENTIK_JWKS_URI`,
`AUTHENTIK_ISSUER`, and `AUTHENTIK_AUDIENCE`. Set `SIGNER_PORT` to change the
host port. The application always listens on port `3001` inside the container.

Do not commit `.env`; it contains signing credentials or vault credentials and
is ignored by Git.

## Environment-backed private keys

Set `PRIVATE_KEYS` to a JSON array. Every entry must have a positive, unique
`walletId` and a 32-byte hex private key:

```env
PRIVATE_KEYS=[{"walletId":1,"key":"0x..."}]
```

Start the deployment:

```bash
docker compose -f docker-compose.local.yml pull
docker compose -f docker-compose.local.yml up -d
```

## OpenBao-backed private keys

Configure the OpenBao connection:

```env
VAULT_URL=http://openbao:8200
VAULT_TOKEN=<VAULT_TOKEN>
VAULT_ETHEREUM_MOUNT=ethereum
VAULT_KV_STORE_PATH=secret
VAULT_TIMEOUT_MS=10000
```

`VAULT_URL` must resolve and be reachable from the signer-server container. If
OpenBao runs in another Compose project, attach both services to a shared Docker
network and use its service name. If it runs on the Docker host, use the host
address supported by your Docker installation instead of `localhost`.

The token must be scoped to only the Ethereum signing and key-value paths the
signer server needs. Rotate it according to the deployment's secret-management
policy.

Start the deployment:

```bash
docker compose -f docker-compose.vault.yml pull
docker compose -f docker-compose.vault.yml up -d
```

## Operations

Use the same Compose file for every command. For example, for the vault-backed
deployment:

```bash
docker compose -f docker-compose.vault.yml logs -f signer-server
docker compose -f docker-compose.vault.yml down
```

Substitute `docker-compose.local.yml` for an environment-backed deployment.

Validate configuration without starting a container:

```bash
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.vault.yml config --quiet
```
