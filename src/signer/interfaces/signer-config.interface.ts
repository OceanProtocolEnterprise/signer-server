import { ethers } from 'ethers';

export type SignerMode = 'local' | 'openbao';

export type SignerKeyConfig = {
  walletId: number;
  key: string;
};

export type OpenBaoSignerConfig = {
  walletId: number;
  url: string;
  token: string;
  ethereumMount: string;
  kvStorePath: string;
  timeoutMs: number;
};

export type ManagedSigner = {
  walletId: number;
  address: string;
  signer: ethers.AbstractSigner;
};
