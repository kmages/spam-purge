#!/usr/bin/env bash
# =============================================================================
# SPAM Purge — one-shot installer for a fresh Ubuntu 22.04 / 24.04 Hetzner VM.
#
# On the VM (as root):
#
#   apt update && apt install -y git
#   git clone <YOUR-REPO-URL> /opt/spam-purge
#   cd /opt/spam-purge
#   sudo ./deploy/setup.sh
#
# It will ask you for 3 things (domain, Google Client ID, Google Client Secret),
# then install Node + PostgreSQL + Caddy, create the database, build the app,
# install an always-on systemd service, and set up automatic HTTPS.
#
# Re-running it is safe — it reuses existing config and the existing database.
# =============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root:  sudo ./deploy/setup.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE=/etc/spam-purge.env
APP_USER=spampurge
DB_NAME=spam_purge
DB_USER=spampurge
PORT=8085

echo "==> SPAM Purge installer"
echo "    repo: $ROOT"
echo

# ---------------------------------------------------------------------------
# 1. Gather config (only prompt for what we don't already have)
# ---------------------------------------------------------------------------
# Reuse values from a previous run if the env file exists.
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

ask() { # ask VAR "Question" [silent]
  local var="$1" q="$2" silent="${3:-}" val=""
  set +u
  val="${!var}"
  set -u
  if [[ -z "$val" ]]; then
    if [[ "$silent" == "silent" ]]; then read -rsp "$q: " val; echo
    else read -rp "$q: " val; fi
  fi
  printf -v "$var" '%s' "$val"
}

ask DOMAIN            "Your domain (its DNS A record must point at this VM, e.g. spampurge.example.com)"
ask GOOGLE_OAUTH_CID  "Google OAuth Client ID"
ask GOOGLE_OAUTH_CSEC "Google OAuth Client Secret" silent

# Generate secrets once and keep them stable across re-runs.
SESSION_SECRET="${SESSION_SECRET:-$(openssl rand -hex 32)}"
if [[ -z "${DATABASE_URL:-}" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
  CREATE_DB=1
else
  CREATE_DB=0   # env file already had a DATABASE_URL — leave the DB alone
fi

# ---------------------------------------------------------------------------
# 2. Install system packages: Node 24, pnpm, PostgreSQL, Caddy
# ---------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
echo "==> installing base packages"
apt-get update -y
apt-get install -y curl ca-certificates gnupg git openssl debian-keyring debian-archive-keyring apt-transport-https

NODE_MAJOR="$(command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' || echo 0)"
if [[ "$NODE_MAJOR" -lt 24 ]]; then
  echo "==> installing Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
echo "==> enabling pnpm via corepack"
corepack enable
corepack prepare pnpm@latest --activate

if ! command -v psql >/dev/null 2>&1; then
  echo "==> installing PostgreSQL"
  apt-get install -y postgresql
fi
systemctl enable --now postgresql

# Caddy installation bypassed since Nginx is used as the frontend proxy on this server
# if ! command -v caddy >/dev/null 2>&1; then
#   echo "==> installing Caddy"
#   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
#     | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
#   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
#     > /etc/apt/sources.list.d/caddy-stable.list
#   apt-get update -y
#   apt-get install -y caddy
# fi

# ---------------------------------------------------------------------------
# 3. Create the database (first run only)
# ---------------------------------------------------------------------------
if [[ "$CREATE_DB" == "1" ]]; then
  echo "==> creating PostgreSQL database and user"
  sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
  END IF;
END \$\$;
SQL
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
  fi
fi

# ---------------------------------------------------------------------------
# 4. App user + write the env file
# ---------------------------------------------------------------------------
if ! id "$APP_USER" >/dev/null 2>&1; then
  echo "==> creating system user '$APP_USER'"
  useradd --system --shell /usr/sbin/nologin "$APP_USER"
fi

echo "==> writing $ENV_FILE"
cat > "$ENV_FILE" <<ENV
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
GOOGLE_OAUTH_CID=${GOOGLE_OAUTH_CID}
GOOGLE_OAUTH_CSEC=${GOOGLE_OAUTH_CSEC}
NODE_ENV=production
PORT=${PORT}
SERVE_STATIC=true
DOMAIN=${DOMAIN}
ENV
chown root:"$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# ---------------------------------------------------------------------------
# 5. Build the app
# ---------------------------------------------------------------------------
echo "==> building (this can take a few minutes)"
set -a; source "$ENV_FILE"; set +a
"$ROOT/deploy/build.sh"
chown -R "$APP_USER":"$APP_USER" "$ROOT"

# ---------------------------------------------------------------------------
# 6. systemd service (always-on — this is what makes auto-purge run 24/7)
# ---------------------------------------------------------------------------
echo "==> installing systemd service"
cat > /etc/systemd/system/spam-purge.service <<UNIT
[Unit]
Description=SPAM Purge (Gmail auto spam deletion)
After=network.target postgresql.service

[Service]
WorkingDirectory=${ROOT}
EnvironmentFile=${ENV_FILE}
ExecStart=$(command -v node) --enable-source-maps artifacts/api-server/dist/index.mjs
Restart=always
RestartSec=5
User=${APP_USER}

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now spam-purge
systemctl restart spam-purge

# ---------------------------------------------------------------------------
# 7. Caddy reverse proxy (automatic HTTPS) - Bypassed for Nginx config
# ---------------------------------------------------------------------------
# echo "==> configuring Caddy for $DOMAIN"
# cat > /etc/caddy/Caddyfile <<CADDY
# ${DOMAIN} {
#     reverse_proxy localhost:${PORT}
# }
# CADDY
# systemctl enable caddy
# systemctl reload caddy || systemctl restart caddy

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
cat <<DONE

============================================================================
 SPAM Purge is installed and running.

 Site:    https://${DOMAIN}
 Service: systemctl status spam-purge   (logs: journalctl -u spam-purge -f)

 TWO things to finish:
 1. DNS — point an A record for ${DOMAIN} at this VM's public IP (if not done).
    Caddy will then fetch an HTTPS certificate automatically on first visit.
 2. Google Cloud Console — add this OAuth redirect URI to your OAuth client:
       https://${DOMAIN}/api/auth/google/callback

 Then open https://${DOMAIN}, sign in with Google, and turn on Automatic Purge.
 The service runs 24/7, so spam is deleted around the clock.

 To update later:  cd ${ROOT} && git pull && sudo ./deploy/setup.sh
============================================================================
DONE
