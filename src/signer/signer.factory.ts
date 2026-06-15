import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import {
  ManagedSigner,
  SignerKeyConfig,
} from './interfaces/signer-config.interface';

@Injectable()
export class SignerFactory {
  createSigners(
    privateKeys: SignerKeyConfig[],
  ): Map<number, ManagedSigner> {
    const signers = new Map<number, ManagedSigner>();

    privateKeys.forEach((privateKey) => {
      if (signers.has(privateKey.id)) {
        throw new Error(
          `Duplicate signer id ${privateKey.id}`,
        );
      }

      signers.set(
        privateKey.id,
        this.createLocalSigner(privateKey),
      );
    });

    return signers;
  }

  private createLocalSigner(
    privateKey: SignerKeyConfig,
  ): ManagedSigner {
    const wallet = new ethers.Wallet(privateKey.key);

    return {
      id: privateKey.id,
      address: wallet.address,
      signer: wallet,
    };
  }
}
