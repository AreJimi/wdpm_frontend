#!/usr/bin/env bash
#
# deploy-frontend.sh — build the wdpm web frontend as a static export and
# deploy it to the server's web root (Nginx/Apache or any static dir),
# optionally rsyncing to a remote host first.
#
# Usage:
#   ./scripts/deploy-frontend.sh                       # build + copy to local web root
#   ./scripts/deploy-frontend.sh --skip-deps           # skip npm ci
#   ./scripts/deploy-frontend.sh --remote user@host    # build locally, rsync out/ to remote
#
# Environment variables (optional):
#   APP_DIR        repo location                                   (default: /opt/wdpm)
#   WEB_ROOT       static web root on the target                   (default: /var/www/wdpm)
#   API_BASE_URL   baked-in NEXT_PUBLIC_API_BASE_URL               (default: https://wdpm.ir/api/v1)
#   REMOTE_HOST    ssh target ("user@host") — same as --remote     (default: none → local deploy)
#
# The result is a fully static site (Next.js output: 'export') — no Node.js
# needed on the web server.

set -euo pipefail

# ── Configuration ───────────────────────────────────────────────────────────
APP_DIR="${APP_DIR:-/opt/wdpm}"
WEB_ROOT="${WEB_ROOT:-/var/www/wdpm}"
API_BASE_URL="${API_BASE_URL:-https://wdpm.ir/api/v1}"
REMOTE_HOST="${REMOTE_HOST:-}"
SKIP_DEPS=0

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-deps) SKIP_DEPS=1 ;;
    --remote)    REMOTE_HOST="${2:?--remote requires a value like user@host}"; shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

log()  { printf '\033[1;34m[deploy-frontend]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[deploy-frontend]\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || fail "node is not installed (need >= 20)"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed"
command -v rsync >/dev/null 2>&1 || fail "rsync is required (--remote mode)"

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

[ -f out/index.html ]      || fail "build failed: out/index.html missing"
[ -f out/admin/index.html ] || fail "build failed: out/admin/index.html missing"

# ── 3. Deploy ───────────────────────────────────────────────────────────────
if [ -n "$REMOTE_HOST" ]; then
  log "Deploying to remote host $REMOTE_HOST:$WEB_ROOT…"
  ssh "$REMOTE_HOST" "mkdir -p '$WEB_ROOT'"
  rsync -az --delete --info=stats1 \
    --exclude '.well-known' \
    out/ "$REMOTE_HOST:$WEB_ROOT/"
else
  log "Deploying to local web root $WEB_ROOT…"
  if [ "$(id -u)" -eq 0 ] || [ ! -d "$WEB_ROOT" ]; then
    mkdir -p "$WEB_ROOT"
  else
    sudo mkdir -p "$WEB_ROOT"
  fi
  if [ "$(id -u)" -eq 0 ]; then
    rsync -a --delete --exclude '.well-known' out/ "$WEB_ROOT/"
  else
    sudo rsync -a --delete --exclude '.well-known' out/ "$WEB_ROOT/"
  fi
fi

# ── 4. Verify ───────────────────────────────────────────────────────────────
log "Verifying deployed files…"
if [ -n "$REMOTE_HOST" ]; then
  ssh "$REMOTE_HOST" "test -f '$WEB_ROOT/index.html' && test -f '$WEB_ROOT/admin/index.html'" \
    || fail "verification failed on remote host"
else
  test -f "$WEB_ROOT/index.html" && test -f "$WEB_ROOT/admin/index.html" \
    || fail "verification failed locally"
fi

log "Deploy complete — static site is live in $WEB_ROOT."
log "Reminder: point your web server (e.g. Nginx root $WEB_ROOT;) at this"
log "directory and proxy /api/ to the backend (see docs in README)."
