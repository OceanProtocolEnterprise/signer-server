import { SignerController } from './signer.controller';
import { SignerService } from './signer.service';

describe('SignerController', () => {
  let signerService: jest.Mocked<SignerService>;
  let controller: SignerController;

  beforeEach(() => {
    signerService = {
      getAddress: jest.fn(),
      signMessage: jest.fn(),
      sendTransaction: jest.fn(),
      getAvailableNetworks: jest.fn(),
      getNonce: jest.fn(),
    } as unknown as jest.Mocked<SignerService>;
    controller = new SignerController(signerService);
  });

  const reqWithWalletId = (walletId: unknown) =>
    ({
      user: { walletId },
    }) as Parameters<SignerController['getMe']>[0];

  it('uses JWT wallet id when getting an address', async () => {
    signerService.getAddress.mockResolvedValue({
      walletId: 7,
      address: '0xAddress',
    });

    await expect(
      controller.getAddress(reqWithWalletId(7)),
    ).resolves.toEqual({
      walletId: 7,
      address: '0xAddress',
    });
    expect(signerService.getAddress).toHaveBeenCalledWith(
      7,
    );
  });

  it('returns configured available networks', () => {
    signerService.getAvailableNetworks.mockReturnValue([
      { chainId: 11155111, name: 'sepolia' },
      { chainId: 999 },
    ]);

    expect(controller.getAvailableNetworks()).toEqual({
      networks: [
        { chainId: 11155111, name: 'sepolia' },
        { chainId: 999 },
      ],
    });
  });

  it('uses JWT wallet id when signing a message', async () => {
    signerService.getAddress.mockResolvedValue({
      walletId: 7,
      address: '0xAddress',
    });
    signerService.signMessage.mockResolvedValue(
      '0xSignature',
    );

    await expect(
      controller.signMessage(
        {
          message: 'message',
        },
        reqWithWalletId(7),
      ),
    ).resolves.toEqual({
      signature: '0xSignature',
      walletId: 7,
      address: '0xAddress',
    });
    expect(signerService.getAddress).toHaveBeenCalledWith(
      7,
    );
    expect(signerService.signMessage).toHaveBeenCalledWith(
      'message',
      7,
    );
  });

  it('uses raw message bytes when signing a raw message', async () => {
    signerService.getAddress.mockResolvedValue({
      walletId: 7,
      address: '0xAddress',
    });
    signerService.signMessage.mockResolvedValue(
      '0xSignature',
    );

    await controller.signMessage(
      {
        rawMessage: '0x010203',
      },
      reqWithWalletId(7),
    );

    expect(signerService.signMessage).toHaveBeenCalledWith(
      Uint8Array.from([1, 2, 3]),
      7,
    );
  });

  it('uses JWT wallet id when sending a transaction', async () => {
    signerService.sendTransaction.mockResolvedValue({
      hash: '0xHash',
      from: '0xFrom',
      to: '0xTo',
      nonce: 1,
    });

    await expect(
      controller.sendTransaction(
        {
          chainId: 11155111,
          to: '0x0000000000000000000000000000000000000001',
          value: '0',
          data: '0x',
          feeBumpPercent: 200,
        },
        reqWithWalletId(7),
      ),
    ).resolves.toEqual({
      hash: '0xHash',
      from: '0xFrom',
      to: '0xTo',
      nonce: 1,
    });
    expect(
      signerService.sendTransaction,
    ).toHaveBeenCalledWith(
      11155111,
      '0x0000000000000000000000000000000000000001',
      '0',
      '0x',
      7,
      200,
    );
  });

  it('uses JWT wallet id when getting a nonce', async () => {
    signerService.getNonce.mockResolvedValue(42);

    await expect(
      controller.getNonce(11155111, reqWithWalletId(7)),
    ).resolves.toEqual({
      nonce: 42,
    });
    expect(signerService.getNonce).toHaveBeenCalledWith(
      11155111,
      7,
    );
  });

  it('rejects non-positive JWT wallet id', async () => {
    await expect(
      controller.getAddress(reqWithWalletId(0)),
    ).rejects.toMatchObject({
      status: 403,
      message:
        'JWT walletId claim must be a positive integer',
    });
    expect(signerService.getAddress).not.toHaveBeenCalled();
  });

  it('returns 403 for missing JWT wallet id', async () => {
    await expect(
      controller.getAddress(reqWithWalletId(undefined)),
    ).rejects.toMatchObject({
      status: 403,
      message:
        'JWT walletId claim must be a positive integer',
    });
  });

  it('returns 403 for invalid JWT wallet id', async () => {
    await expect(
      controller.getAddress(reqWithWalletId('invalid')),
    ).rejects.toMatchObject({
      status: 403,
      message:
        'JWT walletId claim must be a positive integer',
    });
  });

  it('ignores client-supplied wallet id in sign message body', async () => {
    signerService.getAddress.mockResolvedValue({
      walletId: 7,
      address: '0xAddress',
    });
    signerService.signMessage.mockResolvedValue(
      '0xSignature',
    );

    await controller.signMessage(
      {
        message: 'message',
        walletId: 99,
      } as Parameters<SignerController['signMessage']>[0],
      reqWithWalletId(7),
    );

    expect(signerService.signMessage).toHaveBeenCalledWith(
      'message',
      7,
    );
  });
});
