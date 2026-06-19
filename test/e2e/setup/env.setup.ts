import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from the root directory
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Also load .env.test if it exists
const testEnvPath = path.resolve(
  process.cwd(),
  '.env.test',
);
dotenv.config({ path: testEnvPath });

// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Explicitly set all environment variables needed for tests
process.env.PORT = process.env.PORT || '3001';

// Authentik configuration
process.env.AUTHENTIK_JWKS_URI =
  process.env.AUTHENTIK_JWKS_URI || 'https://test.jwks.uri';
process.env.AUTHENTIK_ISSUER =
  process.env.AUTHENTIK_ISSUER || 'https://test.issuer';
process.env.AUTHENTIK_AUDIENCE =
  process.env.AUTHENTIK_AUDIENCE || 'test-audience';
process.env.UPSTREAM_IDP =
  process.env.UPSTREAM_IDP || 'VM3 Partner Source';

// Signer configuration
process.env.SIGNER_MODE =
  process.env.SIGNER_MODE || 'local';
process.env.NODE_URI_MAP =
  process.env.NODE_URI_MAP ||
  '{"11155111":"https://ethereum-sepolia.publicnode.com"}';
process.env.PRIVATE_KEYS =
  process.env.PRIVATE_KEYS ||
  '[{"walletId":1,"key":"0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb"}]';

// JWT token for authentication tests
process.env.JWT_TOKEN = process.env.JWT_TOKEN || '';

// GitHub Actions detection
if (process.env.GITHUB_ACTIONS) {
  console.log('🔧 Running in GitHub Actions environment');
}

// Debug logging (only when DEBUG_TESTS is set)
if (process.env.DEBUG_TESTS) {
  console.log('📋 Environment variables loaded:');
  console.log(
    `  - AUTHENTIK_JWKS_URI: ${process.env.AUTHENTIK_JWKS_URI}`,
  );
  console.log(
    `  - AUTHENTIK_ISSUER: ${process.env.AUTHENTIK_ISSUER}`,
  );
  console.log(
    `  - AUTHENTIK_AUDIENCE: ${process.env.AUTHENTIK_AUDIENCE}`,
  );
  console.log(
    `  - UPSTREAM_IDP: ${process.env.UPSTREAM_IDP}`,
  );
  console.log(
    `  - SIGNER_MODE: ${process.env.SIGNER_MODE}`,
  );
  console.log(
    `  - JWT_TOKEN: ${process.env.JWT_TOKEN ? '***SET***' : 'NOT SET'}`,
  );
  console.log(
    `  - PRIVATE_KEYS: ${process.env.PRIVATE_KEYS ? '***SET***' : 'NOT SET'}`,
  );
  console.log(
    `  - NODE_URI_MAP: ${process.env.NODE_URI_MAP ? '***SET***' : 'NOT SET'}`,
  );
  console.log(
    `  - GITHUB_ACTIONS: ${process.env.GITHUB_ACTIONS}`,
  );
}
