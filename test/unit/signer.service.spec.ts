import { Test, TestingModule } from '@nestjs/testing';
import { SignerService } from '../../src/signer/signer.service';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

jest.mock('ethers', () => ({
  JsonRpcProvider: jest.fn().mockImplementation(() => ({})),
  Wallet: jest.fn().mockImplementation((pk, provider) => ({
    address: '0xMockAddress',
    signMessage: jest.fn().mockResolvedValue('0xsigned'),
    sendTransaction: jest.fn().mockResolvedValue({
      hash: '0xtxhash',
      from: '0xfrom',
      to: '0xto',
      nonce: 1,
      wait: jest.fn().mockResolvedValue({ blockNumber: 123, gasUsed: '21000', status: 1 }),
    }),
  })),
}));

describe('SignerService', () => {
  let service: SignerService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SignerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'ethereum.rpcUrl') return 'https://test.rpc';
              if (key === 'ethereum.chainId') return 11155111;
              if (key === 'ethereum.privateKey') return '0xtestkey';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SignerService>(SignerService);
    configService = module.get<ConfigService>(ConfigService);
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
  });

  it('should send transaction', async () => {
    const result = await service.sendTransaction('0xto', '100', '0xdata');
    expect(result.hash).toBe('0xtxhash');
    expect(result.blockNumber).toBe(123);
  });
});