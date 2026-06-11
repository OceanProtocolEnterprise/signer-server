export default () => ({
  ethereum: {
    privateKey: process.env.PRIVATE_KEY,
    rpcUrl: process.env.ETHEREUM_RPC_URL,
    chainId: parseInt(process.env.CHAIN_ID || '11155111', 10),
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