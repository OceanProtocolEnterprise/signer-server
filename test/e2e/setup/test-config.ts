import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { HttpExceptionFilter } from '../../../src/common/filters/http-exception.filter';
import { API_PREFIX } from '../../../src/common/constants/api.constants';
import * as request from 'supertest';
import { ConfigService } from '@nestjs/config';

export const isVaultAvailable = (): boolean => {
  // Check if we're in CI (GitHub Actions)
  const isGitHubActions = !!process.env.GITHUB_ACTIONS;

  // In CI, we assume Vault is available via docker compose
  if (isGitHubActions) {
    return true;
  }

  // For local development, check if Vault config is present
  const hasVaultConfig = !!(
    process.env.VAULT_URL &&
    process.env.VAULT_TOKEN &&
    process.env.SIGNER_MODE === 'vault'
  );

  return hasVaultConfig;
};

export const isGitHubActions = (): boolean => {
  return !!process.env.GITHUB_ACTIONS;
};

export const isLocalDevelopment = (): boolean => {
  return (
    process.env.NODE_ENV === 'test' &&
    !process.env.GITHUB_ACTIONS
  );
};

export const TEST_VALID_JWT = process.env.JWT_TOKEN || '';
export const TEST_INVALID_JWT = 'invalid.jwt.token';
export const TEST_EXPIRED_JWT =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjEwMDAwMDAwMDB9.signature';

export interface TestConfig {
  signerMode: 'local' | 'vault';
  validWalletId: number;
  invalidWalletId: number;
  testChainId: number;
  testAddress: string;
  testPrivateKey?: string;
}

export const LOCAL_TEST_CONFIG: TestConfig = {
  signerMode: 'local',
  validWalletId: 1,
  invalidWalletId: 999,
  testChainId: 11155111,
  testAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
  testPrivateKey:
    '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
};

export const VAULT_TEST_CONFIG: TestConfig = {
  signerMode: 'vault',
  validWalletId: 1,
  invalidWalletId: 999,
  testChainId: 11155111,
  testAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
};

const HTTP_METHODS_TO_PREFIX = [
  'delete',
  'get',
  'options',
  'patch',
  'post',
  'put',
] as const;

export class TestApp {
  private app: INestApplication;
  private module: TestingModule;

  private withApiPrefix(path: string): string {
    if (!path.startsWith('/')) {
      return path;
    }

    const prefixedPath = `/${API_PREFIX}`;
    if (
      path === prefixedPath ||
      path.startsWith(`${prefixedPath}/`)
    ) {
      return path;
    }

    return `${prefixedPath}${path}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async init(configOverride?: Record<string, any>) {
    const moduleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'signer.mode') {
          return (
            configOverride?.signerMode ||
            process.env.SIGNER_MODE ||
            'local'
          );
        }
        if (key === 'signer.privateKeys') {
          if (configOverride?.privateKeys) {
            return configOverride.privateKeys;
          }
          try {
            return JSON.parse(
              process.env.PRIVATE_KEYS || '[]',
            );
          } catch {
            return [
              {
                walletId: 1,
                key: '0x8dbeed3d544e270f7535c23032e7782410f4244aa055885650cf6befad896cfb',
              },
            ];
          }
        }
        if (key === 'signer.nodeUriMap') {
          if (configOverride?.nodeUriMap) {
            return configOverride.nodeUriMap;
          }
          try {
            return JSON.parse(
              process.env.NODE_URI_MAP ||
                '{"11155111":"https://ethereum-sepolia.publicnode.com"}',
            );
          } catch {
            return {
              '11155111':
                'https://ethereum-sepolia.publicnode.com',
            };
          }
        }
        if (key === 'signer.openBao') {
          return (
            configOverride?.openBao || {
              url:
                process.env.VAULT_URL ||
                'https://localhost:8200',
              token:
                process.env.VAULT_TOKEN || 'test-token',
              ethereumMount: 'ethereum',
              kvStorePath: 'secret',
              timeoutMs: 10000,
            }
          );
        }

        if (key === 'authentik.jwksUri') {
          return (
            configOverride?.authentikJwksUri ||
            process.env.AUTHENTIK_JWKS_URI ||
            'https://test.jwks.uri'
          );
        }
        if (key === 'authentik.issuer') {
          return (
            configOverride?.authentikIssuer ||
            process.env.AUTHENTIK_ISSUER ||
            'https://test.issuer'
          );
        }
        if (key === 'authentik.audience') {
          return (
            configOverride?.authentikAudience ||
            process.env.AUTHENTIK_AUDIENCE ||
            'test-audience'
          );
        }
        if (key === 'authentik.upstreamIdp') {
          if (
            configOverride &&
            'upstreamIdp' in configOverride
          ) {
            return configOverride.upstreamIdp;
          }
          return (
            process.env.UPSTREAM_IDP || 'VM3 Partner Source'
          );
        }

        return undefined;
      }),
    };

    moduleBuilder
      .overrideProvider(ConfigService)
      .useValue(mockConfigService);

    this.module = await moduleBuilder.compile();
    this.app = this.module.createNestApplication();

    this.app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    this.app.useGlobalFilters(new HttpExceptionFilter());
    this.app.enableCors();
    this.app.setGlobalPrefix(API_PREFIX);

    await this.app.init();
    return this.app;
  }

  async close() {
    await this.app?.close();
  }

  getApp() {
    return this.app;
  }

  getModule() {
    return this.module;
  }

  request() {
    const agent = request(this.app.getHttpServer());

    HTTP_METHODS_TO_PREFIX.forEach((method) => {
      const original = agent[method].bind(agent);
      agent[method] = ((
        path: string,
        ...args: Parameters<typeof original> extends [
          string,
          ...infer Rest,
        ]
          ? Rest
          : never
      ) =>
        original(
          this.withApiPrefix(path),
          ...args,
        )) as (typeof agent)[typeof method];
    });

    return agent;
  }
}

export const createTestApp = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configOverride?: Record<string, any>,
) => {
  const testApp = new TestApp();
  await testApp.init(configOverride);
  return testApp;
};

export const generateValidHeaders = (
  jwtToken: string = TEST_VALID_JWT,
) => {
  if (!jwtToken) {
    console.warn(
      '⚠️ JWT_TOKEN is not set in environment variables',
    );
    return {
      Authorization: 'Bearer dummy-token-for-testing',
    };
  }
  return {
    Authorization: `Bearer ${jwtToken}`,
  };
};

export const generateInvalidHeaders = () => {
  return {
    Authorization: `Bearer ${TEST_INVALID_JWT}`,
  };
};

export const generateHeadersWithToken = (token: string) => {
  return {
    Authorization: `Bearer ${token}`,
  };
};

export const skipIfVaultNotAvailable = () => {
  if (!isVaultAvailable()) {
    console.warn(
      '⚠️ Vault is not available, skipping Vault-dependent test',
    );
    return true;
  }
  return false;
};

export const skipIfNoValidToken = () => {
  if (!TEST_VALID_JWT) {
    console.warn(
      '⚠️ JWT_TOKEN is not set, skipping authentication test',
    );
    return true;
  }
  return false;
};
