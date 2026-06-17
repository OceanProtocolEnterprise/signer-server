import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';

type AuthentikJwtPayload = {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  auth_time?: number;
  acr?: string;
  amr?: string[];
  nonce?: string;
  sid?: string;
  jti?: string;
  email?: string;
  email_verified?: boolean;
  upstream_idp?: string;
  orgId?: string;
  name?: string;
  given_name?: string;
  preferred_username?: string;
  nickname?: string;
  groups?: string[];
  signerService?: string;
  walletId?: number;
  azp?: string;
  uid?: string;
  scope?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
  'jwt',
) {
  private readonly logger = new Logger(JwtStrategy.name);
  private readonly upstreamIdp?: string;

  constructor(configService: ConfigService) {
    const jwksUri = configService.get<string>(
      'authentik.jwksUri',
    );
    const issuer = configService.get<string>(
      'authentik.issuer',
    );
    const audience = configService.get<string>(
      'authentik.audience',
    );
    const upstreamIdp = configService.get<string>(
      'authentik.upstreamIdp',
    );

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
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      audience,
      algorithms: ['RS256'],
      ignoreExpiration: false,
    });

    this.upstreamIdp = upstreamIdp?.trim();
  }

  async validate(payload: AuthentikJwtPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException(
        'Invalid token payload',
      );
    }

    if (!this.upstreamIdp) {
      throw new ForbiddenException(
        'UPSTREAM_IDP is not configured',
      );
    }

    if (!payload.upstream_idp) {
      throw new ForbiddenException(
        'Missing upstream_idp claim',
      );
    }

    if (payload.upstream_idp !== this.upstreamIdp) {
      throw new ForbiddenException(
        'Invalid upstream_idp claim',
      );
    }

    this.logger.log(
      `Authenticated user ${payload.email} (${payload.sub})`,
    );

    return {
      sub: payload.sub,
      email: payload.email,
      username:
        payload.preferred_username ?? payload.nickname,
      orgId: payload.orgId,
      walletId: payload.walletId,
      upstreamIdp: payload.upstream_idp,
      groups: payload.groups ?? [],
      scope: payload.scope,
    };
  }
}
