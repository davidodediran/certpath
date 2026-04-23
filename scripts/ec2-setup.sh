#!/bin/bash
# =============================================================================
# CertPath — EC2 UserData bootstrap (Docker)
#
# HOW TO USE:
#   1. Fill in the CREDENTIALS section below (8 values).
#   2. Copy the entire script.
#   3. In AWS Console → EC2 → Launch Instance → Advanced → User data, paste it.
#   4. Launch. Everything else is automatic.
#
# Tested on: Amazon Linux 2023, t3.micro / t3.small
# Log file:  /var/log/certpath-setup.log
#            Also visible in: EC2 Console → Actions → Monitor and troubleshoot
#                             → Get System Log
# =============================================================================

exec > >(tee /var/log/certpath-setup.log /dev/console) 2>&1
echo "============================================================"
echo " CertPath bootstrap started: $(date)"
echo "============================================================"

# ============================================================
# FILL IN THESE VALUES BEFORE PASTING INTO EC2 USER DATA
# ============================================================

# --- Supabase (or any PostgreSQL) database ---
# DB_HOST: paste ONLY the hostname, e.g.  db.abcdefgh.supabase.co
# Do NOT include  https://  or  postgresql://
DB_HOST=""
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"
DB_PASSWORD=""

# --- App security ---
# Generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_SECRET=""

# --- Admin account (manages questions, teachers, cohorts) ---
ADMIN_EMAIL=""
ADMIN_PASSWORD=""

# --- Superuser account (top-level: manages admins, has MFA) ---
SUPER_EMAIL=""
SUPER_PASSWORD=""

# ============================================================
# DO NOT EDIT ANYTHING BELOW THIS LINE
# ============================================================

GITHUB_REPO="davidodediran/certpath"
GITHUB_BRANCH="dev"
APP_DIR="/opt/certpath"
APP_PORT="3001"
NODE_ENV="production"

# ── Validate all required credentials ────────────────────────────────────────
MISSING=0
for VAR in DB_HOST DB_PASSWORD JWT_SECRET ADMIN_EMAIL ADMIN_PASSWORD SUPER_EMAIL SUPER_PASSWORD; do
  if [ -z "${!VAR}" ]; then
    echo "ERROR: $VAR is not set. Fill in all values in the CREDENTIALS section."
    MISSING=1
  fi
done
[ $MISSING -eq 1 ] && exit 1

# Strip any accidental https:// or http:// prefix from DB_HOST
DB_HOST="${DB_HOST#https://}"
DB_HOST="${DB_HOST#http://}"

echo "All credentials provided. Starting deployment..."
echo "  Branch : $GITHUB_BRANCH"
echo "  DB host: $DB_HOST"
echo "  Admin  : $ADMIN_EMAIL"
echo "  Super  : $SUPER_EMAIL"

# ── Swap file — prevents OOM during Docker build on 1 GB RAM instances ───────
if [ ! -f /swapfile ]; then
  echo "--- Creating 1 GB swap file ---"
  fallocate -l 1G /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=128M count=8
  chmod 600 /swapfile
  mkswap  /swapfile
  swapon  /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
  echo "Swap active: $(free -h | grep Swap)"
fi

# ── System update ─────────────────────────────────────────────────────────────
echo "--- System update ---"
dnf update -y

# ── Install git only — AL2023 ships curl-minimal which is sufficient ──────────
# Do NOT install the full 'curl' package — it conflicts with curl-minimal on AL2023.
echo "--- Installing git ---"
dnf install -y git
echo "Git: $(git --version)"

# ── Clone repository ──────────────────────────────────────────────────────────
echo "--- Cloning $GITHUB_REPO (branch: $GITHUB_BRANCH) ---"
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already exists — pulling latest..."
  cd "$APP_DIR"
  git fetch origin
  git checkout "$GITHUB_BRANCH"
  git reset --hard "origin/$GITHUB_BRANCH"
else
  git clone -b "$GITHUB_BRANCH" "https://github.com/$GITHUB_REPO.git" "$APP_DIR"
fi
echo "Repo ready at $APP_DIR"

