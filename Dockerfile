# syntax=docker/dockerfile:1.6
# ──────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for Next.js 16 + Prisma + PostgreSQL on Railway
# Uses standalone output for minimal final image (~150MB).
# ──────────────────────────────────────────────────────────────────────────────

# 1. deps: install all dependencies (incl. dev) for build
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# Prisma validates datasource env vars during postinstall/generate. The real
# Railway DATABASE_URL is only needed at runtime for migrations and queries.
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
RUN npm ci

# 2. builder: build the Next.js app + generate Prisma client
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_OUTPUT_STANDALONE=true
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?schema=public"
# Skip ESLint during build (run it in CI instead)
ENV NEXT_DISABLE_ESLINT=1
RUN npx prisma generate
RUN npm run build

# 3. runner: minimal image for production
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Copy built standalone server + public assets + static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema + migrations + generated client (needed for runtime + migrate deploy)
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma

USER nextjs

EXPOSE 3000

# Run migrations on startup, then start the standalone server.
# If migrations fail, container exits and Railway will show the error.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]
