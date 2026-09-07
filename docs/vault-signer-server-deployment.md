# Signer Server Deployment in Vault Mode

The signer server has a Docker Compose configuration for vault model deployment:

- `docker-compose/vault/docker-compose.yml` sets `SIGNER_MODE=vault` and signs through an
  OpenBao instance.

This configuration pulls `oceanenterprise/signer-server:latest`, expose the
service on host port `8443` by default, and load the container environment from
`.env`.

## Prerequisites

- SSL certificates for HTTPS communication
- Install the `openssl` tool on the server dedicated to hosting the Signer Server with OpenBAO vault.

### TLS Communication between Signer Server and OpenBAO Vault

For secure communication using the HTTPS protocol, OpenBAO can import SSL certificates.
A simpler setup is to generate self-signed certificates with the `opensssl` tool.

Command for generating self-signed certificates:

```console
openssl req -x509 -newkey rsa:4096 -keyout ./openbao/certs/tls.key -out ./openbao/certs/tls.crt -days 365 -nodes \
  -subj "/CN=openbao" \
  -addext "subjectAltName=DNS:openbao,DNS:localhost,IP:127.0.0.1"
```

## Steps

1. Clone the repository from [github](https://github.com/OceanProtocolEnterprise/signer-server.git) using `git clone https://github.com/OceanProtocolEnterprise/signer-server.git`

2. Copy the environment template `.env.example` in `.env` and replace every placeholder:

```bash
cp .env.example .env
```

### Environment Configuration

| Variable               | Required    | Example / Default                                                                    | Description                                                |
| ---------------------- | ----------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `NODE_URI_MAP`         | ✅ Yes      | `[{"11155111":{"key":"https://eth-sepolia.g.alchemy.com/v2/<key>","multiplier":3}}]` | Map of node URIs for the service                           |
| `AUTHENTIK_JWKS_URI`   | ✅ Yes      | `https://ocean-node-vm1-stage.oceanenterprise.io:9443/application/o/oe-market/jwks/` | JWKS endpoint URI for Authentik                            |
| `AUTHENTIK_ISSUER`     | ✅ Yes      | `https://ocean-node-vm1-stage.oceanenterprise.io:9443/application/o/oe-market/`      | Issuer URL for Authentik JWT validation                    |
| `AUTHENTIK_AUDIENCE`   | ✅ Yes      |                                                                                      | Expected audience claim for JWT tokens                     |
| `SIGNER_PORT`          | ✅ Yes      | `8443`                                                                               | HTTPS Host port mapping                                    |
| `PORT`                 | ✅ Yes      | `3001`                                                                               | Internal port mapping (container always listens on `3001`) |
| `VAULT_URL`            | ✅ Yes      | `https://openbao:8200`                                                               | Base URL OpenBao instance                                  |
| `VAULT_ETHEREUM_MOUNT` | ✅ Yes      | `ethereum`                                                                           | Vault mount path for the Ethereum secrets engine           |
| `VAULT_KV_STORE_PATH`  | ✅ Yes      | `secret`                                                                             | Vault KV store mount path                                  |
| `VAULT_TIMEOUT_MS`     | ✅ Yes      | `10000`                                                                              | Vault request timeout in milliseconds                      |





3. Start the deployment:

```bash
cd signer-server/
docker compose -f docker-compose/vault/docker-compose.yml up -d
```

## Operations
To check `signer-server` logs:

```bash
docker compose -f docker-compose/vault/docker-compose.yml logs -f signer-server
```

To check `openbao` vault logs:

```bash
docker compose -f docker-compose/vault/docker-compose.yml logs -f openabo
```

To stop containers without erasing volumes:

```bash
docker compose -f docker-compose/vault/docker-compose.yml down
```

If you want to validate configuration without starting a container:

```bash
docker compose -f docker-compose/vault/docker-compose.yml config --quiet
```
