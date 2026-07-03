import { Module } from '@nestjs/common';
import { SignerController } from './signer.controller';
import { SignerService } from './signer.service';
import { SignerFactory } from './signer.factory';

@Module({
  controllers: [SignerController],
  providers: [SignerFactory, SignerService],
  exports: [SignerService],
})
export class SignerModule {}
