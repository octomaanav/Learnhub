# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install native build dependencies for node-gyp (e.g. for speaker, sqlite, etc)
# Using Debian slim packages instead of Alpine apk
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libasound2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies including devDependencies (needed for tsc)
COPY package*.json ./
RUN npm ci

# Copy source code and migrations
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-slim

WORKDIR /app

# Install runtime dependencies for native modules (e.g. speaker)
RUN apt-get update && apt-get install -y \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and node_modules from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Copy data directory (needed for seeding)
COPY --from=builder /app/data ./data

# Copy migrations folder (required for migration script)
COPY --from=builder /app/drizzle ./drizzle

# Start command
# This runs migrations then starts the server
CMD ["npm", "start"]
