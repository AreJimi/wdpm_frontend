#!/usr/bin/env bash
# ============================================================================
# wdpm frontend — automated deployment script
#
# Builds the web app as a static export and deploys it, optionally
# configuring nginx + SSL:
#
#   - installs deps (skipped automatically when node_modules/ exists)
#   - static build with NEXT_PUBLIC_API_BASE_URL baked in
#   - verifies out/index.html + out/admin/index.html
#   - rsyncs (atomic-ish) to the web root — locally or over SSH (--remote),
#     preserving .well-known for ACME challenges
#   - generates + installs the nginx server block (only when content
#     actually changes) with gzip, static caching and API proxying —
#     the same wdpm.conf backend/deploy.sh writes, so both converge
#   - optionally obtains a Let's Encrypt certificate via certbot
#     (only when one is not already present)
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh                                          # interactive
#   ./deploy.sh --defaults                               # non-interactive
#   ./deploy.sh --domain wdpm.ir --remote user@srv       # explicit values
#
# Incremental / idempotent:
#   - npm install is skipped automatically when node_modules/ exists
#   - the nginx config is written only when its content actually changes
#   - certbot runs only when a certificate is not already present
#   - nginx reload happens only when a config actually changed
#
# Options:
#   --defaults      non-interactive with built-in/env defaults
#   --skip-deps     never run npm ci
#   --skip-nginx    do not touch nginx configs (or reload)
#   --skip-ssl      do not run certbot
#   --status        read-only report; change nothing
#
# Environment variables (all optional):
#   APP_DIR        repo location                     (default: /opt/wdpm)
#   DOMAIN         domain for nginx/SSL              (default: wdpm.ir)
#   WEB_ROOT       static web root                   (default: /var/www/wdpm.ir)
#   API_BASE_URL   baked-in NEXT_PUBLIC_API_BASE_URL (default: https://$DOMAIN/api/v1)
#   API_PORT       backend port for nginx proxy      (default: 3000)
#   EMAIL          certbot registration email
#   REMOTE_HOST    ssh target ("user@host")          (default: local deploy)
#
# Requirements: node >= 20, npm; rsync for --remote mode.
# nginx + certbot are installed automatically on the target when possible.
# ============================================================================
set -euo pipefail

# ————— defaults (used by --defaults or as fallbacks) —————
DEF_DOMAIN="${DOMAIN:-wdpm.ir}"
DEF_WEB_ROOT="${WEB_ROOT:-/var/www/wdpm.ir}"
DEF_API_BASE_URL="${API_BASE_URL:-}"
DEF_API_PORT="${API_PORT:-3000}"
DEF_EMAIL="${EMAIL:-}"
DEF_REMOTE_HOST="${REMOTE_HOST:-}"
DEF_SERVER_NAME=""
DEF_ENABLE_SSL="n"
DEF_RELOAD_NGINX="y"

# ————— pretty output —————
BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RESET=$'\033[0m'
say()  { printf '%s\n' "${BOLD}$*${RESET}"; }
ok()   { printf '%s\n' "${GREEN}✔ $*${RESET}"; }
warn() { printf '%s\n' "${YELLOW}⚠ $*${RESET}"; }
die()  { printf '%s\n' "${RED}✖ $*${RESET}" >&2; exit 1; }

# ————— helpers —————
ask() {
  # ask "prompt" "default" -> echoes the answer
  local prompt="$1" default="${2:-}" answer=""
  if [[ -n "${NONINTERACTIVE:-}" ]]; then
    printf '%s' "$default"; return
  fi
  read -r -p "$(printf '%s' "${DIM}${prompt} ${RESET}[$default]: ")" answer
  printf '%s' "${answer:-$default}"
}

ask_yn() {
  # ask_yn "prompt" "y|n" -> echoes y or n
  local prompt="$1" default="${2:-y}" answer=""
  if [[ -n "${NONINTERACTIVE:-}" ]]; then
    printf '%s' "$default"; return
  fi
  read -r -p "$(printf '%s' "${DIM}${prompt} ${RESET}[${default}]: ")" answer
  answer="${answer:-$default}"
  case "$answer" in [Yy]*) printf 'y';; *) printf 'n';; esac
}

