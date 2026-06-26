import * as dotenv from 'dotenv';
import * as path from 'path';

module.exports = async () => {
  console.log('🚀 Starting E2E test suite...');

  const envPath = path.resolve(process.cwd(), '.env');
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    console.warn(
      '⚠️ No .env file found, using process environment variables',
    );
  } else {
    console.log(
      '✅ Loaded environment variables from .env file',
    );
  }

  const testEnvPath = path.resolve(
    process.cwd(),
    '.env.test',
  );
  const testResult = dotenv.config({ path: testEnvPath });
  if (!testResult.error) {
    console.log(
      '✅ Loaded environment variables from .env.test file',
    );
  }

  const isGitHubActions = !!process.env.GITHUB_ACTIONS;
  if (isGitHubActions) {
    console.log('🔧 Running in GitHub Actions environment');
  }

  const requiredVars = [
    'AUTHENTIK_JWKS_URI',
    'AUTHENTIK_ISSUER',
    'AUTHENTIK_AUDIENCE',
  ];

  const missingVars = requiredVars.filter(
    (v) => !process.env[v],
  );
  if (missingVars.length > 0) {
    console.warn(
      `⚠️ Missing environment variables: ${missingVars.join(', ')}`,
    );
    if (!isGitHubActions) {
      console.warn(
        '⚠️ Some tests may fail due to missing configuration.',
      );
    }
  }

  if (!process.env.JWT_TOKEN) {
    if (isGitHubActions) {
      console.warn(
        '⚠️ JWT_TOKEN not set in GitHub Actions secrets!',
      );
      console.warn(
        '⚠️ Authentication tests will be skipped.',
      );
    } else {
      console.warn(
        '⚠️ JWT_TOKEN not set in environment variables',
      );
      console.warn(
        '⚠️ Authentication tests that require a valid token will be skipped.',
      );
    }
  } else {
    console.log('✅ JWT_TOKEN loaded successfully');
  }

  if (!process.env.PRIVATE_KEYS) {
    if (isGitHubActions) {
      console.warn(
        '⚠️ PRIVATE_KEYS not set in GitHub Actions secrets!',
      );
      console.warn('⚠️ Local signer tests may fail.');
    } else {
      console.warn(
        '⚠️ PRIVATE_KEYS not set, using default test key',
      );
    }
  } else {
    console.log('✅ PRIVATE_KEYS loaded successfully');
  }

  if (!process.env.NODE_URI_MAP) {
    if (isGitHubActions) {
      console.warn(
        '⚠️ NODE_URI_MAP not set in GitHub Actions secrets!',
      );
      console.warn('⚠️ Local signer tests may fail.');
    } else {
      console.warn(
        '⚠️ NODE_URI_MAP not set, using default',
      );
    }
  } else {
    console.log('✅ NODE_URI_MAP loaded successfully');
  }

  const fs = require('fs');
  const testDir = path.join(__dirname, '..', 'temp');
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  if (!fs.existsSync(testDir)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fs.mkdirSync(testDir, { recursive: true });
  }

  console.log('✅ Test setup complete');
};
