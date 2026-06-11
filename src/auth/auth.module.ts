import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthentikGuard } from '../common/guards/authentik.guard';

@Module({
  imports: [PassportModule],
  providers: [
    JwtStrategy,
    AuthentikGuard,
  ],
  exports: [
    AuthentikGuard,
  ],
})
export class AuthModule {}