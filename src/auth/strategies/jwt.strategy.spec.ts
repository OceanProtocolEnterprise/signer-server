import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const createStrategy = (upstreamIdp?: string) =>
    new JwtStrategy({
      get: jest.fn((key: string) => {
        switch (key) {
          case 'authentik.jwksUri':
            return 'https://test/jwks';

          case 'authentik.issuer':
            return 'https://issuer';

          case 'authentik.audience':
            return 'client-id';

          case 'authentik.upstreamIdp':
            return upstreamIdp;
        }
      }),
    } as Pick<ConfigService, 'get'> as ConfigService);

  beforeEach(() => {
    strategy = createStrategy('participant-idp');
  });

  const expectForbidden = async (
    promise: Promise<unknown>,
    message: string,
  ) => {
    let error: unknown;

    try {
      await promise;
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getStatus()).toBe(
      403,
    );
    expect((error as ForbiddenException).message).toBe(
      message,
    );
  };

  it('should validate payload', async () => {
    const result = await strategy.validate({
      sub: '123',
      email: 'test@test.com',
      orgId: 'org1',
      walletId: 7,
      upstream_idp: 'participant-idp',
    });

    expect(result.sub).toBe('123');
    expect(result.walletId).toBe(7);
    expect(result.upstreamIdp).toBe('participant-idp');
  });

  it('rejects when UPSTREAM_IDP is not configured', async () => {
    strategy = createStrategy();

    await expectForbidden(
      strategy.validate({
        sub: '123',
        upstream_idp: 'participant-idp',
      }),
      'UPSTREAM_IDP is not configured',
    );
  });

  it('rejects missing upstream_idp claim', async () => {
    await expectForbidden(
      strategy.validate({
        sub: '123',
      }),
      'Missing upstream_idp claim',
    );
  });

  it('rejects mismatched upstream_idp claim', async () => {
    await expectForbidden(
      strategy.validate({
        sub: '123',
        upstream_idp: 'other-idp',
      }),
      'Invalid upstream_idp claim',
    );
  });
});
