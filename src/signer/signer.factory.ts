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
        throw new Error(`Duplicate wallet id ${privateKey.walletId}`);
      }

      signers.set(privateKey.walletId, this.createLocalSigner(privateKey));
    });

    return signers;
  }

  async createOpenBaoSigner(
    config: OpenBaoSignerConfig,
  ): Promise<ManagedSigner> {
    const signer = new OpenBaoVaultSigner(
      config.url,
      config.token,
      config.ethereumMount,
      config.kvStorePath,
      config.timeoutMs,
    );
    const address = await signer.getAddress(config.walletId);

    return {
      walletId: config.walletId,
      address,
      signer,
    };
  }

  async createOpenBaoSigners(
    config: OpenBaoSignerConfig & { walletId: number },
  ): Promise<Map<number, ManagedSigner>> {
    const signer = await this.createOpenBaoSigner(config);

    return new Map([
      [
        config.walletId,
        signer,
      ],
    ]);
  }

  private createLocalSigner(privateKey: SignerKeyConfig): ManagedSigner {
    const wallet = new ethers.Wallet(privateKey.key);

    return {
      walletId: privateKey.walletId,
      address: wallet.address,
      signer: wallet,
    };
  }
}
