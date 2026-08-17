# Deployment

The signer server has separate Docker Compose configurations for each private
key storage mode:

- `docker-compose/vault/docker-compose.yml` sets `SIGNER_MODE=vault` and signs through an
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

Install `openssl` tool on server dedicated to host Signer Server with OpenBAO vault.

## Environment Configuration

| Variable               | Required    | Example / Default      | Description                                                |
| ---------------------- | ----------- | ---------------------- | ---------------------------------------------------------- |
| `NODE_URI_MAP`         | ✅ Yes      |                        | Map of node URIs for the service                           |
| `AUTHENTIK_JWKS_URI`   | ✅ Yes      |                        | JWKS endpoint URI for Authentik                            |
| `AUTHENTIK_ISSUER`     | ✅ Yes      |                        | Issuer URL for Authentik JWT validation                    |
| `AUTHENTIK_AUDIENCE`   | ✅ Yes      |                        | Expected audience claim for JWT tokens                     |
| `SIGNER_PORT`          | ✅ Yes      | `8443`                 | HTTPS Host port mapping                                    |
| `PORT`                 | ✅ Yes      | `3001`                 | Internal port mapping (container always listens on `3001`) |
| `VAULT_URL`            | ✅ Yes      | `https://openbao:8200` | Base URL OpenBao instance                                  |
| `VAULT_ETHEREUM_MOUNT` | ✅ Yes      | `ethereum`             | Vault mount path for the Ethereum secrets engine           |
| `VAULT_KV_STORE_PATH`  | ✅ Yes      | `secret`               | Vault KV store mount path                                  |
| `VAULT_TIMEOUT_MS`     | ➖ Optional | `10000`                | Vault request timeout in milliseconds                      |

Do not commit `.env`; it contains signing credentials or vault credentials and
is ignored by Git.

## TLS Communication between Signer Server and OpenBAO Vault

For secure communication using HTTPS protocol, OpenBAO can import SSL certificates.
Simpler setup is to generate self-signed certificates with `opensssl` tool.

Command for generating self-signed certificates:

```console
openssl req -x509 -newkey rsa:4096 -keyout ./openbao/certs/tls.key -out ./openbao/certs/tls.crt -days 365 -nodes \
  -subj "/CN=openbao" \
  -addext "subjectAltName=DNS:openbao,DNS:localhost,IP:127.0.0.1"
```

## Operations

Start the deployment:

```bash
docker compose -f docker-compose/vault/docker-compose.yml pull
docker compose -f docker-compose/vault/docker-compose.yml up -d
```

Use the same Compose file for every command. For example, for the vault-backed
deployment:

```bash
docker compose -f docker-compose/vault/docker-compose.yml logs -f signer-server
docker compose -f docker-compose/vault/docker-compose.yml down
```
