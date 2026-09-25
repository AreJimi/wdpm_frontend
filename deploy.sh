#!/usr/bin/env bash
#
# deploy-frontend.sh — build the wdpm web frontend as a static export, deploy
# it to the server's web root, and (optionally) configure Nginx + SSL for the
# given domain.
#
# Usage:
#   ./deploy.sh                                           # full deploy
#   ./deploy.sh --domain wdpm.ir                          # explicit domain
#   ./deploy.sh --remote user@host                        # rsync to remote
#   ./deploy.sh --skip-deps                               # skip npm ci
#   ./deploy.sh --skip-nginx                              # skip Nginx setup
#   ./deploy.sh --skip-ssl                                # skip certbot/SSL
#
# Environment variables (all optional):
#   APP_DIR        repo location                          (default: /opt/wdpm)
#   DOMAIN         domain name for Nginx/SSL              (default: wdpm.ir)
#   WEB_ROOT       static web root                        (default: /var/www/wdpm.org)
#   API_BASE_URL   baked-in NEXT_PUBLIC_API_BASE_URL      (default: https://$DOMAIN/api/v1)
#   API_PORT       backend port for Nginx proxy           (default: 3000)
#   EMAIL          email for certbot registration         (default: none)
#   REMOTE_HOST    ssh target ("user@host"), same as --remote (default: local)
#
# The result is a fully static site (Next.js output: 'export') — no Node.js
# needed on the web server.

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/wdpm}"
DOMAIN="${DOMAIN:-wdpm.ir}"
WEB_ROOT="${WEB_ROOT:-/var/www/wdpm.org}"
API_BASE_URL="${API_BASE_URL:-}"
API_PORT="${API_PORT:-3000}"
EMAIL="${EMAIL:-}"
REMOTE_HOST="${REMOTE_HOST:-}"

SKIP_DEPS=0
SKIP_NGINX=0
SKIP_SSL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --domain)     DOMAIN="${2:?--domain requires a value}"; shift ;;
    --web-root)   WEB_ROOT="${2:?--web-root requires a value}"; shift ;;
    --remote)     REMOTE_HOST="${2:?--remote requires a value like user@host}"; shift ;;
    --skip-deps)  SKIP_DEPS=1 ;;
    --skip-nginx) SKIP_NGINX=1 ;;
    --skip-ssl)   SKIP_SSL=1 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

# Default the API URL to the domain being deployed (https + domain + /api/v1).
API_BASE_URL="${API_BASE_URL:-https://$DOMAIN/api/v1}"

