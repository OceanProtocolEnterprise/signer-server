import * as dotenv from 'dotenv';

dotenv.config();

process.env.NODE_ENV = 'test';

process.env.PRIVATE_KEY = process.env.PRIVATE_KEY;

process.env.NODE_URI_MAP = process.env.NODE_URI_MAP;

process.env.AUTHENTIK_JWKS_URI =
  process.env.AUTHENTIK_JWKS_URI;

process.env.AUTHENTIK_ISSUER = process.env.AUTHENTIK_ISSUER;

process.env.AUTHENTIK_AUDIENCE =
  process.env.AUTHENTIK_AUDIENCE;

process.env.PORT = process.env.PORT || '3001';

process.env.JWT_TOKEN = process.env.JWT_TOKEN;
