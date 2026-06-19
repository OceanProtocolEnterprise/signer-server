import * as path from 'path';
import * as fs from 'fs';

module.exports = async () => {
  console.log('🧹 Cleaning up E2E test suite...');

  // Clean up test files
  const testDir = path.join(__dirname, '..', 'temp');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    console.log('✅ Test temp directory cleaned');
  }

  console.log('✅ Cleanup complete');
};
