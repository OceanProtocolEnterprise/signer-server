import { ethers } from 'ethers';

export type SignerKeyConfig = {
  id: number;
  key: string;
};

export type ManagedSigner = {
  id: number;
  address: string;
  signer: ethers.AbstractSigner;
};
