#!/bin/sh
# TO BE FIXED
set -e

export BAO_ADDR=http://127.0.0.1:8200
export BAO_TOKEN=root

echo "[init] Waiting for OpenBao..."

until bao status >/dev/null 2>&1; do
  sleep 2
done

# ----------------------------
# INIT (only if not initialized)
# ----------------------------

STATUS=$(bao status -format=json 2>/dev/null || true)
INITIALIZED=$(echo "$STATUS" | jq -r '.initialized // false')
SEALED=$(echo "$STATUS" | jq -r '.sealed // true')

INIT_FILE="/vault/keys/init.json"
ADDRESS_FILE="/vault/keys/address"
PRIVATE_KEY_FILE="/vault/keys/private.key"

if [ "$INITIALIZED" != "true" ]; then
  echo "[init] Initializing OpenBao..."

  bao operator init -format=json > "$INIT_FILE"
else
  echo "[init] Already initialized"

  if [ ! -f "$INIT_FILE" ]; then
    echo "[init] WARNING: init.json missing, cannot unseal automatically"
    echo "[init] Please provide unseal keys manually or persist init.json"
    exit 1
  fi
fi

# ----------------------------
# UNSEAL
# ----------------------------

UNSEAL_KEY=$(jq -r '.unseal_keys_b64[0]' "$INIT_FILE")

if [ -z "$UNSEAL_KEY" ] || [ "$UNSEAL_KEY" = "null" ]; then
  echo "[init] ERROR: missing unseal key"
  exit 1
fi

echo "[init] Unsealing OpenBao..."

bao operator unseal "$UNSEAL_KEY" >/dev/null

# wait until unsealed
until [ "$(bao status -format=json | jq -r '.sealed')" = "false" ]; do
  echo "[init] waiting for unseal..."
  sleep 2
done

echo "[init] OpenBao is unsealed"

echo "[init] Registering ethsign plugin..."

PLUGIN_PATH="/opt/openbao/plugins/ethsign"

if [ ! -f "$PLUGIN_PATH" ]; then
  echo "[init] ERROR: plugin binary missing"
  exit 1
fi

SHA256=$(sha256sum "$PLUGIN_PATH" | awk '{print $1}')

echo "[init] Plugin SHA256: $SHA256"

bao plugin register -sha256="$SHA256" -command=ethsign secret ethsign || true

echo "[init] Plugin registered (or already exists)"

# ----------------------------
# ETH ACCOUNT INIT
# ----------------------------

if [ -f "$ADDRESS_FILE" ]; then
  echo "[init] Account already exists: $(cat $ADDRESS_FILE)"
  exit 0
fi

echo "[init] Enabling ethereum secrets engine..."

bao secrets enable -path=ethereum -plugin-name=ethsign plugin || true

if [ ! -f "$PRIVATE_KEY_FILE" ]; then
  echo "[init] ERROR: missing private key file"
  exit 1
fi

PRIVATE_KEY=$(cat "$PRIVATE_KEY_FILE" | tr -d '\n' | sed 's/^0x//')

echo "[init] Creating ethereum account..."

CREATE_RESPONSE=$(bao write -format=json ethereum/accounts privateKey="${PRIVATE_KEY}")

echo "[init] Raw response:"
echo "$CREATE_RESPONSE"

ADDRESS=$(echo "$CREATE_RESPONSE" | jq -r '.data.address // empty')

if [ -z "$ADDRESS" ]; then
  echo "[init] ERROR: failed to extract address"
  exit 1
fi

echo "$ADDRESS" > "$ADDRESS_FILE"

echo "[init] Address stored: $ADDRESS"

# ----------------------------
# CLEANUP
# ----------------------------

echo "[init] Removing private key file for security..."
rm -f "$PRIVATE_KEY_FILE"

echo "[init] OpenBao initialization complete"