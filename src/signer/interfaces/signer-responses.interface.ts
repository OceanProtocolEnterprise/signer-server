// src/signer/interfaces/signer-responses.interface.ts
import { ApiProperty } from '@nestjs/swagger';

export class AddressResponse {
  @ApiProperty()
  address: string;
}

export class SignMessageResponse {
  @ApiProperty()
  signature: string;
  @ApiProperty()
  address: string;
}

export class SendTransactionResult {
  @ApiProperty()
  hash: string;
  @ApiProperty()
  from: string;
  @ApiProperty({ nullable: true })
  to: string | null;   
  @ApiProperty()
  nonce: number;
  @ApiProperty()
  blockNumber: number;
  @ApiProperty()
  gasUsed: string;
  @ApiProperty({ nullable: true })   
  status: number | null; 
}
export type SendTransactionResponse = SendTransactionResult;

export class TransactionResponse {
  @ApiProperty()
  hash: string;
  @ApiProperty()
  from: string;
  @ApiProperty({ nullable: true })
  to: string | null;
  @ApiProperty()
  value: string;
  @ApiProperty()
  data: string;
  @ApiProperty()
  nonce: number;
  @ApiProperty({ nullable: true })
  blockNumber: number | null;
  @ApiProperty({ nullable: true })
  blockHash: string | null;
  @ApiProperty()
  chainId: string;
}

export class NonceResponse {
  @ApiProperty()
  nonce: number;
}