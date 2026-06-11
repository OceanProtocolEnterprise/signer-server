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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              switch (key) {
                case 'ethereum.rpcUrl':
                  return 'https://test.rpc';

                case 'ethereum.chainId':
                  return 11155111;

                case 'ethereum.privateKey':
                  return '0xtestkey';

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
    const sig = await service.signMessage('hello');

    expect(sig).toBe('0xsigned');
    expect(mockWallet.signMessage).toHaveBeenCalledWith('hello');
  });

  it('should send transaction', async () => {
    const result = await service.sendTransaction(
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
  });
});