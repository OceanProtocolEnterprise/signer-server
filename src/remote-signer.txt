import { ethers, TransactionRequest, TransactionResponse } from 'ethers'
import { AddressResponse, SendTransactionResponse, SignMessageResponse } from './types/interfaces.js'
import { JsonRpcProvider } from 'ethers'

export class RemoteSigner extends ethers.AbstractSigner {
  private serviceUrl: string
  private secret: string
  private address: string

  constructor(
    serviceUrl: string,
    secret: string,
    address: string,
    provider: JsonRpcProvider,
  ) {
    super(provider)

    this.serviceUrl = serviceUrl.replace(/\/$/, '')
    this.secret = secret
    this.address = address
  }

  private async invokeApi<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<any> {
    const response = await fetch(`${this.serviceUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': this.secret,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error ?? `Service error ${response.status}`)
    }

    return data
  }
override async getAddress(): Promise<string> {
    return this.address
  }

  override async signMessage(
    message: string | Uint8Array,
  ): Promise<string> {
    const data = await this.invokeApi<SignMessageResponse>(
      'POST',
      '/sign-message',
      {
        message:
          typeof message === 'string'
            ? message
            : ethers.hexlify(message),
      },
    )

    return data.signature
  }

  override async signTransaction(
    _tx: TransactionRequest,
  ): Promise<string> {
    throw new Error(
      'Use sendTransaction — backend signs and broadcasts in one call',
    )
  }

  override async sendTransaction(
    tx: TransactionRequest,
  ): Promise<TransactionResponse> {
    const resolved = await ethers.resolveProperties(tx)

    const data = await this.invokeApi<SendTransactionResponse>(
      'POST',
      '/send-transaction',
      {
        to: resolved.to,
        value: resolved.value?.toString() ?? '0',
        data: resolved.data ?? '0x',
      },
    )

    const fullTx = await this.provider!.getTransaction(data.hash)

    if (!fullTx) {
      throw new Error(`Transaction ${data.hash} not found`)
    }

    return fullTx
  }

  override async signTypedData(): Promise<string> {
    throw new Error('signTypedData not implemented')
  }

  override connect(provider: ethers.Provider): RemoteSigner {
    return new RemoteSigner(
      this.serviceUrl,
      this.secret,
      this.address,
      provider as JsonRpcProvider,
    )
  }
}

export async function createRemoteSigner(
  serviceUrl: string,
  secret: string,
  rpcUrl: string,
  chainId: number,
): Promise<RemoteSigner> {
  const provider = new ethers.JsonRpcProvider(rpcUrl, {
    name: 'network',
    chainId,
  })

  const response = await fetch(`${serviceUrl}/address`, {
    headers: {
      'X-Api-Key': secret,
    },
  })

  if (!response.ok) {
    throw new Error(
      `Cannot connect to signer service at ${serviceUrl}`,
    )
  }

  const { address } = (await response.json()) as AddressResponse

  return new RemoteSigner(
    serviceUrl,
    secret,
    address,
    provider,
  )
}