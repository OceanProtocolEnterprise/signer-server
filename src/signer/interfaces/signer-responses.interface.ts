// src/signer/interfaces/signer-responses.interface.ts
import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';

export class AddressResponse {
  @ApiPropertyOptional()
  walletId?: number;
  @ApiProperty()
  address: string;
}

export class SignMessageResponse {
  @ApiProperty()
  signature: string;
  @ApiPropertyOptional()
  walletId?: number;
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
  blockHash: string;
  @ApiProperty()
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

export class AvailableNetworkResponse {
  @ApiProperty()
  chainId: number;

  @ApiPropertyOptional()
  name?: string;
}

export class AvailableNetworksResponse {
  @ApiProperty({ type: [AvailableNetworkResponse] })
  networks: AvailableNetworkResponse[];
}
