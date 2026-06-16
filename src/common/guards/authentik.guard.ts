import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

type AuthenticatedUser = {
  email?: string;
};

@Injectable()
export class AuthentikGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(AuthentikGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [context.getHandler(), context.getClass()],
      );

    if (isPublic) {
      return true;
    }

    const req = context
      .switchToHttp()
      .getRequest<Request>();

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
