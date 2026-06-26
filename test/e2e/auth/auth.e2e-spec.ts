import {
  TestApp,
  createTestApp,
  generateInvalidHeaders,
  TEST_VALID_JWT,
  TEST_EXPIRED_JWT,
  skipIfNoValidToken,
} from '../setup/test-config';

describe('Authentication E2E Tests', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp({
      signerMode: 'local',
      privateKeys: [
        {
          walletId: 1,
          key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
        },
      ],
      nodeUriMap: [
        {
          '11155111': {
            key: 'https://eth-sepolia.g.alchemy.com/v2/test',
            multiplier: 3,
          },
        },
      ],
    });
  });

  afterAll(async () => {
    await testApp.close();
  });

  describe('Public Endpoints', () => {
    it('should allow access to health endpoint without authentication', async () => {
      const response = await testApp
        .request()
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'signer-service',
      });
    });

    it('should reject access to protected /me endpoint without authentication', async () => {
      const response = await testApp
        .request()
        .get('/me')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });
  });

  describe('Protected Endpoints - Authentication', () => {
    it('should reject requests without Authorization header', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should reject requests with invalid JWT token', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .set(generateInvalidHeaders())
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should reject requests with malformed JWT token', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', 'Bearer malformed.token.here')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should reject requests with expired JWT token', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', `Bearer ${TEST_EXPIRED_JWT}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should reject tokens with missing sub claim', async () => {
      const invalidToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature';

      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should reject requests with empty Authorization header', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', '')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should reject requests with malformed Authorization header', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', 'Bearer')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });
  });

  describe('Authentication - JWT Strategy Validation', () => {
    it('should validate upstream_idp claim and return 403 if mismatch', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithDiffUpstream = await createTestApp({
        signerMode: 'local',
        privateKeys: [
          {
            walletId: 1,
            key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
          },
        ],
        nodeUriMap: [
          {
            '11155111': {
              key: 'https://eth-sepolia.g.alchemy.com/v2/test',
              multiplier: 3,
            },
          },
        ],
        upstreamIdp: 'Different-Provider',
      });

      try {
        const response = await testAppWithDiffUpstream
          .request()
          .get('/address')
          .set('Authorization', `Bearer ${TEST_VALID_JWT}`)
          .expect(403);

        expect(response.body).toMatchObject({
          statusCode: 403,
          message: 'Invalid upstream_idp claim',
        });
      } finally {
        await testAppWithDiffUpstream.close();
      }
    });

    it('should accept valid JWT token with correct claims', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithMatchingUpstream =
        await createTestApp({
          signerMode: 'local',
          privateKeys: [
            {
              walletId: 1,
              key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
            },
          ],
          nodeUriMap: [
            {
              '11155111': {
                key: 'https://eth-sepolia.g.alchemy.com/v2/test',
                multiplier: 3,
              },
            },
          ],
          upstreamIdp:
            process.env.UPSTREAM_IDP ||
            'VM3 Partner Source',
        });

      try {
        const response = await testAppWithMatchingUpstream
          .request()
          .get('/address')
          .set('Authorization', `Bearer ${TEST_VALID_JWT}`)
          .expect(200);

        expect(response.body).toMatchObject({
          walletId: 1,
          address: expect.stringMatching(
            /^0x[a-fA-F0-9]{40}$/,
          ),
        });
      } finally {
        await testAppWithMatchingUpstream.close();
      }
    });
  });

  describe('Authentication - Error Scenarios', () => {
    it('should handle missing UPSTREAM_IDP configuration', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithNoUpstream = await createTestApp({
        signerMode: 'local',
        privateKeys: [
          {
            walletId: 1,
            key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
          },
        ],
        nodeUriMap: [
          {
            '11155111': {
              key: 'https://eth-sepolia.g.alchemy.com/v2/test',
              multiplier: 3,
            },
          },
        ],
        upstreamIdp: undefined,
      });

      try {
        const response = await testAppWithNoUpstream
          .request()
          .get('/address')
          .set('Authorization', `Bearer ${TEST_VALID_JWT}`);

        expect(response.status).toBe(403);
        expect(response.body).toMatchObject({
          statusCode: 403,
          message: expect.stringContaining('UPSTREAM_IDP'),
        });
      } finally {
        await testAppWithNoUpstream.close();
      }
    });

    it('should handle missing upstream_idp claim in token', async () => {
      const tokenWithoutUpstream =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.signature';

      const response = await testApp
        .request()
        .get('/address')
        .set(
          'Authorization',
          `Bearer ${tokenWithoutUpstream}`,
        )
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should handle missing payload.sub claim', async () => {
      const tokenWithoutSub =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20ifQ.signature';

      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', `Bearer ${tokenWithoutSub}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });
  });

  describe('Authentication - Token Payload Validation', () => {
    it('should extract and validate user information from valid token', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithMatchingUpstream =
        await createTestApp({
          signerMode: 'local',
          privateKeys: [
            {
              walletId: 1,
              key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
            },
          ],
          nodeUriMap: [
            {
              '11155111': {
                key: 'https://eth-sepolia.g.alchemy.com/v2/test',
                multiplier: 3,
              },
            },
          ],
          upstreamIdp:
            process.env.UPSTREAM_IDP ||
            'VM3 Partner Source',
        });

      try {
        const response = await testAppWithMatchingUpstream
          .request()
          .get('/me')
          .set('Authorization', `Bearer ${TEST_VALID_JWT}`)
          .expect(200);

        expect(response.body).toMatchObject({
          sub: expect.any(String),
          email: expect.any(String),
          username: expect.any(String),
          orgId: expect.any(String),
          walletId: expect.any(Number),
          upstreamIdp: expect.any(String),
          groups: expect.any(Array),
          scope: expect.any(String),
        });
      } finally {
        await testAppWithMatchingUpstream.close();
      }
    });

    it('should handle token with missing optional fields', async () => {
      const minimalToken =
        'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJ1cHN0cmVhbV9pZHAiOiJ0ZXN0In0.signature';

      const response = await testApp
        .request()
        .get('/me')
        .set('Authorization', `Bearer ${minimalToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });
  });

  describe('Authentication - Rate Limiting and Security', () => {
    it('should handle multiple authentication requests consistently', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithMatchingUpstream =
        await createTestApp({
          signerMode: 'local',
          privateKeys: [
            {
              walletId: 1,
              key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
            },
          ],
          nodeUriMap: [
            {
              '11155111': {
                key: 'https://eth-sepolia.g.alchemy.com/v2/test',
                multiplier: 3,
              },
            },
          ],
          upstreamIdp:
            process.env.UPSTREAM_IDP ||
            'VM3 Partner Source',
        });

      try {
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            testAppWithMatchingUpstream
              .request()
              .get('/address')
              .set(
                'Authorization',
                `Bearer ${TEST_VALID_JWT}`,
              ),
          );
        }

        const responses = await Promise.all(promises);
        responses.forEach((response) => {
          expect(response.status).toBe(200);
          expect(response.body).toMatchObject({
            walletId: 1,
            address: expect.stringMatching(
              /^0x[a-fA-F0-9]{40}$/,
            ),
          });
        });
      } finally {
        await testAppWithMatchingUpstream.close();
      }
    });

    it('should reject requests with invalid Authorization format', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', 'Basic invalid-format')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });
  });

  describe('Authentication - Group and Scope Validation', () => {
    it('should include groups from token in user object when valid', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithMatchingUpstream =
        await createTestApp({
          signerMode: 'local',
          privateKeys: [
            {
              walletId: 1,
              key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
            },
          ],
          nodeUriMap: [
            {
              '11155111': {
                key: 'https://eth-sepolia.g.alchemy.com/v2/test',
                multiplier: 3,
              },
            },
          ],
          upstreamIdp:
            process.env.UPSTREAM_IDP ||
            'VM3 Partner Source',
        });

      try {
        const response = await testAppWithMatchingUpstream
          .request()
          .get('/me')
          .set('Authorization', `Bearer ${TEST_VALID_JWT}`)
          .expect(200);

        expect(response.body.groups).toBeDefined();
        expect(Array.isArray(response.body.groups)).toBe(
          true,
        );
      } finally {
        await testAppWithMatchingUpstream.close();
      }
    });

    it('should include scope from token in user object when valid', async () => {
      if (skipIfNoValidToken()) return;

      const testAppWithMatchingUpstream =
        await createTestApp({
          signerMode: 'local',
          privateKeys: [
            {
              walletId: 1,
              key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
            },
          ],
          nodeUriMap: [
            {
              '11155111': {
                key: 'https://eth-sepolia.g.alchemy.com/v2/test',
                multiplier: 3,
              },
            },
          ],
          upstreamIdp:
            process.env.UPSTREAM_IDP ||
            'VM3 Partner Source',
        });

      try {
        const response = await testAppWithMatchingUpstream
          .request()
          .get('/me')
          .set('Authorization', `Bearer ${TEST_VALID_JWT}`)
          .expect(200);

        expect(response.body.scope).toBeDefined();
        expect(typeof response.body.scope).toBe('string');
      } finally {
        await testAppWithMatchingUpstream.close();
      }
    });
  });

  describe('Authentication - Edge Cases', () => {
    it('should handle very large tokens gracefully', async () => {
      const largeToken = 'a'.repeat(10000);

      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', `Bearer ${largeToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should handle tokens with special characters', async () => {
      const specialToken = 'token.with.special!@#$%^&*()';

      const response = await testApp
        .request()
        .get('/address')
        .set('Authorization', `Bearer ${specialToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });
  });
});
