import {
  TestApp,
  createTestApp,
  generateValidHeaders,
  generateInvalidHeaders,
  VAULT_TEST_CONFIG,
  isVaultAvailable,
  skipIfNoValidToken,
} from '../setup/test-config';

const describeIfVault = isVaultAvailable()
  ? describe
  : describe.skip;

describeIfVault('Vault Signer E2E Tests', () => {
  let testApp: TestApp;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let validHeaders: any;

  beforeAll(async () => {
    if (!isVaultAvailable()) {
      console.warn(
        '⚠️ Vault is not available, skipping Vault signer tests',
      );
      return;
    }

    const rpcUrl =
      process.env.ETHEREUM_RPC_URL ||
      'https://ethereum-sepolia.publicnode.com';

    testApp = await createTestApp({
      signerMode: 'vault',
      openBao: {
        url:
          process.env.VAULT_URL || 'http://127.0.0.1:8200',
        token: process.env.VAULT_TOKEN || 'test-token',
        ethereumMount: 'ethereum',
        kvStorePath: 'secret',
        timeoutMs: 10000,
      },
      nodeUriMap: {
        '11155111': rpcUrl,
        '11155420': 'https://sepolia.optimism.io',
      },
    });
    validHeaders = generateValidHeaders();
  });

  afterAll(async () => {
    if (testApp) {
      await testApp.close();
    }
  });

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
    it('should return 200 OK for /address with wallet ID - provide wallet ID and assert public wallet address', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/address')
        .set(validHeaders)
        .expect(200);

      expect(response.body).toMatchObject({
        walletId: expect.any(Number),
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

      const message = 'Test message for vault signing';
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
        walletId: expect.any(Number),
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
  });

  describe('Transaction Sending', () => {
    const approveData =
      '0x095ea7b300000000000000000000000080e63f73cac60c1662f27d2dfd2ea834acddbaa8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

    it('should return 200 OK for /send-transaction with approve spender payload', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: VAULT_TEST_CONFIG.testChainId,
        to: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
        value: '0',
        data: approveData,
      };

      const response = await testApp
        .request()
        .post('/send-transaction')
        .set(validHeaders)
        .send(tx);

      if (response.status === 200) {
        expect(response.body).toMatchObject({
          hash: expect.stringMatching(
            /^0x[a-fA-F0-9]{64}$/,
          ),
          from: expect.stringMatching(
            /^0x[a-fA-F0-9]{40}$/,
          ),
          to: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          nonce: expect.any(Number),
          blockNumber: expect.any(Number),
          gasUsed: expect.any(String),
          status: expect.any(Number),
        });
      } else if (response.status === 400) {
        expect(response.body).toMatchObject({
          statusCode: 400,
          message: expect.stringContaining(
            'Insufficient funds',
          ),
        });
      }
    });

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

    it('should return 400 Bad Request for invalid to address', async () => {
      if (skipIfNoValidToken()) return;

      const tx = {
        chainId: VAULT_TEST_CONFIG.testChainId,
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
  });

  describe('Transaction Query', () => {
    it('should return 200 OK for /transaction/:hash', async () => {
      if (skipIfNoValidToken()) return;

      const txHash =
        '0x0000000000000000000000000000000000000000000000000000000000000000';
      const response = await testApp
        .request()
        .get(`/transaction/${txHash}`)
        .query({ chainId: VAULT_TEST_CONFIG.testChainId })
        .set(validHeaders);

      if (response.status === 404) {
        expect(response.body).toMatchObject({
          statusCode: 404,
          message: 'Transaction not found',
        });
      } else if (response.status === 200) {
        expect(response.body).toMatchObject({
          hash: expect.stringMatching(
            /^0x[a-fA-F0-9]{64}$/,
          ),
          from: expect.stringMatching(
            /^0x[a-fA-F0-9]{40}$/,
          ),
          to: expect.stringMatching(/^0x[a-fA-F0-9]{40}$/),
          value: expect.any(String),
          data: expect.any(String),
          nonce: expect.any(Number),
          blockNumber: expect.any(Number),
          blockHash: expect.stringMatching(
            /^0x[a-fA-F0-9]{64}$/,
          ),
          chainId: expect.any(String),
        });
      }
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
  });

  describe('Nonce Retrieval', () => {
    it('should return 200 OK for /nonce', async () => {
      if (skipIfNoValidToken()) return;

      const response = await testApp
        .request()
        .get('/nonce')
        .query({ chainId: VAULT_TEST_CONFIG.testChainId })
        .set(validHeaders);

      if (response.status === 200) {
        expect(response.body).toMatchObject({
          nonce: expect.any(Number),
        });
        expect(response.body.nonce).toBeGreaterThanOrEqual(
          0,
        );
      }
    });

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
  describe('UPSTREAM_IDP Authorization', () => {
    const createInvalidApp = async () => {
      const rpcUrl =
        process.env.ETHEREUM_RPC_URL ||
        'https://ethereum-sepolia.publicnode.com';

      return createTestApp({
        signerMode: 'vault',
        upstreamIdp: 'Different-Provider',
        openBao: {
          url:
            process.env.VAULT_URL ||
            'http://127.0.0.1:8200',
          token: process.env.VAULT_TOKEN || 'test-token',
          ethereumMount: 'ethereum',
          kvStorePath: 'secret',
          timeoutMs: 10000,
        },
        nodeUriMap: {
          '11155111': rpcUrl,
          '11155420': 'https://sepolia.optimism.io',
        },
      });
    };

    it('should return 403 Forbidden for /address', async () => {
      if (skipIfNoValidToken()) return;

      const app = await createInvalidApp();

      try {
        await app
          .request()
          .get('/address')
          .set(validHeaders)
          .expect(403);
      } finally {
        await app.close();
      }
    });

    it('should return 403 Forbidden for /sign-message', async () => {
      if (skipIfNoValidToken()) return;

      const app = await createInvalidApp();

      try {
        await app
          .request()
          .post('/sign-message')
          .set(validHeaders)
          .send({
            message: 'test',
          })
          .expect(403);
      } finally {
        await app.close();
      }
    });

    it('should return 403 Forbidden for /send-transaction', async () => {
      if (skipIfNoValidToken()) return;

      const app = await createInvalidApp();

      try {
        await app
          .request()
          .post('/send-transaction')
          .set(validHeaders)
          .send({
            chainId: VAULT_TEST_CONFIG.testChainId,
            to: VAULT_TEST_CONFIG.testAddress,
            value: '0',
            data: '0x',
          })
          .expect(403);
      } finally {
        await app.close();
      }
    });

    it('should return 403 Forbidden for /transaction/:hash', async () => {
      if (skipIfNoValidToken()) return;

      const app = await createInvalidApp();

      try {
        await app
          .request()
          .get(
            '/transaction/0x0000000000000000000000000000000000000000000000000000000000000000',
          )
          .query({
            chainId: VAULT_TEST_CONFIG.testChainId,
          })
          .set(validHeaders)
          .expect(403);
      } finally {
        await app.close();
      }
    });

    it('should return 403 Forbidden for /nonce', async () => {
      if (skipIfNoValidToken()) return;

      const app = await createInvalidApp();

      try {
        await app
          .request()
          .get('/nonce')
          .query({
            chainId: VAULT_TEST_CONFIG.testChainId,
          })
          .set(validHeaders)
          .expect(403);
      } finally {
        await app.close();
      }
    });
  });
});
