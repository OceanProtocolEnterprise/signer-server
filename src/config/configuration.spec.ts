import configuration from './configuration';

describe('configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('parses multiple private keys', () => {
    process.env.PRIVATE_KEYS = JSON.stringify([
      {
        id: 1,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        id: 2,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);

    expect(configuration().signer.privateKeys).toEqual([
      {
        id: 1,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        id: 2,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);
  });

  it('rejects duplicate private key ids', () => {
    process.env.PRIVATE_KEYS = JSON.stringify([
      {
        id: 1,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        id: 1,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);

    expect(() => configuration()).toThrow(
      'PRIVATE_KEYS contains duplicate id 1',
    );
  });

  it('rejects invalid private key format', () => {
    process.env.PRIVATE_KEYS = JSON.stringify([
      {
        id: 1,
        key: 'not-a-key',
      },
    ]);

    expect(() => configuration()).toThrow(
      'PRIVATE_KEYS[0].key must be a 32-byte hex private key',
    );
  });
});
