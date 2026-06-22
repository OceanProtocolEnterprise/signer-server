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
  private nodeUriMap: Record<string, string>;
  private providers = new Map<
    number,
    ethers.JsonRpcProvider
  >();
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
  ) {
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
    const gasPrice =
      maxGasCost ??
      feeData.gasPrice ??
      feeData.maxFeePerGas;

    if (!gasPrice) {
      return;
    }

    const required = value + gasEstimate * gasPrice;

    if (balance < required) {
      throw new BadRequestException(
        `Insufficient funds for transaction: wallet ${from} on chain ID ${chainId} has ${balance.toString()} wei, needs at least ${required.toString()} wei`,
      );
    }
  }

  private async sendAndReturn(
    signer: ethers.AbstractSigner,
    provider: ethers.JsonRpcProvider,
    txRequest: ethers.TransactionRequest,
  ): Promise<SendTransactionResult> {
    const tx = await signer
      .connect(provider)
      .sendTransaction(txRequest);
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to, // ethers TransactionResponse.to can be null, but we know it's not for our call
      nonce: tx.nonce,
    };
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
    message: string,
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

    await this.assertSufficientFunds(
      provider,
      chainId,
      signer.address,
      to,
      txValue,
      data,
      feeData.maxFeePerGas ?? undefined,
    );

    const eip1559Transaction: ethers.TransactionRequest = {
      to,
      value: txValue,
      data,
      type: 2,
    };

    if (feeData.maxFeePerGas != null) {
      eip1559Transaction.maxFeePerGas =
        feeData.maxFeePerGas;
    }

    if (feeData.maxPriorityFeePerGas != null) {
      eip1559Transaction.maxPriorityFeePerGas =
        feeData.maxPriorityFeePerGas;
    }
    try {
      return await this.sendAndReturn(
        signer.signer,
        provider,
        eip1559Transaction,
      );
    } catch (error) {
      this.logger.log(
        'EIP-1559 transaction failed; falling back to legacy transaction',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      const gasPrice =
        feeData.gasPrice ?? feeData.maxFeePerGas;
      const legacyTransaction: ethers.TransactionRequest = {
        to,
        value: txValue,
        data,
      };

      if (gasPrice != null) {
        legacyTransaction.gasPrice = gasPrice;
      }

      return this.sendAndReturn(
        signer.signer,
        provider,
        legacyTransaction,
      );
    }
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
