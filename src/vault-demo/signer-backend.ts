import { ethers } from 'ethers'

export type SignerType = 'local' | 'vault'

export interface SignerConfig {
  signerType: SignerType
  provider: ethers.JsonRpcProvider
  chainId: number
  // local signer
  privateKey?: string
  // vault signer
  vaultUrl?: string
  vaultToken?: string
  vaultMount?: string
  vaultAccount?: string
}

/**
 * All signers extend ethers.AbstractSigner — the type ocean.js requires.
 */
export type SignerBackend = ethers.AbstractSigner