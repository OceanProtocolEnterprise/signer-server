import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class AuthentikGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(
    AuthentikGuard.name,
  );

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(
        IS_PUBLIC_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (isPublic) {
      return true;
    }

    const req =
      context.switchToHttp().getRequest();

    this.logger.log(
      `Authenticating request: ${req.method} ${req.url}`,
    );

    return super.canActivate(context);
  }

  handleRequest(
    err: any,
    user: any,
    info: any,
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

    this.logger.log(
      `Authenticated: ${user.email}`,
    );

    return user;
  }
}