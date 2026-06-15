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

export default () => ({
  signer: {
    privateKeys: parsePrivateKeys(),
    nodeUriMap: parseNodeUriMap(),
  },
  authentik: {
    jwksUri: process.env.AUTHENTIK_JWKS_URI,
    issuer: process.env.AUTHENTIK_ISSUER,
    audience: process.env.AUTHENTIK_AUDIENCE,
  },
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKeyFallback: process.env.API_KEY_FALLBACK,
});
