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

Create a `.env` file:

```env
PRIVATE_KEYS=[{"id":1,"key":"0x..."}]

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

PORT=3001
NODE_ENV=development
```

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

Start service:

```bash
docker compose up --build
```

Stop service:

```bash
docker compose down
```

View logs:

```bash
docker compose logs -f
```

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
docker compose up --build
```

Everything should pass before merging.

---
