import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class SignMessageDto {
  @ApiProperty({ description: 'Message to sign' })
  @IsString()
  @IsNotEmpty()
  message: string;
}