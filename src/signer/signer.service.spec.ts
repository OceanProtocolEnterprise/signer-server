import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SignerFactory } from './signer.factory';

const mockWait = jest.fn().mockResolvedValue({
  blockNumber: 123,
  gasUsed: 21000n,
  status: 1,
});

const mockSendTransaction = jest.fn().mockResolvedValue({
  hash: '0xtxhash',
  from: '0xMockAddress1',
  to: '0xto',
  nonce: 1,
  wait: mockWait,
});

const mockWallets = new Map<string, any>();

function mockCreateWallet(privateKey: string) {
  const signerNumber = privateKey.endsWith('2'.repeat(64))
    ? '2'
    : '1';
  const wallet = {
    address: `0xMockAddress${signerNumber}`,
    signMessage: jest
      .fn()
      .mockResolvedValue(`0xsigned${signerNumber}`),
    sendTransaction: mockSendTransaction,
    connect: jest.fn(),
  };
  wallet.connect.mockReturnValue(wallet);
  mockWallets.set(privateKey, wallet);
  return wallet;
}

const mockProvider = {
  getTransaction: jest.fn(),
  getTransactionCount: jest.fn(),
};

jest.mock('ethers', () => ({
  ethers: {
    AbstractSigner: class {
      constructor(public provider?: unknown) {}
    },
    JsonRpcProvider: jest.fn(() => mockProvider),
    Wallet: jest.fn((privateKey: string) =>
      mockCreateWallet(privateKey),
    ),
  },
}));

import { SignerService } from './signer.service';

