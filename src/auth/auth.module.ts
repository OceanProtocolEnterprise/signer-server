import { Module } from '@nestjs/common';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PassportModule } from '@nestjs/passport';

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy],
})
export class AuthModule {}