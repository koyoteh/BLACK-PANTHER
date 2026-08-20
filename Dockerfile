FROM node:22-slim

# Install system deps
# python3/make/g++ — compile better-sqlite3 native module from source
# git              — auto-update feature (pulls from GitHub on restart)
# ffmpeg           — media processing (stickers, audio, video)
# curl             — healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer-cached until package.json changes)
COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force

# Copy source
COPY . .

# Create runtime directories the bot expects
RUN mkdir -p sessions guru/database

# Remove Replit-only files that have no meaning inside the container
RUN rm -f .replit replit.md 2>/dev/null || true

# Environment defaults (all can be overridden via Heroku Config Vars)
ENV NODE_ENV=production \
    BOT_NAME="BLACK PANTHER MD" \
    OWNER_NAME="Koyoteh" \
    OWNER_NUMBER="254105521300" \
    BOT_PREFIX="." \
    MODE="public" \
    TIME_ZONE="Africa/Nairobi" \
    AUTO_BIO="true" \
    AUTO_LIKE_STATUS="true" \
    AUTO_READ_STATUS="true" \
    AUTO_REACT="false" \
    AUTO_UPDATE="true" \
    PORT=5000

EXPOSE 5000

# Give the bot 60s to start (session decode + WA handshake takes time)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fs http://localhost:${PORT}/health || exit 1

CMD ["node", "--no-warnings", "--expose-gc", "--max-old-space-size=512", "--max-semi-space-size=64", "index.js"]