describe('SignerService', () => {
  let service: SignerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWallets.clear();

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          SignerService,
          SignerFactory,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                switch (key) {
                  case 'signer.mode':
                    return 'local';

                  case 'signer.privateKeys':
                    return [
                      {
                        walletId: 10,
                        key: `0x${'1'.repeat(64)}`,
                      },
                      {
                        walletId: 20,
                        key: `0x${'2'.repeat(64)}`,
                      },
                    ];

                  case 'signer.nodeUriMap':
                    return {
                      '11155111': 'https://test.rpc',
                      '11155420':
                        'https://test.optimism.rpc',
                    };

                  case 'signer.openBao':
                    return {};

                  default:
                    return undefined;
                }
              }),
            },
          },
        ],
      }).compile();

    service = module.get<SignerService>(SignerService);

    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return address', async () => {
    await expect(service.getAddress()).resolves.toEqual({
      walletId: 10,
      address: '0xMockAddress1',
    });
  });

  it('should return address for selected wallet', async () => {
    await expect(service.getAddress(20)).resolves.toEqual({
      walletId: 20,
      address: '0xMockAddress2',
    });
  });

  it('should sign a message', async () => {
    const signature = await service.signMessage('hello');

    expect(signature).toBe('0xsigned1');
    expect(
      mockWallets.get(`0x${'1'.repeat(64)}`).signMessage,
    ).toHaveBeenCalledWith('hello');
  });

  it('should sign a message with selected wallet', async () => {
    const signature = await service.signMessage(
      'hello',
      20,
    );

    expect(signature).toBe('0xsigned2');
    expect(
      mockWallets.get(`0x${'2'.repeat(64)}`).signMessage,
    ).toHaveBeenCalledWith('hello');
  });

  it('should send transaction', async () => {
    const result = await service.sendTransaction(
      11155111,
      '0xto',
      '100',
      '0xdata',
    );

    expect(result).toEqual({
      hash: '0xtxhash',
      from: '0xMockAddress1',
      to: '0xto',
      nonce: 1,
      blockNumber: 123,
      gasUsed: '21000',
      status: 1,
    });
    expect(
      mockWallets.get(`0x${'1'.repeat(64)}`).connect,
    ).toHaveBeenCalledWith(mockProvider);
    expect(mockSendTransaction).toHaveBeenCalledWith({
      to: '0xto',
      value: 100n,
      data: '0xdata',
    });
  });

  it('should send transaction with selected wallet', async () => {
    await service.sendTransaction(
      11155111,
      '0xto',
      '100',
      '0xdata',
      20,
    );

    expect(
      mockWallets.get(`0x${'2'.repeat(64)}`).connect,
    ).toHaveBeenCalledWith(mockProvider);
  });

  it('should get transaction', async () => {
    mockProvider.getTransaction.mockResolvedValue({
      hash: '0xhash',
      from: '0xfrom',
      to: '0xto',
      value: 100n,
      data: '0x',
      nonce: 5,
      blockNumber: 123,
      blockHash: '0xblock',
      chainId: 11155111n,
    });

    const tx = await service.getTransaction(
      11155111,
      '0xhash',
    );

    expect(tx).toEqual({
      hash: '0xhash',
      from: '0xfrom',
      to: '0xto',
      value: '100',
      data: '0x',
      nonce: 5,
      blockNumber: 123,
      blockHash: '0xblock',
      chainId: '11155111',
    });

    expect(
      mockProvider.getTransaction,
    ).toHaveBeenCalledWith('0xhash');
  });

  it('should return null when transaction is not found', async () => {
    mockProvider.getTransaction.mockResolvedValue(null);

    const tx = await service.getTransaction(
      11155111,
      '0xhash',
    );

    expect(tx).toBeNull();
  });

  it('should get nonce', async () => {
    mockProvider.getTransactionCount.mockResolvedValue(42);

    const nonce = await service.getNonce(11155111);

    expect(nonce).toBe(42);

    expect(
      mockProvider.getTransactionCount,
    ).toHaveBeenCalledWith('0xMockAddress1');
  });

  it('should get nonce for selected wallet', async () => {
    mockProvider.getTransactionCount.mockResolvedValue(24);

    const nonce = await service.getNonce(11155111, 20);

    expect(nonce).toBe(24);

    expect(
      mockProvider.getTransactionCount,
    ).toHaveBeenCalledWith('0xMockAddress2');
  });

  it('should throw when chain ID has no configured node URI', async () => {
    await expect(service.getNonce(1)).rejects.toThrow(
      'No node URI configured for chain ID 1',
    );
  });

  it('should throw when wallet id is not configured', async () => {
    await expect(service.getAddress(999)).rejects.toThrow(
      'No wallet configured for id 999',
    );
  });

  it('should throw a suggestive error for unsupported signer mode', async () => {
    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          SignerService,
          {
            provide: SignerFactory,
            useValue: {
              createLocalSigners: jest.fn(),
              createOpenBaoSigners: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                switch (key) {
                  case 'signer.mode':
                    return 'remote';

                  case 'signer.nodeUriMap':
                    return {
                      '11155111': 'https://test.rpc',
                    };

                  case 'signer.privateKeys':
                    return [];

                  case 'signer.openBao':
                    return {};

                  default:
                    return undefined;
                }
              }),
            },
          },
        ],
      }).compile();

    const invalidModeService =
      module.get<SignerService>(SignerService);

    await expect(
      invalidModeService.onModuleInit(),
    ).rejects.toThrow(
      `Unknown mode "remote". Please proceed with supported modes: 'local' or 'vault'`,
    );
  });

  it('should initialize Vault signer mode', async () => {
    const openBaoSigner = {
      address: '0xVaultAddress',
      signMessage: jest.fn(),
      connect: jest.fn(),
    };
    const defaultOpenBaoSigner = {
      address: '0xDefaultVaultAddress',
      signMessage: jest.fn(),
      connect: jest.fn(),
    };
    const createOpenBaoSigner = jest
      .fn()
      .mockImplementation(
        (config: { walletId?: number }) => {
          if (config.walletId === 30) {
            return Promise.resolve({
              walletId: 30,
              address: '0xVaultAddress',
              signer: openBaoSigner,
            });
          }

          return Promise.resolve({
            address: '0xDefaultVaultAddress',
            signer: defaultOpenBaoSigner,
          });
        },
      );

    const module: TestingModule =
      await Test.createTestingModule({
        providers: [
          SignerService,
          {
            provide: SignerFactory,
            useValue: {
              createLocalSigners: jest.fn(),
              createOpenBaoSigner,
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                switch (key) {
                  case 'signer.mode':
                    return 'vault';

                  case 'signer.nodeUriMap':
                    return {
                      '11155111': 'https://test.rpc',
                    };

                  case 'signer.privateKeys':
                    return [];

                  case 'signer.openBao':
                    return {
                      url: 'http://vault.test',
                      token: 'vault-token',
                      ethereumMount: 'ethereum',
                      kvStorePath: 'secret',
                      timeoutMs: 5000,
                    };

                  default:
                    return undefined;
                }
              }),
            },
          },
        ],
      }).compile();

    const vaultService =
      module.get<SignerService>(SignerService);

    await vaultService.onModuleInit();

    await expect(
      vaultService.getAddress(),
    ).resolves.toEqual({
      walletId: undefined,
      address: '0xDefaultVaultAddress',
    });
    await expect(
      vaultService.getAddress(30),
    ).resolves.toEqual({
      walletId: 30,
      address: '0xVaultAddress',
    });
    expect(createOpenBaoSigner).toHaveBeenCalledWith({
      url: 'http://vault.test',
      token: 'vault-token',
      ethereumMount: 'ethereum',
      kvStorePath: 'secret',
      timeoutMs: 5000,
    });
    expect(createOpenBaoSigner).toHaveBeenCalledWith({
      walletId: 30,
      url: 'http://vault.test',
      token: 'vault-token',
      ethereumMount: 'ethereum',
      kvStorePath: 'secret',
      timeoutMs: 5000,
    });
  });
});
