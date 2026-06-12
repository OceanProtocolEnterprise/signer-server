import 'dotenv/config'

import { ethers } from 'ethers'
import { createSignerFromEnv } from './signer-factory.js'

/**
 * Force Vault mode for this demo
 */
process.env.SIGNER_TYPE = 'vault'

const RPC_URL = process.env.ETHEREUM_RPC_URL

if (!RPC_URL) {
  throw new Error('ETHEREUM_RPC_URL is required')
}

const CHAIN_ID = Number(process.env.CHAIN_ID ?? '11155111')

// EURC on Sepolia
const EURC_ADDRESS = '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4'

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function main(): Promise<void> {
  console.log('=== VAULT SIGNER + OPENBAO DEMO ===\n')

  /**
   * STEP 1: Create provider + signer via factory
   */
  console.log('Step 1: Creating Vault signer via factory...')

  const provider = new ethers.JsonRpcProvider(RPC_URL, {
    name: 'sepolia',
    chainId: CHAIN_ID,
  })

  const signer = createSignerFromEnv(provider, CHAIN_ID)

  const address = await signer.getAddress()

  console.log(`  Address (from OpenBao): ${address}`)
  console.log(
    `  instanceof AbstractSigner: ${signer instanceof ethers.AbstractSigner}`,
  )

  /**
   * STEP 2: (Optional) sign message
   * NOTE: VaultSigner does not support EIP-191 with Kaleido ethsign
   */
  console.log('\nStep 2: Signing message...')

  try {
    const message = 'Vault OpenBao test message'
    const signature = await signer.signMessage(message)

    console.log(`  Signature: ${signature}`)

    const recovered = ethers.verifyMessage(message, signature)

    console.log(`  Recovered: ${recovered}`)
    console.log(
      `  Valid: ${recovered.toLowerCase() === address.toLowerCase()}`,
    )
  } catch (err) {
    console.log(
      `  Sign message not supported: ${getErrorMessage(err)}`,
    )
  }

  /**
   * STEP 3: Load ocean.js
   */
  console.log('\nStep 3: Loading ocean.js...')

  const { ConfigHelper, Datatoken } = await import('@oceanprotocol/lib')

  const oceanConfig = new ConfigHelper().getConfig(CHAIN_ID)

  console.log(`  Ocean config loaded for chain ${CHAIN_ID}`)

  /**
   * STEP 4: Create Datatoken instance
   */
  console.log('\nStep 4: Creating Datatoken instance...')

  const datatoken = new Datatoken(signer, CHAIN_ID)

  console.log('  Datatoken ready with VaultSigner')

  /**
   * STEP 5: Check EURC balance
   */
  console.log('\nStep 5: Checking EURC balance...')

  const eurcBalance = await datatoken.balance(EURC_ADDRESS, address)

  console.log(`  EURC Balance: ${eurcBalance}`)

  /**
   * STEP 6: Approve EURC for Ocean FRE (signed inside OpenBao)
   */
  const spenderAddress = oceanConfig.fixedRateExchangeAddress as string

  console.log('\nStep 6: Approving EURC (Vault signed tx)...')
  console.log(`  Token: ${EURC_ADDRESS}`)
  console.log(`  Spender: ${spenderAddress}`)
  console.log(`  Amount: 100`)

  try {
    const approveTx = await datatoken.approve(
      EURC_ADDRESS,
      spenderAddress,
      '100',
    )

    console.log(`  Approve tx: ${JSON.stringify(approveTx)}`)
    console.log('  Approval successful')

    /**
     * STEP 7: Verify allowance
     */
    console.log('\nStep 7: Checking allowance...')

    const allowance = await datatoken.allowance(
      EURC_ADDRESS,
      address,
      spenderAddress,
    )

    console.log(`  Allowance: ${allowance}`)
  } catch (err) {
    const message = getErrorMessage(err)

    console.error(`  Approve failed: ${message}`)

    if (message.includes('insufficient funds')) {
      console.log(`  Fund wallet with ETH: ${address}`)
    }
  }

  console.log('\n=== VAULT DEMO COMPLETE ===')
}

main().catch((error: unknown) => {
  console.error('Vault demo failed:', getErrorMessage(error))
})