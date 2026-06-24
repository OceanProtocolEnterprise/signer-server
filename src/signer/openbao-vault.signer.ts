import { ethers } from 'ethers';

type VaultAccountResponse = {
  data: {
    data: {
      address: string;
    };
  };
};

type VaultAccountsResponse = {
  data: {
    keys: string[];
  };
};

type VaultSignRawResponse = {
  data: {
    signature: string;
  };
};

type VaultSignTransactionResponse = {
  data: {
    signed_transaction: string;
  };
};

const DEFAULT_VAULT_TIMEOUT_MS = 10000;

export class OpenBaoVaultSigner
  extends ethers.AbstractSigner
{
  private readonly vaultUrl: string;
  private cachedAddresses = new Map<number, string>();
  private cachedDefaultAddress?: string;

  constructor(
    vaultUrl: string,
    private readonly vaultToken: string,
    private readonly ethereumMount: string,
    private readonly kvStorePath: string,
    private readonly timeoutMs = DEFAULT_VAULT_TIMEOUT_MS,
    provider?: ethers.Provider,
    private readonly walletId?: number,
  ) {
    super(provider);
    this.vaultUrl = vaultUrl.replace(/\/+$/, '');
    this.ethereumMount = ethereumMount.replace(
      /^\/+|\/+$/g,
      '',
    );
    this.kvStorePath = kvStorePath.replace(
      /^\/+|\/+$/g,
      '',
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const response = await fetch(
        `${this.vaultUrl}/v1/${path.replace(/^\/+/, '')}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Vault-Token': this.vaultToken,
          },
          signal: controller.signal,
          ...(body ? { body: JSON.stringify(body) } : {}),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Vault request failed (${response.status}): ${await response.text()}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (
        error instanceof Error &&
        error.name === 'AbortError'
      ) {
        throw new Error(
          `Vault request timed out after ${this.timeoutMs}ms`,
        );
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getAddress(
    walletId = this.walletId,
  ): Promise<string> {
    if (walletId === undefined) {
      if (this.cachedDefaultAddress) {
        return this.cachedDefaultAddress;
      }

      const result =
        await this.request<VaultAccountsResponse>(
          'LIST',
          `${this.ethereumMount}/accounts`,
        );
      const [firstAccount] = result.data.keys;
      if (!firstAccount) {
        throw new Error('No Vault Ethereum accounts found');
      }

      this.cachedDefaultAddress = firstAccount.replace(
        /\/+$/,
        '',
      );
      return this.cachedDefaultAddress;
    }

    const cachedAddress =
      this.cachedAddresses.get(walletId);
    if (cachedAddress) {
      return cachedAddress;
    }

    const result = await this.request<VaultAccountResponse>(
      'GET',
      `${this.kvStorePath}/data/wallets/by-id/${walletId}`,
    );
    const address = result.data.data.address;
    this.cachedAddresses.set(walletId, address);
    return address;
  }

  async signMessage(
    message: string | Uint8Array,
  ): Promise<string> {
    const address = await this.getAddress();
    const digest = ethers.hashMessage(message);
    const result = await this.request<VaultSignRawResponse>(
      'POST',
      `${this.ethereumMount}/accounts/${address}/signRaw`,
      {
        payload: digest,
      },
    );

    const raw = ethers.getBytes(result.data.signature);
    const r = ethers.hexlify(raw.slice(0, 32));
    const s = ethers.hexlify(raw.slice(32, 64));

    if (raw.length === 65) {
      let v = raw[64];
      if (v < 27) {
        v += 27;
      }

      const signature = ethers.Signature.from({
        r,
        s,
        v,
      }).serialized;
      if (
        ethers
          .verifyMessage(message, signature)
          .toLowerCase() === address.toLowerCase()
      ) {
        return signature;
      }
    }

    for (const v of [27, 28]) {
      const signature = ethers.Signature.from({
        r,
        s,
        v,
      }).serialized;
      if (
        ethers
          .verifyMessage(message, signature)
          .toLowerCase() === address.toLowerCase()
      ) {
        return signature;
      }
    }

    throw new Error(
      'Could not determine recovery id for Vault signature',
    );
  }

  async signTransaction(
    _tx: ethers.TransactionRequest,
  ): Promise<string> {
    throw new Error(
      'Use sendTransaction for Vault transaction signing',
    );
  }

  async sendTransaction(
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    if (!this.provider) {
      throw new Error(
        'Vault signer requires a provider to send transactions',
      );
    }

    const from = await this.getAddress();
    const resolved = await ethers.resolveProperties(tx);
    const nonce = await this.provider.getTransactionCount(
      from,
      'pending',
    );
    const network = await this.provider.getNetwork();
    const value = resolved.value
      ? BigInt(resolved.value.toString())
      : 0n;
    const data =
      (resolved.data as string | undefined) ?? '0x';
    const feeData = await this.provider.getFeeData();
    const gasPrice =
      resolved.gasPrice != null
        ? BigInt(resolved.gasPrice.toString())
        : (feeData.gasPrice ?? 0n);
    const gasEstimate = await this.provider.estimateGas({
      from,
      to: resolved.to as string,
      value,
      data,
    });
    const gasLimit =
      resolved.gasLimit != null
        ? BigInt(resolved.gasLimit.toString())
        : gasEstimate;

    const result =
      await this.request<VaultSignTransactionResponse>(
        'POST',
        `${this.ethereumMount}/accounts/${from}/sign`,
        {
          to: resolved.to,
          value: ethers.toBeHex(value),
          data,
          nonce: ethers.toBeHex(nonce),
          gas: Number(gasLimit),
          chainId: Number(network.chainId),
          gasPrice: ethers.toBeHex(gasPrice),
        },
      );
    const signedTransaction =
      result.data.signed_transaction;

    return this.provider.broadcastTransaction(
      signedTransaction,
    );
  }

  async signTypedData(): Promise<string> {
    throw new Error(
      'Vault typed data signing is not supported',
    );
  }

  connect(provider: ethers.Provider): OpenBaoVaultSigner {
    const signer = new OpenBaoVaultSigner(
      this.vaultUrl,
      this.vaultToken,
      this.ethereumMount,
      this.kvStorePath,
      this.timeoutMs,
      provider,
      this.walletId,
    );
    signer.cachedAddresses = new Map(this.cachedAddresses);
    signer.cachedDefaultAddress = this.cachedDefaultAddress;
    return signer;
  }
}