require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    warn "Not running as root — sudo will be used where needed."
    SUDO="sudo"
  else
    SUDO=""
  fi
}

check_deps() {
  say "Checking dependencies…"
  command -v node >/dev/null 2>&1 || die "node is not installed (need >= 20)."
  command -v npm  >/dev/null 2>&1 || die "npm is not installed."
  NODE_MAJOR="$(node -e 'console.log(process.versions.node.split(".")[0])')"
  [[ "$NODE_MAJOR" -ge 20 ]] || die "node >= 20 required (found $(node -v))."
  ok "node $(node -v), npm $(npm -v)"
}

# ————— parse args —————
SKIP_DEPS=0
SKIP_NGINX=0
SKIP_SSL=0
STATUS_ONLY=0

for arg in "$@"; do
  case "$arg" in
    --defaults)    NONINTERACTIVE=1 ;;
    --skip-deps)   SKIP_DEPS=1 ;;
    --skip-nginx)  SKIP_NGINX=1 ;;
    --skip-ssl)    SKIP_SSL=1 ;;
    --status)      STATUS_ONLY=1 ;;
    -h|--help)
      awk '/^# =+$/ && ++n == 2 { print; exit } { print }' "$0"
      echo ""
      echo "Options:"
      echo "  --defaults      non-interactive with built-in/env defaults"
      echo "  --skip-deps     never run npm ci"
      echo "  --skip-nginx    do not write/reload nginx configs"
      echo "  --skip-ssl      do not attempt certbot"
      echo "  --status        report only; do not modify anything"
      exit 0
      ;;
    *) warn "Unknown option: $arg (ignored)" ;;
  esac
done

# value-carrying flags need a second pass since the loop above
# intentionally handles simple flags only
while [ $# -gt 0 ]; do
  case "$1" in
    --domain)       DEF_DOMAIN="${2:?--domain requires a value}"; shift ;;
    --web-root)     DEF_WEB_ROOT="${2:?--web-root requires a value}"; shift ;;
    --remote)       DEF_REMOTE_HOST="${2:?--remote requires a value like user@host}"; shift ;;
    --api-base-url) DEF_API_BASE_URL="${2:?--api-base-url requires a value}"; shift ;;
    --api-port)     DEF_API_PORT="${2:?--api-port requires a value}"; shift ;;
    --email)        DEF_EMAIL="${2:?--email requires a value}"; shift ;;
  esac
  shift
done

require_root
check_deps

# ————— locate the frontend —————
# The script lives in frontend/, so trust its own location first.
# APP_DIR is honored only when it really contains the frontend —
# a stale/empty $APP_DIR/frontend must not hijack the deploy.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${APP_DIR:-}" && -f "$APP_DIR/frontend/package.json" ]]; then
  FRONTEND_DIR="$APP_DIR/frontend"
else
  FRONTEND_DIR="$SCRIPT_DIR"
fi
[[ -f "$FRONTEND_DIR/package.json" ]] \
  || die "package.json not found in $FRONTEND_DIR — run this script from frontend/ (or set APP_DIR to the repo root)."
cd "$FRONTEND_DIR"

# ————— banner —————
say ""
say "═══════════════════════════════════════════════════════════════"
say "  wdpm frontend — deployment"
say "═══════════════════════════════════════════════════════════════"
say ""

# ————— questions —————
DOMAIN="$(ask "Domain" "$DEF_DOMAIN")"
WEB_ROOT="$(ask "Web root" "$DEF_WEB_ROOT")"
DEF_API_BASE_URL="${DEF_API_BASE_URL:-https://$DOMAIN/api/v1}"
API_BASE_URL="$(ask "API base URL baked into the build" "$DEF_API_BASE_URL")"
API_PORT="$(ask "Backend port for nginx proxy" "$DEF_API_PORT")"
REMOTE_HOST="$(ask "Deploy over SSH to host (blank = local)" "$DEF_REMOTE_HOST")"
SERVER_NAME_EXTRA="$(ask "Extra server_name aliases (blank = none)" "$DEF_SERVER_NAME")"
ENABLE_SSL="$(ask_yn "Obtain Let's Encrypt SSL certificate now?" "$DEF_ENABLE_SSL")"
if [[ "$ENABLE_SSL" == "y" ]]; then
  CERTBOT_EMAIL="$(ask "Email for certbot (blank = none)" "$DEF_EMAIL")"
