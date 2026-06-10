#!/usr/bin/env bash
# Build SPAM Purge for self-hosting. Run this on the VM after pulling the code
# and creating your env file. Usage:
#
#   sudo cp deploy/spam-purge.env.example /etc/spam-purge.env   # then edit it
#   set -a; source /etc/spam-purge.env; set +a
#   ./deploy/build.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Load the env file automatically if it exists and vars aren't already set.
if [[ -z "${DATABASE_URL:-}" && -f /etc/spam-purge.env ]]; then
  echo "==> loading /etc/spam-purge.env"
  set -a; source /etc/spam-purge.env; set +a
fi

: "${DATABASE_URL:?DATABASE_URL is required (set it or create /etc/spam-purge.env)}"
PORT="${PORT:-8080}"

echo "==> installing dependencies"
pnpm install

echo "==> pushing database schema"
pnpm --filter @workspace/db run push

echo "==> building frontend"
PORT="$PORT" BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/spam-purge run build

echo "==> building backend"
pnpm --filter @workspace/api-server run build

echo ""
echo "Build complete."
echo "Start it now with:"
echo "  SERVE_STATIC=true NODE_ENV=production PORT=$PORT node --enable-source-maps artifacts/api-server/dist/index.mjs"
echo "Or install the systemd service (see deploy/spam-purge.service)."
