// src/signer/signer.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { TransactionResponse, SendTransactionResult } from './interfaces/signer-responses.interface';

@Injectable()
export class SignerService implements OnModuleInit {
  private readonly logger = new Logger(SignerService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rpcUrl = this.configService.get<string>('ethereum.rpcUrl');
    const chainId = this.configService.get<number>('ethereum.chainId');
    const privateKey = this.configService.get<string>('ethereum.privateKey');

    if (!rpcUrl || !privateKey) {
      throw new Error('Missing Ethereum configuration (RPC URL or private key)');
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl, { name: 'network', chainId });
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.logger.log(`Signer initialized with address: ${this.wallet.address}`);
  }

  getAddress(): string {
    return this.wallet.address;
  }

  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }

  async sendTransaction(to: string, value: string = '0', data: string = '0x'): Promise<SendTransactionResult> {
    const tx = await this.wallet.sendTransaction({
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

  async getTransaction(hash: string): Promise<TransactionResponse | null> {
    const tx = await this.provider.getTransaction(hash);
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

  async getNonce(): Promise<number> {
    return this.provider.getTransactionCount(this.wallet.address);
  }
}