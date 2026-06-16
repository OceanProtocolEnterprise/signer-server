import { validate } from './validation';

describe('config validation', () => {
  const validBaseConfig = {
    SIGNER_MODE: 'local',
    PRIVATE_KEYS: `[{"walletId":1,"key":"0x${'1'.repeat(64)}"}]`,
    NODE_URI_MAP: '{"11155111":"https://test.rpc"}',
    AUTHENTIK_JWKS_URI: 'https://test/jwks',
    AUTHENTIK_ISSUER: 'https://issuer',
    AUTHENTIK_AUDIENCE: 'client-id',
    PORT: '3001',
  };

  it('rejects missing signer mode', () => {
    const config: Partial<typeof validBaseConfig> = {
      ...validBaseConfig,
    };
    delete config.SIGNER_MODE;

    expect(() =>
      validate(config as Record<string, unknown>),
    ).toThrow('SIGNER_MODE must be either local or vault');
  });

  it('rejects empty signer mode', () => {
    expect(() =>
      validate({ ...validBaseConfig, SIGNER_MODE: '' }),
    ).toThrow('SIGNER_MODE must be either local or vault');
  });

  it('rejects invalid signer mode', () => {
    expect(() =>
      validate({
        ...validBaseConfig,
        SIGNER_MODE: 'remote',
      }),
    ).toThrow('SIGNER_MODE must be either local or vault');
  });
});
