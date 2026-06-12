import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

const mockWait = jest.fn().mockResolvedValue({
  blockNumber: 123,
  gasUsed: 21000n,
  status: 1,
});

const mockSendTransaction = jest.fn().mockResolvedValue({
  hash: '0xtxhash',
  from: '0xMockAddress',
  to: '0xto',
  nonce: 1,
  wait: mockWait,
});

const mockWallet = {
  address: '0xMockAddress',
  signMessage: jest.fn().mockResolvedValue('0xsigned'),
  sendTransaction: mockSendTransaction,
  connect: jest.fn(),
};

const mockProvider = {
  getTransaction: jest.fn(),
  getTransactionCount: jest.fn(),
};

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn(() => mockProvider),
    Wallet: jest.fn(() => mockWallet),
  },
}));

import { SignerService } from './signer.service';

describe('SignerService', () => {
  let service: SignerService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockWallet.connect.mockReturnValue(mockWallet);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'signer.privateKey':
                  return '0xtestkey';

                case 'signer.nodeUriMap':
                  return {
                    '11155111': 'https://test.rpc',
                    '11155420': 'https://test.optimism.rpc',
                  };

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

  it('should return address', () => {
    expect(service.getAddress()).toBe('0xMockAddress');
  });

  it('should sign a message', async () => {
    const signature = await service.signMessage('hello');

    expect(signature).toBe('0xsigned');
    expect(mockWallet.signMessage).toHaveBeenCalledWith(
      'hello',
    );
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
      from: '0xMockAddress',
      to: '0xto',
      nonce: 1,
      blockNumber: 123,
      gasUsed: '21000',
      status: 1,
    });
    expect(mockWallet.connect).toHaveBeenCalledWith(mockProvider);
    expect(mockSendTransaction).toHaveBeenCalledWith({
      to: '0xto',
      value: 100n,
      data: '0xdata',
    });
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
    mockProvider.getTransaction.mockResolvedValue(
      null,
    );

    const tx = await service.getTransaction(
      11155111,
      '0xhash',
    );

    expect(tx).toBeNull();
  });

  it('should get nonce', async () => {
    mockProvider.getTransactionCount.mockResolvedValue(
      42,
    );

    const nonce = await service.getNonce(11155111);

    expect(nonce).toBe(42);

    expect(
      mockProvider.getTransactionCount,
    ).toHaveBeenCalledWith(
      '0xMockAddress',
    );
  });

  it('should throw when chain ID has no configured node URI', async () => {
    await expect(service.getNonce(1)).rejects.toThrow(
      'No node URI configured for chain ID 1',
    );
  });
});