else
  CERTBOT_EMAIL="$DEF_EMAIL"
fi
RELOAD_NGINX="$(ask_yn "Reload nginx after configuration?" "$DEF_RELOAD_NGINX")"

# ————— sanity —————
[[ -f package.json && -f next.config.ts ]] \
  || die "package.json/next.config.ts not found in $(pwd) — run this script from frontend/ (or set APP_DIR to the repo root)."

say ""
say "Plan:"
say "  Site     → https://${DOMAIN}  → ${WEB_ROOT}  $([[ -n "$REMOTE_HOST" ]] && printf '(via %s)' "$REMOTE_HOST" || printf '(local)')"
say "  API      → proxied to 127.0.0.1:${API_PORT}/api/v1"
say "  Bake in  → NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}"
say ""

# run a shell script locally, or on the remote target over SSH
run_shell() {
  if [[ -z "$REMOTE_HOST" ]]; then bash -s; else ssh "$REMOTE_HOST" bash -s; fi
}

# ————— status-only report (no changes) —————
if [[ "$STATUS_ONLY" -eq 1 ]]; then
  say "Status report (read-only):"
  [[ -d node_modules ]] && ok "node_modules present — npm ci can be skipped (--skip-deps)" \
                        || warn "node_modules missing — will run npm ci"
  [[ -f out/index.html ]] && ok "out/ exists (stale build — will be rebuilt)" \
                        || warn "out/ missing — will be built"
  TARGET_STATE="$(run_shell <<STATUS_EOF
WEB_ROOT="$WEB_ROOT"
DOMAIN="$DOMAIN"
if [ -f "\$WEB_ROOT/index.html" ] && [ -f "\$WEB_ROOT/admin/index.html" ]; then
  echo "DEPLOYED yes"
else
  echo "DEPLOYED no"
fi
if [ -f /etc/nginx/sites-available/wdpm.conf ] || [ -f /etc/nginx/conf.d/wdpm.conf ]; then
  echo "NGINX yes"
else
  echo "NGINX no"
fi
if [ -d "/etc/letsencrypt/live/\$DOMAIN" ]; then
  echo "SSL yes"
else
  echo "SSL no"
fi
STATUS_EOF
)" || TARGET_STATE=""
  if [[ -z "$TARGET_STATE" ]]; then
    warn "could not probe the target host"
  else
    grep -q '^DEPLOYED yes' <<<"$TARGET_STATE" \
      && ok "site deployed to $WEB_ROOT" \
      || warn "site not deployed to $WEB_ROOT yet"
    grep -q '^NGINX yes' <<<"$TARGET_STATE" \
      && ok "nginx config exists (wdpm.conf)" \
      || warn "nginx config missing (wdpm.conf)"
    grep -q '^SSL yes' <<<"$TARGET_STATE" \
      && ok "SSL cert present for $DOMAIN" \
      || warn "no SSL cert for $DOMAIN"
  fi
  exit 0
fi

# ————— 1. dependencies —————
if [[ "$SKIP_DEPS" -eq 1 ]]; then
  say "Skipping dependency install (--skip-deps)."
elif [[ -d node_modules ]]; then
  say "node_modules present — skipping npm ci (use --skip-deps to force skip, or delete node_modules to reinstall)."
else
  say "Installing dependencies (npm ci)…"
  npm ci --no-audit --no-fund
fi

# ————— 2. static build with the production API URL —————
say "Building static export with NEXT_PUBLIC_API_BASE_URL=$API_BASE_URL…"
NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" npm run build

[[ -f out/index.html ]]       || die "build failed: out/index.html missing"
[[ -f out/admin/index.html ]] || die "build failed: out/admin/index.html missing"
ok "static export built (out/)"

