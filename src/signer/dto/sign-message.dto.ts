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
    description: 'Signer id to use',
    required: false,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  signerId?: number = 1;

  @ApiProperty({ description: 'Message to sign' })
  @IsString()
  @IsNotEmpty()
  message: string;
}
