// src/signer/signer.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, JsonRpcProvider, Network } from 'ethers';
import { SignerFactory } from './signer.factory';
import {
  ManagedSigner,
  OpenBaoSignerConfig,
  SignerKeyConfig,
  SignerMode,
} from './interfaces/signer-config.interface';
import {
  AvailableNetworkResponse,
  TransactionResponse,
  SendTransactionResult,
} from './interfaces/signer-responses.interface';

@Injectable()
export class SignerService implements OnModuleInit {
  private static readonly transactionWaitTimeoutMs = 180_000;
  private static readonly defaultGasLimitBumpPercent = 120;

  private nodeUriMap: Record<string, string>;
  private providers = new Map<
    number,
    ethers.JsonRpcProvider
  >();
  private transactionQueues = new Map<
    string,
    Promise<unknown>
  >();
  private nextNonces = new Map<string, number>();
  private signers = new Map<number, ManagedSigner>();
  private defaultWalletId: number;
  private defaultVaultSigner?: ManagedSigner;
  private signerMode: SignerMode;
  private readonly logger = new Logger(SignerService.name);
  private openBaoConfig?: Omit<
    OpenBaoSignerConfig,
    'walletId'
  >;

  constructor(
    private configService: ConfigService,
    private signerFactory: SignerFactory,
  ) {}

  async onModuleInit() {
    const nodeUriMap =
      this.configService.get<Record<string, string>>(
        'signer.nodeUriMap',
      ) ?? {};
    const signerMode =
      this.configService.get<string>('signer.mode');
    const privateKeys =
      this.configService.get<SignerKeyConfig[]>(
        'signer.privateKeys',
      ) ?? [];
    const openBaoConfig =
      this.configService.get<Partial<OpenBaoSignerConfig>>(
        'signer.openBao',
      ) ?? {};

    if (!signerMode) {
      throw new Error(
        'SIGNER_MODE must be either local or vault',
      );
    }

    if (!Object.keys(nodeUriMap).length) {
      throw new Error(
        'Missing signer configuration (NODE_URI_MAP)',
      );
    }

    if (signerMode === 'local') {
      this.signerMode = signerMode;
      if (!privateKeys.length) {
        throw new Error(
          'Missing signer configuration (PRIVATE_KEYS)',
        );
      }

      this.signers =
        this.signerFactory.createLocalSigners(privateKeys);
      this.defaultWalletId = privateKeys[0].walletId;
    } else if (signerMode === 'vault') {
      this.signerMode = signerMode;
      if (
        !openBaoConfig.url ||
        !openBaoConfig.token ||
        !openBaoConfig.ethereumMount ||
        !openBaoConfig.kvStorePath ||
        !openBaoConfig.timeoutMs
      ) {
        throw new Error(
          'Missing Vault signer configuration (VAULT_URL, VAULT_TOKEN, VAULT_ETHEREUM_MOUNT, VAULT_KV_STORE_PATH, or VAULT_TIMEOUT_MS)',
        );
      }

      this.openBaoConfig = {
        url: openBaoConfig.url,
        token: openBaoConfig.token,
        ethereumMount: openBaoConfig.ethereumMount,
        kvStorePath: openBaoConfig.kvStorePath,
        timeoutMs: openBaoConfig.timeoutMs,
      };
    } else {
      throw new Error(
        `Unknown mode "${signerMode}". Please proceed with supported modes: 'local' or 'vault'`,
      );
    }

    this.nodeUriMap = nodeUriMap;
  }

  private getProvider(
    chainId: number,
  ): ethers.JsonRpcProvider {
    const cachedProvider = this.providers.get(chainId);
    if (cachedProvider) {
      return cachedProvider;
    }

    const nodeUri = this.nodeUriMap[String(chainId)];
    if (!nodeUri) {
      throw new BadRequestException(
        `Unsupported chain ID ${chainId}`,
      );
    }

    const provider = new JsonRpcProvider(nodeUri);
    this.providers.set(chainId, provider);
    return provider;
  }

