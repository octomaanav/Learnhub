# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Install native build dependencies for node-gyp (e.g. for speaker, sqlite, etc)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    alsa-lib-dev

# Install dependencies including devDependencies (needed for tsc)
COPY package*.json ./
RUN npm ci

# Copy source code and migrations
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install runtime dependencies for native modules (e.g. speaker)
RUN apk add --no-cache alsa-lib

# Install only production dependencies
COPY package*.json ./
# Omit dev dependencies to keep image small
RUN npm ci --only=production

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Copy data directory (needed for seeding)
COPY --from=builder /app/data ./data

# Copy migrations folder (required for migration script)
COPY --from=builder /app/drizzle ./drizzle

# Start command
# This runs migrations then starts the server
CMD ["npm", "start"]
