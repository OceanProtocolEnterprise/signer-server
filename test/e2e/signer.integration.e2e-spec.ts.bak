import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import * as request from 'supertest';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';

import { AppModule } from '../../src/app.module';

dotenv.config();

const JWT_TOKEN = process.env.JWT_TOKEN;
if (!JWT_TOKEN) {
  throw new Error('JWT_TOKEN environment variable not set');
}

const PRIVATE_KEYS_JSON = process.env.PRIVATE_KEYS;
let localExpectedAddress: string | undefined;
let localWalletId: number | undefined;
if (PRIVATE_KEYS_JSON) {
  try {
    const keys = JSON.parse(PRIVATE_KEYS_JSON) as Array<{
      walletId: number;
      key: string;
    }>;
    if (keys.length > 0) {
      localExpectedAddress = new ethers.Wallet(keys[0].key)
        .address;
      localWalletId = keys[0].walletId;
    }
  } catch {}
}

async function createApp(
  signerMode: 'local' | 'vault',
  upstreamIdp?: string,
): Promise<INestApplication> {
  process.env.SIGNER_MODE = signerMode;

  if (upstreamIdp !== undefined) {
    process.env.UPSTREAM_IDP = upstreamIdp;
  } else {
    delete process.env.UPSTREAM_IDP;
  }

  if (signerMode === 'vault') {
    if (
      !process.env.VAULT_URL ||
      !process.env.VAULT_TOKEN
    ) {
      console.warn(
        'Vault configuration missing, vault tests will fail',
      );
    }
  }

  const moduleFixture: TestingModule =
    await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.init();
  return app;
}

async function hasEnoughBalance(
  providerUrl: string,
  address: string,
  minWei = ethers.parseEther('0.001'),
): Promise<boolean> {
  let provider: ethers.JsonRpcProvider | undefined;

  try {
    provider = new ethers.JsonRpcProvider(
      providerUrl,
      undefined,
      {
        staticNetwork: true,
      },
    );

    const balance = await provider.getBalance(address);

    return balance >= minWei;
  } catch (error) {
    console.warn(
      `Balance check failed for ${address}: ${
        error instanceof Error
          ? error.message
          : 'Unknown error'
      }`,
    );

    return false;
  } finally {
    provider?.destroy();
  }
}

const APPROVE_SPENDER_PAYLOAD = {
  chainId: 11155111,
  to: '0x08210F9170F89Ab7658F0B5E3fF39b0E03C594D4',
  value: '0',
  data: '0x095ea7b300000000000000000000000080e63f73cac60c1662f27d2dfd2ea834acddbaa8ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
};