# ── Write backend/.env ────────────────────────────────────────────────────────
echo "--- Writing backend/.env ---"
mkdir -p "$APP_DIR/backend"
cat > "$APP_DIR/backend/.env" << ENVEOF
NODE_ENV=$NODE_ENV
PORT=$APP_PORT
DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require
JWT_SECRET=$JWT_SECRET
ADMIN_EMAIL=$ADMIN_EMAIL
ADMIN_PASSWORD=$ADMIN_PASSWORD
SUPER_EMAIL=$SUPER_EMAIL
SUPER_PASSWORD=$SUPER_PASSWORD
ENVEOF
chmod 600 "$APP_DIR/backend/.env"
echo ".env written (permissions: 600)"

# ── Install Docker from AL2023 repo ──────────────────────────────────────────
# AL2023 ships docker 25.x — no external repo needed.
echo "--- Installing Docker ---"
dnf install -y docker
systemctl enable --now docker
echo "Docker: $(docker --version)"

# ── Install Buildx plugin (AL2023's bundled buildx is too old for Compose v5) ─
BUILDX_VERSION="0.19.3"
echo "--- Installing Docker Buildx v${BUILDX_VERSION} ---"
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL \
  "https://github.com/docker/buildx/releases/download/v${BUILDX_VERSION}/buildx-v${BUILDX_VERSION}.linux-amd64" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
echo "Buildx: $(docker buildx version)"

# ── Install Docker Compose plugin ─────────────────────────────────────────────
COMPOSE_VERSION="2.27.0"
echo "--- Installing Docker Compose v${COMPOSE_VERSION} ---"
curl -fsSL \
  "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
echo "Compose: $(docker compose version)"

# ── Build and start the app container ─────────────────────────────────────────
echo "--- Building Docker image (this takes 3-6 minutes on first run) ---"
cd "$APP_DIR"
docker compose -f docker-compose.ec2.yml down --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.ec2.yml up -d --build

if [ $? -ne 0 ]; then
  echo "ERROR: docker compose up failed."
  docker compose -f "$APP_DIR/docker-compose.ec2.yml" logs --tail=50
  exit 1
fi

# ── Wait for app to respond before running migrations ─────────────────────────
echo "--- Waiting for app to become ready ---"
MAX_WAIT=120
ELAPSED=0
until curl -sf http://localhost/ > /dev/null 2>&1; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "WARNING: App did not respond within ${MAX_WAIT}s. Running migrations anyway..."
    break
  fi
  echo "  Still starting... (${ELAPSED}s elapsed)"
  sleep 5
  ELAPSED=$((ELAPSED + 5))
done
[ $ELAPSED -lt $MAX_WAIT ] && echo "App is responding."

# ── Run database migrations ────────────────────────────────────────────────────
echo "--- Running database migrations ---"
docker compose -f "$APP_DIR/docker-compose.ec2.yml" exec -T app node src/db/migrate.js \
  && echo "Migrations completed successfully." \
  || echo "WARNING: Migrations reported an error — check: docker compose -f $APP_DIR/docker-compose.ec2.yml logs app"

# ── Summary ────────────────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " CertPath deployment COMPLETE: $(date)"
echo " App is running on port 80"
echo ""
echo " To access the app:"
echo "   http://$(curl -sf http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo '<your-ec2-public-ip>')"
echo ""
echo " SSH access (no key needed):"
echo "   AWS Console → EC2 → your instance → Connect → EC2 Instance Connect"
echo ""
echo " Useful commands after SSH:"
echo "   View live logs : docker compose -f $APP_DIR/docker-compose.ec2.yml logs -f app"
echo "   Container status: docker compose -f $APP_DIR/docker-compose.ec2.yml ps"
echo "   Restart app    : docker compose -f $APP_DIR/docker-compose.ec2.yml restart app"
echo "   Re-run migrations: docker compose -f $APP_DIR/docker-compose.ec2.yml exec app node src/db/migrate.js"
echo ""
echo " Full setup log: /var/log/certpath-setup.log"
echo "============================================================"