# ————— 3. deploy to web root —————
deploy_static() {
  local dest="$1"
  say "Deploying out/ → ${dest}"
  if [[ -n "$REMOTE_HOST" ]]; then
    command -v rsync >/dev/null 2>&1 || die "rsync is required for --remote mode."
    ssh "$REMOTE_HOST" "sudo mkdir -p '$dest' && sudo chown \\\"\\$(whoami)\\\" '$dest'"
    rsync -az --delete --info=stats1 --exclude '.well-known' out/ "$REMOTE_HOST:$dest/"
  else
    $SUDO mkdir -p "$dest"
    # atomic-ish: rsync if available, otherwise cp
    if command -v rsync >/dev/null 2>&1; then
      $SUDO rsync -a --delete --exclude '.well-known' out/ "$dest/"
    else
      $SUDO rm -rf "${dest:?}"/*
      $SUDO cp -a out/. "$dest/"
    fi
  fi
}

deploy_static "$WEB_ROOT"

# ————— 4. verify deployed files —————
say "Verifying deployed files…"
if ! run_shell <<VERIFY_EOF
set -e
WEB_ROOT="$WEB_ROOT"
test -f "\$WEB_ROOT/index.html"
test -f "\$WEB_ROOT/admin/index.html"
VERIFY_EOF
then
  die "verification failed — index files not found in $WEB_ROOT"
fi
ok "site deployed to $WEB_ROOT"

# ————— 5. nginx configuration —————
write_nginx_conf() {
  local conf_path="$1"
  local extra=""
  [[ -n "$SERVER_NAME_EXTRA" ]] && extra=" $SERVER_NAME_EXTRA"

  cat > "$conf_path" <<NGINX
# ——————————————————————————————————————————————————————————————
# wdpm — ${DOMAIN} (managed by frontend/deploy.sh — regenerate
# rather than editing by hand)
# ——————————————————————————————————————————————————————————————
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN}${extra};

    root ${WEB_ROOT};
    index index.html;

    # security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml application/xml font/woff2;

    # static assets — long cache (hashed filenames)
    location /_next/static/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    # images and fonts
    location ~* \.(webp|png|jpg|jpeg|svg|ico|woff2?)$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }

    # static pages
    location / {
        try_files \$uri \$uri/ \$uri/index.html =404;
    }

    # never cache the documents themselves
    location ~* /index\.html$ {
        add_header Cache-Control "no-cache";
    }

    # API — proxied to the local backend service
    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
    }
}
NGINX
}

NGINX_CHANGED=0
if [[ "$SKIP_NGINX" -eq 1 ]]; then
  say "Skipping nginx configuration (--skip-nginx)."
else
  say "Ensuring nginx configuration is up to date…"

  # Install nginx on the target if missing (Debian/Ubuntu via apt).
  NGINX_AVAILABLE=1
  if ! run_shell <<NGX_CHECK_EOF
set -e
if ! command -v nginx >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -qq && apt-get install -y -qq nginx
  else
    exit 42
  fi
fi
NGX_CHECK_EOF
  then
    warn "nginx is not available on the target and could not be installed — skipping nginx setup."
    NGINX_AVAILABLE=0
  fi

  if [[ "$NGINX_AVAILABLE" -eq 1 ]]; then
    # generate the config locally, ship it to the target, install only
    # when the content actually changed (idempotent)
    TMP_CONF="$(mktemp)"
    write_nginx_conf "$TMP_CONF"
    CONF_B64="$(base64 < "$TMP_CONF")"
    rm -f "$TMP_CONF"

    NGX_RESULT="$(run_shell <<NGX_INSTALL_EOF
set -euo pipefail
CONF_B64="$CONF_B64"
printf '%s' "\$CONF_B64" | base64 -d > /tmp/wdpm-nginx.conf.new

if [ -d /etc/nginx/sites-available ]; then
  TARGET="/etc/nginx/sites-available/wdpm.conf"
  LINK="/etc/nginx/sites-enabled/wdpm.conf"
else
  TARGET="/etc/nginx/conf.d/wdpm.conf"
  LINK=""
fi

CHANGED=0
if [ -f "\$TARGET" ] && cmp -s /tmp/wdpm-nginx.conf.new "\$TARGET"; then
  echo "UNCHANGED \$TARGET"
else
  SUDO=""
  [ "\$(id -u)" -ne 0 ] && SUDO="sudo"
  \$SUDO cp /tmp/wdpm-nginx.conf.new "\$TARGET"
  if [ -n "\$LINK" ]; then
    \$SUDO ln -sf "\$TARGET" "\$LINK"
  fi
  CHANGED=1
  echo "UPDATED \$TARGET"
fi
rm -f /tmp/wdpm-nginx.conf.new

if [ "\$CHANGED" -eq 1 ]; then
  SUDO=""
  [ "\$(id -u)" -ne 0 ] && SUDO="sudo"
  \$SUDO nginx -t
  \$SUDO systemctl enable nginx >/dev/null 2>&1 || true
  echo "RELOAD"
fi
NGX_INSTALL_EOF
)" || die "nginx configuration failed on the target."

    if grep -q '^UNCHANGED' <<<"$NGX_RESULT"; then
      ok "nginx config unchanged on target"
    else
      ok "nginx config updated on target"
      NGINX_CHANGED=1
    fi

    if grep -q '^RELOAD' <<<"$NGX_RESULT" && [[ "$RELOAD_NGINX" == "y" ]]; then
      say "Reloading nginx…"
      run_shell <<NGX_RELOAD_EOF || warn "nginx reload failed — check systemctl status nginx on the target."
SUDO=""
[ "\$(id -u)" -ne 0 ] && SUDO="sudo"
\$SUDO systemctl reload nginx || \$SUDO nginx -s reload
NGX_RELOAD_EOF
      ok "nginx reloaded"
    elif [[ "$NGINX_CHANGED" -eq 0 ]]; then
      ok "nginx unchanged — no reload needed"
    fi
  fi
fi

# ————— 6. SSL via certbot —————
if [[ "$SKIP_SSL" -eq 1 ]]; then
  say "Skipping SSL (--skip-ssl)."
elif [[ "$SKIP_NGINX" -eq 1 ]]; then
  say "SSL not possible — nginx setup was skipped."
elif [[ "$ENABLE_SSL" != "y" ]]; then
  say "SSL not requested — skipping certbot."
else
  CERT_PRESENT="$(run_shell <<CERT_CHECK_EOF
[ -d "/etc/letsencrypt/live/$DOMAIN" ] && echo yes || echo no
CERT_CHECK_EOF
)"
  if [[ "$CERT_PRESENT" == "yes" ]]; then
    ok "SSL certificate already present for ${DOMAIN} — skipping certbot."
  else
    say "Obtaining SSL certificate for ${DOMAIN}…"
    if ! run_shell <<CERTBOT_EOF
set -euo pipefail
DOMAIN="$DOMAIN"
EMAIL="$CERTBOT_EMAIL"

if ! command -v certbot >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq certbot python3-certbot-nginx
  else
    echo "certbot not installed and apt unavailable" >&2
    exit 42
  fi
fi

SUDO=""
[ "\$(id -u)" -ne 0 ] && SUDO="sudo"

CERTBOT_ARGS=(--nginx -d "\$DOMAIN" --redirect --non-interactive --agree-tos)
if [ -n "\$EMAIL" ]; then
  CERTBOT_ARGS+=(-m "\$EMAIL")
else
  CERTBOT_ARGS+=(--register-unsafely-without-email)
fi
\$SUDO certbot "\${CERTBOT_ARGS[@]}"
\$SUDO systemctl reload nginx
echo "[ssl] https://\$DOMAIN is active."
CERTBOT_EOF
    then
      warn "certbot failed — check DNS records point to this server. HTTP is still served."
    else
      ok "SSL active for ${DOMAIN}"
    fi
  fi
fi

say ""
say "═══════════════════════════════════════════════════════════════"
ok "Frontend deployment complete."
say "  Site    : http${ENABLE_SSL:+s}://${DOMAIN}"
say "  Admin   : http${ENABLE_SSL:+s}://${DOMAIN}/admin/"
say "  Files   : ${WEB_ROOT}  $([[ -n "$REMOTE_HOST" ]] && printf '(on %s)' "$REMOTE_HOST" || printf '(local)')"
say "  API     : http${ENABLE_SSL:+s}://${DOMAIN}/api/v1  → 127.0.0.1:${API_PORT}"
say "  Baked   : NEXT_PUBLIC_API_BASE_URL=${API_BASE_URL}"
say "═══════════════════════════════════════════════════════════════"
