process.env.NODE_ENV = 'test';

process.env.PRIVATE_KEY =
  process.env.PRIVATE_KEY || 'test-private-key';

process.env.NODE_URI_MAP =
  process.env.NODE_URI_MAP ||
  JSON.stringify({
    '11155111': 'http://localhost:8545',
  });

process.env.AUTHENTIK_JWKS_URI =
  process.env.AUTHENTIK_JWKS_URI || 'http://test';

process.env.AUTHENTIK_ISSUER =
  process.env.AUTHENTIK_ISSUER || 'http://test';

process.env.AUTHENTIK_AUDIENCE =
  process.env.AUTHENTIK_AUDIENCE || 'test-audience';

process.env.PORT = process.env.PORT || '3001';
