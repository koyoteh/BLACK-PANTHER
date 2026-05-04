FROM node:20-slim

# Install system deps (python3/make/g++ required for better-sqlite3 native build)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libvips-dev \
    curl \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (Docker cache layer)
# Use npm install (not ci) so native modules rebuild against this system
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# Copy source
COPY . .

# Remove dev-only files
RUN rm -f .replit replit.md

# Runtime directories
RUN mkdir -p sessions/auth public

ENV NODE_ENV=production \
    BOT_NAME="BLACK PANTHER MD" \
    OWNER_NAME="GuruTech" \
    OWNER_NUMBER="254105521300" \
    BOT_PREFIX="." \
    MODE="public" \
    TIME_ZONE="Africa/Nairobi" \
    AUTO_BIO="true" \
    AUTO_LIKE_STATUS="true" \
    AUTO_READ_STATUS="true" \
    AUTO_REACT="false" \
    PORT=5000 \
    DEBUG="false"

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -fs http://localhost:5000/health || exit 1

CMD ["node", "--max-old-space-size=512", "--expose-gc", "index.js"]
