import { JwtStrategy } from './jwt.strategy';
import { ConfigService } from '@nestjs/config';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy({
      get: jest.fn((key: string) => {
        switch (key) {
          case 'authentik.jwksUri':
            return 'https://test/jwks';

          case 'authentik.issuer':
            return 'https://issuer';

          case 'authentik.audience':
            return 'client-id';
        }
      }),
    } as Pick<ConfigService, 'get'> as ConfigService);
  });

  it('should validate payload', async () => {
    const result = await strategy.validate({
      sub: '123',
      email: 'test@test.com',
      orgId: 'org1',
    });

    expect(result.sub).toBe('123');
  });
});
