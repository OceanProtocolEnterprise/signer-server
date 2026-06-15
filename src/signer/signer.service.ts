// src/signer/signer.service.ts
import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
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
      this.configService.get<SignerMode>('signer.mode');
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

    this.nodeUriMap = nodeUriMap;
    this.signerMode = signerMode;
    if (signerMode === 'local') {
      if (!privateKeys.length) {
        throw new Error(
          'Missing signer configuration (PRIVATE_KEYS)',
        );
      }

      this.signers =
        this.signerFactory.createLocalSigners(privateKeys);
      this.defaultWalletId = privateKeys[0].walletId;
    } else {
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
    }

    this.signers.forEach(({ walletId, address }) => {
      this.logger.log(
        `Wallet ${walletId} initialized with address: ${address}`,
      );
    });
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
      throw new Error(
        `No node URI configured for chain ID ${chainId}`,
      );
    }

    const provider = new ethers.JsonRpcProvider(nodeUri, {
      name: 'network',
      chainId,
    });
    this.providers.set(chainId, provider);
    return provider;
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

      if (!walletId) {
        throw new Error(
          'walletId is required when SIGNER_MODE=vault',
        );
      }

      if (!this.openBaoConfig) {
        throw new Error(
          'Vault signer configuration is not initialized',
        );
      }

      const openBaoSigners =
        await this.signerFactory.createOpenBaoSigners({
          walletId,
          ...this.openBaoConfig,
        });
      const openBaoSigner = openBaoSigners.get(walletId);
      if (!openBaoSigner) {
        throw new Error(
          `No Vault wallet resolved for id ${walletId}`,
        );
      }

      this.signers.set(walletId, openBaoSigner);
      this.logger.log(
        `Vault wallet ${walletId} resolved with address: ${openBaoSigner.address}`,
      );
      return openBaoSigner;
    }
    return signer;
  }

  async getAddress(walletId?: number): Promise<{
    walletId: number;
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
    const tx = await signer.signer
      .connect(this.getProvider(chainId))
      .sendTransaction({
        to,
        value: BigInt(value),
        data,
      });
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
