function parseNodeUriMap(): Record<string, string> {
  const value = process.env.NODE_URI_MAP;
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(parsed).map(([chainId, nodeUri]) => [chainId, String(nodeUri)]),
  );
}

export default () => ({
  signer: {
    privateKey: process.env.PRIVATE_KEY,
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
