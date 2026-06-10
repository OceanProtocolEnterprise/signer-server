import 'dotenv/config'

import { ethers } from 'ethers'
import { createRemoteSigner } from './remote-signer.js'
import {
    ConfigHelper,
    Datatoken,
  } from '@oceanprotocol/lib'

const SERVICE_URL = 'http://localhost:3001'

const SERVICE_SECRET =
  process.env.SERVICE_SECRET ?? 'changeme'

const RPC_URL = process.env.ETHEREUM_RPC_URL

if (!RPC_URL) {
  throw new Error('ETHEREUM_RPC_URL is required')
}

const CHAIN_ID = Number(
  process.env.CHAIN_ID ?? '11155111',
)

// EURC on Sepolia
const EURC_ADDRESS =
  '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4'

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : String(error)
}

async function main(): Promise<void> {
  console.log(
    '=== Remote Signer + ocean.js Demo ===\n',
  )

  console.log(
    'Step 1: Connecting to signer service...',
  )

  const signer = await createRemoteSigner(
    SERVICE_URL,
    SERVICE_SECRET,
    RPC_URL as string,
    CHAIN_ID,
  )

  const address = await signer.getAddress()

  console.log(`  Address: ${address}`)
  console.log(
    `  instanceof AbstractSigner: ${
      signer instanceof ethers.AbstractSigner
    }`,
  )

  console.log('\nStep 2: Signing message...')

  const message = 'Ocean Enterprise test'

  const signature =
    await signer.signMessage(message)

  console.log(
    `  Signature: ${signature}`,
  )

  const recovered = ethers.verifyMessage(
    message,
    signature,
  )

  console.log(`  Recovered: ${recovered}`)
  console.log(
    `  Valid: ${
      recovered.toLowerCase() ===
      address.toLowerCase()
    }`,
  )

  console.log('\nStep 3: Loading ocean.js...')

  const oceanConfig =
    new ConfigHelper().getConfig(CHAIN_ID)

  console.log(
    `  Ocean config loaded for chain ${CHAIN_ID}`,
  )

  console.log(
    '\nStep 4: Creating Datatoken instance...',
  )

  const datatoken = new Datatoken(
    signer,
    CHAIN_ID,
  )

  console.log(
    '  Datatoken instance created with RemoteSigner',
  )

  console.log(
    '\nStep 5: Checking EURC balance...',
  )

  const eurcBalance =
    await datatoken.balance(
      EURC_ADDRESS,
      address,
    )

  console.log(
    `  EURC Balance: ${eurcBalance}`,
  )

  const spenderAddress =
    oceanConfig.fixedRateExchangeAddress

  console.log(
    '\nStep 6: Approving EURC for spender...',
  )

  console.log(`  Token: ${EURC_ADDRESS}`)
  console.log(`  Spender: ${spenderAddress}`)
  console.log('  Amount: 100')

  try {
    const approveTx =
      await datatoken.approve(
        EURC_ADDRESS,
        spenderAddress,
        '100',
      )

    console.log(
      `  Approve tx: ${approveTx}`,
    )

    console.log('  EURC approved!')

    console.log(
      '\nStep 7: Checking allowance...',
    )

    const allowance =
      await datatoken.allowance(
        EURC_ADDRESS,
        address,
        spenderAddress,
      )

    console.log(
      `  Allowance: ${allowance}`,
    )
  } catch (error) {
    const message =
      getErrorMessage(error)

    console.error(
      `  Approve failed: ${message}`,
    )

    if (
      message.includes(
        'insufficient funds',
      )
    ) {
      console.log(
        `  Fund the wallet with ETH: ${address}`,
      )
    }
  }

  console.log('\n=== Demo Complete ===')
}

main().catch((error: unknown) => {
  console.error(
    'Demo failed:',
    getErrorMessage(error),
  )
})