  private async assertSufficientFunds(
    provider: ethers.JsonRpcProvider,
    chainId: number,
    from: string,
    to: string,
    value: bigint,
    data: string,
    maxGasCost?: bigint,
  ): Promise<bigint> {
    const [balance, feeData, gasEstimate] =
      await Promise.all([
        provider.getBalance(from),
        provider.getFeeData(),
        provider.estimateGas({
          from,
          to,
          value,
          data,
        }),
      ]);
    const gasPrice = maxGasCost ?? feeData.gasPrice;
    const gasLimit =
      (gasEstimate *
        BigInt(SignerService.defaultGasLimitBumpPercent) +
        99n) /
      100n;

    if (!gasPrice) {
      return gasLimit;
    }

    const required = value + gasLimit * gasPrice;

    if (balance < required) {
      throw new BadRequestException(
        `Insufficient funds for transaction: wallet ${from} on chain ID ${chainId} has ${balance.toString()} wei, needs at least ${required.toString()} wei`,
      );
    }

    return gasLimit;
  }

  private async send(
    signer: ethers.AbstractSigner,
    provider: ethers.JsonRpcProvider,
    txRequest: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    return signer
      .connect(provider)
      .sendTransaction(txRequest);
  }

  private enqueueTransaction<T>(
    chainId: number,
    address: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const queueKey = `${chainId}:${address.toLowerCase()}`;
    const previousTransaction =
      this.transactionQueues.get(queueKey) ??
      Promise.resolve();
    const transaction = previousTransaction
      .catch(() => undefined)
      .then(operation);

    this.transactionQueues.set(queueKey, transaction);

    const clearQueue = () => {
      if (
        this.transactionQueues.get(queueKey) === transaction
      ) {
        this.transactionQueues.delete(queueKey);
      }
    };

    void transaction.then(clearQueue, clearQueue);
    return transaction;
  }

  private async sendNextTransaction(
    chainId: number,
    address: string,
    signer: ethers.AbstractSigner,
    provider: ethers.JsonRpcProvider,
    transaction: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    const nonceKey = `${chainId}:${address.toLowerCase()}`;
    const pendingNonce = await provider.getTransactionCount(
      address,
      'pending',
    );
    const nonce = Math.max(
      pendingNonce,
      this.nextNonces.get(nonceKey) ?? pendingNonce,
    );

    try {
      const response = await this.send(signer, provider, {
        ...transaction,
        nonce,
      });
      this.nextNonces.set(nonceKey, nonce + 1);
      return response;
    } catch (error) {
      this.nextNonces.delete(nonceKey);
      throw error;
    }
  }

  private bumpFee(
    value: bigint | null | undefined,
    feeBumpPercent: number,
  ) {
    if (value == null) return undefined;

    const multiplier = BigInt(feeBumpPercent);
    return (value * multiplier + 99n) / 100n;
  }

  private getBumpedFeeData(
    feeData: ethers.FeeData,
    feeBumpPercent: number,
  ) {
    return {
      gasPrice: this.bumpFee(
        feeData.gasPrice,
        feeBumpPercent,
      ),
    };
  }

  private getFeeBumpPercent(chainId: number) {
    const feeBumpPercentByChain =
      this.configService.get<Record<string, number>>(
        'signer.feeBumpPercentByChain',
      ) ?? {};

    return feeBumpPercentByChain[String(chainId)] ?? 100;
  }

  private stringifyForLog(value: unknown) {
    return JSON.stringify(value, (_key, propertyValue) =>
      typeof propertyValue === 'bigint'
        ? propertyValue.toString()
        : propertyValue,
    );
  }

