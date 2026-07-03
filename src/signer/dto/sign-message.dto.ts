import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  Matches,
  ValidateIf,
} from 'class-validator';

export class SignMessageDto {
  @ApiProperty({
    description: 'Text message to sign',
    required: false,
  })
  @ValidateIf((dto: SignMessageDto) => !dto.rawMessage)
  @IsString()
  @IsNotEmpty()
  message?: string;

  @ApiProperty({
    description: 'Raw message bytes as a hex string',
    required: false,
  })
  @ValidateIf((dto: SignMessageDto) => !dto.message)
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[0-9a-fA-F]*$/)
  rawMessage?: string;
}
