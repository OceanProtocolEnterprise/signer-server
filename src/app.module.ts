import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validate } from './config/validation';
import { AuthModule } from './auth/auth.module';
import { SignerModule } from './signer/signer.module';

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
})
export class AppModule {}