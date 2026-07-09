FROM node:22-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    git \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund \
    && npm cache clean --force

COPY . .

RUN mkdir -p sessions guru/database

RUN rm -f .replit replit.md 2>/dev/null || true

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

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fs http://localhost:${PORT}/health || exit 1

CMD ["node", "--no-warnings", "--expose-gc", "--max-old-space-size=512", "--max-semi-space-size=64", "index.js"]
