#!/bin/sh
set -e

TARGET="/usr/share/nginx/html/env.js"

# Generate runtime config from environment (comes from Vault/ESO)
cat > "$TARGET" <<EOF
window.__APP_CONFIG__ = {
  apiBaseUrl: "${VITE_API_BASE_URL:-${VITE_API_URL:-https://api.stock.dsk.lab/api}}"
};
EOF

exec nginx -g "daemon off;"
