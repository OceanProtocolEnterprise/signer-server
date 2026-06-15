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
    const { SIGNER_MODE: _signerMode, ...config } = validBaseConfig;

    expect(() => validate(config)).toThrow(
      'SIGNER_MODE must be either local or openbao',
    );
  });

  it('rejects empty signer mode', () => {
    expect(() => validate({ ...validBaseConfig, SIGNER_MODE: '' })).toThrow(
      'SIGNER_MODE must be either local or openbao',
    );
  });

  it('rejects invalid signer mode', () => {
    expect(() => validate({ ...validBaseConfig, SIGNER_MODE: 'vault' })).toThrow(
      'SIGNER_MODE must be either local or openbao',
    );
  });
});
