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
    );
    const addressPromise = signer.getAddress(10);

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
    );

    await expect(signer.getAddress(10)).resolves.toBe(
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

  it('resolves the first Vault Ethereum account when wallet id is omitted', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          keys: [
            '0xcf3185a502be4b5eb2c4eb81646ecf7dd0ac2f22',
          ],
        },
      }),
    } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
    );

    await expect(signer.getAddress()).resolves.toBe(
      '0xcf3185a502be4b5eb2c4eb81646ecf7dd0ac2f22',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://vault.test/v1/ethereum/accounts',
      expect.objectContaining({
        method: 'LIST',
        headers: expect.objectContaining({
          'X-Vault-Token': 'vault-token',
        }),
      }),
    );
  });

  it('uses the Vault account list for default address after resolving an explicit wallet', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            data: {
              address: '0xExplicitVaultAddress',
            },
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            keys: ['0xDefaultVaultAddress'],
          },
        }),
      } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
    );

    await expect(signer.getAddress(10)).resolves.toBe(
      '0xExplicitVaultAddress',
    );
    await expect(signer.getAddress()).resolves.toBe(
      '0xDefaultVaultAddress',
    );
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      'http://vault.test/v1/ethereum/accounts',
      expect.objectContaining({
        method: 'LIST',
      }),
    );
  });

  it('uses the selected wallet id as the default address when configured', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          data: {
            address: '0xSelectedVaultAddress',
          },
        },
      }),
    } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
      undefined,
      undefined,
      10,
    );

    await expect(signer.getAddress()).resolves.toBe(
      '0xSelectedVaultAddress',
    );
    expect(global.fetch).toHaveBeenCalledWith(
      'http://vault.test/v1/secret/data/wallets/by-id/10',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('preserves the selected wallet id when connecting a provider', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          data: {
            address: '0xSelectedVaultAddress',
          },
        },
      }),
    } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
      undefined,
      undefined,
      10,
    );
    const connectedSigner = signer.connect(
      {} as Parameters<OpenBaoVaultSigner['connect']>[0],
    );

    await expect(
      connectedSigner.getAddress(),
    ).resolves.toBe('0xSelectedVaultAddress');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://vault.test/v1/secret/data/wallets/by-id/10',
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });

  it('throws when Vault has no Ethereum accounts', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        data: {
          keys: [],
        },
      }),
    } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
    );

    await expect(signer.getAddress()).rejects.toThrow(
      'No Vault Ethereum accounts found',
    );
  });

  it('sends explicit legacy gas price and gas limit to Vault when present', async () => {
    const broadcastTransaction = jest
      .fn()
      .mockResolvedValue({ hash: '0xHash' });
    const provider = {
      getTransactionCount: jest.fn().mockResolvedValue(7),
      getNetwork: jest
        .fn()
        .mockResolvedValue({ chainId: 11155111n }),
      getFeeData: jest.fn().mockResolvedValue({
        gasPrice: 1n,
      }),
      estimateGas: jest.fn().mockResolvedValue(21000n),
      broadcastTransaction,
    };
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            keys: [
              '0xcf3185a502be4b5eb2c4eb81646ecf7dd0ac2f22',
            ],
          },
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          data: {
            signed_transaction: '0xf801',
          },
        }),
      } as unknown as Response);

    const signer = new OpenBaoVaultSigner(
      'http://vault.test/',
      'vault-token',
      '/ethereum/',
      '/secret/',
      undefined,
      provider as unknown as Parameters<
        OpenBaoVaultSigner['connect']
      >[0],
    );

    await signer.sendTransaction({
      to: '0x0000000000000000000000000000000000000001',
      value: 100n,
      data: '0x',
      type: 0,
      gasLimit: 25200n,
      gasPrice: 5n,
      nonce: 8,
    });

    const signRequest = (global.fetch as jest.Mock).mock
      .calls[1][1];
    expect(JSON.parse(signRequest.body)).toEqual({
      to: '0x0000000000000000000000000000000000000001',
      value: '0x64',
      data: '0x',
      nonce: '0x08',
      gas: 25200,
      chainId: 11155111,
      gasPrice: '0x05',
    });
    expect(broadcastTransaction).toHaveBeenCalledWith(
      '0xf801',
    );
    expect(
      provider.getTransactionCount,
    ).not.toHaveBeenCalled();
  });
});