  private isTransactionWaitTimeout(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'TIMEOUT'
    );
  }

  private async waitAndReturn(
    tx: ethers.TransactionResponse,
  ): Promise<SendTransactionResult> {
    this.logger.log(
      `Transaction sent; waiting for receipt: ${JSON.stringify(
        {
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          nonce: tx.nonce,
        },
      )}`,
    );

    const result = {
      hash: tx.hash,
      from: tx.from,
      to: tx.to, // ethers TransactionResponse.to can be null, but we know it's not for our call
      nonce: tx.nonce,
    };

    let receipt: ethers.TransactionReceipt | null;
    try {
      receipt = await tx.wait(
        1,
        SignerService.transactionWaitTimeoutMs,
      );
    } catch (error) {
      if (!this.isTransactionWaitTimeout(error)) {
        throw error;
      }

      this.logger.warn(
        `Transaction receipt wait timed out; returning pending transaction: ${JSON.stringify(
          result,
        )}`,
      );

      return result;
    }

    if (!receipt) {
      this.logger.warn(
        `Transaction receipt was not available; returning pending transaction: ${JSON.stringify(
          result,
        )}`,
      );

      return result;
    }

    this.logger.log(
      `Transaction confirmed; returning response: ${JSON.stringify(
        result,
      )}`,
    );

    return result;
  }

  private async getSigner(
    walletId?: number,
  ): Promise<ManagedSigner> {
    const resolvedWalletId =
      walletId ?? this.defaultWalletId;
    const signer = this.signers.get(resolvedWalletId);
    if (!signer) {
      if (this.signerMode !== 'vault') {
        throw new Error(
          `No wallet configured for id ${resolvedWalletId}`,
        );
      }

      if (!this.openBaoConfig) {
        throw new Error(
          'Vault signer configuration is not initialized',
        );
      }

      if (walletId === undefined) {
        if (!this.defaultVaultSigner) {
          this.defaultVaultSigner =
            await this.signerFactory.createOpenBaoSigner({
              ...this.openBaoConfig,
            });
        }

        return this.defaultVaultSigner;
      }

      const openBaoSigner =
        await this.signerFactory.createOpenBaoSigner({
          walletId,
          ...this.openBaoConfig,
        });
      this.signers.set(walletId, openBaoSigner);
      return openBaoSigner;
    }
    return signer;
  }

  async getAddress(walletId?: number): Promise<{
    walletId?: number;
    address: string;
  }> {
    const signer = await this.getSigner(walletId);
    return {
      walletId: signer.walletId,
      address: signer.address,
    };
  }

  getAvailableNetworks(): AvailableNetworkResponse[] {
    return Object.keys(this.nodeUriMap)
      .map((chainId) => Number(chainId))
      .filter((chainId) => Number.isInteger(chainId))
      .sort((left, right) => left - right)
      .map((chainId) => {
        const networkName = Network.from(chainId).name;
        return {
          chainId,
          ...(networkName !== 'unknown'
            ? { name: networkName }
            : {}),
        };
      });
  }

  async signMessage(
    message: string | Uint8Array,
    walletId?: number,
  ): Promise<string> {
    return (
      await this.getSigner(walletId)
    ).signer.signMessage(message);
  }

  async sendTransaction(
    chainId: number,
    to: string,
    value: string = '0',
    data: string = '0x',
    walletId?: number,
  ): Promise<SendTransactionResult> {
    const signer = await this.getSigner(walletId);
    const provider = this.getProvider(chainId);
    const txValue = BigInt(value);
    const feeData = await provider.getFeeData();
    this.logger.log(
      `feeData: ${this.stringifyForLog(feeData)}`,
    );
    const bumpedFeeData = this.getBumpedFeeData(
      feeData,
      this.getFeeBumpPercent(chainId),
    );
    this.logger.log(
      `bumpedFeeData: ${this.stringifyForLog(bumpedFeeData)}`,
    );

    const gasLimit = await this.assertSufficientFunds(
      provider,
      chainId,
      signer.address,
      to,
      txValue,
      data,
      bumpedFeeData.gasPrice,
    );

    const legacyTransaction: ethers.TransactionRequest = {
      to,
      value: txValue,
      data,
      type: 0,
      gasLimit,
    };

    if (bumpedFeeData.gasPrice != null) {
      legacyTransaction.gasPrice = bumpedFeeData.gasPrice;
    }

    const tx = await this.enqueueTransaction(
      chainId,
      signer.address,
      () =>
        this.sendNextTransaction(
          chainId,
          signer.address,
          signer.signer,
          provider,
          legacyTransaction,
        ),
    );

    return this.waitAndReturn(tx);
  }

  async getTransaction(
    chainId: number,
    hash: string,
  ): Promise<TransactionResponse | null> {
    const tx =
      await this.getProvider(chainId).getTransaction(hash);
    if (!tx) return null;
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,
      value: tx.value.toString(),
      data: tx.data,
      nonce: tx.nonce,
      blockNumber: tx.blockNumber,
      blockHash: tx.blockHash,
      chainId: tx.chainId?.toString(),
    };
  }

  async getNonce(
    chainId: number,
    walletId?: number,
  ): Promise<number> {
    const signer = await this.getSigner(walletId);
    return this.getProvider(chainId).getTransactionCount(
      signer.address,
    );
  }
}
