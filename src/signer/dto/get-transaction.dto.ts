import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class GetTransactionDto {
  @ApiProperty({ description: 'Transaction hash' })
  @IsString()
  @IsNotEmpty()
  hash: string;
}