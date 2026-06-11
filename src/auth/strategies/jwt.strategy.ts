import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    const jwksUri = configService.get<string>('authentik.jwksUri');
    const issuer = configService.get<string>('authentik.issuer');
    const audience = configService.get<string>('authentik.audience');

    if (!jwksUri || !issuer || !audience) {
      throw new Error('Authentik configuration missing');
    }

    super({
      secretOrKeyProvider: passportJwtSecret({
        jwksUri,
        cache: true,
        rateLimit: true,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      audience,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }
    // Attach user info to request
    return { userId: payload.sub, email: payload.email, roles: payload.groups || [] };
  }
}