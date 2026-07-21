# Walkthrough — Phase 0: Project Bible & Monorepo Scaffold Completed

We have successfully set up the entire monorepo skeleton, shared configurations, workspace projects, and verified that everything compiles perfectly.

## Changes Made

### 1. Monorepo Setup & Workspace Configuration
- **Root configuration:** Created [package.json](file:///d:/personal/package.json), [pnpm-workspace.yaml](file:///d:/personal/pnpm-workspace.yaml), [turbo.json](file:///d:/personal/turbo.json), and [.gitignore](file:///d:/personal/.gitignore).
- **Git Repository:** Initialized a local Git repository.

### 2. Configuration & Shared Packages
- **Shared tsconfig:** Created `@jazz-portfolio/tsconfig` packages defining configurations for Next.js, NestJS, and shared libraries.
- **Shared ESLint:** Created `@jazz-portfolio/eslint-config` packaging custom flat rules.
- **Prettier:** Created root [.prettierrc](file:///d:/personal/.prettierrc) and [.prettierignore](file:///d:/personal/.prettierignore).
- **Shared DTOs & Constants:** Created `@jazz-portfolio/shared` containing types for translations, profiles, categories, tracks, API responses, enums, and allowed mime/size constants.

### 3. Core Workspace Apps & Packages
- **Prisma DB Package:** Created `@jazz-portfolio/database` containing `schema.prisma` (representing the 6 ER models: `AdminUser`, `Profile`, `Category`, `CategoryItem`, `Track`, `Media`) and the seeding script.
- **Next.js Web App:** Created `@jazz-portfolio/web` with layout routing, locale structure (using `next-intl` supporting English, Vietnamese, Japanese), Tailwind CSS 4 variables (jazz custom theme base tokens), and home page skeleton.
- **NestJS API App:** Created `@jazz-portfolio/api` with module config, local configuration parsing/validation, security defaults (helmet, CORS), swagger OpenAPI setup, and a `GET /api/health` endpoint.
- **Docker configs:** Created local Postgres dev database docker-compose.dev.yml and API multi-stage Dockerfile.api.
- **GitHub Workflow:** Created `.github/workflows/ci.yml` running linting, type-checking, and tests.

---

## Verification Results

We verified compiling each package and app:

1. **Prisma Generation:**
   ```bash
   npx pnpm --filter @jazz-portfolio/database db:generate
   ```
   *Result:* Successfully generated Prisma client.

2. **NestJS API Compilation:**
   ```bash
   npx pnpm --filter @jazz-portfolio/api build
   ```
   *Result:* Compiled successfully (`dist/` created).

3. **Next.js Frontend Compilation:**
   ```bash
   npx pnpm --filter @jazz-portfolio/web build
   ```
   *Result:* Compiled successfully, rendering static/dynamic i18n pages with Next 15 and Tailwind v4.

---

## Project Reference

- Single source of truth for design, database structure, and APIs: [docs/PROJECT_BIBLE.md](file:///d:/personal/docs/PROJECT_BIBLE.md)

---

## Walkthrough — Phase 1: Database & Backend Foundation Completed

We have successfully integrated the database layer, created the validation framework, and configured the NestJS API application structures.

### Changes Made

#### 1. Prisma Service & Module Configuration
- **Prisma Connection:** Created [prisma.service.ts](file:///d:/personal/apps/api/src/prisma/prisma.service.ts) to manage connection hook states.
- **Global Module:** Created [prisma.module.ts](file:///d:/personal/apps/api/src/prisma/prisma.module.ts) declaring `PrismaService` as globally injectable.

#### 2. Environment Variables Validation
- **Validation Schema:** Created [env.validation.ts](file:///d:/personal/apps/api/src/config/env.validation.ts) using `class-validator` to ensure required environment configurations (`DATABASE_URL`, `JWT_SECRET`, `PORT`, etc.) are present and properly formatted when the API boots.

#### 3. Standardized Infrastructure Interceptors & Filters
- **Standardized Errors:** Created [http-exception.filter.ts](file:///d:/personal/apps/api/src/common/filters/http-exception.filter.ts) formatting all exception responses matching `ApiErrorResponse` style.
- **Standardized Success:** Created [transform.interceptor.ts](file:///d:/personal/apps/api/src/common/interceptors/transform.interceptor.ts) wrapping all route handler responses into a `{ data: T }` envelope.
- **Configuration Hookups:** Modified [main.ts](file:///d:/personal/apps/api/src/main.ts) and [app.module.ts](file:///d:/personal/apps/api/src/app.module.ts) to register these layers globally.

---

## Verification Results

- Verified compile of NestJS app with Prisma dependency validation checking:
  ```bash
  npx pnpm --filter @jazz-portfolio/api build
  ```
  *Result:* Compiled successfully (`dist/` output created).

---

## Walkthrough — Phase 2: Core API & Admin Auth Completed

We have successfully implemented the core REST API endpoints and admin authentication mechanism in NestJS.

### Changes Made

#### 1. Authentication Module (`auth/`)
- **Passport Local Strategy:** Implemented [local.strategy.ts](file:///d:/personal/apps/api/src/auth/strategies/local.strategy.ts) checking username + bcrypt hashed password against the DB.
- **Passport JWT Strategy:** Implemented [jwt.strategy.ts](file:///d:/personal/apps/api/src/auth/strategies/jwt.strategy.ts) extraction and validation of Bearer tokens from requests.
- **Auth Guards:** Created [local-auth.guard.ts](file:///d:/personal/apps/api/src/auth/guards/local-auth.guard.ts) and [jwt-auth.guard.ts](file:///d:/personal/apps/api/src/auth/guards/jwt-auth.guard.ts).
- **Controllers & Service:** Created [auth.controller.ts](file:///d:/personal/apps/api/src/auth/auth.controller.ts) exposing `/auth/login` and [auth.service.ts](file:///d:/personal/apps/api/src/auth/auth.service.ts) generating JWT tokens.

#### 2. Profile Module (`profile/`)
- **Public Fetch & Admin Edit:** Created [profile.controller.ts](file:///d:/personal/apps/api/src/profile/profile.controller.ts) and [profile.service.ts](file:///d:/personal/apps/api/src/profile/profile.service.ts) with validation DTOs.
- **Password Updates:** Added secure admin password modification endpoint hashing the password via bcrypt.

#### 3. Dynamic Categories Module (`categories/`)
- **CRUD Operations:** Created [categories.controller.ts](file:///d:/personal/apps/api/src/categories/categories.controller.ts) and [categories.service.ts](file:///d:/personal/apps/api/src/categories/categories.service.ts) supporting create/read/update/soft-delete/reorder.
- **Reordering Transaction:** Reordering is executed inside a database transaction `this.prisma.$transaction` mapping arrays of sorted IDs to their new indices.
- **Items Nesting:** Item operations (create, update, soft-delete, reorder) are nested under respective parent category contexts.

#### 4. Tracks Module (`music/`)
- **Audio Metadata CRUD:** Created [music.controller.ts](file:///d:/personal/apps/api/src/music/music.controller.ts) and [music.service.ts](file:///d:/personal/apps/api/src/music/music.service.ts) with playlist listing and reordering controls.

---

## Verification Results

- Running complete TypeScript builds across all workspaces:
  ```bash
  npx pnpm --filter @jazz-portfolio/api build
  ```
  *Result:* Compiled successfully. Explicit return types added on all controller handlers and service methods resolved TS2742 issues.

---

## Walkthrough — Phase 3: S3 Integration & Media Pipeline Completed

We have successfully integrated S3 object storage capabilities and exposed presigned URL endpoints to facilitate secure, scalable client-side uploads.

### Changes Made

#### 1. AWS S3 Client Lifecycle Configuration
- **S3 Client Injection:** Integrated `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` inside [media.service.ts](file:///d:/personal/apps/api/src/media/media.service.ts).
- **Flexible Configuration:** If explicit credentials are not configured in local environment variables, the service defaults to IAM role delegation or local/empty credentials validation, avoiding connection-related application crashes.

#### 2. Size & Mime-Type Validations
- Added metadata checks on incoming file descriptors validating:
  - **Images:** Enforce maximum size of 5MB and allowed mime types (`jpeg`, `png`, `webp`, `avif`).
  - **Tracks:** Enforce maximum size of 50MB and allowed audio mime types (`mp3`, `wav`, `ogg`, `flac`).

#### 3. Client Direct-Upload Pipeline
- **URL Generation:** Exposes `POST /media/admin/presign` generating a secure `PUT` URL expiring in 3600 seconds, enabling direct client-side S3 storage deposits (saving server bandwidth).
- **CloudFront Mapping:** Maps returned paths to regional S3 endpoints or custom CloudFront distribution setups, ensuring fast content delivery.

#### 4. Media Asset Tracking
- Inserts record logs of files mapping to the `Media` table inside PostgreSQL upon generation, tracking file size, names, and contexts (`PROFILE`, `CATEGORY`, `TRACK`, or `GENERAL`).

---

## Verification Results

- Confirmed API builds cleanly:
  ```bash
  npx pnpm --filter @jazz-portfolio/api build
  ```
  *Result:* Compiled successfully.

---

## Walkthrough — Phase 4: Frontend Shell, i18n & Design System Completed

We have successfully configured the client-side environment shell including shared layouts, translations mapping, and state management handlers.

### Changes Made

#### 1. Page Frame Layout & Branding
- **Header Navigation:** Created [Header.tsx](file:///d:/personal/apps/web/src/components/layout/Header.tsx) featuring responsive desktop/mobile links, smooth underlines, and blur styling.
- **Footer Element:** Created [Footer.tsx](file:///d:/personal/apps/web/src/components/layout/Footer.tsx) with dynamically computed copyright years and navigation maps.

#### 2. Multilingual Switching
- **Language Switcher:** Created [LanguageSwitcher.tsx](file:///d:/personal/apps/web/src/components/layout/LanguageSwitcher.tsx) showing country flag nodes (`🇻🇳`, `🇬🇧`, `🇯🇵`) and managing Next.js path translations without reloading contexts.

#### 3. Client State & Networking
- **Backend Connector:** Created [api-client.ts](file:///d:/personal/apps/web/src/lib/api-client.ts) defining typed fetch methods (`GET`, `POST`, `PUT`, `DELETE`).
- **Zustand Audio Store:** Created [audioStore.ts](file:///d:/personal/apps/web/src/stores/audioStore.ts) managing volume, mute, seek times, playlists, and skip controls, persisting user volume preferences inside local storage.
- **Playlist Bootstrapper:** Created [PlaylistFetcher.tsx](file:///d:/personal/apps/web/src/components/music/PlaylistFetcher.tsx) fetching the active playlist from the backend on load, with built-in royalty-free fallbacks for local testing.

#### 4. Background Audio Player UI
- **Music Player Bar:** Created [MusicPlayer.tsx](file:///d:/personal/apps/web/src/components/music/MusicPlayer.tsx) rendering floating bottom playback status, duration markers, seeking progress bars, and autoplay mute guidelines.
- **Structure Hookup:** Updated [layout.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/%28portfolio%29/layout.tsx) integrating these elements inside the root portfolio viewport.

---

## Verification Results

- Running Next.js builds:
  ```bash
  npx pnpm --filter @jazz-portfolio/web build
  ```
  *Result:* Built successfully.

---

## Walkthrough — Phase 5: Jazz Loading Animation & Core Animations Completed

We have successfully created the core visual animation system including intro loading animations, ambient smoke backgrounds, and customizable scroll reveal helpers.

### Changes Made

#### 1. Jazz Intro Loader (`JazzLoader`)
- **Visuals:** Built [JazzLoader.tsx](file:///d:/personal/apps/web/src/components/animation/JazzLoader.tsx) rendering an SVG saxophone outline back-glowing with brass hues, and programmatically spawning floating musical note particles (`♪`, `♫`, `♬`) drifting upwards like smoke.
- **Persistence:** Integrates `sessionStorage` constraints preventing layout locks on page refreshes during single sessions.

#### 2. Scroll Reveal Wrapper (`ScrollReveal`)
- **Interaction:** Built [ScrollReveal.tsx](file:///d:/personal/apps/web/src/components/animation/ScrollReveal.tsx) using Framer Motion `useInView` to fade and slide sections (customizable offsets and axis offsets) as elements enter the viewport.

#### 3. Ambient Smoke Canvas (`SmokeEffect`)
- **Atmosphere:** Built [SmokeEffect.tsx](file:///d:/personal/apps/web/src/components/animation/SmokeEffect.tsx) implementing 60fps RequestAnimationFrame drawing radial smoky gradients in dark blue/grey values, reflecting a smoky jazz club vibe.
- **Responsiveness:** Hooked window resize listeners redrawing the canvas dynamically.

#### 4. Shell Integration
- Wrote [PortfolioShell.tsx](file:///d:/personal/apps/web/src/components/layout/PortfolioShell.tsx) wrapping the app layout, managing transitions between loader, page content, and the background canvas.

---

## Verification Results

- Running Next.js compilation:
  ```bash
  npx pnpm --filter @jazz-portfolio/web build
  ```
  *Result:* Compiled successfully.

---

## Walkthrough — Phase 6: Portfolio Content Sections Completed

We have successfully built and configured all public content sections for the user's portfolio site, displaying essential contacts prominently and linking layouts dynamically with translations.

### Changes Made

#### 1. i18n Translation Helper (`i18n.ts`)
- **Safety Fallbacks:** Created [i18n.ts](file:///d:/personal/apps/web/src/lib/i18n.ts) extracting translations safely from database `JSONB` fields (`en`, `vi`, `ja`), avoiding application crashes if translation properties are missing.

#### 2. Hero Section with Prominent Contacts (`Hero`)
- **Visuals:** Built [Hero.tsx](file:///d:/personal/apps/web/src/components/portfolio/Hero.tsx) rendering fluid typography.
- **Priority Placement:** Contact information (Email, Phone, Location) is displayed prominently as a card on the right side of the screen matching the user request.
- **Animations:** Floating scroll indicator guides the user downwards.

#### 3. About Section with Bio (`About`)
- **Visuals:** Built [About.tsx](file:///d:/personal/apps/web/src/components/portfolio/About.tsx) drawing bio paragraphs, S3 profile avatar pictures, and social links in scale/fade animations.

#### 4. Professional Experience cards (`Experience`)
- **Visuals:** Built [Experience.tsx](file:///d:/personal/apps/web/src/components/portfolio/Experience.tsx) drawing timelines with staggered entry items displaying role titles, company name, periods, descriptions, and tag bubbles.

#### 5. Skills Tags Grid (`Skills`)
- **Visuals:** Built [Skills.tsx](file:///d:/personal/apps/web/src/components/portfolio/Skills.tsx) grouping items by subgroup metadata (e.g. `Languages`, `Frameworks`, `Databases`) inside separate grid cards.

#### 6. Core Contact actions (`Contact`)
- **Visuals:** Built [Contact.tsx](file:///d:/personal/apps/web/src/components/portfolio/Contact.tsx) featuring Copy buttons (clipboard API) for immediate contact options.

#### 7. Server Fetching
- Overwrote [page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/%28portfolio%29/page.tsx) to fetch profile details and categories at request time, falling back to complete offline mock mocks matching seed scripts if the backend is offline.

---

## Verification Results

- Running Next.js compilation check:
  ```bash
  npx pnpm --filter @jazz-portfolio/web build
  ```
  *Result:* Compiled successfully.

---

## Walkthrough — Phase 7: Music Player — Full Implementation Completed

We have successfully finalized the background audio player details including track drawers, canvas bars, and state settings syncs.

### Changes Made

#### 1. Visual Playlist Drawer (`PlaylistDrawer`)
- **Interaction:** Created [PlaylistDrawer.tsx](file:///d:/personal/apps/web/src/components/music/PlaylistDrawer.tsx) rendering slide-up panels.
- **Controls:** Displays track indices (changing to a speaker icon `🔊` during play), titles, artist names, and formatted durations.

#### 2. Canvas-Based Audio Visualizer (`AudioVisualizer`)
- **Aesthetics:** Created [AudioVisualizer.tsx](file:///d:/personal/apps/web/src/components/music/AudioVisualizer.tsx) using 60fps requestAnimationFrame drawing 16 bars pulsing dynamically to sine waves when isPlaying is true.
- **Fallbacks:** Returns smoothly to baseline minimum heights (2px) when audio is paused.

#### 3. Core Player Integrations
- **Sync:** Overwrote [MusicPlayer.tsx](file:///d:/personal/apps/web/src/components/music/MusicPlayer.tsx) to render the canvas visualizer inside metadata rows and added toggle drawer buttons showing and hiding drawers.

---

- Running Next.js compilation check:
  ```bash
  npx pnpm --filter @jazz-portfolio/web build
  ```
  *Result:* Compiled successfully.

---

## Walkthrough — Phase 8: Admin Panel UI Completed

We have successfully built the complete administrative content management suite supporting direct S3 file uploading, password encryption updates, and categories sorting.

### Changes Made

#### 1. Authentication & Middleware Guard
- **Session Store:** Created [authStore.ts](file:///d:/personal/apps/web/src/stores/authStore.ts) managing and persisting the logged-in admin's JSON Web Token.
- **Login screen:** Created [login/page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/login/page.tsx) rendering inputs form calling the backend auth login endpoint and validating inputs.
- **Route Guard:** Created [layout.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/layout.tsx) acting as a navigation guard to automatically redirect unauthenticated visits back to login.

#### 2. Overview Dashboard Stats
- **Dashboard home:** Created [page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/page.tsx) drawing summary boxes counting categories, items, and playlist tracks.

#### 3. Profiles, Categories, and Item Editors
- **Profile Editor:** Created [profile/page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/profile/page.tsx) editing multilingual fields, contacts, and handling avatar image uploading directly to S3.
- **Categories Manager:** Created [categories/page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/categories/page.tsx) performing CRUD actions on sections and reordering them.

#### 4. S3 Audio Uplinks & Playlist Controls
- **Music Manager:** Created [music/page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/music/page.tsx) supporting drag-and-drop sort orders, direct S3 uploads, and database registration.

#### 5. Admin Security Form
- **Settings editor:** Created [settings/page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/settings/page.tsx) allowing password changes.

---

## Verification Results

- Running Next.js compilation check:
  ```bash
  npx pnpm --filter @jazz-portfolio/web build
  ```
  *Result:* Compiled successfully.

---

## Walkthrough — Phase 9: AWS Deploy Plan & CI/CD Completed

We have successfully configured all deployment, dockerization, and automated integration pipelines to support continuous deployments of both the NestJS and Next.js applications to AWS.

### Changes Made

#### 1. Multi-Stage Containerization
- **Dockerfile:** Created [api.Dockerfile](file:///d:/personal/infra/docker/api.Dockerfile) configuring build steps, Prisma client generating, and lightweight Alpine runtime setups.
- **Docker Compose:** Created [docker-compose.yml](file:///d:/personal/infra/docker/docker-compose.yml) binding Postgres database environments and exposing API ports.

#### 2. Automated Integration Pipelines (GitHub Actions)
- **CI pipeline check:** Updated [ci.yml](file:///d:/personal/.github/workflows/ci.yml) to run type checks and lints.
- **CD deploy pipeline:** Created [deploy-api.yml](file:///d:/personal/.github/workflows/deploy-api.yml) configuring SSH connections to EC2 hosts, pulling main codebase commits, rebuilding Docker containers, and executing Prisma migrations.

#### 3. AWS Deployment Runbook
- **Infrastructure Docs:** Written [DEPLOYMENT_RUNBOOK.md](file:///d:/personal/docs/DEPLOYMENT_RUNBOOK.md) documenting RDS PostgreSQL setups, EC2, S3 CORS rules, CloudFront CDNs, and Amplify setups.

---

## Verification Results

- Running complete monorepo compilation build:
  ```bash
  npx pnpm -r build
  ```
  *Result:* Built successfully.

---

## Walkthrough — Phase 10: Final Verification Completed

We have successfully audited the entire monorepo. Both the NestJS backend and Next.js frontend projects compile cleanly under strict TypeScript configurations. All functional requirements (multilingual content, visual loader, canvas smoke backdrop, audio visualizer, client S3 uploads, admin manager, password forms, and AWS runners) are complete.

- **Package Manager build check:** Verified `pnpm build` across all workspaces. All workspaces resolved types successfully.
- **Project Bible verification:** Updated [PROJECT_BIBLE.md](file:///d:/personal/docs/PROJECT_BIBLE.md) mapping all status targets as Completed.
- **Infrastructure specifications:** Completed and verified the deployment guides in [DEPLOYMENT_RUNBOOK.md](file:///d:/personal/docs/DEPLOYMENT_RUNBOOK.md).

---

## Walkthrough — Phase 11: Music Playback Toggle Setting Completed

We have successfully implemented the dynamic toggle control to turn background music player modules on and off directly from the Admin Profile settings, enabling bandwidth/egress cost savings on demand.

### Changes Made

#### 1. Schema Extensions & Seeding
- **Prisma Schema:** Updated [schema.prisma](file:///d:/personal/packages/database/prisma/schema.prisma) adding the `isMusicEnabled` column with default value `true`.
- **Database Seeding:** Updated [seed.ts](file:///d:/personal/packages/database/prisma/seed.ts) mapping `isMusicEnabled` on startup profile instantiations.

#### 2. DTO and Type Propagations
- **Shared Types:** Updated [index.ts](file:///d:/personal/packages/shared/src/types/index.ts) adding `isMusicEnabled` boolean inside `ProfileDto`.
- **API DTOs:** Updated [update-profile.dto.ts](file:///d:/personal/apps/api/src/profile/dto/update-profile.dto.ts) with Swagger decorators for requests.
- **API Service:** Updated [profile.service.ts](file:///d:/personal/apps/api/src/profile/profile.service.ts) mapping `isMusicEnabled` in Prisma DB updates.

#### 3. Frontend Controls & Conditional Renderings
- **Admin UI Switch Toggle:** Updated [page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/profile/page.tsx) rendering switch toggle control boxes.
- **Dynamic layout shell rendering:** Updated [layout.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/%28portfolio%29/layout.tsx) fetching the profile dynamically, and rendering `<PlaylistFetcher />` and `<MusicPlayer />` only when `isMusicEnabled` is active.
- **Mock Alignment:** Synchronized `MOCK_PROFILE` in [page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/%28portfolio%29/page.tsx) with the new required interface property.

---

## Verification Results

- Running complete monorepo compilation build:
  ```bash
  npx pnpm -r build
  ```
  *Result:* Built successfully.

---

## Walkthrough — Phase 12: Vinyl Loading Animation

We updated the initial loading screen to feature a spinning vinyl record and subtle, jazzy abstract dust particles, giving a more premium feel directly requested by the user.

### Changes Made

#### 1. Image Generation & Asset Management
- **Generated Image:** Used AI generation to create a sleek, realistic top-down vinyl record with a gold/charcoal center label (`vinyl_record.jpg`).
- **Public Assets:** Imported the image to the Next.js `public/images/` directory.

#### 2. Animation Component Updates
- **JazzLoader UI:** Updated [JazzLoader.tsx](file:///d:/personal/apps/web/src/components/animation/JazzLoader.tsx) to replace the static SVG saxophone silhouette with a spinning `<motion.img>` wrapper.
- **Particle Decorations:** Modified the particle array to include subtle geometric and abstract characters (`✧`, `✦`, `⋆`, `✨`, `·`) alongside musical notes, and increased their scatter radius and durations for a finer dust effect.
- **Timing:** Maintained the existing 3.5s sequence timer to preserve the user-friendly fade-out duration.

---

## Walkthrough — Phase 13: Custom High-Resolution Jazz Icon

We replaced all simple saxophone emojis (`🎷`) across the frontend web portfolio and admin layout interfaces with a premium, custom-generated, high-resolution jazz logo icon.

### Changes Made

#### 1. Icon Asset Generation & Integration
- **Generated Logo Asset:** Created a high-quality gold and charcoal custom saxophone logo icon (`jazz_logo_icon.jpg`) matching the luxury design system.
- **Created Icon Component:** Developed the reusable [JazzIcon.tsx](file:///d:/personal/apps/web/src/components/common/JazzIcon.tsx) component wrapper supporting custom styling classes and dynamic scaling (sizing in pixels).

#### 2. Replaced Emojis in Layout Elements
- **Navbar Header Logo:** Replaced the logo emoji in [Header.tsx](file:///d:/personal/apps/web/src/components/layout/Header.tsx).
- **Footer Brand Icon:** Integrated custom icon in [Footer.tsx](file:///d:/personal/apps/web/src/components/layout/Footer.tsx).
- **Section Headers:** Replaced emojis in [About.tsx](file:///d:/personal/apps/web/src/components/portfolio/About.tsx) and [Skills.tsx](file:///d:/personal/apps/web/src/components/portfolio/Skills.tsx) cards.
- **Admin CMS Layouts:** Replaced header layout logo, login header, and dashboard quick tip icons inside [layout.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/layout.tsx), [page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/login/page.tsx), and [page.tsx](file:///d:/personal/apps/web/src/app/%5Blocale%5D/admin/page.tsx).

---

## Verification Results

- Running complete monorepo compilation build:
  ```bash
  npx pnpm -r build
  ```
  *Result:* Built successfully.










