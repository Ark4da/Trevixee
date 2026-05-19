# Trevixee

Trading journal and analytics platform.

## Overview

Collaborative web application for tracking trades, analyzing performance, and managing trading activity.

This repository represents my portfolio version and contribution to the project.

---

## Website
https://trevixe.com/

---

## My Contribution

- Backend API development
- Database integration
- Authentication logic
- Feature implementation
- Deployment support

---

## Features

- Trade tracking
- Performance analytics
- Authentication system
- Dashboard
- Cloud deployment
- Responsive UI

---

## Tech Stack

- TypeScript
- Next.js
- Prisma
- PostgreSQL
- Docker

---

## Screenshots

## Dashboard
<img width="2560" height="1271" alt="image" src="https://github.com/user-attachments/assets/8fa851e0-6c98-480c-8edd-f28732a4907c" />

## Trade Journal
<img width="2560" height="1271" alt="image" src="https://github.com/user-attachments/assets/35f9e4f8-9980-44ae-8a4a-3d0c5667cfd8" />

## Add New Trade
<img width="2560" height="1271" alt="image" src="https://github.com/user-attachments/assets/40142664-b1ba-453e-b276-a3ce8ed72d91" />

---

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
