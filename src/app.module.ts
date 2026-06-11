import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { validate } from './config/validation';

import { AuthModule } from './auth/auth.module';
import { SignerModule } from './signer/signer.module';

import { AuthentikGuard } from './common/guards/authentik.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      validate,
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    AuthModule,
    SignerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AuthentikGuard,
    },
  ],
})
export class AppModule {}