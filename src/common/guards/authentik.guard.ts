import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { normalizeOrigin } from '../origins';

type AuthenticatedUser = {
  email?: string;
};

@Injectable()
export class AuthentikGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(AuthentikGuard.name);
  private readonly allowedOrigins: Set<string>;

  constructor(
    private reflector: Reflector,
    configService: ConfigService,
  ) {
    super();
    this.allowedOrigins = new Set(
      configService.get<string[]>('allowedOrigins') ?? [],
    );
  }

  canActivate(context: ExecutionContext) {
    const req = context
      .switchToHttp()
      .getRequest<Request>();

    if (this.allowedOrigins.size > 0) {
      const origin = req.get('origin');
      const normalizedOrigin = origin
        ? normalizeOrigin(origin)
        : undefined;

      if (
        !normalizedOrigin ||
        !this.allowedOrigins.has(normalizedOrigin)
      ) {
        this.logger.warn(
          `Rejected request from disallowed origin: ${origin ?? 'missing'}`,
        );
        throw new ForbiddenException(
          'Origin is not allowed',
        );
      }
    }

    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (isPublic) {
      return true;
    }

    this.logger.log(
      `Authenticating request: ${req.method} ${req.url}`,
    );

    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    info?: { message?: string },
    _context?: ExecutionContext,
    _status?: unknown,
  ) {
    if (err || !user) {
      this.logger.error(
        `Authentication failed`,
        info?.message,
      );

      throw (
        err ||
        new UnauthorizedException(
          'Invalid or missing Authentik token',
        )
      );
    }

    const authenticatedUser = user as AuthenticatedUser;
    this.logger.log(
      `Authenticated: ${authenticatedUser.email}`,
    );

    return user;
  }
}
