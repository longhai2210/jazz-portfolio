# Performance notes (Phase 6)

> **Rationale & practices:** [refactor_and_performance.md](./refactor_and_performance.md) (why these changes and rules to keep).

Short record of the Jazz Portfolio refactor (phases 1–5) and how to revalidate / measure.

## What changed (expected wins)

| Area | Change | Expected impact |
| --- | --- | --- |
| Public SSR | Parallel `Promise.all` for profile / categories / settings; React `cache()` for `getProfile` | Lower TTFB; no duplicate profile fetch in layout + page |
| Data cache | `PublicApiClient` uses `revalidate` + tags; admin uses `cache: 'no-store'` | Correct ISR; admin GETs never poison the Data Cache |
| Client JS | `next/dynamic` for MusicPlayer / PlaylistFetcher / SmokeEffect; `optimizePackageImports` | Smaller initial JS; better TTI on portfolio |
| Images / audio | `next/image` + CloudFront remotePatterns; vinyl WebP; audio `preload="metadata"` | Better LCP / less bandwidth |
| Admin | TanStack Query; split category/settings UI; lightweight `/admin/stats` | Fewer full-tree fetches; clearer mutation errors |
| Backend | Prisma indexes; selective fields; JWT without per-request DB hit; httpOnly cookie | Faster authenticated + public API |
| SEO polish | `robots.ts`, `sitemap.ts`, Open Graph metadata, error / 404 boundaries | Better crawlability and share previews |

## Revalidation after CMS edits

Public GETs are tagged:

- `profile`, `categories`, `settings`, `music`

Invalidate from the Next app:

```http
POST /api/revalidate
Content-Type: application/json

{ "tag": "profile" }
```

(Requires whatever secret / auth the route handler expects in your deploy.)

## Measuring

### Production build (bundle sizes)

```bash
pnpm --filter @jazz-portfolio/database db:generate
pnpm turbo run build
```

Inspect Next.js route/chunk output under `apps/web/.next` (First Load JS per route in the build summary).

### Optional: `@next/bundle-analyzer`

```bash
pnpm --filter @jazz-portfolio/web add -D @next/bundle-analyzer
```

Wrap `next.config.ts` with the analyzer plugin and run:

```bash
ANALYZE=true pnpm --filter @jazz-portfolio/web build
```

### Lighthouse (CLI not required in CI)

If Chrome is installed:

```bash
npx lighthouse http://localhost:3000/en --form-factor=mobile --only-categories=performance,accessibility,seo --view
```

Or use Chrome DevTools → Lighthouse on the deployed Amplify URL (mobile).

**Targets:** Performance ≥ 90, Accessibility ≥ 90, SEO ≥ 95 (see implementation plan Phase 10).

## Baseline / after (this pass)

| Metric | Baseline (pre-refactor) | After phases 1–6 |
| --- | --- | --- |
| Lighthouse mobile | Not captured here (Lighthouse CLI / live URL not available in this agent run) | Re-run on Amplify after deploy; expect gains from parallel SSR, dynamic music/smoke, image/audio preload, smaller admin fetch surface |
| Next production build (2026-07-20) | n/a (pre-refactor not re-built) | `/[locale]` **11.8 kB** route / **169 kB** First Load JS; shared First Load **102 kB**; admin routes ~116–119 kB First Load; `/robots.txt` + `/sitemap.xml` static |
| Qualitative | Sequential homepage fetches; eager MusicPlayer/Smoke; admin over-fetch; JWT in localStorage | Parallel cached RSC data; deferred heavy clients; stats endpoint; httpOnly cookie auth |

Update Lighthouse scores in this table after the next production deploy.

## CI gates

GitHub Actions (`.github/workflows/ci.yml`) runs:

1. `pnpm turbo run lint type-check`
2. `pnpm turbo run build test`

Focused unit tests cover `ApiRoutes` / `buildReorderIds`, public vs admin fetch cache options, portfolio `getProfile` tag wiring, and Nest health/stats controller smoke tests.
