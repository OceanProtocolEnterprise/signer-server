import { ethers } from 'ethers';

export type SignerKeyConfig = {
  walletId: number;
  key: string;
};

export type ManagedSigner = {
  walletId: number;
  address: string;
  signer: ethers.AbstractSigner;
};
