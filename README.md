# Trevixe

Next.js 16 app with Prisma/PostgreSQL, prepared for Docker deployment on Railway.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Production Build

```bash
npm run build
```

The build runs `prisma generate` before `next build`.

## Railway

This repo includes:

- `railway.json` configured to build with the root `Dockerfile`
- Docker standalone output for a smaller production image
- `/api/health` for Railway health checks
- `.dockerignore` to exclude local caches, secrets, logs, and worktrees

Set the required environment variables in Railway from `.env.example`.
At minimum, production needs `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
