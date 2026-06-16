import { SignerController } from './signer.controller';
import { SignerService } from './signer.service';

describe('SignerController', () => {
  let signerService: jest.Mocked<SignerService>;
  let controller: SignerController;

  beforeEach(() => {
    signerService = {
      getAddress: jest.fn(),
      signMessage: jest.fn(),
    } as unknown as jest.Mocked<SignerService>;
    controller = new SignerController(signerService);
  });

  it('uses body wallet id when signing a message', async () => {
    signerService.getAddress.mockResolvedValue({
      walletId: 1,
      address: '0xAddress',
    });
    signerService.signMessage.mockResolvedValue(
      '0xSignature',
    );

    await expect(
      controller.signMessage({
        message: 'message',
        walletId: 1,
      }),
    ).resolves.toEqual({
      signature: '0xSignature',
      walletId: 1,
      address: '0xAddress',
    });
    expect(signerService.getAddress).toHaveBeenCalledWith(
      1,
    );
    expect(signerService.signMessage).toHaveBeenCalledWith(
      'message',
      1,
    );
  });

  it('uses default signer when body wallet id is omitted', async () => {
    signerService.getAddress.mockResolvedValue({
      address: '0xAddress',
    });
    signerService.signMessage.mockResolvedValue(
      '0xSignature',
    );

    await expect(
      controller.signMessage({ message: 'message' }),
    ).resolves.toEqual({
      signature: '0xSignature',
      address: '0xAddress',
    });
    expect(signerService.getAddress).toHaveBeenCalledWith(
      undefined,
    );
    expect(signerService.signMessage).toHaveBeenCalledWith(
      'message',
      undefined,
    );
  });
});
