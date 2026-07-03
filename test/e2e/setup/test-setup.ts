import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

process.env.NODE_ENV = 'test';

jest.setTimeout(30000);

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

afterEach(async () => {});
