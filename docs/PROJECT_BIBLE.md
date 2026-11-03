# 🎷 Jazz Portfolio — Project Bible

> **This is the single source of truth for the Jazz Portfolio project.**
> Every architectural decision, convention, and reference is documented here.
> Updated with each implementation phase.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Monorepo Structure](#monorepo-structure)
5. [Design System](#design-system)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Authentication](#authentication)
9. [Internationalization (i18n)](#internationalization-i18n)
10. [Music Player](#music-player)
11. [Admin Panel](#admin-panel)
12. [AWS Infrastructure](#aws-infrastructure)
13. [CI/CD Pipeline](#cicd-pipeline)
14. [Environment Variables](#environment-variables)
15. [Conventions & Standards](#conventions--standards)
16. [Deployment Runbook](#deployment-runbook)
17. [Decision Log](#decision-log)
18. [Related Docs](#related-docs)

---

## Project Overview

**Jazz Portfolio** is a multilingual (English, Vietnamese, Japanese) portfolio website with a jazz music aesthetic. It features a persistent background music player, smooth animations, and an admin panel for content management.

### Key Features (v1)

| Feature | Status | Description |
|---|---|---|
| Jazz Theme | ✅ Completed | Dark smoky palette, brass/gold accents, jazz loading animation |
| Multilingual | ✅ Completed | EN, VI, JA with flag-based switching |
| Music Player | ✅ Completed | Auto-play (muted), persistent across navigation, playlist support |
| Portfolio Sections | ✅ Completed | Hero, About, Experience, Skills, Contact |
| Blog / Journal | ✅ Completed | Feature-flagged, multilingual posts with Markdown rendering and RSS feed |
| Comments System | ✅ Completed | Moderated comment threads with 14-layer anti-spam shield and blocklist engine |
| Admin Panel | ✅ Completed | Profile, categories, music, blog posts, comment moderation, settings management |
| Dynamic Categories | ✅ Completed | Add/delete (soft) categories and items via admin |
| Contact Form | ✅ Completed | Public message submission with honeypots, dynamic length limits, and email notifications |
| Admin Inbox | ✅ Completed | Splitscreen inbox panel to read and manage client contact form submissions |
| System Settings | ✅ Completed | Admin configurations managing contact form toggles, content feature flags, and email provider settings |
| Theme Switcher | ✅ Completed | Smooth theme switching animations supporting Dark theme and Light-Jazz theme |
| Responsive | ✅ Completed | Mobile-first, all breakpoints |
| Scroll Animations | ✅ Completed | Framer Motion scroll reveals, parallax, staggered entries |
| CI/CD | ✅ Completed | GitHub Actions -> AWS (Amplify + EC2) |


### Out of Scope (v1)

- Multi-admin / roles
- Custom domain (using default AWS URLs)


---

## Architecture

### High-Level Diagram

```
+-------------------------------------------------------------+
|                    MONOREPO (Turborepo + pnpm)              |
|                                                             |
|  +--------------+  +--------------+  +------------------+  |
|  |  apps/web     |  |  apps/api    |  |  packages/*      |  |
|  |  Next.js 15   |  |  NestJS 11   |  |  database        |  |
|  |  App Router   |  |  REST API    |  |  shared          |  |
|  |  Tailwind 4   |  |  Prisma ORM  |  |  config          |  |
|  |  Framer Motion|  |  JWT Auth    |  |                  |  |
|  |  next-intl    |  |  S3 SDK      |  |                  |  |
|  |  Zustand      |  |  Swagger     |  |                  |  |
|  +-------+------+  +-------+------+  +------------------+  |
|          |                  |                                |
+----------+------------------+--------------------------------+
           |                  |
     +-----v-----+     +------v------+
     |  AWS       |     |  AWS        |
     |  Amplify   |     |  EC2 + RDS  |
     |  (CDN)     |     |  (Docker)   |
     +-----------+     +------+------+
                              |
                    +---------v----------+
                    |  AWS S3 + CloudFront|
                    |  (Media Storage)    |
                    +--------------------+
```

### Data Flow

1. **Public Portfolio:** Next.js (RSC + SSG/ISR) -> optional private API origin -> NestJS API -> PostgreSQL -> tagged cached response rendered with i18n
2. **Admin Panel:** Next.js (CSR) -> JWT Auth -> NestJS API -> PostgreSQL / S3
3. **Music Playback:** Next.js -> Zustand store -> `<audio>` element -> CloudFront CDN -> S3
4. **Media Upload:** Admin form -> Presigned URL from API -> Direct upload to S3 -> Metadata saved to DB

---

## Technology Stack

| Layer | Technology | Version | Rationale |
|---|---|---|---|
| Monorepo | Turborepo | ^2.5 | Task caching, parallel execution, workspace dependency graph |
| Package Manager | pnpm | 9.x | Workspace protocol, disk-efficient, strict dependency resolution |
| Frontend | Next.js (App Router) | 15.x | SSR/SSG, React Server Components, file-based routing |
| React | React | 19.x | Concurrent rendering, Suspense, improved hydration |
| Styling | Tailwind CSS | 4.x | Utility-first, @theme design tokens, tree-shaking |
| Animations | Framer Motion | 12.x | Declarative API, layout animations, useInView, useScroll |
| i18n | next-intl | 4.x | App Router native, no page reloads, ICU message format |
| Client State | Zustand | 5.x | Minimal boilerplate, persist middleware for audio state |
| Backend | NestJS | 11.x | DI, decorators, modular architecture, OpenAPI integration |
| ORM | Prisma | 6.x | Type-safe queries, migrations, PostgreSQL JSONB support |
| Database | PostgreSQL | 16.x | JSONB columns, full-text search, robust relational model |
| Auth | Passport + JWT | latest | NestJS integration, stateless authentication |
| Validation | class-validator | 0.14.x | Decorator-based DTO validation |
| Storage SDK | @aws-sdk/client-s3 | 3.x | Presigned URLs, multipart upload, IAM integration |

---

## Monorepo Structure

```
jazz-portfolio/
├── apps/
│   ├── web/          -> Next.js 15 frontend (port 3000)
│   └── api/          -> NestJS 11 backend (port 3001)
├── packages/
│   ├── database/     -> Prisma schema, client, migrations, seed
│   ├── shared/       -> TypeScript types, constants, enums
│   └── config/       -> Shared tsconfig, eslint, tailwind
├── infra/
│   └── docker/       -> Dockerfiles, docker-compose
├── docs/
│   └── PROJECT_BIBLE.md  -> This file
├── .github/
│   └── workflows/    -> CI/CD pipelines
├── turbo.json        -> Turborepo task config
├── pnpm-workspace.yaml
└── package.json
```

### Workspace Dependencies

```
apps/web
  -> @jazz-portfolio/shared
  -> @jazz-portfolio/tsconfig

apps/api
  -> @jazz-portfolio/shared
  -> @jazz-portfolio/database
  -> @jazz-portfolio/tsconfig

packages/database
  -> @jazz-portfolio/tsconfig

packages/shared
  -> @jazz-portfolio/tsconfig
```

---

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `jazz-black` | `#0a0a0f` | Page background |
| `jazz-dark` | `#111118` | Card backgrounds, nav |
| `jazz-charcoal` | `#1a1a2e` | Section backgrounds |
| `jazz-slate` | `#2a2a3e` | Borders, dividers |
| `jazz-muted` | `#4a4a5e` | Disabled states |
| `jazz-gold` | `#d4a574` | Primary accent, headings |
| `jazz-brass` | `#c9a96e` | Secondary accent |
| `jazz-amber` | `#e8b868` | Hover states, highlights |
| `jazz-copper` | `#b87333` | Tertiary accent |
| `jazz-blue` | `#16213e` | Cool section backgrounds |
| `jazz-text` | `#e8e8f0` | Primary text |
| `jazz-text-muted` | `#9898b0` | Secondary text |
| `jazz-text-dim` | `#6a6a80` | Tertiary text, captions |

### Typography

| Usage | Font | Fallback |
|---|---|---|
| Headings (EN/VI) | Playfair Display | serif |
| Headings (JA) | Noto Serif JP | serif |
| Body (EN/VI) | Inter | sans-serif |
| Body (JA) | Noto Sans JP | sans-serif |
| Code/Mono | JetBrains Mono | monospace |

### Animation Strategy

| Animation | Library | Trigger |
|---|---|---|
| Jazz Loading Screen | Framer Motion + CSS | First visit (sessionStorage) |
| Page Transitions | Framer Motion AnimatePresence | Route change |
| Scroll Reveals | Framer Motion useInView | Element enters viewport |
| Parallax Backgrounds | Framer Motion useScroll | Scroll position |
| Hover Glow | CSS transitions | Mouse hover |
| Staggered Lists | Framer Motion staggerChildren | Parent enters viewport |
| Music Visualizer | Canvas API or CSS | Audio playing |

---

## Database Schema

### Entities

#### `admin_users`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| username | VARCHAR (UNIQUE) | Login identifier |
| password_hash | VARCHAR | bcrypt hashed |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

#### `profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Fixed: `default-profile` |
| name | JSONB | `{ en, vi, ja }` |
| title | JSONB | `{ en, vi, ja }` |
| introduction | JSONB | `{ en, vi, ja }` |
| bio | JSONB | `{ en, vi, ja }` |
| avatar_url | VARCHAR? | S3/CloudFront URL |
| background_url | VARCHAR? | S3/CloudFront URL |
| social_links | JSONB | `{ github, linkedin, ... }` |
| contact_info | JSONB | `{ email, phone, ... }` |
| updated_at | TIMESTAMP | Auto |

#### `categories`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| name | JSONB | `{ en, vi, ja }` |
| slug | VARCHAR (UNIQUE) | URL-safe identifier |
| type | VARCHAR | SKILL / EXPERIENCE / EDUCATION / CUSTOM |
| sort_order | INT | Display ordering |
| is_active | BOOLEAN | Visibility toggle |
| is_deleted | BOOLEAN | Soft delete flag |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

#### `category_items`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| category_id | UUID (FK) | References categories.id |
| title | JSONB | `{ en, vi, ja }` |
| description | JSONB | `{ en, vi, ja }` |
| metadata | JSONB | Flexible: dates, levels, company, etc. |
| image_url | VARCHAR? | S3/CloudFront URL |
| sort_order | INT | Display ordering |
| is_active | BOOLEAN | Visibility toggle |
| is_deleted | BOOLEAN | Soft delete flag |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

#### `tracks`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| title | VARCHAR | Song title |
| artist | VARCHAR | Artist name |
| s3_key | VARCHAR | S3 object key |
| cloudfront_url | VARCHAR | Public CDN URL |
| duration_seconds | INT | Track duration |
| sort_order | INT | Playlist ordering |
| is_active | BOOLEAN | Include in playlist |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

#### `media`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| filename | VARCHAR | Original filename |
| s3_key | VARCHAR | S3 object key |
| cloudfront_url | VARCHAR | Public CDN URL |
| mime_type | VARCHAR | image/jpeg, audio/mpeg, etc. |
| file_size_bytes | INT | File size |
| context | VARCHAR | PROFILE / CATEGORY / TRACK / GENERAL |
| created_at | TIMESTAMP | Auto |

#### `contact_submissions`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Auto-generated |
| sender_name | VARCHAR(100) | Sender's name |
| sender_email | VARCHAR(254) | Sender's email address |
| subject | VARCHAR(200) | Message subject |
| message_body | VARCHAR(5000) | Sanitiized message body |
| is_read | BOOLEAN | Read status |
| created_at | TIMESTAMP | Auto |
| updated_at | TIMESTAMP | Auto |

#### `site_settings`
| Column | Type | Notes |
|---|---|---|
| id | UUID (PK) | Fixed ID: `default` |
| is_contact_form_enabled | BOOLEAN | Toggle form visibility on landing page |
| mail_provider | VARCHAR | `resend` or `smtp` |
| mail_from | VARCHAR | Email sender |
| mail_to | VARCHAR | Email recipient |
| updated_at | TIMESTAMP | Auto |

---

## API Endpoints

> Updated as endpoints are implemented.

### Public Endpoints (No Auth)

| Method | Route | Description |
|---|---|---|
| GET | /api/health | Health check |
| GET | /api/profile | Get portfolio profile |
| GET | /api/categories | List active categories with items |
| GET | /api/categories/:slug | Get single category with items |
| GET | /api/tracks | List active tracks (playlist) |
| POST | /api/contact | Submit contact form message (throttled) |
| GET | /api/settings/public | Get public site settings |

### Auth Endpoints

| Method | Route | Description |
|---|---|---|
| POST | /api/auth/login | Login, returns JWT |
| POST | /api/auth/refresh | Refresh JWT token |

### Admin Endpoints (JWT Required)

| Method | Route | Description |
|---|---|---|
| PUT | /api/admin/profile | Update profile |
| POST | /api/admin/categories | Create category |
| PUT | /api/admin/categories/:id | Update category |
| PATCH | /api/admin/categories/:id/reorder | Reorder category |
| DELETE | /api/admin/categories/:id | Soft delete category |
| POST | /api/admin/categories/:id/items | Create category item |
| PUT | /api/admin/category-items/:id | Update category item |
| DELETE | /api/admin/category-items/:id | Soft delete category item |
| POST | /api/admin/tracks | Create track |
| PUT | /api/admin/tracks/:id | Update track |
| DELETE | /api/admin/tracks/:id | Delete track |
| PATCH | /api/admin/tracks/:id/reorder | Reorder track |
| POST | /api/admin/media/presign | Get presigned upload URL |
| PUT | /api/admin/password | Change password |
| GET | /api/admin/contact | List contact submissions |
| PATCH | /api/admin/contact/:id/read | Mark contact submission as read |
| GET | /api/admin/settings/email | Get email configurations and statuses |
| PUT | /api/admin/settings/email | Update email configurations |
| POST | /api/admin/settings/email/test | Send a test notification email |

---

## Authentication

### Flow

```
1. Admin submits username + password on /[locale]/admin/login
2. Browser POST /api/auth/login with credentials: 'include'
3. NestJS validates credentials (bcrypt compare)
4. Nest sets httpOnly cookie jazz_access_token (JWT, expiry from JWT_EXPIRATION)
5. Web sets non-httpOnly UX marker jazz_admin_session (Next host) for middleware gating
6. Next middleware blocks /admin/* (except login) when marker missing
7. Admin layout confirms session via GET /api/auth/me (cookie sent to API)
8. AdminApiClient calls use credentials: 'include' (no JWT in localStorage / Zustand)
9. Logout: Nest clears jazz_access_token; web clears jazz_admin_session
```

JWT strategy accepts **cookie or** `Authorization: Bearer` (Bearer is optional/legacy; cookie is the primary path).

### Security Rules

- Passwords hashed with bcrypt (12 salt rounds)
- JWT secret: minimum 64 characters, stored in environment variable
- httpOnly `jazz_access_token` on the API host: prevents XSS token theft from JS
- CORS: `credentials: true` with origin allowlist (`FRONTEND_URL` / `CORS_ORIGINS`)
- Cross-origin local/prod: `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true`
- Rate limiting: 100 requests/minute globally, 5 login attempts/15min
- Helmet: security headers on all API responses
- JWT `validate` trusts signed payload (no DB hit per request by default)

### Data Fetching (Web)

| Client | Use for | Cache |
|---|---|---|
| `ServerPublicApiClient` | Portfolio/blog RSC public GETs | `API_INTERNAL_URL` fallback + `revalidate` + tags |
| `PublicApiClient` | Live browser reads/writes (comments/tokens) | `cache: 'no-store'` against `NEXT_PUBLIC_API_URL` |
| `AdminApiClient` | CMS mutations & authenticated GETs | `cache: 'no-store'` + cookies |

Shared path builders live in `@jazz-portfolio/shared` (`ApiRoutes`). Nest controllers are the HTTP source of truth. See [refactor_and_performance.md](./refactor_and_performance.md).

---

## Internationalization (i18n)

### Setup

- Library: next-intl with App Router integration
- Routing: /en/..., /vi/..., /ja/... (default: /en)
- Translation files: apps/web/src/i18n/messages/{locale}.json

### Conventions

- **Key naming:** Dot-separated, component-scoped: `hero.greeting`, `common.home`
- **Dynamic content:** Uses JSONB fields in database: `{ "en": "...", "vi": "...", "ja": "..." }`
- **Font handling:** Conditionally load Japanese-specific fonts when locale is ja

### Supported Locales

| Code | Language | Flag | Font (Heading) | Font (Body) |
|---|---|---|---|---|
| en | English | GB | Playfair Display | Inter |
| vi | Vietnamese | VN | Playfair Display | Inter |
| ja | Japanese | JP | Noto Serif JP | Noto Sans JP |

---

## Music Player

### Architecture

- **Lazy music chrome** — `MusicPlayer` + `PlaylistFetcher` load via `next/dynamic` (`ssr: false`) when `isMusicEnabled` (see `MusicChrome`)
- **Zustand store** manages: currentTrack, isPlaying, isMuted, volume, playlist, currentTime
- **Persist middleware** saves volume, isMuted, currentTrackIndex to localStorage (playback prefs only — not auth)
- **Autoplay policy:** Start muted -> show pulsing unmute prompt -> user interaction enables sound
- Audio uses `preload="metadata"` (not full eager download)

### UI Components

| Component | Location | Description |
|---|---|---|
| MusicPlayer | Fixed bottom bar | Play/pause, track info, volume, mute toggle |
| PlaylistDrawer | Slide-up panel | Full track list, click to play |
| AudioVisualizer | Inside player bar | Subtle frequency visualization |

### Track Storage

- Audio files stored in S3: `s3://jazz-portfolio-media/tracks/{uuid}.{ext}`
- Served via CloudFront for global CDN caching
- Metadata (title, artist, duration, order) stored in PostgreSQL tracks table

---

## Admin Panel

### Route Structure

```
/[locale]/admin/
  +-- login        -> Login page (public)
  +-- page         -> Dashboard overview (protected; uses GET /api/admin/stats)
  +-- profile      -> Profile editor (protected)
  +-- categories   -> Category manager (protected)
  +-- music        -> Music manager (protected)
  +-- contact      -> Contact inbox (protected; paginated)
  +-- settings     -> Password + email / contact form settings (protected)
```

### Data layer

- **TanStack Query** provider scoped to the admin layout only
- Hooks under `apps/web/src/hooks/admin/` (categories, tracks, profile, contact, settings, stats)
- UI split: category list/forms/items; settings password vs email forms
- Mutations surface errors in UI banners (not silent `console.error`)

### Capabilities

1. **Dashboard:** Lightweight counts via `GET /api/admin/stats` (no full category trees).
2. **Profile Editor:** Edit multilingual name, title, intro, bio. Upload avatar and background (presigned S3; response field `uploadUrl`).
3. **Category Manager:** CRUD categories, reorder via `PATCH` + `{ ids }`, soft delete/restore.
4. **Category Item Manager:** Nested under categories. CRUD items with multilingual fields, metadata, and images.
5. **Music Manager:** Upload tracks to S3, edit metadata, reorder playlist, toggle active.
6. **Contact Inbox:** Paginated list; fetch full `messageBody` per message detail.
7. **Settings:** Change password (`currentPassword`); email provider / contact-form toggles.

---

## AWS Infrastructure

### Resources

| Resource | Type | Spec | Purpose |
|---|---|---|---|
| RDS | PostgreSQL 16 | db.t4g.micro, 20GB gp3 | Database |
| EC2 | Amazon Linux 2023 | t4g.micro, ARM | NestJS API (Docker) |
| Amplify | Hosting | Auto-deploy from GitHub | Next.js frontend |
| S3 | Standard | Lifecycle rules | Media storage |
| CloudFront | Distribution | Origin: S3 bucket | Media CDN |
| Route 53 | Hosted Zone | (when custom domain added) | DNS |

### Estimated Monthly Cost

| Resource | Year 1 (Free Tier) | Post Free Tier |
|---|---|---|
| RDS | ~$0 | ~$15 |
| EC2 | ~$0 | ~$7 |
| Amplify | ~$0-5 | ~$5 |
| S3 | ~$1 | ~$1-2 |
| CloudFront | ~$0 (1TB free) | ~$5 |
| **Total** | **~$5-15/mo** | **~$30-35/mo** |

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### ci.yml -- On every PR and push to main
1. Checkout code
2. Install pnpm + dependencies
3. Generate Prisma client
4. `pnpm turbo run lint type-check`
5. `pnpm turbo run build test` (with placeholder `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL`)

#### deploy-api.yml -- On push to main (backend changes)
1. SSH into EC2
2. Git pull latest code
3. Rebuild Docker container
4. Restart NestJS service
5. Run pending Prisma migrations

#### deploy-web.yml -- Automatic via Amplify
1. Amplify detects push to main
2. Builds Next.js production bundle
3. Deploys to Amplify CDN

---

## Environment Variables

### Backend (apps/api/.env)

| Variable | Required | Description |
|---|---|---|
| PORT | Yes | API server port (default: 3001) |
| NODE_ENV | Yes | development / production |
| DATABASE_URL | Yes | PostgreSQL connection string |
| JWT_SECRET | Yes | JWT signing secret (min 64 chars) |
| JWT_EXPIRATION | Yes | Token expiry (e.g., 24h) |
| AWS_REGION | Yes | AWS region (e.g., ap-southeast-1) |
| AWS_S3_BUCKET | Yes | S3 bucket name |
| AWS_CLOUDFRONT_DOMAIN | Yes | CloudFront distribution domain |
| FRONTEND_URL | Yes | Frontend URL for CORS (single origin) |
| CORS_ORIGINS | No | Comma-separated origin allowlist (overrides `FRONTEND_URL` when set) |
| COOKIE_SAME_SITE | No | `none` (cross-origin web→api, default) or `lax` (same-site) |
| COOKIE_SECURE | No | `true` required with `SameSite=None` |
| MAIL_PROVIDER | No | `resend` or `smtp` (default: `resend`) |
| MAIL_FROM | No | Fallback email sender (e.g., notifications@domain.com) |
| MAIL_TO | No | Fallback email recipient (e.g., contact@domain.com) |
| RESEND_API_KEY | No | API Key required if MAIL_PROVIDER is `resend` |
| SMTP_HOST | No | SMTP Server host required if MAIL_PROVIDER is `smtp` |
| SMTP_PORT | No | SMTP Server port (default: 587) |
| SMTP_USER | No | SMTP Server authentication username |
| SMTP_PASS | No | SMTP Server authentication password |

### Frontend (apps/web/.env)

| Variable | Required | Description |
|---|---|---|
| NEXT_PUBLIC_API_URL | Yes | Backend API base URL (browser; used with credentialed admin fetches) |
| API_INTERNAL_URL | No | Private API base URL for RSC/ISR; falls back to `NEXT_PUBLIC_API_URL` |
| NEXT_PUBLIC_CDN_URL | No | CloudFront URL for media |
| NEXT_PUBLIC_SITE_URL | No | Canonical site origin for metadata / sitemap / robots |
| REVALIDATE_SECRET | No | Shared secret for `POST /api/revalidate` (cache tag invalidation) |

---

## Conventions & Standards

### Code Style

- **TypeScript:** Strict mode everywhere
- **Formatting:** Prettier (single quotes, trailing commas, 100 char width)
- **Linting:** ESLint with TypeScript plugin
- **Naming:**
  - Files: kebab-case (e.g., music-player.tsx)
  - Components: PascalCase (e.g., MusicPlayer)
  - Functions/variables: camelCase
  - DB tables: snake_case
  - Environment vars: SCREAMING_SNAKE_CASE

### Git

- **Branch strategy:** main (production), develop (staging), feature/*, fix/*
- **Commit format:** Conventional Commits (feat:, fix:, chore:, docs:)
- **PR required:** All changes go through PR with CI checks

### API

- **Prefix:** All routes start with /api
- **Versioning:** Not needed for v1 (add /api/v2 if breaking changes later)
- **Response format:** `{ data: T }` for success, `{ statusCode, message, error }` for errors
- **Validation:** All DTOs validated with class-validator decorators

---

## Deployment Runbook

> To be completed in Phase 9.

### First-Time Setup

1. Provision AWS resources (RDS, EC2, S3, CloudFront, Amplify)
2. Configure security groups and IAM roles
3. Set environment variables on EC2 and Amplify
4. Run initial Prisma migration against production RDS
5. Seed production database
6. Deploy API to EC2 via Docker
7. Connect Amplify to GitHub repository
8. Verify deployment

### Routine Deployment

1. Push to main branch
2. CI runs automatically
3. Backend deploys via GitHub Actions SSH
4. Frontend deploys via Amplify auto-build
5. Verify health check endpoint

---

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-07-12 | JSONB for multilingual content | 3 fixed languages -- simpler than translation table, Prisma JSONB support |
| 2026-07-12 | Category + CategoryItem pattern | Dynamic sections without schema changes |
| 2026-07-12 | Single admin, no roles table | Only one admin user needed |
| 2026-07-12 | Admin inside Next.js (not separate SPA) | Shared auth middleware, code reuse, simpler deployment |
| 2026-07-12 | Zustand over Redux/Context | Minimal boilerplate, persist middleware for audio |
| 2026-07-12 | Tailwind CSS 4 over styled-components | Design tokens via @theme, better performance, tree-shaking |
| 2026-07-12 | Presigned URL uploads (browser to S3) | Offloads bandwidth from API server |
| 2026-07-12 | Default AWS URLs (no custom domain v1) | Can be added later via Route 53 |
| 2026-07-12 | Display contact info, no email form v1 | Simpler; avoids AWS SES setup |
| 2026-07-19 | Contact form with email integration | Added interactive contact form with dynamic email delivery (Resend/SMTP) |
| 2026-07-19 | DB-based Email Settings Dashboard | Moves email routing configs and form visibility switches to a single-row SiteSettings DB table, keeping secrets in env |
| 2026-07-19 | Theme Switcher (Dark & Light-Jazz) | Toggle switch supporting smooth animations and light-jazz custom aesthetic |
| 2026-07-20 | Shared `ApiRoutes` in `@jazz-portfolio/shared` | End admin path/DTO drift; Nest controllers remain HTTP SoT |
| 2026-07-20 | Split `PublicApiClient` / `AdminApiClient` | ISR + tags for portfolio; `no-store` + cookies for CMS — never one client for both |
| 2026-07-20 | React `cache()` + `Promise.all` for portfolio RSC | Deduplicate layout/page profile fetch; cut sequential TTFB |
| 2026-07-20 | `next/dynamic` for music chrome & smoke | Defer non-critical JS/canvas off the critical path |
| 2026-07-20 | TanStack Query for admin only | Mutation cache + split CMS UI; keep RSC for public portfolio |
| 2026-07-20 | Prisma indexes + lean public selects + list pagination | Hot filters indexed; no `s3Key` on public music; inbox/media paginated |
| 2026-07-20 | httpOnly cookie JWT (`jazz_access_token`) | Remove localStorage XSS surface; CORS credentials + SameSite for cross-origin |
| 2026-07-20 | CI lint → type-check → build → test | Catch ship breakage, not only static analysis |
| 2026-09-02 | Split cached server public reads from live browser public reads | Allow private RSC routing, keep Next cache options out of browser requests, and stream comments independently |

---

## Related Docs

| Doc | Purpose |
|---|---|
| [refactor_and_performance.md](./refactor_and_performance.md) | Rationale and best practices for the Phase 1–6 refactor |
| [perf-notes.md](./perf-notes.md) | Cache tags, revalidation, build metrics, Lighthouse how-to |
| [application_optimization_plan.md](./application_optimization_plan.md) | Current hybrid-architecture assessment, measured baseline, completed refactors, and ranked next phases |
| [DEPLOYMENT_RUNBOOK.md](./DEPLOYMENT_RUNBOOK.md) | Deploy operations |
| [backend_development_mastery.md](./backend_development_mastery.md) | Nest patterns deep-dive |
| [database_design_deepdive.md](./database_design_deepdive.md) | Schema and query design |
| [getting_started.md](./getting_started.md) | Local setup |
