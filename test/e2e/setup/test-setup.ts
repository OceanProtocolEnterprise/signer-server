// This file runs after env.setup.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

// Ensure environment variables are loaded
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
// Uncomment the lines below to silence console output during tests
// global.console.log = jest.fn();
// global.console.error = jest.fn();
// global.console.warn = jest.fn();

// Log test environment info (only in debug mode)
if (process.env.DEBUG_TESTS) {
  console.log('✅ Test setup complete');
  console.log(
    `  - JWT_TOKEN available: ${!!process.env.JWT_TOKEN}`,
  );
  console.log(
    `  - PRIVATE_KEYS available: ${!!process.env.PRIVATE_KEYS}`,
  );
  console.log(
    `  - NODE_URI_MAP available: ${!!process.env.NODE_URI_MAP}`,
  );
}

// Clean up any resources after each test
afterEach(async () => {
  // Add any cleanup needed after each test
});
