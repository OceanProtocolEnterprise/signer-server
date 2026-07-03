import { DEFAULT_GAS_MULTIPLIERS_BY_CHAIN } from './default-gas-multipliers.config';
import { parseAllowedOrigins } from '../common/origins';

type NodeUriMapEntry = Record<
  string,
  {
    key: unknown;
    multiplier?: unknown;
  }
>;

type ParsedNodeUriConfig = {
  nodeUriMap: Record<string, string>;
  feeBumpPercentByChain: Record<string, number>;
};

function parseNodeUriMap(): ParsedNodeUriConfig {
  const value = process.env.NODE_URI_MAP;
  if (!value) {
    return {
      nodeUriMap: {},
      feeBumpPercentByChain: {},
    };
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('NODE_URI_MAP must be a JSON array');
  }

  const nodeUriMap: Record<string, string> = {};
  const feeBumpPercentByChain: Record<string, number> = {};
  const seenChainIds = new Set<string>();

  parsed.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(
        `NODE_URI_MAP[${index}] must be an object`,
      );
    }

    const entries = Object.entries(
      entry as NodeUriMapEntry,
    );
    if (entries.length !== 1) {
      throw new Error(
        `NODE_URI_MAP[${index}] must contain exactly one chain ID`,
      );
    }

    const [chainId, config] = entries[0];
    if (!/^[1-9]\d*$/.test(chainId)) {
      throw new Error(
        `NODE_URI_MAP[${index}] chain ID must be a positive integer string`,
      );
    }

    if (seenChainIds.has(chainId)) {
      throw new Error(
        `NODE_URI_MAP contains duplicate chain ID ${chainId}`,
      );
    }
    seenChainIds.add(chainId);

    if (!config || typeof config !== 'object') {
      throw new Error(
        `NODE_URI_MAP[${index}][${chainId}] must be an object`,
      );
    }

    const { key, multiplier } = config;
    if (typeof key !== 'string' || !key.trim()) {
      throw new Error(
        `NODE_URI_MAP[${index}][${chainId}].key must be a non-empty string`,
      );
    }

    const feeMultiplier = Number(
      multiplier ??
        DEFAULT_GAS_MULTIPLIERS_BY_CHAIN[chainId] ??
        1,
    );
    if (
      !Number.isFinite(feeMultiplier) ||
      feeMultiplier < 1
    ) {
      throw new Error(
        `NODE_URI_MAP[${index}][${chainId}].multiplier must be a number greater than or equal to 1`,
      );
    }

    nodeUriMap[chainId] = key.trim();
    feeBumpPercentByChain[chainId] = Math.ceil(
      feeMultiplier * 100,
    );
  });

  return {
    nodeUriMap,
    feeBumpPercentByChain,
  };
}

type PrivateKeyConfig = {
  walletId: number;
  key: string;
};

function parseSignerMode(): 'local' | 'vault' {
  const value = process.env.SIGNER_MODE;
  if (value !== 'local' && value !== 'vault') {
    throw new Error(
      'SIGNER_MODE must be either local or vault',
    );
  }

  return value;
}

function parseVaultMount(
  value: string | undefined,
  fallback: string,
): string {
  const mount = value?.trim() || fallback;
  return mount.replace(/^\/+|\/+$/g, '');
}

function parseVaultTimeoutMs(): number {
  const value = process.env.VAULT_TIMEOUT_MS;
  if (!value) {
    return 10000;
  }

  const timeoutMs = Number(value);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new Error(
      'VAULT_TIMEOUT_MS must be a positive integer',
    );
  }

  return timeoutMs;
}

function parsePrivateKeys(): PrivateKeyConfig[] {
  const value = process.env.PRIVATE_KEYS;
  if (!value) {
    return [];
  }

  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('PRIVATE_KEYS must be a JSON array');
  }

  const seenWalletIds = new Set<number>();
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(
        `PRIVATE_KEYS[${index}] must be an object`,
      );
    }

    const { walletId, key } = entry as Record<
      string,
      unknown
    >;
    if (
      !Number.isInteger(walletId) ||
      Number(walletId) < 1
    ) {
      throw new Error(
        `PRIVATE_KEYS[${index}].walletId must be a positive integer`,
      );
    }

    if (seenWalletIds.has(Number(walletId))) {
      throw new Error(
        `PRIVATE_KEYS contains duplicate walletId ${String(walletId)}`,
      );
    }
    seenWalletIds.add(Number(walletId));

    if (typeof key !== 'string' || !key.trim()) {
      throw new Error(
        `PRIVATE_KEYS[${index}].key must be a non-empty string`,
      );
    }

    const normalizedKey = key.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(normalizedKey)) {
      throw new Error(
        `PRIVATE_KEYS[${index}].key must be a 32-byte hex private key`,
      );
    }

    return {
      walletId: Number(walletId),
      key: normalizedKey,
    };
  });
}

export default () => {
  const signerMode = parseSignerMode();
  const parsedNodeUriConfig = parseNodeUriMap();

  return {
    signer: {
      mode: signerMode,
      privateKeys:
        signerMode === 'local' ? parsePrivateKeys() : [],
      nodeUriMap: parsedNodeUriConfig.nodeUriMap,
      feeBumpPercentByChain:
        parsedNodeUriConfig.feeBumpPercentByChain,
      openBao: {
        url: process.env.VAULT_URL,
        token: process.env.VAULT_TOKEN,
        ethereumMount: parseVaultMount(
          process.env.VAULT_ETHEREUM_MOUNT,
          'ethereum',
        ),
        kvStorePath: parseVaultMount(
          process.env.VAULT_KV_STORE_PATH,
          'secret',
        ),
        timeoutMs: parseVaultTimeoutMs(),
      },
    },
    authentik: {
      jwksUri: process.env.AUTHENTIK_JWKS_URI,
      issuer: process.env.AUTHENTIK_ISSUER,
      audience: process.env.AUTHENTIK_AUDIENCE,
      upstreamIdp: process.env.UPSTREAM_IDP,
    },
    allowedOrigins: parseAllowedOrigins(
      process.env.ALLOWED_ORIGINS,
    ),
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKeyFallback: process.env.API_KEY_FALLBACK,
    tls: {
      certPath: process.env.HTTP_CERT_PATH,
      keyPath: process.env.HTTP_KEY_PATH,
    },
  };
};
