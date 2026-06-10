# signer-server
Server for web3 signer abstraction

## Setup

```bash
npm install
cp .env.example .env   # fill in your private key and RPC URL
```

## Run

Terminal 1 — start the signer service:
```bash
npm run service
```

Terminal 2 — run the demo:
```bash
npm run demo
```

## Files

- `service.js` — Express backend, imports private key from env, uses ethers.Wallet
- `remote-signer.js` — RemoteSigner class extending ethers.AbstractSigner, fetches from backend
- `demo.js` — ocean.js Datatoken.approve() using RemoteSigner

