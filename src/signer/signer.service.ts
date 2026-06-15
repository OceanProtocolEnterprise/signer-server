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
  SignerKeyConfig,
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

  constructor(
    private configService: ConfigService,
    private signerFactory: SignerFactory,
  ) {}

  async onModuleInit() {
    const nodeUriMap =
      this.configService.get<Record<string, string>>(
        'signer.nodeUriMap',
      ) ?? {};
    const privateKeys =
      this.configService.get<SignerKeyConfig[]>(
        'signer.privateKeys',
      ) ?? [];

    if (
      !Object.keys(nodeUriMap).length ||
      !privateKeys.length
    ) {
      throw new Error(
        'Missing signer configuration (NODE_URI_MAP or PRIVATE_KEYS)',
      );
    }

    this.nodeUriMap = nodeUriMap;
    this.signers =
      this.signerFactory.createSigners(privateKeys);
    this.signers.forEach(({ id, address }) => {
      this.logger.log(
        `Signer ${id} initialized with address: ${address}`,
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

  private getSigner(signerId = 1): ManagedSigner {
    const signer = this.signers.get(signerId);
    if (!signer) {
      throw new Error(
        `No signer configured for id ${signerId}`,
      );
    }
    return signer;
  }

  getAddress(signerId = 1): {
    signerId: number;
    address: string;
  } {
    const signer = this.getSigner(signerId);
    return {
      signerId: signer.id,
      address: signer.address,
    };
  }

  async signMessage(
    message: string,
    signerId = 1,
  ): Promise<string> {
    return this.getSigner(signerId).signer.signMessage(
      message,
    );
  }

  async sendTransaction(
    chainId: number,
    to: string,
    value: string = '0',
    data: string = '0x',
    signerId = 1,
  ): Promise<SendTransactionResult> {
    const tx = await this.getSigner(signerId)
      .signer.connect(this.getProvider(chainId))
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
    signerId = 1,
  ): Promise<number> {
    return this.getProvider(chainId).getTransactionCount(
      this.getSigner(signerId).address,
    );
  }
}
