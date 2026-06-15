function parseNodeUriMap(): Record<string, string> {
  const value = process.env.NODE_URI_MAP;
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed).map(([chainId, nodeUri]) => [
      chainId,
      String(nodeUri),
    ]),
  );
}

type PrivateKeyConfig = {
  walletId: number;
  key: string;
};

function parseSignerMode(): 'local' | 'vault' {
  const value = process.env.SIGNER_MODE;
  if (value !== 'local' && value !== 'vault') {
    throw new Error('SIGNER_MODE must be either local or vault');
  }

  return value;
}

function parseVaultMount(value: string | undefined, fallback: string): string {
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
    throw new Error('VAULT_TIMEOUT_MS must be a positive integer');
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
      throw new Error(`PRIVATE_KEYS[${index}] must be an object`);
    }

    const { walletId, key } = entry as Record<string, unknown>;
    if (!Number.isInteger(walletId) || Number(walletId) < 1) {
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
      throw new Error(`PRIVATE_KEYS[${index}].key must be a non-empty string`);
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

  return {
    signer: {
      mode: signerMode,
      privateKeys: signerMode === 'local' ? parsePrivateKeys() : [],
      nodeUriMap: parseNodeUriMap(),
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
    },
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKeyFallback: process.env.API_KEY_FALLBACK,
    tls: {
      certPath: process.env.HTTP_CERT_PATH,
      keyPath: process.env.HTTP_KEY_PATH,
    },
  };
};
