// src/signer/signer.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers, JsonRpcProvider } from 'ethers';
import { SignerFactory } from './signer.factory';
import {
  ManagedSigner,
  OpenBaoSignerConfig,
  SignerKeyConfig,
  SignerMode,
} from './interfaces/signer-config.interface';
import {
  TransactionResponse,
  SendTransactionResult,
} from './interfaces/signer-responses.interface';

@Injectable()
export class SignerService implements OnModuleInit {
  private readonly logger = new Logger(SignerService.name);
  private nodeUriMap: Record<string, string>;
  private providers = new Map<
    number,
    ethers.JsonRpcProvider
  >();
  private signers = new Map<number, ManagedSigner>();
  private defaultWalletId: number;
  private defaultVaultSigner?: ManagedSigner;
  private signerMode: SignerMode;
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
      this.logger.log('Vault signer mode initialized');
    } else {
      throw new Error(
        `Unknown mode "${signerMode}". Please proceed with supported modes: 'local' or 'vault'`,
      );
    }

    this.nodeUriMap = nodeUriMap;

    this.signers.forEach(({ walletId, address }) => {
      this.logger.log(
        `Wallet ${walletId} initialized with address: ${address}`,
      );
    });
  }

  private getProvider(
    chainId: number,
  ): ethers.JsonRpcProvider {
    this.logger.log(
      `Getting provider for chain ID ${chainId}`,
    );
    const cachedProvider = this.providers.get(chainId);
    this.logger.log(
      `Cached provider for chain ID ${chainId}: ${cachedProvider ? 'found' : 'not found'}`,
    );
    if (cachedProvider) {
      return cachedProvider;
    }

    this.logger.log(
      `Node URI for chain ID ${chainId}: ${this.nodeUriMap[String(chainId)] ? 'configured' : 'not configured'}`,
    );
    const nodeUri = this.nodeUriMap[String(chainId)];
    if (!nodeUri) {
      throw new Error(
        `No node URI configured for chain ID ${chainId}`,
      );
    }

    const provider = new JsonRpcProvider(nodeUri);
    this.logger.log(
      `Provider for chain ID ${chainId} created`,
    );
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
      feeData.gasPrice ?? feeData.maxFeePerGas;

    this.logger.log(
      `Fee payer ${from} balance on chain ID ${chainId}: ${balance.toString()} wei`,
    );

    if (!gasPrice) {
      this.logger.warn(
        `Cannot preflight transaction funds for wallet ${from} on chain ID ${chainId}: missing gas price data`,
      );
      return;
    }

    const required = value + gasEstimate * gasPrice;
    this.logger.log(
      `Transaction funding preflight for ${from} on chain ID ${chainId}: value=${value.toString()} wei, estimatedGas=${gasEstimate.toString()}, gasPrice=${gasPrice.toString()} wei, required=${required.toString()} wei`,
    );

    if (balance < required) {
      this.logger.warn(
        `Insufficient funds for fee payer ${from} on chain ID ${chainId}: balance=${balance.toString()} wei, required=${required.toString()} wei`,
      );
      throw new BadRequestException(
        `Insufficient funds for transaction: wallet ${from} on chain ID ${chainId} has ${balance.toString()} wei, needs at least ${required.toString()} wei`,
      );
    }
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
          this.logger.log(
            `Default Vault wallet resolved with address: ${this.defaultVaultSigner.address}`,
          );
        }

        return this.defaultVaultSigner;
      }

      const openBaoSigner =
        await this.signerFactory.createOpenBaoSigner({
          walletId,
          ...this.openBaoConfig,
        });
      this.signers.set(walletId, openBaoSigner);
      this.logger.log(
        `Vault wallet ${walletId} resolved with address: ${openBaoSigner.address}`,
      );
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
    this.logger.log(
      `Sending transaction from wallet ${signer.walletId}`,
    );
    this.logger.log(
      `Fee payer wallet address: ${signer.address}`,
    );
    this.logger.log(
      `Transaction details: ${JSON.stringify({ to, value, data })}`,
    );
    const provider = this.getProvider(chainId);
    this.logger.log(
      `Using provider for chain ID ${chainId}`,
    );
    const txValue = BigInt(value);
    await this.assertSufficientFunds(
      provider,
      chainId,
      signer.address,
      to,
      txValue,
      data,
    );
    const tx = await signer.signer
      .connect(provider)
      .sendTransaction({
        to,
        value: txValue,
        data,
      });
    this.logger.log(
      `Transaction sent: ${JSON.stringify(tx)}`,
    );
    const receipt = await tx.wait();
    if (!receipt)
      throw new Error('Transaction receipt not available');
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to, // ethers TransactionResponse.to can be null, but we know it's not for our call
      nonce: tx.nonce,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
    };
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
