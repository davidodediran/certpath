#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# CertPath in-place deployment script
# Called by GitHub Actions via AWS SSM Run Command on every merge to main.
# Run manually: sudo bash /opt/certpath/scripts/deploy.sh [branch]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BRANCH="${1:-main}"
APP_DIR="/opt/certpath"
LOG_FILE="/var/log/certpath-deploy.log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

log "=== Deploy started (branch: $BRANCH) ==="

# ── Pull latest code ────────────────────────────────────────────────────────
cd "$APP_DIR"
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"
log "Code updated to $(git rev-parse --short HEAD)"

# ── Rebuild React frontend ───────────────────────────────────────────────────
log "Building frontend..."
cd "$APP_DIR/frontend"
npm ci
npm run build
log "Frontend built."

# ── Update backend dependencies ──────────────────────────────────────────────
log "Installing backend dependencies..."
cd "$APP_DIR/backend"
npm ci
log "Backend dependencies ready."

# ── Reload app via PM2 (zero-downtime) ──────────────────────────────────────
log "Reloading PM2 process..."
pm2 reload certpath --update-env
pm2 save
log "App reloaded. Status:"
pm2 status certpath

log "=== Deploy complete ==="
