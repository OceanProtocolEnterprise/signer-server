import {
  generateKeyPairSync,
  KeyObject,
  sign,
} from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { JwksClient } from 'jwks-rsa';

import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy signature verification', () => {
  const rsa = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const ec = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const otherEc = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const ec384 = generateKeyPairSync('ec', {
    namedCurve: 'secp384r1',
  });
  let strategy: JwtStrategy;

  beforeEach(() => {
    // Stub only JWKS transport; exercise key conversion and JWT verification.
    jest
      .spyOn(JwksClient.prototype, 'getKeys')
      .mockResolvedValue(
        [
          { pair: rsa, alg: 'RS256' },
          { pair: ec, alg: 'ES256' },
          { pair: ec384, alg: 'ES384' },
        ].map(({ pair, alg }) => ({
          ...pair.publicKey.export({ format: 'jwk' }),
          kid: alg,
          alg,
          use: 'sig',
        })),
      );
    const config: Record<string, string> = {
      'authentik.jwksUri': 'https://test/jwks',
      'authentik.issuer': 'https://issuer',
      'authentik.audience': 'client-id',
      'authentik.upstreamIdp': 'participant-idp',
    };
    strategy = new JwtStrategy({
      get: (key: string) => config[key],
    } as ConfigService);
  });

  afterEach(() => jest.restoreAllMocks());

  const createToken = (
    alg: string,
    privateKey: KeyObject,
    claims: Record<string, unknown> = {},
    kid = alg,
  ) => {
    const encode = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString(
        'base64url',
      );
    const input = [
      encode({ alg, kid, typ: 'JWT' }),
      encode({
        sub: 'test-user',
        iss: 'https://issuer',
        aud: 'client-id',
        exp: Math.floor(Date.now() / 1000) + 300,
        upstream_idp: 'participant-idp',
        ...claims,
      }),
    ].join('.');
    const signature = sign(
      alg === 'ES384' ? 'sha384' : 'sha256',
      Buffer.from(input),
      { key: privateKey, dsaEncoding: 'ieee-p1363' },
    );
    return `${input}.${signature.toString('base64url')}`;
  };

  const authenticate = (token: string) =>
    new Promise<unknown>((resolve, reject) => {
      strategy.success = resolve;
      strategy.fail = reject;
      strategy.error = reject;
      strategy.authenticate({
        headers: { authorization: `Bearer ${token}` },
      } as Request);
    });

  it.each([
    ['RS256', rsa],
    ['ES256', ec],
  ] as const)(
    'accepts a valid %s token from JWKS',
    async (alg, pair) => {
      await expect(
        authenticate(createToken(alg, pair.privateKey)),
      ).resolves.toMatchObject({
        sub: 'test-user',
        upstreamIdp: 'participant-idp',
      });
    },
  );

  it('rejects ES384 even when its public key is in JWKS', async () => {
    await expect(
      authenticate(createToken('ES384', ec384.privateKey)),
    ).rejects.toThrow('invalid algorithm');
  });

  it('rejects an ES256 signature from a different key', async () => {
    await expect(
      authenticate(
        createToken('ES256', otherEc.privateKey),
      ),
    ).rejects.toThrow('invalid signature');
  });

  it('rejects a token with an unknown key ID', async () => {
    await expect(
      authenticate(
        createToken('ES256', ec.privateKey, {}, 'unknown'),
      ),
    ).rejects.toThrow(
      'secret or public key must be provided',
    );
  });

  it.each([
    [{ iss: 'https://other-issuer' }, 'jwt issuer invalid'],
    [{ aud: 'other-client' }, 'jwt audience invalid'],
    [{ exp: 1 }, 'jwt expired'],
    [
      { upstream_idp: 'other-idp' },
      'Invalid upstream_idp claim',
    ],
  ])(
    'rejects ES256 with invalid claims %j',
    async (claims, message) => {
      await expect(
        authenticate(
          createToken('ES256', ec.privateKey, claims),
        ),
      ).rejects.toThrow(message);
    },
  );
});