log()  { printf '\033[1;34m[deploy-frontend]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy-frontend]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy-frontend]\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "node is not installed (need >= 20)"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed"

FRONTEND_DIR="$APP_DIR/frontend"
[ -d "$FRONTEND_DIR" ] || fail "frontend directory not found: $FRONTEND_DIR (set APP_DIR)"

cd "$FRONTEND_DIR"

# ── 1. Dependencies ─────────────────────────────────────────────────────────
if [ "$SKIP_DEPS" -eq 0 ]; then
  log "Installing dependencies (npm ci)…"
  npm ci
else
  log "Skipping dependency install (--skip-deps)"
fi

# ── 2. Static build with the production API URL ────────────────────────────
log "Building static export with NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL…"
NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" npm run build

[ -f out/index.html ]       || fail "build failed: out/index.html missing"
[ -f out/admin/index.html ] || fail "build failed: out/admin/index.html missing"

# ── 3. Deploy to web root ───────────────────────────────────────────────────
if [ -n "$REMOTE_HOST" ]; then
  command -v rsync >/dev/null 2>&1 || fail "rsync is required for --remote mode"
  log "Deploying to remote host $REMOTE_HOST:$WEB_ROOT…"
  ssh "$REMOTE_HOST" "sudo mkdir -p '$WEB_ROOT' && sudo chown \"\$(whoami)\" '$WEB_ROOT'"
  rsync -az --delete --info=stats1 --exclude '.well-known' out/ "$REMOTE_HOST:$WEB_ROOT/"
else
  log "Deploying to local web root $WEB_ROOT…"
  if [ "$(id -u)" -eq 0 ]; then
    mkdir -p "$WEB_ROOT"
    rsync -a --delete --exclude '.well-known' out/ "$WEB_ROOT/"
  else
    sudo mkdir -p "$WEB_ROOT"
    sudo rsync -a --delete --exclude '.well-known' out/ "$WEB_ROOT/"
  fi
fi

# ── 4. Verify deployed files ────────────────────────────────────────────────
log "Verifying deployed files…"
if [ -n "$REMOTE_HOST" ]; then
  ssh "$REMOTE_HOST" "test -f '$WEB_ROOT/index.html' && test -f '$WEB_ROOT/admin/index.html'" \
    || fail "verification failed on remote host"
else
  test -f "$WEB_ROOT/index.html" && test -f "$WEB_ROOT/admin/index.html" \
    || fail "verification failed locally"
fi
log "Static site deployed to $WEB_ROOT."

# ── 5. Nginx (skippable: --skip-nginx) ──────────────────────────────────────
if [ "$SKIP_NGINX" -eq 1 ]; then
  warn "Skipping Nginx setup (--skip-nginx)"
else
  NGINX_TARGET="local"
  if [ -n "$REMOTE_HOST" ]; then NGINX_TARGET="$REMOTE_HOST"; fi
  log "Configuring Nginx for domain '$DOMAIN' on $NGINX_TARGET…"

  run_target() {
    if [ "$NGINX_TARGET" = "local" ]; then bash -s; else ssh "$NGINX_TARGET" bash -s; fi
  # Runs the heredoc script either locally or on the remote host.
  }

  run_target <<REMOTE_SCRIPT
set -euo pipefail
DOMAIN="$DOMAIN"
WEB_ROOT="$WEB_ROOT"
API_PORT="$API_PORT"

# Install nginx if missing (Debian/Ubuntu via apt).
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "[nginx] installing nginx via apt…"
    apt-get update -qq && apt-get install -y -qq nginx
  else
    echo "[nginx] nginx not installed and apt unavailable — skipping." >&2
    exit 42
  fi
fi

if [ -d /etc/nginx/sites-available ]; then
  CONF_PATH="/etc/nginx/sites-available/wdpm.conf"
  ENABLED_PATH="/etc/nginx/sites-enabled/wdpm.conf"
else
  CONF_PATH="/etc/nginx/conf.d/wdpm.conf"
  ENABLED_PATH=""
fi

cat > /tmp/wdpm-nginx.conf <<EOF
# Managed by frontend/deploy.sh — regenerate by re-running the script.
server {
    listen 80;
    server_name \$DOMAIN;

    root \$WEB_ROOT;
    index index.html;

    location / {
        try_files \$uri \$uri/ \$uri/index.html =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:\$API_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

cp /tmp/wdpm-nginx.conf "\$CONF_PATH"
rm -f /tmp/wdpm-nginx.conf
if [ -n "\$ENABLED_PATH" ]; then
  ln -sf "\$CONF_PATH" "\$ENABLED_PATH"
fi

nginx -t
systemctl enable nginx
systemctl reload nginx 2>/dev/null || systemctl restart nginx
echo "[nginx] serving \$DOMAIN from \$WEB_ROOT (API proxied to 127.0.0.1:\$API_PORT)."
REMOTE_SCRIPT

  if [ $? -eq 42 ]; then
    warn "Nginx could not be configured on the target — continuing."
    SKIP_NGINX=1
  fi
fi

# ── 6. SSL via certbot (skippable: --skip-ssl) ──────────────────────────────
if [ "$SKIP_SSL" -eq 1 ]; then
  warn "Skipping SSL certificate (--skip-ssl)"
elif [ "$SKIP_NGINX" -eq 1 ]; then
  warn "Skipping SSL because Nginx setup was skipped (--skip-nginx)"
else
  log "Obtaining SSL certificate for '$DOMAIN'…"
  SSL_TARGET="local"
  if [ -n "$REMOTE_HOST" ]; then SSL_TARGET="$REMOTE_HOST"; fi

  bash_or_ssh() {
    if [ "$SSL_TARGET" = "local" ]; then bash -s; else ssh "$SSL_TARGET" bash -s; fi
  }

  if bash_or_ssh <<REMOTE_SCRIPT
set -euo pipefail
DOMAIN="$DOMAIN"
EMAIL="$EMAIL"

if ! command -v certbot >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq certbot python3-certbot-nginx
  else
    echo "[ssl] certbot not installed and apt unavailable — skipping." >&2
    exit 42
  fi
fi

CERTBOT_ARGS=(--nginx -d "\$DOMAIN" --redirect --non-interactive --agree-tos)
if [ -n "\$EMAIL" ]; then
  CERTBOT_ARGS+=(-m "\$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi
certbot "\${CERTBOT_ARGS[@]}"
systemctl reload nginx
echo "[ssl] https://\$DOMAIN is active."
REMOTE_SCRIPT
  then
    log "SSL is active for $DOMAIN."
  else
    warn "certbot failed (is DNS pointing at this server yet?) — HTTP is still served."
  fi
fi

log "Frontend deploy complete — https://$DOMAIN is live (or HTTP if SSL was skipped/failed)."
