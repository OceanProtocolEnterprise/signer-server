// src/signer/signer.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { TransactionResponse, SendTransactionResult } from './interfaces/signer-responses.interface';

@Injectable()
export class SignerService implements OnModuleInit {
  private readonly logger = new Logger(SignerService.name);
  private nodeUriMap: Record<string, string>;
  private providers = new Map<number, ethers.JsonRpcProvider>();
  private wallet: ethers.Wallet;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const nodeUriMap = this.configService.get<Record<string, string>>('signer.nodeUriMap') ?? {};
    const privateKey = this.configService.get<string>('signer.privateKey');

    if (!Object.keys(nodeUriMap).length || !privateKey) {
      throw new Error('Missing signer configuration (NODE_URI_MAP or private key)');
    }

    this.nodeUriMap = nodeUriMap;
    this.wallet = new ethers.Wallet(privateKey);
    this.logger.log(`Signer initialized with address: ${this.wallet.address}`);
  }

  private getProvider(chainId: number): ethers.JsonRpcProvider {
    const cachedProvider = this.providers.get(chainId);
    if (cachedProvider) {
      return cachedProvider;
    }

    const nodeUri = this.nodeUriMap[String(chainId)];
    if (!nodeUri) {
      throw new Error(`No node URI configured for chain ID ${chainId}`);
    }

    const provider = new ethers.JsonRpcProvider(nodeUri, { name: 'network', chainId });
    this.providers.set(chainId, provider);
    return provider;
  }

  private getWallet(chainId: number): ethers.Wallet {
    return this.wallet.connect(this.getProvider(chainId));
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }

  async sendTransaction(chainId: number, to: string, value: string = '0', data: string = '0x'): Promise<SendTransactionResult> {
    const tx = await this.getWallet(chainId).sendTransaction({
      to,
      value: BigInt(value),
      data,
    });
    const receipt = await tx.wait();
    if (!receipt) throw new Error('Transaction receipt not available');
    return {
      hash: tx.hash,
      from: tx.from,
      to: tx.to,          // ethers TransactionResponse.to can be null, but we know it's not for our call
      nonce: tx.nonce,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      status: receipt.status,
    };
  }

  async getTransaction(chainId: number, hash: string): Promise<TransactionResponse | null> {
    const tx = await this.getProvider(chainId).getTransaction(hash);
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

  async getNonce(chainId: number): Promise<number> {
    return this.getProvider(chainId).getTransactionCount(this.wallet.address);
  }
}