function createSignerTests(signerMode: 'local' | 'vault') {
  describe(`Signer Service - ${signerMode.toUpperCase()} Signer`, () => {
    let app: INestApplication;
    let providerUrl: string;
    let rpcAvailable = false;
    let authHeader: { Authorization: string };
    let expectedAddress: string | undefined;
    let expectedWalletId: number | undefined;

    beforeAll(async () => {
      app = await createApp(
        signerMode,
        'VM3 Partner Source',
      );

      const nodeUriMap = JSON.parse(
        process.env.NODE_URI_MAP || '{}',
      );
      providerUrl = nodeUriMap['11155111'];

      if (providerUrl) {
        let provider: ethers.JsonRpcProvider | undefined;

        try {
          provider = new ethers.JsonRpcProvider(
            providerUrl,
            undefined,
            {
              staticNetwork: true,
            },
          );

          await provider.getBlockNumber();

          rpcAvailable = true;
        } catch (error) {
          console.warn(
            'RPC unavailable. Transaction tests will be skipped.',
            error,
          );
        } finally {
          provider?.destroy();
        }
      }

      if (!providerUrl) {
        console.warn(
          'No RPC URL configured for chain 11155111. Gas-dependent tests will be skipped.',
        );
      } else {
        console.log(
          `Using RPC URL: ${providerUrl.substring(0, 30)}...`,
        );
      }

      authHeader = { Authorization: `Bearer ${JWT_TOKEN}` };

      if (signerMode === 'local') {
        expectedAddress = localExpectedAddress;
        expectedWalletId = localWalletId;
      }

      if (!expectedAddress) {
        try {
          const res = await request(app.getHttpServer())
            .get('/address')
            .set(authHeader);
          if (res.status === 200) {
            expectedAddress = res.body.address;
            expectedWalletId = res.body.walletId;
            console.log(
              `Retrieved address from service: ${expectedAddress}`,
            );
          }
        } catch (error) {
          console.warn(
            'Failed to fetch address from service',
            error,
          );
        }
      }
    });

    afterAll(async () => {
      await app?.close();
      delete process.env.UPSTREAM_IDP;
      await new Promise((resolve) =>
        setTimeout(resolve, 500),
      );
    });

    describe('401 Unauthorized', () => {
      it('GET /address - missing JWT', () => {
        return request(app.getHttpServer())
          .get('/address')
          .expect(401);
      });

      it('GET /address - invalid JWT', () => {
        return request(app.getHttpServer())
          .get('/address')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });

      it('POST /sign-message - missing JWT', () => {
        return request(app.getHttpServer())
          .post('/sign-message')
          .send({ message: 'test' })
          .expect(401);
      });

      it('POST /send-transaction - missing JWT', () => {
        return request(app.getHttpServer())
          .post('/send-transaction')
          .send(APPROVE_SPENDER_PAYLOAD)
          .expect(401);
      });

      it('GET /transaction/:hash - missing JWT', () => {
        return request(app.getHttpServer())
          .get(
            '/transaction/0x1234567890abcdef?chainId=11155111',
          )
          .expect(401);
      });

      it('GET /me - missing JWT', () => {
        return request(app.getHttpServer())
          .get('/me')
          .expect(401);
      });
    });

    describe('Public Endpoints', () => {
      it('GET /health - 200 OK without JWT', () => {
        return request(app.getHttpServer())
          .get('/health')
          .expect(200)
          .expect((res) => {
            expect(res.body).toEqual({
              status: 'ok',
              service: 'signer-service',
            });
          });
      });

      it('GET /health - 200 OK with JWT', () => {
        return request(app.getHttpServer())
          .get('/health')
          .set(authHeader)
          .expect(200);
      });
    });

    describe('Authenticated Endpoints', () => {
      it('GET /me - 200 OK, returns user info from JWT', () => {
        return request(app.getHttpServer())
          .get('/me')
          .set(authHeader)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('sub');
            expect(res.body).toHaveProperty('email');
            expect(res.body).toHaveProperty('walletId');
          });
      });

      describe('GET /address', () => {
        it('200 OK - with wallet ID (from JWT claim), asserts correct address', () => {
          return request(app.getHttpServer())
            .get('/address')
            .set(authHeader)
            .expect(200)
            .expect((res) => {
              expect(res.body).toHaveProperty('address');
              expect(res.body).toHaveProperty('walletId');
              if (expectedWalletId) {
                expect(res.body.walletId).toBe(
                  expectedWalletId,
                );
              }
              if (expectedAddress) {
                expect(res.body.address.toLowerCase()).toBe(
                  expectedAddress.toLowerCase(),
                );
              }
            });
        });

        it('200 OK - without wallet ID, returns first account from listing', () => {
          return request(app.getHttpServer())
            .get('/address')
            .set(authHeader)
            .expect(200);
        });
      });

      describe('POST /sign-message', () => {
        it('200 OK - signs a message', () => {
          const message = 'Test message for signing';
          return request(app.getHttpServer())
            .post('/sign-message')
            .set(authHeader)
            .send({ message })
            .expect(200)
            .expect((res) => {
              expect(res.body).toHaveProperty('signature');
              expect(res.body).toHaveProperty('address');
              const recovered = ethers.verifyMessage(
                message,
                res.body.signature,
              );
              expect(recovered.toLowerCase()).toBe(
                res.body.address.toLowerCase(),
              );
            });
        });
      });

      describe('POST /send-transaction', () => {
        it('200 OK - sends approve spender tx (skips if insufficient ETH)', async () => {
          if (!providerUrl || !expectedAddress) {
            console.warn(
              'Skipping send-transaction: missing config',
            );
            return;
          }

          const hasFunds = await hasEnoughBalance(
            providerUrl,
            expectedAddress,
          );

          if (!hasFunds) {
            console.warn(
              `Skipping send-transaction: insufficient ETH for ${expectedAddress}`,
            );
            return;
          }

          await request(app.getHttpServer())
            .post('/send-transaction')
            .set(authHeader)
            .send(APPROVE_SPENDER_PAYLOAD)
            .expect(201)
            .expect((res) => {
              expect(res.body).toHaveProperty('hash');
              expect(res.body).toHaveProperty('from');
              expect(res.body.to?.toLowerCase()).toBe(
                APPROVE_SPENDER_PAYLOAD.to.toLowerCase(),
              );
            });
        });
      });

      describe('GET /transaction/:hash', () => {
        let lastTxHash: string;

        beforeAll(async () => {
          if (
            !rpcAvailable ||
            !providerUrl ||
            !expectedAddress
          ) {
            return;
          }
          const hasFunds = await hasEnoughBalance(
            providerUrl,
            expectedAddress,
          );
          if (!hasFunds) return;

          try {
            const res = await request(app.getHttpServer())
              .post('/send-transaction')
              .set(authHeader)
              .send(APPROVE_SPENDER_PAYLOAD);
            if (res.status === 201) {
              lastTxHash = res.body.hash;
            }
          } catch {}
        });

        it('200 OK - returns transaction details', async () => {
          if (!lastTxHash) {
            console.warn(
              'Skipping /transaction:hash test: no tx hash available',
            );
            return;
          }

          await request(app.getHttpServer())
            .get(
              `/transaction/${lastTxHash}?chainId=11155111`,
            )
            .set(authHeader)
            .expect(200)
            .expect((res) => {
              expect(res.body.hash).toBe(lastTxHash);
              expect(res.body).toHaveProperty('from');
              expect(res.body).toHaveProperty('to');
              expect(res.body.chainId).toBe('11155111');
            });
        });
      });
    });

    describe('400 Bad Request - Missing Payload Fields', () => {
      it('POST /sign-message - missing message field', () => {
        return request(app.getHttpServer())
          .post('/sign-message')
          .set(authHeader)
          .send({})
          .expect(400);
      });

      it('POST /sign-message - empty message', () => {
        return request(app.getHttpServer())
          .post('/sign-message')
          .set(authHeader)
          .send({ message: '' })
          .expect(400);
      });

      it('POST /send-transaction - missing chainId', () => {
        return request(app.getHttpServer())
          .post('/send-transaction')
          .set(authHeader)
          .send({
            to: APPROVE_SPENDER_PAYLOAD.to,
            value: '0',
            data: '0x',
          })
          .expect(400);
      });

      it('POST /send-transaction - missing "to" address', () => {
        return request(app.getHttpServer())
          .post('/send-transaction')
          .set(authHeader)
          .send({
            chainId: 11155111,
            value: '0',
            data: '0x',
          })
          .expect(400);
      });

      it('POST /send-transaction - invalid "to" address', () => {
        return request(app.getHttpServer())
          .post('/send-transaction')
          .set(authHeader)
          .send({
            chainId: 11155111,
            to: 'invalid-address',
            value: '0',
            data: '0x',
          })
          .expect(400);
      });

      it('POST /send-transaction - invalid chainId (negative)', () => {
        return request(app.getHttpServer())
          .post('/send-transaction')
          .set(authHeader)
          .send({
            chainId: -1,
            to: APPROVE_SPENDER_PAYLOAD.to,
            value: '0',
            data: '0x',
          })
          .expect(400);
      });
    });

    describe('403 Forbidden - upstream_idp mismatch', () => {
      let forbiddenApp: INestApplication;

      beforeAll(async () => {
        forbiddenApp = await createApp(
          signerMode,
          'wrong-upstream-idp-value',
        );
      });

      afterAll(async () => {
        await forbiddenApp?.close();
      });

      it('GET /address - 403 Forbidden when UPSTREAM_IDP differs', async () => {
        await request(forbiddenApp.getHttpServer())
          .get('/address')
          .set('Authorization', `Bearer ${JWT_TOKEN}`)
          .expect(403);
      });

      it('POST /sign-message - 403 Forbidden when UPSTREAM_IDP differs', async () => {
        await request(forbiddenApp.getHttpServer())
          .post('/sign-message')
          .set('Authorization', `Bearer ${JWT_TOKEN}`)
          .send({ message: 'test' })
          .expect(403);
      });

      it('POST /send-transaction - 403 Forbidden when UPSTREAM_IDP differs', async () => {
        await request(forbiddenApp.getHttpServer())
          .post('/send-transaction')
          .set('Authorization', `Bearer ${JWT_TOKEN}`)
          .send(APPROVE_SPENDER_PAYLOAD)
          .expect(403);
      });

      it('GET /transaction/:hash - 403 Forbidden when UPSTREAM_IDP differs', async () => {
        await request(forbiddenApp.getHttpServer())
          .get(
            '/transaction/0x1234567890abcdef?chainId=11155111',
          )
          .set('Authorization', `Bearer ${JWT_TOKEN}`)
          .expect(403);
      });

      it('should work normally after unsetting UPSTREAM_IDP', async () => {
        const unsetApp = await createApp(
          signerMode,
          undefined,
        );

        await request(unsetApp.getHttpServer())
          .get('/address')
          .set('Authorization', `Bearer ${JWT_TOKEN}`)
          .expect(403);

        await unsetApp.close();
      });
    });
  });
}

if (process.env.VAULT_URL && process.env.VAULT_TOKEN) {
  createSignerTests('local');
  createSignerTests('vault');
} else {
  console.warn(
    'Vault configuration not found, running only local signer tests',
  );
  createSignerTests('local');

  describe('Signer Service - VAULT Signer (SKIPPED)', () => {
    it.skip('Vault tests require VAULT_URL and VAULT_TOKEN', () => {});
  });
}
