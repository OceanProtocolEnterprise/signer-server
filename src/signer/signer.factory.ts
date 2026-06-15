import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  ManagedSigner,
  OpenBaoSignerConfig,
  SignerKeyConfig,
} from './interfaces/signer-config.interface';
import { OpenBaoVaultSigner } from './openbao-vault.signer';

@Injectable()
export class SignerFactory {
  createLocalSigners(
    privateKeys: SignerKeyConfig[],
  ): Map<number, ManagedSigner> {
    const signers = new Map<number, ManagedSigner>();

    privateKeys.forEach((privateKey) => {
      if (signers.has(privateKey.walletId)) {
        throw new Error(
          `Duplicate wallet id ${privateKey.walletId}`,
        );
      }

      signers.set(
        privateKey.walletId,
        this.createLocalSigner(privateKey),
      );
    });

    return signers;
  }

  async createOpenBaoSigners(
    config: OpenBaoSignerConfig,
  ): Promise<Map<number, ManagedSigner>> {
    const signer = new OpenBaoVaultSigner(
      config.url,
      config.token,
      config.ethereumMount,
      config.kvStorePath,
      config.walletId,
      config.timeoutMs,
    );
    const address = await signer.getAddress();

    return new Map([
      [
        config.walletId,
        {
          walletId: config.walletId,
          address,
          signer,
        },
      ],
    ]);
  }

  private createLocalSigner(
    privateKey: SignerKeyConfig,
  ): ManagedSigner {
    const wallet = new ethers.Wallet(privateKey.key);

    return {
      walletId: privateKey.walletId,
      address: wallet.address,
      signer: wallet,
    };
  }
}
