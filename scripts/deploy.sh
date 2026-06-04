#!/usr/bin/env bash
#
# Audera one-command deploy.
#
# Builds every workspace artifact (in dependency order), version-stamps the
# landing assets, syncs the build output to the server, restarts the service,
# and smoke-checks the result. Codifies the steps that were easy to forget when
# deploying by hand:
#   - build the web bundle WITH the public API origin (else it runs in offline
#     demo mode and login/signup silently fail);
#   - restart the server after a web rebuild (the /app static plugin enumerates
#     content-hashed asset filenames at boot — new bundle 404s until restart);
#   - bump the landing ?v= cache-bust hashes.
#
# Configuration via environment (NO secrets are committed):
#   DEPLOY_HOST       server hostname/IP                (required)
#   DEPLOY_USER       ssh user                          (required)
#   DEPLOY_DIR        remote app dir   (default: /home/$DEPLOY_USER/audera)
#   API_BASE_URL      public origin    (default: https://$DEPLOY_HOST)
#   SERVICE           systemd unit                      (default: audera)
#   SSHPASS           ssh password — optional; if set, sshpass is used.
#                     Prefer key-based auth and leave this unset.
#
# Usage:
#   DEPLOY_HOST=1.2.3.4 DEPLOY_USER=ruut API_BASE_URL=https://audit.example.com \
#     scripts/deploy.sh
#
set -euo pipefail

HOST="${DEPLOY_HOST:?set DEPLOY_HOST}"
USER="${DEPLOY_USER:?set DEPLOY_USER}"
DIR="${DEPLOY_DIR:-/home/$USER/audera}"
API_BASE="${API_BASE_URL:-https://$HOST}"
SERVICE="${SERVICE:-audera}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# ssh / rsync transport: use sshpass only when a password is supplied.
SSH=(ssh -o StrictHostKeyChecking=accept-new)
if [ -n "${SSHPASS:-}" ]; then SSH=(sshpass -e "${SSH[@]}"); fi
RSH="${SSH[*]}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

hash8() {
  if command -v md5sum >/dev/null 2>&1; then md5sum "$1" | cut -c1-8
  else md5 -q "$1" | cut -c1-8; fi
}

# ---------------------------------------------------------------------------
log "Building workspace (core → reporter → … → server)"
pnpm -r build

log "Rebuilding web bundle with API base: $API_BASE"
VITE_A11YAUDIT_API_BASE_URL="$API_BASE" pnpm --filter @a11yaudit/web build

# ---------------------------------------------------------------------------
log "Version-stamping landing assets"
CSS_HASH="$(hash8 apps/landing/landing/landing.css)"
JS_HASH="$(hash8 apps/landing/landing/landing.js)"
# portable in-place sed (GNU vs BSD)
sed_i() { if sed --version >/dev/null 2>&1; then sed -i "$@"; else sed -i '' "$@"; fi; }
sed_i -E "s#landing/landing\.css(\?v=[a-f0-9]*)?#landing/landing.css?v=${CSS_HASH}#" apps/landing/index.html
sed_i -E "s#landing/landing\.js(\?v=[a-f0-9]*)?#landing/landing.js?v=${JS_HASH}#" apps/landing/index.html
log "  css?v=$CSS_HASH  js?v=$JS_HASH (commit apps/landing/index.html if changed)"

# ---------------------------------------------------------------------------
log "Syncing artifacts to $USER@$HOST:$DIR"
sync() { rsync -az --delete -e "$RSH" "$1" "$USER@$HOST:$DIR/$2"; }
sync_keep() { rsync -az -e "$RSH" "$1" "$USER@$HOST:$DIR/$2"; }

sync apps/web/dist/            apps/web/dist/
sync apps/server/dist/         apps/server/dist/
sync_keep apps/landing/        apps/landing/
for pkg in core crawler rules reporter storage audit assist-widget; do
  if [ -d "packages/$pkg/dist" ]; then
    sync "packages/$pkg/dist/" "packages/$pkg/dist/"
  fi
done

# ---------------------------------------------------------------------------
log "Restarting $SERVICE"
"${SSH[@]}" "$USER@$HOST" "sudo systemctl restart $SERVICE && sleep 3 && systemctl is-active $SERVICE"

# ---------------------------------------------------------------------------
log "Smoke-checking $API_BASE"
WEB_JS="$(curl -s "$API_BASE/app" | grep -o '/app/assets/index-[A-Za-z0-9_-]*\.js' | head -1)"
for path in "/" "/app" "$WEB_JS"; do
  [ -z "$path" ] && continue
  code="$(curl -s -o /dev/null -w '%{http_code}' "$API_BASE$path")"
  printf '    %-40s %s\n' "$path" "$code"
  [ "$code" = "200" ] || { echo "FAILED: $path returned $code"; exit 1; }
done

log "Deploy complete: $API_BASE"
