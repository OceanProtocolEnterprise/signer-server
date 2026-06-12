import { ethers } from 'ethers'

export class LocalWalletSigner extends ethers.AbstractSigner {
  private readonly wallet: ethers.Wallet

  constructor(privateKey: string, provider: ethers.JsonRpcProvider) {
    super(provider)
    this.wallet = new ethers.Wallet(privateKey, provider)
  }

  async getAddress(): Promise<string> {
    return this.wallet.address
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    return this.wallet.signMessage(message)
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    return this.wallet.signTransaction(tx)
  }

  async sendTransaction(
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    return this.wallet.sendTransaction(tx)
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>,
  ): Promise<string> {
    return this.wallet.signTypedData(domain, types, value)
  }

  connect(provider: ethers.Provider): LocalWalletSigner {
    return new LocalWalletSigner(
      this.wallet.privateKey,
      provider as ethers.JsonRpcProvider,
    )
  }
}