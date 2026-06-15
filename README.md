# Signer Service (NestJS)

Remote signing service for Ocean Enterprise with Authentik JWT authentication.

## Features

- Transaction signing and sending across configured networks
- Multiple local signer private keys selectable by wallet id
- Authentik OIDC JWT authentication (Bearer token)
- Swagger documentation at `/api`
- Docker & docker-compose ready
- Unit and e2e tests

## Setup

1. Copy `.env.example` to `.env` and fill values
2. Install dependencies: `npm install`
3. Run dev: `npm run start:dev`
4. Build: `npm run build`
5. Run production: `npm run start:prod`

## Environment

Set the signer mode with `SIGNER_MODE`. Local signers are configured with `PRIVATE_KEYS` as a JSON array:

```env
SIGNER_MODE=local
PRIVATE_KEYS=[{"walletId":10,"key":"0x..."}]
NODE_URI_MAP={"11155111":"https://<your-rpc-provider-url-and-key>"}
```

Each local signer must have a unique numeric `walletId` and a 32-byte hex private key. Endpoints that use the signer accept an optional `walletId`; when omitted, the first wallet from `PRIVATE_KEYS` is used.

OpenBao signer mode uses a Vault-compatible API and does not load private keys into this service:

```env
SIGNER_MODE=openbao
VAULT_URL=http://localhost:8200
VAULT_TOKEN=<vault-token>
VAULT_ETHEREUM_MOUNT=ethereum
VAULT_KV_STORE_PATH=secret
VAULT_TIMEOUT_MS=10000
NODE_URI_MAP={"11155111":"https://<your-rpc-provider-url-and-key>"}
```

In OpenBao mode, the wallet id is read from the request JWT `orgWalletId` unless an endpoint explicitly passes `walletId`. The service resolves the public wallet address with `GET /v1/{VAULT_KV_STORE_PATH}/data/wallets/by-id/{walletId}`, then signs with `POST /v1/{VAULT_ETHEREUM_MOUNT}/accounts/{walletAddress}/signRaw` for messages and `POST /v1/{VAULT_ETHEREUM_MOUNT}/accounts/{walletAddress}/sign` for transactions.

## HTTPS

Direct HTTPS is optional. Reverse proxy TLS offload remains supported without these variables. To run the signer service with HTTPS directly, configure both certificate paths:

```env
HTTP_CERT_PATH=/etc/ssl/certs/cert.pem
HTTP_KEY_PATH=/etc/ssl/certs/key.pem
```

If only one path is configured, or if the files cannot be loaded, the service logs a warning and starts with HTTP.

## Endpoints (all protected by JWT)

- `GET /address?walletId=10`
- `POST /sign-message`
- `POST /send-transaction`
- `GET /transaction/:hash`
- `GET /nonce?chainId=11155111&walletId=10`

## Testing

- Unit: `npm test`
- E2E: `npm run test:e2e`

# Install dependencies

npm install

# Copy environment variables

cp .env.example .env

# Edit .env with your actual values (private key, node URI map, Authentik URIs)

# Run in development

npm run start:dev

# Run unit tests

npm test

# Run e2e tests (requires a valid JWT from Authentik, or modify guard to allow test mode)

npm run test:e2e

# Build and run production

npm run build
npm run start:prod

# Docker

docker-compose up --build
