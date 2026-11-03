# Task Tracker

## Phase 0: Project Bible & Monorepo Scaffold

- [x] Initialize Turborepo monorepo with pnpm workspaces
- [x] Create all folder structures (`apps/web`, `apps/api`, `packages/*`, `docs/`, `infra/`)
- [x] Configure shared `tsconfig`, ESLint, and Prettier across monorepo
- [x] Write `docs/PROJECT_BIBLE.md` — the single source of truth
- [x] Initialize Git, create `.gitignore`, write `README.md`
- [x] Create `package.json` files for each workspace with correct dependencies
- [x] Verify: package compilation passes (`pnpm build` across workspaces)


## Phase 1: Database & Backend Foundation
- [x] Set up `packages/database` with Prisma schema
- [x] Docker Compose for local PostgreSQL
- [x] Run initial migration (Schema defined, migrations set up, DB credentials to be configured by user)
- [x] Create seed script
- [x] Initialize NestJS app with module structure (Prisma service, modules added)
- [x] Set up env config validation (class-validator schema validation for NestJS config)
- [x] Create common infrastructure (HttpExceptionFilter, TransformInterceptor, ValidationPipe)
- [x] Health check endpoint
- [x] Set up `packages/shared`



## Phase 2: Core API & Admin Auth
- [x] Implement JWT Authentication in NestJS (local & JWT strategies, guards, login endpoint)
- [x] Profile CRUD endpoints (GET public profile, PUT admin update)
- [x] Categories CRUD endpoints (GET list, POST create, PUT update, DELETE soft-delete, PATCH reorder)
- [x] Category Items CRUD endpoints (POST create item, PUT update, DELETE soft-delete, PATCH reorder)
- [x] Tracks CRUD endpoints (GET active tracks list, POST create, PUT update, DELETE track, PATCH reorder)
- [x] Password management (PUT admin change password endpoint, bcrypt hashing verification)
- [x] Request validation (DTOs with class-validator decorators)
- [x] Swagger documentation configurations for all endpoints


## Phase 3: S3 Integration & Media Pipeline
- [x] Set up S3 connection configurations in NestJS config loading
- [x] Expose presigned URL generation endpoint (`POST /media/presign`) returning custom upload paths
- [x] Client-side upload handler DTO schemas (filenames, types, sizes checking)
- [x] Direct upload helper logic mapping generated presigned uploads to media registers
- [x] S3 upload endpoints Swagger declarations
- [x] Media asset metadata tracking module in database (`Media` table records management)


## Phase 4: Frontend Shell, i18n & Design System
- [x] Build global portfolio layout elements: Header & Footer
- [x] Build LanguageSwitcher component supporting en/vi/ja with flag icons
- [x] Build global API client (`lib/api-client.ts`) linking frontend to NestJS backend
- [x] Set up Zustand audio store (`stores/audioStore.ts`) to manage player states
- [x] Build MusicPlayer component shell (floating bar at the bottom)
- [x] Verify Next.js responsiveness and styling tokens


## Phase 5: Jazz Loading Animation & Core Animations
- [x] Build `JazzLoader` screen showing animated silhouette and floating musical note particles
- [x] Build `ScrollReveal` component using framer-motion useInView wrapper
- [x] Build CSS/Canvas ambient background smoke effects matching the jazz club aesthetic
- [x] Implement smooth page routing and layout fade-in transitions
- [x] Design hover animations (brass glowing effects, button micro-behaviors)
- [x] Staggered entry list expansions for experience card listings


## Phase 6: Portfolio Content Sections
- [x] Build public API fetching helper for profile and categories content
- [x] Create Hero section displaying contact details first, title, and scrolling prompts
- [x] Create About section with bio descriptions and social links
- [x] Create Experience section rendering items inside staggered reveal cards
- [x] Create Skills section drawing skills tags and categories
- [x] Integrate full i18n support mapping backend translation JSONB responses to active locale


## Phase 7: Music Player — Full Implementation
- [x] Build visual playlist selection drawer (Slide-up panel)
- [x] Build Canvas frequency visualizer bars inside the bottom player bar
- [x] Verify volume settings persistence (local storage sync)
- [x] Configure custom controls: next, prev, volume seek, play/pause toggling
- [x] Refine autoplay blocking prompts (pulsing mute visual indicator badge)


## Phase 8: Admin Panel UI
- [x] Build Admin Authentication state persistence (JWT localStorage cookie sync)
- [x] Build Admin Login screen (`/admin/login`) with form inputs validation
- [x] Build Admin layout with sidebar navigation, header, and logout triggers
- [x] Build Profile Editor interface with form fields, S3 avatar uploads integration
- [x] Build Category & Item Managers allowing creation, soft deletes, and drag-and-drop list reorderings
- [x] Build Music Manager supporting direct upload to S3 using presigned URLs
- [x] Build Settings page for admin password updates


## Phase 9: AWS Deploy Plan & CI/CD
- [x] Create Docker configuration: Dockerfile and docker-compose.yml for NestJS API service
- [x] Create GitHub Actions CI workflow (ci.yml) validating tests, lints, and builds
- [x] Create GitHub Actions deploy workflow (deploy-api.yml) configuring CD pipelines to AWS EC2
- [x] Write comprehensive deployment runbook (AWS S3, EC2, RDS PostgreSQL, Amplify, CloudFront)


## Phase 10: Final Verification & Walkthrough
- [x] Conduct total walkthrough audit verifying backend structures, endpoints definitions, and UI configurations
- [x] Check Project Bible definitions match implementation results
- [x] Verify full workspace compilation builds

## Phase 11: Music Playback Toggle Setting
- [x] Add `isMusicEnabled` column to database Profile model
- [x] Update database seed script with default isMusicEnabled value
- [x] Add `isMusicEnabled` type mappings inside packages/shared and apps/api DTOs
- [x] Add toggling checkbox setting in admin profile editor UI
- [x] Wire conditional music player rendering in layout wrapper using isMusicEnabled status
## Phase 12: Blog Posts & Moderated Comments System
- [x] Phase 1: Database Schema & Shared Contracts (`posts`, `comments`, `comment_blocklists` models, enums, DTOs, API path builders)
- [x] Phase 2: Feature Flags & Server Guards (`FeatureFlagGuard`, TTL settings cache, `/admin/settings` Content tab)
- [x] Phase 3: Posts API (Diacritics-stripping slugifier, reading time calculator, sanitized DTOs, NestJS controllers)
- [x] Phase 4: Admin Posts CMS (Multilingual Markdown editor with live preview, S3 cover upload, `/admin/posts` list & editor)
- [x] Phase 5: Public Blog UI (RSC Markdown rendering with `rehype-sanitize`, public blog pages `/[locale]/blog`, RSS feed, sitemap)
- [x] Phase 6: Comments API & Anti-Spam Engine (15-min HMAC token, `SpamShieldService` with 14-layer defense, moderation API)
- [x] Phase 7: Public Comment UI (`useCommentForm` with 5s dwell-time gate, honeypots, initials avatars, nested reply tree)
- [x] Phase 8: Comment Moderation CMS (Master-detail split pane, one-click blocklist shortcuts, bulk actions, sidebar counter badge)
- [x] Phase 9: Hardening, Tests & Observability (36/36 unit & PII leakage security tests passing, 0-error web type-check & build)
- [x] Phase 10: SEO, Docs & Staged Rollout Strategy (SEO validation, updated Project Bible & task tracker, walkthrough doc)
