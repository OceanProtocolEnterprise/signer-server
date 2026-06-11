import { ethers } from 'ethers'

interface VaultSignResponse {
  data: {
    signed_transaction: string
    transaction_hash: string
  }
}

interface VaultSignRawResponse {
  data: {
    signature: string
  }
}

interface VaultAccountResponse {
  data: {
    address: string
  }
}

export class VaultSigner extends ethers.AbstractSigner {
  private cachedAddress?: string

  constructor(
    provider: ethers.JsonRpcProvider,
    private readonly vaultUrl: string,
    private readonly vaultToken: string,
    private readonly mount: string,
    private readonly account: string,
    private readonly chainId: number,
  ) {
    super(provider)
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(
      `${this.vaultUrl}/v1/${this.mount}${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Vault-Token': this.vaultToken,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    )

    if (!response.ok) {
      throw new Error(
        `Vault request failed (${response.status}): ${await response.text()}`,
      )
    }

    return (await response.json()) as T
  }

  async getAddress(): Promise<string> {
    if (this.cachedAddress) return this.cachedAddress

    const result = await this.request<VaultAccountResponse>(
      'GET',
      `/accounts/${this.account}`,
    )

    this.cachedAddress = result.data.address
    return this.cachedAddress
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
  const from = await this.getAddress()

  // EIP-191 digest — same as what ethers.Wallet signs internally
  const digest = ethers.hashMessage(message)

  const result = await this.request<VaultSignRawResponse>(
    'POST',
    `/accounts/${from}/signRaw`,
    { data: digest },
  )

  const raw = ethers.getBytes(result.data.signature)
  const r = ethers.hexlify(raw.slice(0, 32))
  const s = ethers.hexlify(raw.slice(32, 64))

  // Normalize v: plugin may return 0/1, 27/28, or omit it (64 bytes)
  if (raw.length === 65) {
    let v = raw[64]
    if (v < 27) v += 27
    const candidate = ethers.Signature.from({ r, s, v }).serialized
    if (
      ethers.verifyMessage(message, candidate).toLowerCase() ===
      from.toLowerCase()
    ) {
      return candidate
    }
  }
    // Fallback: determine recovery id by trying both values
  for (const v of [27, 28]) {
    const candidate = ethers.Signature.from({ r, s, v }).serialized
    if (
      ethers.verifyMessage(message, candidate).toLowerCase() ===
      from.toLowerCase()
    ) {
      return candidate
    }
  }

  throw new Error('Could not determine recovery id for Vault signature')
}

  async signTransaction(_tx: ethers.TransactionRequest): Promise<string> {
    throw new Error('Use sendTransaction — Vault signs and we broadcast')
  }

  async sendTransaction(
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    const provider = this.provider as ethers.JsonRpcProvider
    const from = await this.getAddress()
    const resolved = await ethers.resolveProperties(tx)

    const nonce = await provider.getTransactionCount(from, 'pending')

    const value = resolved.value
      ? BigInt(resolved.value.toString())
      : 0n

    const gasEstimate = await provider.estimateGas({
      from,
      to: resolved.to as string,
      value,
      data: (resolved.data as string) ?? '0x',
    })

    const feeData = await provider.getFeeData()
    const gasPrice = feeData.gasPrice ?? 0n

    const payload = {
      to: resolved.to,
      value: ethers.toBeHex(value),
      data: (resolved.data as string) ?? '0x',
      nonce: ethers.toBeHex(nonce),
      gas: Number(gasEstimate),
      gasPrice: ethers.toBeHex(gasPrice),
      chainId: this.chainId,
    }

    const signed = await this.request<VaultSignResponse>(
      'POST',
      `/accounts/${from}/sign`,
      payload,
    )

    // broadcastTransaction returns a real TransactionResponse — ocean.js can call .wait()
    return provider.broadcastTransaction(signed.data.signed_transaction)
  }

  async signTypedData(): Promise<string> {
    throw new Error('signTypedData not supported by ethsign plugin')
  }

  connect(provider: ethers.Provider): VaultSigner {
    return new VaultSigner(
      provider as ethers.JsonRpcProvider,
      this.vaultUrl,
      this.vaultToken,
      this.mount,
      this.account,
      this.chainId,
    )
  }
}