import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

import { AuthentikGuard } from './authentik.guard';

describe('AuthentikGuard origin checks', () => {
  const createContext = (
    origin?: string,
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: (): Request =>
          ({
            get: jest.fn((header: string) =>
              header.toLowerCase() === 'origin'
                ? origin
                : undefined,
            ) as Request['get'],
            method: 'GET',
            url: '/health',
          }) as Request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    }) as unknown as ExecutionContext;

  const createGuard = (
    allowedOrigins: string[] = [],
    isPublic = true,
  ): AuthentikGuard =>
    new AuthentikGuard(
      {
        getAllAndOverride: jest.fn(() => isPublic),
      } as unknown as Reflector,
      {
        get: jest.fn((key: string) =>
          key === 'allowedOrigins'
            ? allowedOrigins
            : undefined,
        ),
      } as Pick<ConfigService, 'get'> as ConfigService,
    );

  it('allows public routes when ALLOWED_ORIGINS is unset', () => {
    const guard = createGuard();

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows public routes without an origin when allowed origins are configured', () => {
    const guard = createGuard([
      'https://wallet-dev-stage.oceanenterprise.io',
    ]);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows public routes from disallowed origins', () => {
    const guard = createGuard([
      'https://wallet-dev-stage.oceanenterprise.io',
    ]);

    expect(
      guard.canActivate(createContext('https://evil.test')),
    ).toBe(true);
  });

  it('rejects a missing origin on protected routes', () => {
    const guard = createGuard(
      ['https://wallet-dev-stage.oceanenterprise.io'],
      false,
    );

    expect(() =>
      guard.canActivate(createContext()),
    ).toThrow(ForbiddenException);
  });

  it('rejects disallowed origins on protected routes', () => {
    const guard = createGuard(
      ['https://wallet-dev-stage.oceanenterprise.io'],
      false,
    );

    expect(() =>
      guard.canActivate(createContext('https://evil.test')),
    ).toThrow(ForbiddenException);
  });
});
