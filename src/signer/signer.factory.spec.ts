const mockWallets = new Map<string, any>();

function mockCreateWallet(privateKey: string) {
  const signerNumber = privateKey.endsWith('2'.repeat(64)) ? '2' : '1';
  const wallet = {
    address: `0xMockAddress${signerNumber}`,
  };
  mockWallets.set(privateKey, wallet);
  return wallet;
}

jest.mock('ethers', () => ({
  ethers: {
    Wallet: jest.fn((privateKey: string) => mockCreateWallet(privateKey)),
  },
}));

import { SignerFactory } from './signer.factory';

describe('SignerFactory', () => {
  let factory: SignerFactory;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWallets.clear();
    factory = new SignerFactory();
  });

  it('should create local signers from private key config', () => {
    const signers = factory.createSigners([
      {
        walletId: 10,
        key: `0x${'1'.repeat(64)}`,
      },
      {
        walletId: 20,
        key: `0x${'2'.repeat(64)}`,
      },
    ]);

    expect(signers.get(10)).toEqual({
      walletId: 10,
      address: '0xMockAddress1',
      signer: mockWallets.get(`0x${'1'.repeat(64)}`),
    });
    expect(signers.get(20)).toEqual({
      walletId: 20,
      address: '0xMockAddress2',
      signer: mockWallets.get(`0x${'2'.repeat(64)}`),
    });
  });

  it('should reject duplicate wallet ids', () => {
    expect(() =>
      factory.createSigners([
        {
          walletId: 10,
          key: `0x${'1'.repeat(64)}`,
        },
        {
          walletId: 10,
          key: `0x${'2'.repeat(64)}`,
        },
      ]),
    ).toThrow('Duplicate wallet id 10');
  });
});
