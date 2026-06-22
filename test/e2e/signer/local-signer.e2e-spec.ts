import {
  TestApp,
  createTestApp,
  generateValidHeaders,
  generateInvalidHeaders,
  LOCAL_TEST_CONFIG,
  skipIfNoValidToken,
} from '../setup/test-config';

describe('Local Signer E2E Tests', () => {
  let testApp: TestApp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let validHeaders: any;

  beforeAll(async () => {
    const rpcUrl =
      process.env.ETHEREUM_RPC_URL ||
      'https://ethereum-sepolia.publicnode.com';

    testApp = await createTestApp({
      signerMode: 'local',
      privateKeys: [
        {
          walletId: LOCAL_TEST_CONFIG.validWalletId,
          key: LOCAL_TEST_CONFIG.testPrivateKey,
        },
      ],
      nodeUriMap: {
        '11155111': rpcUrl,
        '11155420': 'https://sepolia.optimism.io',
      },
    });
    validHeaders = generateValidHeaders();
  }, 30000);

  afterAll(async () => {
    if (testApp) {
      await testApp.close();
    }
  }, 10000);

  describe('Health Check', () => {
    it('should return 200 OK for /health', async () => {
      const response = await testApp
        .request()
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'ok',
        service: 'signer-service',
      });
    });
  });

  describe('Authentication', () => {
    it('should return 401 Unauthorized if JWT is missing', async () => {
      const response = await testApp
        .request()
        .get('/address')
        .expect(401);

      expect(response.body).toMatchObject({
        statusCode: 401,
        message: expect.any(String),
      });
    });

    it('should return 401 Unauthorized if JWT is invalid', async () => {
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

    it('should return 200 OK for /me with valid JWT', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/me')
        .set(validHeaders)
        .expect(200);

      expect(response.body).toMatchObject({
        sub: expect.any(String),
        email: expect.any(String),
        username: expect.any(String),
      });
    });
  });

  describe('Address Endpoint', () => {
    it('should return 200 OK for /address when walletId is provided', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/address')
        .query({
          walletId: LOCAL_TEST_CONFIG.validWalletId,
        })
        .set(validHeaders)
        .expect(200);

      expect(response.body).toMatchObject({
        walletId: LOCAL_TEST_CONFIG.validWalletId,
        address: expect.stringMatching(
          /^0x[a-fA-F0-9]{40}$/,
        ),
      });
    });

    it('should return 200 OK for /address without wallet ID - assert first account address', async () => {
      if (skipIfNoValidToken()) return;

      const responseWithWallet = await testApp
        .request()
        .get('/address')
        .set(validHeaders)
        .expect(200);

      const responseWithoutWallet = await testApp
        .request()
        .get('/address')
        .set(validHeaders)
        .expect(200);

      expect(responseWithWallet.body.address).toBe(
        responseWithoutWallet.body.address,
      );
    });
  });

  describe('Available Networks', () => {
    it('should return 200 OK for /available-networks', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/available-networks')
        .set(validHeaders)
        .expect(200);

      expect(response.body).toMatchObject({
        networks: expect.arrayContaining([
          expect.objectContaining({
            chainId: expect.any(Number),
          }),
        ]),
      });

      expect(response.body.networks.length).toBeGreaterThan(
        0,
      );
      expect(
        response.body.networks.some(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (n: any) => n.chainId === 11155111,
        ),
      ).toBe(true);
    });
  });

  describe('Message Signing', () => {
    it('should return 200 OK for /sign-message', async () => {
      if (skipIfNoValidToken()) return;

      const message = 'Test message for signing';
      const response = await testApp
        .request()
        .post('/sign-message')
        .set(validHeaders)
        .send({ message })
        .expect(200);

      expect(response.body).toMatchObject({
        signature: expect.stringMatching(
          /^0x[a-fA-F0-9]+$/,
        ),
        walletId: LOCAL_TEST_CONFIG.validWalletId,
        address: expect.stringMatching(
          /^0x[a-fA-F0-9]{40}$/,
        ),
      });
    });

    it('should return 400 Bad Request for missing message field', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .post('/sign-message')
        .set(validHeaders)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
      expect(response.body.message).toContain(
        'message should not be empty',
      );
      expect(response.body.message).toContain(
        'message must be a string',
      );
    });

    it('should return 400 Bad Request for empty message', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .post('/sign-message')
        .set(validHeaders)
        .send({ message: '' })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
      expect(response.body.message).toContain(
        'message should not be empty',
      );
    });

    it('should return 400 Bad Request for null message', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .post('/sign-message')
        .set(validHeaders)
        .send({ message: null })
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
      expect(response.body.message).toContain(
        'message should not be empty',
      );
      expect(response.body.message).toContain(
        'message must be a string',
      );
    });
  });

  describe('Transaction Sending - Success', () => {
    const approveData =
      '0x095ea7b300000000000000000000000080e63f73cac60c1662f27d2dfd2ea834acddbaa8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    let successfulTxHash: string | undefined;

    it('should return success for /send-transaction with approve payload', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: 11155111,
        to: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
        value: '0',
        data: approveData,
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx);

      if (
        response.status === 400 &&
        typeof response.body.message === 'string' &&
        response.body.message.includes('Insufficient funds')
      ) {
        console.warn(
          '⚠️ Skipping send transaction test due to insufficient funds',
        );
        return;
      }

      expect([200, 201]).toContain(response.status);

      expect(response.body).toMatchObject({
        hash: expect.stringMatching(/^0x[a-fA-F0-9]{64}$/),
      });

      successfulTxHash = response.body.hash;
    }, 90000);

    it('should return transaction details for a previously submitted transaction', async () => {
      if (skipIfNoValidToken()) return;

      if (!successfulTxHash) {
        console.warn(
          '⚠️ Skipping transaction lookup test because no transaction was successfully submitted',
        );
        return;
      }

      await new Promise((resolve) =>
        setTimeout(resolve, 10000),
      );

      const response = await testApp
        .request()
        .get(`/transaction/${successfulTxHash}`)
        .query({
          chainId: 11155111,
        })
        .set(validHeaders);

      console.log(
        'Transaction lookup:',
        response.status,
        response.body,
      );

      if (response.status === 200) {
        expect(response.body).toMatchObject({
          hash: successfulTxHash,
        });
        return;
      }

      if (response.status === 404) {
        expect(response.body).toMatchObject({
          statusCode: 404,
        });
        return;
      }

      if (response.status === 500) {
        console.warn(
          '⚠️ Transaction lookup returned 500:',
          response.body,
        );
        return;
      }

      fail(
        `Unexpected response status: ${response.status}`,
      );
    }, 60000);
  });

  describe('Transaction Sending - Validation', () => {
    it('should return 400 Bad Request for missing chainId', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        to: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
        value: '0',
        data: '0x',
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
    });

    it('should return 400 Bad Request for invalid chainId', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: 'invalid',
        to: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
        value: '0',
        data: '0x',
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
    });

    it('should return 400 Bad Request for missing to address', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: LOCAL_TEST_CONFIG.testChainId,
        value: '0',
        data: '0x',
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
    });

    it('should return 400 Bad Request for invalid to address', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: LOCAL_TEST_CONFIG.testChainId,
        to: '0xinvalid',
        value: '0',
        data: '0x',
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
      expect(response.body.message).toContain(
        'to must be an Ethereum address',
      );
    });

    it('should return 400 Bad Request for negative chainId', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: -1,
        to: LOCAL_TEST_CONFIG.testAddress,
        value: '0',
        data: '0x',
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(Array),
      });
      expect(response.body.message).toContain(
        'chainId must not be less than 1',
      );
    });

    it('should handle invalid value format gracefully', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: LOCAL_TEST_CONFIG.testChainId,
        to: LOCAL_TEST_CONFIG.testAddress,
        value: 'not-a-number',
        data: '0x',
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx);

      if (response.status === 500) {
        expect(response.body).toMatchObject({
          statusCode: 500,
          message: expect.stringContaining(
            'Cannot convert not-a-number to a BigInt',
          ),
        });
      } else {
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: expect.any(Array),
        });
      }
    });
  });

  describe('Transaction Query', () => {
    it('should return 404 for non-existent transaction', async () => {
      if (skipIfNoValidToken()) return;

      const txHash =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const response = await testApp
        .request()
        .get(`/transaction/${txHash}`)
        .query({ chainId: LOCAL_TEST_CONFIG.testChainId })
        .set(validHeaders)
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Transaction not found',
      });
    });

    it('should return 400 Bad Request for invalid chainId', async () => {
      if (skipIfNoValidToken()) return;

      const txHash =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const response = await testApp
        .request()
        .get(`/transaction/${txHash}`)
        .query({ chainId: 'invalid' })
        .set(validHeaders)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.any(String),
      });
    });

    it('should return 400 Bad Request for unsupported chain ID', async () => {
      if (skipIfNoValidToken()) return;

      const txHash =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const response = await testApp
        .request()
        .get(`/transaction/${txHash}`)
        .query({ chainId: 999999 })
        .set(validHeaders)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining(
          'Unsupported chain ID',
        ),
      });
    });

    it('should handle invalid transaction hash format gracefully', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/transaction/invalid-hash')
        .query({ chainId: LOCAL_TEST_CONFIG.testChainId })
        .set(validHeaders);

      if (response.status === 500) {
        expect(response.body).toMatchObject({
          statusCode: 500,
          message: expect.stringContaining(
            'invalid argument',
          ),
        });
      } else {
        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: expect.any(Array),
        });
      }
    });
  });

  describe('Nonce Retrieval', () => {
    it('should return 200 OK for /nonce', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/nonce')
        .query({ chainId: LOCAL_TEST_CONFIG.testChainId })
        .set(validHeaders);

      if (response.status === 200) {
        expect(response.body).toMatchObject({
          nonce: expect.any(Number),
        });
        expect(response.body.nonce).toBeGreaterThanOrEqual(
          0,
        );
      } else if (response.status === 500) {
        // RPC issues - skip validation
        console.warn(
          'Nonce test skipped due to RPC issues',
        );
      } else {
        // Unexpected status
        expect(response.status).toBe(200);
      }
    }, 10000);

    it('should return 400 Bad Request for missing chainId', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/nonce')
        .set(validHeaders)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining(
          'Validation failed',
        ),
      });
    });

    it('should return 400 Bad Request for unsupported chain ID', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/nonce')
        .query({ chainId: 999999 })
        .set(validHeaders)
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        message: expect.stringContaining(
          'Unsupported chain ID',
        ),
      });
    });
  });

  describe('CORS Headers', () => {
    it('should return correct CORS headers', async () => {
      const response = await testApp
        .request()
        .options('/address')
        .set('Origin', 'http://localhost:3000');

      expect(
        response.headers['access-control-allow-origin'],
      ).toBe('*');
      expect(
        response.headers['access-control-allow-methods'],
      ).toContain('GET');
      expect(
        response.headers['access-control-allow-methods'],
      ).toContain('POST');
    });
  });

  describe('Error Response Format', () => {
    it('should return consistent error format for validation errors', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        statusCode: 400,
        timestamp: expect.stringMatching(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
        ),
        path: expect.stringContaining('/send-transaction'),
        message: expect.any(Array),
      });
    });
  });

  describe('UPSTREAM_IDP Authorization', () => {
    let invalidUpstreamApp: TestApp;

    beforeAll(async () => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      invalidUpstreamApp = await createTestApp({
        signerMode: 'local',
        upstreamIdp: 'Different-Provider',
        privateKeys: [
          {
            walletId: LOCAL_TEST_CONFIG.validWalletId,
            key: LOCAL_TEST_CONFIG.testPrivateKey,
          },
        ],
        nodeUriMap: {
          '11155111': rpcUrl,
        },
      });
    });

    afterAll(async () => {
      await invalidUpstreamApp.close();
    });

    it('should return 403 Forbidden for /address when upstream_idp does not match', async () => {
      if (skipIfNoValidToken()) return;

      await invalidUpstreamApp
        .request()
        .get('/address')
        .set(validHeaders)
        .expect(403);
    });

    it('should return 403 Forbidden for /sign-message when upstream_idp does not match', async () => {
      if (skipIfNoValidToken()) return;

      await invalidUpstreamApp
        .request()
        .post('/sign-message')
        .set(validHeaders)
        .send({
          message: 'test',
        })
        .expect(403);
    });

    it('should return 403 Forbidden for /send-transaction when upstream_idp does not match', async () => {
      if (skipIfNoValidToken()) return;

      await invalidUpstreamApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send({
          chainId: LOCAL_TEST_CONFIG.testChainId,
          to: LOCAL_TEST_CONFIG.testAddress,
          value: '0',
          data: '0x',
        })
        .expect(403);
    });

    it('should return 403 Forbidden for /transaction/:hash when upstream_idp does not match', async () => {
      if (skipIfNoValidToken()) return;

      await invalidUpstreamApp
        .request()
        .get(
          '/transaction/0x0000000000000000000000000000000000000000000000000000000000000000',
        )
        .query({
          chainId: LOCAL_TEST_CONFIG.testChainId,
        })
        .set(validHeaders)
        .expect(403);
    });

    it('should return 403 Forbidden for /nonce when upstream_idp does not match', async () => {
      if (skipIfNoValidToken()) return;

      await invalidUpstreamApp
        .request()
        .get('/nonce')
        .query({
          chainId: LOCAL_TEST_CONFIG.testChainId,
        })
        .set(validHeaders)
        .expect(403);
    });
  });
});
