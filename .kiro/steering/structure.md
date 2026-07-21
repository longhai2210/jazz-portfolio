# Project Structure

## Monorepo Organization

This is a Turborepo monorepo managed by pnpm workspaces with the following structure:

```
jazz-portfolio/
├── apps/                    # Application workspaces
│   ├── web/                # Next.js 15 frontend (port 3000)
│   └── api/                # NestJS 11 backend (port 3001)
├── packages/               # Shared packages
│   ├── database/          # Prisma schema, client, migrations, seed
│   ├── shared/            # Shared TypeScript types, constants, enums
│   └── config/            # Shared tsconfig, eslint, tailwind configs
├── infra/                 # Infrastructure as code
│   └── docker/            # Dockerfiles and docker-compose
├── docs/                  # Documentation
│   └── PROJECT_BIBLE.md   # Single source of truth for architecture
├── .github/
│   └── workflows/         # CI/CD pipelines (ci.yml, deploy-api.yml)
├── .kiro/                 # Kiro configuration and steering
├── turbo.json             # Turborepo task configuration
├── pnpm-workspace.yaml    # pnpm workspace definition
└── package.json           # Root package with workspace scripts
```

## Workspace Dependencies

```
apps/web → @jazz-portfolio/shared, @jazz-portfolio/tsconfig
apps/api → @jazz-portfolio/shared, @jazz-portfolio/database, @jazz-portfolio/tsconfig
packages/database → @jazz-portfolio/tsconfig
packages/shared → @jazz-portfolio/tsconfig
```

## Frontend Structure (apps/web)

```
apps/web/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx           # Root layout with <audio> element
│   │   └── [locale]/            # Locale-based routing (en, vi, ja)
│   │       ├── (portfolio)/     # Public portfolio pages
│   │       │   ├── layout.tsx   # Portfolio layout
│   │       │   └── page.tsx     # Home page
│   │       └── admin/           # Admin panel (JWT protected)
│   │           ├── layout.tsx   # Admin layout
│   │           ├── login/       # Login page (public)
│   │           ├── categories/  # Category management
│   │           ├── music/       # Music track management
│   │           ├── profile/     # Profile editor
│   │           └── settings/    # Password change
│   ├── components/              # React components
│   │   ├── animation/          # Framer Motion animations
│   │   ├── layout/             # Layout components (Header, Footer, Nav)
│   │   ├── music/              # Music player components
│   │   ├── portfolio/          # Portfolio section components
│   │   └── ui/                 # Reusable UI components
│   ├── stores/                 # Zustand stores
│   │   └── music-store.ts      # Music player state
│   ├── lib/                    # Utilities and helpers
│   ├── i18n/                   # Internationalization
│   │   └── messages/           # Translation files (en.json, vi.json, ja.json)
│   └── styles/                 # Global styles
├── public/                     # Static assets
│   └── images/                # Images
├── next.config.ts             # Next.js configuration
├── tailwind.config.ts         # Tailwind CSS configuration
└── package.json
```

## Backend Structure (apps/api)

```
apps/api/
├── src/
│   ├── main.ts                 # Application entry point
│   ├── app.module.ts           # Root module
│   ├── auth/                   # Authentication module
│   │   ├── auth.controller.ts # /api/auth endpoints
│   │   ├── auth.service.ts    # Auth business logic
│   │   ├── strategies/        # Passport strategies (JWT, Local)
│   │   ├── guards/            # Auth guards
│   │   └── dto/               # Auth DTOs
│   ├── profile/               # Profile module
│   ├── categories/            # Categories module
│   ├── music/                 # Music tracks module
│   ├── media/                 # Media/S3 module
│   ├── prisma/                # Prisma service module
│   ├── common/                # Shared utilities
│   │   ├── filters/          # Exception filters
│   │   └── interceptors/     # Response interceptors
│   ├── config/                # Configuration
│   │   └── env.validation.ts # Environment variable validation
│   └── health.controller.ts   # Health check endpoint
├── nest-cli.json              # NestJS CLI configuration
├── tsconfig.json              # TypeScript configuration
└── package.json
```

## Database Package (packages/database)

```
packages/database/
├── prisma/
│   ├── schema.prisma          # Prisma schema definition
│   ├── migrations/            # Database migrations
│   └── seed.ts                # Database seeding script
├── src/
│   └── index.ts               # Prisma client export
└── package.json               # Database scripts (migrate, generate, seed)
```

## Shared Package (packages/shared)

```
packages/shared/
├── src/
│   ├── types/                 # Shared TypeScript types
│   ├── constants/             # Shared constants
│   ├── enums/                 # Shared enums
│   └── index.ts               # Package exports
└── package.json
```

## Key Conventions

### File Naming
- **Files**: kebab-case (e.g., `music-player.tsx`, `auth.service.ts`)
- **Components**: PascalCase for component names (e.g., `MusicPlayer`, `CategoryList`)
- **Functions/Variables**: camelCase
- **Database Tables**: snake_case (e.g., `admin_users`, `category_items`)
- **Environment Variables**: SCREAMING_SNAKE_CASE

### Module Organization (NestJS)
Each feature module follows this pattern:
```
feature/
├── feature.controller.ts      # HTTP endpoints
├── feature.service.ts         # Business logic
├── feature.module.ts          # Module definition
└── dto/                       # Data Transfer Objects
    ├── create-feature.dto.ts
    └── update-feature.dto.ts
```

### Component Organization (Next.js)
- **Route Groups**: Use parentheses for logical grouping without URL segments: `(portfolio)`, `(dashboard)`
- **Dynamic Routes**: Use brackets for parameters: `[locale]`, `[id]`
- **Layouts**: Each route segment can have its own `layout.tsx`
- **Loading/Error States**: Colocate `loading.tsx` and `error.tsx` with routes

### Import Paths
- Use workspace protocol for internal packages: `@jazz-portfolio/shared`, `@jazz-portfolio/database`
- Relative imports within the same workspace
- No barrel exports (`index.ts`) except at package boundaries

### Database Schema
- **Multilingual Content**: Store as JSONB with keys `{ en, vi, ja }`
- **Soft Deletes**: Use `is_deleted` boolean flag, never hard delete user content
- **Timestamps**: All tables have `created_at` and `updated_at` (auto-managed)
- **UUIDs**: Use UUID for primary keys, not auto-incrementing integers

### API Structure
- **Prefix**: All routes start with `/api`
- **Public Routes**: No auth required (profile, categories, tracks)
- **Admin Routes**: Prefix with `/api/admin/*`, require JWT
- **Response Format**: 
  - Success: `{ data: T }`
  - Error: `{ statusCode, message, error }`

### Styling
- **Tailwind Utility Classes**: Primary styling approach
- **Design Tokens**: Use Tailwind @theme for jazz color palette
- **Responsive**: Mobile-first breakpoints (sm, md, lg, xl, 2xl)
- **Animations**: Framer Motion for complex animations, CSS transitions for simple hovers
