jest.mock('ethers'); 

import { Test, TestingModule } from '@nestjs/testing';
import { SignerService } from './signer.service';
import { ConfigService } from '@nestjs/config';

describe('SignerService', () => {
  let service: SignerService;

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