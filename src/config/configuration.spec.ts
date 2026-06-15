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
    process.env.SIGNER_MODE = 'local';
    process.env.PRIVATE_KEYS = JSON.stringify([
      {
        walletId: 10,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        walletId: 20,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);

    expect(configuration().signer.privateKeys).toEqual([
      {
        walletId: 10,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        walletId: 20,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);
    expect(configuration().signer.mode).toBe('local');
  });

  it('parses Vault signer config', () => {
    process.env.SIGNER_MODE = 'vault';
    process.env.PRIVATE_KEYS = 'not-json';
    process.env.VAULT_URL = 'http://vault.test';
    process.env.VAULT_TOKEN = 'vault-token';
    process.env.VAULT_ETHEREUM_MOUNT = '/ethereum/';
    process.env.VAULT_KV_STORE_PATH = '/secret/';
    process.env.VAULT_TIMEOUT_MS = '5000';

    expect(configuration().signer).toMatchObject({
      mode: 'vault',
      privateKeys: [],
      openBao: {
        url: 'http://vault.test',
        token: 'vault-token',
        ethereumMount: 'ethereum',
        kvStorePath: 'secret',
        timeoutMs: 5000,
      },
    });
  });

  it('uses the default Vault timeout', () => {
    process.env.SIGNER_MODE = 'vault';

    expect(configuration().signer.openBao.timeoutMs).toBe(10000);
  });

  it('rejects missing signer mode', () => {
    delete process.env.SIGNER_MODE;

    expect(() => configuration()).toThrow(
      'SIGNER_MODE must be either local or vault',
    );
  });

  it('rejects empty signer mode', () => {
    process.env.SIGNER_MODE = '';

    expect(() => configuration()).toThrow(
      'SIGNER_MODE must be either local or vault',
    );
  });

  it('rejects invalid signer mode', () => {
    process.env.SIGNER_MODE = 'remote';

    expect(() => configuration()).toThrow(
      'SIGNER_MODE must be either local or vault',
    );
  });

  it('rejects invalid Vault timeout', () => {
    process.env.SIGNER_MODE = 'vault';
    process.env.VAULT_TIMEOUT_MS = '0';

    expect(() => configuration()).toThrow(
      'VAULT_TIMEOUT_MS must be a positive integer',
    );
  });

  it('rejects duplicate private key ids', () => {
    process.env.SIGNER_MODE = 'local';
    process.env.PRIVATE_KEYS = JSON.stringify([
      {
        walletId: 10,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        walletId: 10,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);

    expect(() => configuration()).toThrow(
      'PRIVATE_KEYS contains duplicate walletId 10',
    );
  });

  it('rejects invalid private key format', () => {
    process.env.SIGNER_MODE = 'local';
    process.env.PRIVATE_KEYS = JSON.stringify([
      {
        walletId: 10,
        key: 'not-a-key',
      },
    ]);

    expect(() => configuration()).toThrow(
      'PRIVATE_KEYS[0].key must be a 32-byte hex private key',
    );
  });

  it('parses HTTPS certificate paths', () => {
    process.env.SIGNER_MODE = 'vault';
    process.env.HTTP_CERT_PATH = '/etc/ssl/certs/cert.pem';
    process.env.HTTP_KEY_PATH = '/etc/ssl/certs/key.pem';

    expect(configuration().tls).toEqual({
      certPath: '/etc/ssl/certs/cert.pem',
      keyPath: '/etc/ssl/certs/key.pem',
    });
  });
});
