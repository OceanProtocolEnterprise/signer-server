import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class SignMessageDto {
  @ApiProperty({
    description:
      'Wallet id to use. Defaults to the first configured wallet.',
    required: false,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  walletId?: number;

  @ApiProperty({ description: 'Message to sign' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
