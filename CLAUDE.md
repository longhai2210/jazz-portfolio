# Jazz Portfolio: a jazz-themed, multilingual portfolio site with blog, comments, background music and an admin CMS, for one owner and their visitors

## Stack
pnpm + Turborepo monorepo, TypeScript. `apps/web`: Next.js 15 App Router, React 19, Tailwind 4, Framer Motion, Three.js, Zustand, TanStack Query (admin only), next-intl (en, vi, ja). `apps/api`: NestJS 11, Prisma, PostgreSQL 16, JWT in an httpOnly cookie. `packages/database`: Prisma schema and client. `packages/shared`: DTOs, enums, `ApiRoutes`. `packages/config`: tsconfig and ESLint.

## Commands
- Install: pnpm install --frozen-lockfile, then pnpm --filter @jazz-portfolio/database db:generate (also needed in every fresh worktree, before verify)
- Local database: docker-compose -f infra/docker/docker-compose.dev.yml up -d, then pnpm --filter @jazz-portfolio/database db:migrate and db:seed
- Dev servers: pnpm dev (web http://localhost:3000, API http://localhost:3001/api)
- Verify everything: pnpm run verify   (lint, types, tests, build; MUST be green before reporting done)
- Unit tests: pnpm run test:ci, or one workspace: pnpm --filter @jazz-portfolio/web test
- Main branch: master, so pass `--base master` to `node scripts/kg.mjs impact` when comparing against it

## Architecture: how a user action flows
- Public page: `app/[locale]/(portfolio)` RSC -> `lib/portfolio-data.ts` or `lib/blog-data.ts` (React `cache`) -> `ServerPublicApiClient` (Data Cache with `CACHE_TAGS`) -> Nest controller -> service -> Prisma.
- Public browser action: client component or hook in `hooks/` -> `PublicApiClient` (`lib/api-public.ts`) -> Nest controller. The contact form is the exception: `hooks/public/use-contact-submit.ts` calls `fetch` itself.
- Admin page: `app/[locale]/admin/*` -> TanStack Query hook in `hooks/admin/` -> `AdminApiClient` (`lib/api-admin.ts`, sends the cookie) -> `/api/admin/*` behind `JwtAuthGuard` -> service -> `RevalidationService` -> web `app/api/revalidate` webhook, so public caches refresh.
- Web, `apps/web/src`: routes `app/[locale]`, components `components/{admin,animation,blog,common,layout,music,portfolio}`, state `stores/`, messages `i18n/messages/*.json`, design tokens `styles/globals.css` (`@theme`), test setup `test/setup.ts`.
- API, `apps/api/src`: one folder per feature with `*.module.ts`, `*.controller.ts` (`*-admin.controller.ts` for admin routes), `*.service.ts`, `dto/`. Cross-cutting code is in `common/`, env validation in `config/env.validation.ts`, the root module in `app.module.ts`.
- Data: `packages/database/prisma/schema.prisma`, with SQL migrations beside it.

## Conventions
- API paths come only from `ApiRoutes` in `@jazz-portfolio/shared`; never hardcode them. Request and response types live in the same package, and Nest controllers are the source of truth.
- Use the right client: `ServerPublicApiClient` for cached RSC reads, `PublicApiClient` for live browser requests, `AdminApiClient` for the CMS. `lib/api-client.ts` is deprecated.
- Admin data goes through hooks in `hooks/admin/` using `adminKeys`; do not fetch in components.
- A change to public content must revalidate its cache tag through `RevalidationService`.
- Public UI text goes through next-intl, with the key added to all of en, vi and ja; the admin UI does not use next-intl. Multilingual database content is JSON `{ en, vi, ja }`, read with `getTranslation`.
- Features that can be switched off use `FeatureFlagGuard` with `@RequireFeature`.
- Styling is Tailwind utilities with the `jazz-*` tokens. Colocate `loading.tsx` and `error.tsx` with routes.
- Every new API DTO is validated with class-validator.
- Tests: Jest, next to the code. Files are `*.spec.ts` in the API and `*.test.ts(x)` in web and shared. Web tests default to the node environment; a component test starts with the `@jest-environment jsdom` docblock (see `apps/web/src/test/smoke.test.tsx`).
- Every API call handles loading, empty and error states.

## Recipes
- Add a public page: create `app/[locale]/(portfolio)/<route>/page.tsx` as an RSC, fetch through a `cache()` function in `lib/*-data.ts` with a tag from `CACHE_TAGS`, then add its messages to all three locales.
- Add an admin page: create `app/[locale]/admin/<route>/page.tsx`, add a hook in `hooks/admin/`, a key in `query-keys.ts`, and components in `components/admin/<area>/`.
- Add an API endpoint: add the DTO and method to the feature's controller and service, add the path to `ApiRoutes` and the types to `packages/shared`, then call it through the right client. Build `packages/shared` before type-checking its consumers (`pnpm run typecheck` does this).
- Change the schema: edit `schema.prisma`, run `pnpm --filter @jazz-portfolio/database db:migrate`, and commit the migration.

## Forbidden
- Editing .env files or committing secrets; client env vars (NEXT_PUBLIC_*) are public
- Disabling lint rules, skipping or weakening tests, `any` to silence types
- Guessing when a spec is unclear: ask instead

## AI workflow
- Task tracker: github
- Specs: specs/<feature>/ (see specs/README.md). Every AC is proven by a test titled with its ID. This repo is public, so specs and issues are public too.
- Roles: subagents in .claude/agents (designer, dev, tester, reviewer); the main session is the Lead via /ai-workflow.
- Knowledge graph (optional, local, never committed): query with `node scripts/kg.mjs`, never open .ua/ files; the user runs /understand to update it. Without a graph, use the architecture map above, then Glob/Grep.
- Keep the architecture map and conventions above current: update them in the PR of any feature that adds a page, module or convention.
- Gates: G0 spec approved, G1 tasks cover every AC, G2 design approved, G3 verify green, G4 ACs tested (`node scripts/trace.mjs`), G5 review approved, G6 demo accepted.
