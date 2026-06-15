import { OpenBaoVaultSigner } from './openbao-vault.signer';

describe('OpenBaoVaultSigner', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('times out Vault requests', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    const signer = new OpenBaoVaultSigner(
      'http://vault.test',
      'vault-token',
      'ethereum',
      'secret',
      10,
      10,
    );
    const addressPromise = signer.getAddress();

    jest.advanceTimersByTime(10);

    await expect(addressPromise).rejects.toThrow(
      'Vault request timed out after 10ms',
    );
  });

  it('resolves wallet address from the configured KV store path', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          data: {
            address:
              '0xcf3185a502be4b5eb2c4eb81646ecf7dd0ac2f22',
          },
        },
      }),
    } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
      10,
    );

    await expect(signer.getAddress()).resolves.toBe(
      '0xcf3185a502be4b5eb2c4eb81646ecf7dd0ac2f22',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://vault.test/v1/secret/data/wallets/by-id/10',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'X-Vault-Token': 'vault-token',
        }),
      }),
    );
  });
});
