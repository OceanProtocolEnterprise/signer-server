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

  @ApiProperty({
    description:
      'Optional fee multiplier percentage applied to RPC fee suggestions before signing. 200 means 200%.',
    required: false,
    default: 200,
  })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @IsOptional()
  feeBumpPercent?: number = 200;
}
