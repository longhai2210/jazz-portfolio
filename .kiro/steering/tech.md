# Technology Stack

## Build System

**Monorepo Manager**: Turborepo 2.5+ with pnpm workspaces  
**Package Manager**: pnpm 9.15+ (required)  
**Node Version**: 20.0.0 or higher

## Frontend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React framework with App Router, SSR/SSG |
| React | 19.x | UI library with concurrent rendering |
| TypeScript | 5.7.x | Type safety |
| Tailwind CSS | 4.x | Utility-first styling with @theme tokens |
| Framer Motion | 12.x | Animations and scroll effects |
| next-intl | 4.x | Internationalization (EN, VI, JA) |
| Zustand | 5.x | Client state management (music player) |

## Backend Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 11.x | Backend framework with DI and decorators |
| Prisma | 6.x | ORM with type-safe database client |
| PostgreSQL | 16.x | Primary database with JSONB support |
| Passport + JWT | latest | Authentication strategy |
| class-validator | 0.14.x | DTO validation |
| @aws-sdk/client-s3 | 3.x | Media storage integration |

## Infrastructure

- **Hosting**: AWS Amplify (frontend), AWS EC2 (backend)
- **Database**: AWS RDS PostgreSQL 16
- **Storage**: AWS S3 with CloudFront CDN
- **CI/CD**: GitHub Actions

## Common Commands

### Development

```bash
# Install dependencies (from root)
pnpm install

# Start all apps in development mode
pnpm dev

# Start specific workspace
pnpm --filter @jazz-portfolio/web dev
pnpm --filter @jazz-portfolio/api dev

# Start local database (requires Docker)
docker-compose -f infra/docker/docker-compose.dev.yml up -d
```

### Building

```bash
# Build all workspaces
pnpm build

# Build specific workspace
pnpm --filter @jazz-portfolio/web build
pnpm --filter @jazz-portfolio/api build
```

### Code Quality

```bash
# Lint all workspaces
pnpm lint

# Type check all workspaces
pnpm type-check

# Format code
pnpm format

# Run tests
pnpm test
```

### Database

```bash
# Run migrations
pnpm --filter @jazz-portfolio/database db:migrate

# Generate Prisma client
pnpm --filter @jazz-portfolio/database db:generate

# Seed database
pnpm --filter @jazz-portfolio/database db:seed

# Open Prisma Studio
pnpm --filter @jazz-portfolio/database db:studio
```

### Clean

```bash
# Clean all build artifacts
pnpm clean
```

## Port Assignments

- Frontend (Next.js): `3000`
- Backend (NestJS): `3001`
- PostgreSQL (local): `5432`
- Prisma Studio: `5555`

## Key Libraries

### Frontend-Specific
- `react-icons`: Icon components
- `@tailwindcss/postcss`: Tailwind 4 PostCSS integration

### Backend-Specific
- `bcrypt`: Password hashing
- `helmet`: Security headers
- `@nestjs/swagger`: API documentation
- `@nestjs/throttler`: Rate limiting
- `@aws-sdk/s3-request-presigner`: Presigned upload URLs

## Development Tools

- **Prettier**: Code formatting (single quotes, trailing commas, 100 char width)
- **ESLint**: Linting with TypeScript plugin
- **Turbo**: Task caching and parallel execution
