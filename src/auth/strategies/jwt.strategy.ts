import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

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
        cacheMaxEntries: 10,
        cacheMaxAge: 600000,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      audience,
      algorithms: ['RS256'],
      ignoreExpiration: false,
    });

    this.logger.log(`JWT Strategy initialized`);
    this.logger.log(`JWKS URI: ${jwksUri}`);
    this.logger.log(`Issuer: ${issuer}`);
    this.logger.log(`Audience: ${audience}`);
  }

  async validate(payload: any) {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token payload');
    }

    this.logger.log(
      `Authenticated user ${payload.email} (${payload.sub})`,
    );

    return {
      sub: payload.sub,
      email: payload.email,
      username:
        payload.preferred_username ??
        payload.nickname,
      orgId: payload.orgId,
      orgWalletId: payload.orgWalletId,
      groups: payload.groups ?? [],
      scope: payload.scope,
    };
  }
}