import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsEthereumAddress } from 'class-validator';

export class SendTransactionDto {
  @ApiProperty({ description: 'Recipient address' })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: 'Value in wei', required: false, default: '0' })
  @IsString()
  @IsOptional()
  value?: string = '0';

  @ApiProperty({ description: 'Transaction data (hex)', required: false, default: '0x' })
  @IsString()
  @IsOptional()
  data?: string = '0x';
}