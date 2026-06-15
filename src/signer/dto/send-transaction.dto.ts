import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEthereumAddress,
  IsInt,
  Min,
} from 'class-validator';

export class SendTransactionDto {
  @ApiProperty({
    description: 'Signer id to use',
    required: false,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  signerId?: number = 1;

  @ApiProperty({
    description: 'Chain ID for the network RPC to use',
    example: 11155111,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  chainId: number;

  @ApiProperty({ description: 'Recipient address' })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({
    description: 'Value in wei',
    required: false,
    default: '0',
  })
  @IsString()
  @IsOptional()
  value?: string = '0';

  @ApiProperty({
    description: 'Transaction data (hex)',
    required: false,
    default: '0x',
  })
  @IsString()
  @IsOptional()
  data?: string = '0x';
}
