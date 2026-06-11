import 'dotenv/config'

import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import { ethers } from 'ethers'

const app = express()

app.use(express.json())

const {
  PRIVATE_KEY,
  ETHEREUM_RPC_URL,
  CHAIN_ID,
  SERVICE_SECRET,
  PORT,
} = process.env

if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY is required')
  process.exit(1)
}

interface SignMessageRequest {
  message: string
}

interface SendTransactionRequest {
  to: string
  value?: string
  data?: string
}

const provider = new ethers.JsonRpcProvider(
  ETHEREUM_RPC_URL,
  {
    name: 'network',
    chainId: Number(CHAIN_ID ?? '11155111'),
  },
)

const wallet = new ethers.Wallet(
  PRIVATE_KEY,
  provider,
)

console.log(
  `Signer service running — address: ${wallet.address}`,
)

function auth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
    console.log ('Checking auth...')
  const secret = req.header('X-Api-Key')

  if (secret !== SERVICE_SECRET) {
    res.status(401).json({
      error: 'Unauthorized',
    })
    return
  }

  next()
}

app.get(
  '/address',
  auth,
  (_req: Request, res: Response) => {
    console.log("Retrieving address...")
    res.json({
      address: wallet.address,
    })
  },
)

app.post(
  '/sign-message',
  auth,
  async (
    req: Request<unknown, unknown, SignMessageRequest>,
    res: Response,
  ): Promise<void> => {
    try {
    console.log("Signing message...")
      const { message } = req.body

      const signature =
        await wallet.signMessage(message)
      console.log("Signature: ", signature)

      res.json({
        signature,
        address: wallet.address,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error'

      res.status(500).json({
        error: message,
      })
    }
  },
)

app.post(
  '/send-transaction',
  auth,
  async (
    req: Request<
      unknown,
      unknown,
      SendTransactionRequest
    >,
    res: Response,
  ): Promise<void> => {
    try {
    console.log("Sending transaction...")
      const { to, value, data } = req.body
      console.log("To: ", to)
      console.log("Value: ", value)
      console.log("Data: ", data)

      const tx =
        await wallet.sendTransaction({
          to,
          value: value
            ? BigInt(value)
            : 0n,
          data: data ?? '0x',
        })
      console.log("TX: ", JSON.stringify(tx))

      const receipt = await tx.wait()

      if (!receipt) {
        throw new Error(
          'Transaction receipt not available',
        )
      }
      console.log("receipt: ", JSON.stringify(receipt))

      res.json({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        nonce: tx.nonce,
        blockNumber: receipt.blockNumber,
        gasUsed:
          receipt.gasUsed.toString(),
        status: receipt.status,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error'

      res.status(500).json({
        error: message,
      })
    }
  },
)

app.get(
  '/transaction/:hash',
  auth,
  async (
    req: Request<{ hash: string }>,
    res: Response,
  ): Promise<void> => {
    try {
      const tx =
        await provider.getTransaction(
          req.params.hash,
        )

      if (!tx) {
        res.status(404).json({
          error: 'Not found',
        })
        return
      }

      console.log("TX: ", JSON.stringify(tx))

      res.json({
        hash: tx.hash,
        from: tx.from,
        to: tx.to,
        value: tx.value.toString(),
        data: tx.data,
        nonce: tx.nonce,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        chainId:
          tx.chainId?.toString(),
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error'

      res.status(500).json({
        error: message,
      })
    }
  },
)

app.get(
  '/nonce',
  auth,
  async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const nonce =
        await provider.getTransactionCount(
          wallet.address,
        )
        console.log("nonce: ", nonce)

      res.json({
        nonce,
      })
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown error'

      res.status(500).json({
        error: message,
      })
    }
  },
)

const port = Number(PORT ?? 3001)

app.listen(port, () => {
  console.log(
    `Listening on port ${port}`,
  )
})

export default app