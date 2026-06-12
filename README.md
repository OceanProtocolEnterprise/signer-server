# Signer Service (NestJS)

Remote signing service for Ocean Enterprise with Authentik JWT authentication.

## Features
- Transaction signing and sending across configured networks
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

## Endpoints (all protected by JWT)
- `GET /address`
- `POST /sign-message`
- `POST /send-transaction`
- `GET /transaction/:hash`
- `GET /nonce`

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
