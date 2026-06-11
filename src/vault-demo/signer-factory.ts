import { ethers } from 'ethers'
import { LocalWalletSigner } from './local-wallet-signer.js'
import { VaultSigner } from './vault-signer.js'
import { SignerBackend, SignerConfig } from './signer-backend.js'
import { readFileSync } from 'node:fs'
import path from 'node:path'

export function createSigner(config: SignerConfig): SignerBackend {
  switch (config.signerType) {
    case 'local': {
      if (!config.privateKey) {
        throw new Error('privateKey is required for local signer')
      }
      return new LocalWalletSigner(config.privateKey, config.provider)
    }
    // wallet address, signer_url

    case 'vault': {
      if (
        !config.vaultUrl ||
        !config.vaultToken ||
        !config.vaultMount ||
        !config.vaultAccount
      ) {
        throw new Error(
          'vaultUrl, vaultToken, vaultMount, and vaultAccount are required for vault signer',
        )
      }
      return new VaultSigner(
        config.provider,
        config.vaultUrl,
        config.vaultToken,
        config.vaultMount,
        config.vaultAccount,
        config.chainId,
      )
    }

    default:
      throw new Error(`Invalid signer type: ${config.signerType as string}`)
  }
}



export function createSignerFromEnv(
  provider: ethers.JsonRpcProvider,
  chainId: number,
): SignerBackend {
  const signerType = (process.env.SIGNER_TYPE ?? 'local') as 'local' | 'vault'

  // Resolve vault account: env var takes priority, fallback to shared file
  let vaultAccount = process.env.ETHSIGN_ACCOUNT
  if (!vaultAccount && signerType === 'vault') {
    const addressFile = process.env.ETHSIGN_ADDRESS_FILE ?? path.join(process.cwd(), 'address')
    vaultAccount = readFileSync(addressFile, 'utf8').trim()
  }

  return createSigner({
    signerType,
    provider,
    chainId,
    privateKey: process.env.PRIVATE_KEY,
    vaultUrl: process.env.OPENBAO_URL,
    vaultToken: process.env.OPENBAO_TOKEN,
    vaultMount: process.env.ETHSIGN_MOUNT ?? 'ethereum',
    vaultAccount,
  })
}