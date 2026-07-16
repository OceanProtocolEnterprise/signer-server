# Signer Service

Remote signing service built with NestJS for Ocean Enterprise. The service provides authenticated blockchain signing operations using Authentik JWT authentication and supports multiple chains through configurable RPC endpoints.

---

## Features

- Authentik JWT authentication
- Remote message signing
- Remote transaction signing and broadcasting
- Multi-chain support
- Swagger API documentation
- Docker support
- Unit tests
- End-to-end tests
- ESLint + Prettier
- TypeScript strict mode
- GitHub Actions CI/CD
- CodeQL security scanning

---

# Architecture

```text
src/
├── auth/
│   ├── strategies/
│   └── auth.module.ts
│
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   └── interceptors/
│
├── config/
│   ├── configuration.ts
│   └── validation.ts
│
├── signer/
│   ├── dto/
│   ├── interfaces/
│   ├── signer.controller.ts
│   ├── signer.service.ts
│   └── signer.module.ts
│
├── app.module.ts
└── main.ts

test/
└── e2e/
```

---

# Authentication

All API endpoints are protected by Authentik JWT authentication through a global guard.

The guard validates:

- JWT signature
- JWKS endpoint
- Issuer
- Audience
- `upstream_idp` claim matches `UPSTREAM_IDP`

Public routes can be marked with the `@Public()` decorator.

---

# Environment Variables

Copy `.env.example` to `.env`, then configure one signer mode. The Compose files
override `SIGNER_MODE`; direct Node.js deployments read it from `.env`.

For environment-backed keys:

```env
SIGNER_MODE=local
PRIVATE_KEYS=[{"walletId":1,"key":"0x..."}]
```

For OpenBao-backed keys:

```env
SIGNER_MODE=vault
VAULT_URL=http://openbao:8200
VAULT_TOKEN=<VAULT_TOKEN>
VAULT_ETHEREUM_MOUNT=ethereum
VAULT_KV_STORE_PATH=secret
VAULT_TIMEOUT_MS=10000
```

Both modes require the shared service configuration:

```env
NODE_URI_MAP=[
  {
    "11155111": {
      "key": "https://eth-sepolia.g.alchemy.com/v2/<ALCHEMY_API_KEY>",
      "multiplier": 3
    }
  },
  {
    "11155420": {
      "key": "https://opt-sepolia.g.alchemy.com/v2/<ALCHEMY_API_KEY>",
      "multiplier": 2
    }
  },
  {
    "10": {
      "key": "https://opt-mainnet.g.alchemy.com/v2/<ALCHEMY_API_KEY>",
      "multiplier": 1.5
    }
  },
  {
    "1": {
      "key": "https://eth-mainnet.g.alchemy.com/v2/<ALCHEMY_API_KEY>",
      "multiplier": 2
    }
  }
]

If `multiplier` is omitted, the service uses built-in defaults for these chains:
Sepolia `11155111` = `3`, OP Sepolia `11155420` = `2`, OP Mainnet `10` = `1.5`, Ethereum Mainnet `1` = `2`.

AUTHENTIK_JWKS_URI=https://example.com/jwks/
AUTHENTIK_ISSUER=https://example.com/
AUTHENTIK_AUDIENCE=client-id
UPSTREAM_IDP=participant-idp
ALLOWED_ORIGINS=['https://market-git-feat-stage-ocean-enterprise.vercel.app','https://wallet-dev-stage.oceanenterprise.io']

PORT=3001
NODE_ENV=development
```

`ALLOWED_ORIGINS` is optional. When unset, origin checks are disabled.
When set, use an array of origins.
Requests without a matching `Origin` header are rejected with `403`
before JWT validation.

---

# Installation

Install dependencies:

```bash
npm install
```

---

# Development

Run in watch mode:

```bash
npm run start:dev
```

Application:

```text
http://localhost:3001/api/v1
```

Swagger:

```text
http://localhost:3001/api
```

---

# Code Quality

Lint project:

```bash
npm run lint
```

Auto-fix lint issues:

```bash
npm run lint:fix
```

Format code:

```bash
npm run format
```

Type checking:

```bash
npm run typecheck
```

---

# Testing

## Unit Tests

Run:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

---

## End-to-End Tests

Run:

```bash
npm run test:e2e
```

Current e2e suite validates:

- JWT protection
- Unauthorized access rejection
- Public endpoints
- Controller integration

---

## Coverage

Generate coverage report:

```bash
npm run test:cov
```

Coverage output:

```text
coverage/
```

Current CI requires:

```text
Statements: 70%
Branches: 70%
Functions: 70%
Lines: 70%
```

Configured in:

```json
coverageThreshold
```

inside `package.json`.

---

# Build

Before building, the project automatically performs:

1. ESLint validation
2. TypeScript type checking

Build command:

```bash
npm run build
```

Equivalent flow:

```bash
npm run lint
npm run typecheck
nest build
```

Compiled output:

```text
dist/
```

Run production build:

```bash
npm run start:prod
```

---

# Docker

Build image:

```bash
docker build -t signer-service .
```

Run container:

```bash
docker run \
  --env-file .env \
  -p 3001:3001 \
  signer-service
```

---

# Docker Compose

Two Compose files are provided for the supported deployment variants. Both load
shared configuration from `.env` and override `SIGNER_MODE` for their respective
storage mode.

Start the environment-backed signer:

```bash
docker compose -f docker-compose.local.yml pull
docker compose -f docker-compose.local.yml up -d
```

Start the OpenBao-backed signer:

```bash
docker compose -f docker-compose.vault.yml pull
docker compose -f docker-compose.vault.yml up -d
```

Use the same file to view logs or stop a deployment:

```bash
docker compose -f docker-compose.local.yml logs -f signer-server
docker compose -f docker-compose.local.yml down
```

See [Deployment](docs/deployment.md) for prerequisites, OpenBao networking, and
configuration validation.

---

# API Endpoints

Protected routes require:

```http
Authorization: Bearer <jwt>
```

Endpoints:

```http
GET    /api/v1/address
GET    /api/v1/nonce
GET    /api/v1/transaction/:hash

POST   /api/v1/sign-message
POST   /api/v1/send-transaction
```

Swagger documentation:

```text
/api
```

---

# Adding New Modules

Generate a module:

```bash
nest g module organization
```

Generate a controller:

```bash
nest g controller organization
```

Generate a service:

```bash
nest g service organization
```

Example future modules:

```text
src/
├── organization/
├── wallet/
├── vault/
├── policies/
├── audit/
└── signer/
```

Each module should contain:

```text
module
controller
service
dto
interfaces
tests
```

---

# CI/CD

GitHub Actions automatically run on:

- Pull Requests to main
- Pushes to main
- Pushes to develop
- Pushes to feat/\*\* branches

Pipeline stages:

```text
Install
 ↓
Lint
 ↓
Type Check
 ↓
Build
 ↓
Unit Tests
 ↓
E2E Tests
 ↓
Coverage
```

Workflow:

```text
.github/workflows/ci.yml
```

---

# Security Scanning

CodeQL runs:

- On push to main
- On push to develop
- On pull requests
- Weekly schedule

Workflow:

```text
.github/workflows/codeql.yml
```

CodeQL performs:

- Security analysis
- Vulnerability detection
- TypeScript code scanning

---

# Local Verification Checklist

Before opening a Pull Request:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:cov
npm run build
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.vault.yml config --quiet
```

Everything should pass before merging.

---
