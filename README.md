# 🎷 Jazz Portfolio

A jazz-themed, multilingual portfolio website with an admin CMS, background music player, and CI/CD pipeline on AWS.

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, Framer Motion
- **Backend:** NestJS 11, Prisma, PostgreSQL 16
- **Infrastructure:** AWS (Amplify, EC2, RDS, S3, CloudFront)
- **Monorepo:** Turborepo + pnpm

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Docker & Docker Compose (for local PostgreSQL)

### Setup

```bash
# Install dependencies
pnpm install

# Start local database
docker-compose -f infra/docker/docker-compose.dev.yml up -d

# Run database migrations
pnpm --filter @jazz-portfolio/database db:migrate

# Seed the database
pnpm --filter @jazz-portfolio/database db:seed

# Start development
pnpm dev
```

### Project Structure

See [docs/PROJECT_BIBLE.md](./docs/PROJECT_BIBLE.md) for the complete architecture reference.

- [Refactor & performance guide](./docs/refactor_and_performance.md) — rationale and best practices from the Phase 1–6 hardening pass
- [Performance notes](./docs/perf-notes.md) — cache tags, revalidation, build metrics, Lighthouse

## Workspaces

| Workspace | Description | Port |
|---|---|---|
| `apps/web` | Next.js frontend | 3000 |
| `apps/api` | NestJS backend | 3001 |
| `packages/database` | Prisma schema & client | - |
| `packages/shared` | Shared types & constants | - |
| `packages/config` | Shared configs (TS, ESLint) | - |
