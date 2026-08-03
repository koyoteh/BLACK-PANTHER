#!/bin/bash
set -e

APP_DIR="/opt/tehseen-bot"
APP_USER="bot"

echo "=== Tehseen Tech Automation - VPS Setup ==="

# 1. Install Node.js 22
if ! command -v node &>/dev/null || [[ "$(node -v)" != v22* ]]; then
    echo "[1/7] Installing Node.js 22..."
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
else
    echo "[1/7] Node.js 22 already installed."
fi

# 2. Install system dependencies
echo "[2/7] Installing system dependencies..."
apt-get update -qq
apt-get install -y --no-install-recommends ffmpeg git nginx certbot python3-certbot-nginx

# 3. Create app user
if ! id "$APP_USER" &>/dev/null; then
    echo "[3/7] Creating user '$APP_USER'..."
    useradd -r -m -d "$APP_DIR" -s /bin/bash "$APP_USER"
else
    echo "[3/7] User '$APP_USER' already exists."
fi

# 4. Clone or update the repo
if [ -d "$APP_DIR/.git" ]; then
    echo "[4/7] Updating existing installation..."
    cd "$APP_DIR"
    sudo -u "$APP_USER" git pull origin main
else
    echo "[4/7] Cloning repository..."
    git clone https://github.com/tehseentech/black-panther.git "$APP_DIR"
    chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# 5. Install npm dependencies
echo "[5/7] Installing dependencies..."
cd "$APP_DIR"
sudo -u "$APP_USER" npm install --legacy-peer-deps --no-audit --no-fund

# 6. Create .env if missing
if [ ! -f "$APP_DIR/.env" ]; then
    echo "[6/7] Creating .env template..."
    cat > "$APP_DIR/.env" <<'ENVEOF'
# Required: Your WhatsApp session ID
SESSION_ID=

# Bot settings
BOT_NAME=Tehseen Tech Automation
OWNER_NAME=TehseenTech
OWNER_NUMBER=
BOT_PREFIX=.
MODE=public
PORT=5000

# Optional: PostgreSQL (leave empty for SQLite)
DATABASE_URL=

# Optional: Expiry date (YYYY-MM-DD, leave empty for no expiry)
EXPIRY_DATE=
ENVEOF
    chown "$APP_USER:$APP_USER" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    echo "    Edit /opt/tehseen-bot/.env with your settings before starting."
else
    echo "[6/7] .env already exists, skipping."
fi

# 7. Install systemd service
echo "[7/7] Installing systemd service..."
cp "$APP_DIR/deploy/tehseen-bot.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable tehseen-bot

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. Edit your config:       nano /opt/tehseen-bot/.env"
echo "  2. Set up your domain:     Replace YOUR_DOMAIN.com in deploy/nginx.conf"
echo "     then copy it:           cp $APP_DIR/deploy/nginx.conf /etc/nginx/sites-available/tehseen-bot"
echo "     enable it:              ln -s /etc/nginx/sites-available/tehseen-bot /etc/nginx/sites-enabled/"
echo "     test & reload:          nginx -t && systemctl reload nginx"
echo "  3. Get SSL certificate:    certbot --nginx -d YOUR_DOMAIN.com"
echo "  4. Start the bot:          systemctl start tehseen-bot"
echo "  5. Check status:           systemctl status tehseen-bot"
echo "  6. View logs:              journalctl -u tehseen-bot -f"
echo ""
