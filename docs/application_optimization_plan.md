# Application Optimization Assessment and Implementation Plan

**Audit date:** 2026-09-02  
**Scope:** Next.js web app, NestJS API, Prisma/PostgreSQL access, cache invalidation,
runtime effects, build/deployment behavior, and the current `docs/` / `.kiro/` design.

## Executive assessment

Keep the hybrid architecture. Its main boundaries are appropriate:

| Surface | Current model | Assessment |
| --- | --- | --- |
| Portfolio | RSC + SSG/ISR + tagged API fetches | Correct for SEO and read-heavy content |
| Blog | RSC + cached API reads + client interaction islands | Correct; comments needed a true streaming boundary |
| Admin CMS | CSR + TanStack Query + `no-store` API reads | Correct for a mutation-heavy private UI |
| Music/forms | Deferred client islands + direct browser API/media calls | Correct; these depend on browser APIs and interaction |
| API | NestJS REST + Prisma + PostgreSQL | Appropriate at this scale; projections and observability matter more than a framework change |

The architecture was not suffering from one large bundle regression. The most valuable issues
were boundary leaks and runtime work: the same public fetch client was serving both RSC and browser
requests, article HTML waited for comments, public comment queries read private columns, and the
ambient canvas ran continuously. Those items were addressed in this pass.

## Evidence captured

Production build with Next.js 15.5.20, using an intentionally unavailable placeholder API:

| Route | First Load JS before | After this pass | Interpretation |
| --- | ---: | ---: | --- |
| `/[locale]` | 127 kB | 127 kB | Healthy; this pass did not add public JS |
| `/[locale]/blog` | 111 kB | 111 kB | Healthy |
| `/[locale]/blog/[slug]` | 122 kB | 122 kB | Streamed server work changed, client payload stayed flat |
| Admin routes (most) | 117-123 kB | 117-123 kB | Healthy for a private CMS |
| Admin post editor | 221 kB | 221 kB | Expected hotspot: Markdown editor/preview |
| Shared app JS | 102 kB | 102 kB | Stable |

Quality baseline after the changes:

- API type-check: pass
- Web type-check: pass
- API tests: 37/37 pass
- Web tests: 7/7 pass
- API lint: zero warnings/errors
- Web lint: zero warnings/errors
- API production build: pass
- Web production build: pass

No live Lighthouse or production latency trace was available, so this audit does not invent LCP,
INP, TTFB, API p95, or database timing numbers. Capture those in Phase 1.

## Implemented in this pass

### 1. Separate server and browser public data clients

**Status:** complete

- `ServerPublicApiClient` owns Next Data Cache options and tagged ISR reads.
- `PublicApiClient` is now for live browser interactions and always uses `cache: 'no-store'`.
- `API_INTERNAL_URL` optionally routes RSC/ISR calls over a private service address; it falls back
  to `NEXT_PUBLIC_API_URL` when the deployment has no private network path.

This is the key hybrid boundary: server caching policy and private routing cannot accidentally leak
into comment-token or comment-refresh browser requests.

### 2. Stream article comments

**Status:** complete

Article settings and post content now start in parallel. The discussion fetch lives in an async
server component below `Suspense`, so the article can stream before the comments query finishes.
The comments endpoint is not called when comments are globally disabled or closed for the post.

### 3. Reduce public database I/O

**Status:** complete

- Public post detail explicitly selects only fields used by `PostDetailDto`.
- Public comment lookup selects only the post ID.
- Public comment rows select only ID, author name, body, parent ID, and timestamp.
- Token, submission, parent-validation, and moderation lookups use narrow projections.

Besides reducing row width and object allocation, the public comment path no longer reads email,
IP hash, user-agent, spam metadata, or multilingual post content into memory when it does not need
them.

### 4. Collapse settings-cache misses

**Status:** complete

Concurrent requests arriving when the 30-second in-process settings cache expires now share one
database promise. A version guard prevents an older in-flight read from repopulating the cache
after an admin update.

### 5. Bound ambient animation cost

**Status:** complete

The smoke canvas is capped at 30 fps, uses fewer particles on mobile, pauses in background tabs,
and reacts if reduced-motion preference changes. Decorative work remains delayed until after the
critical rendering window.

### 6. Correct locale font usage

**Status:** complete

Display and Japanese fonts use variable weights. Japanese body and heading variables are now
actually applied on `lang="ja"` pages. Font transfer must still be measured per locale because
Japanese fonts are split into Unicode-range files; the emitted build directory size is not equal
to browser transfer size.

## Ranked remaining plan

### Phase 1 — measure and make deployment failure explicit (P0)

1. Capture mobile Lighthouse for `/en`, `/vi`, `/ja`, `/en/blog`, and one article on the deployed
   URL; run three times and record the median plus p75 CrUX/RUM when enough traffic exists.
2. Emit Server-Timing for Next-to-API duration and Prisma query duration. Add request IDs across
   Next, Nest, and ALB/CloudWatch logs.
3. Add a small Web Vitals sink for LCP, INP, CLS, and TTFB, sampled in production.
4. Decide the production-build data policy. Today, an unreachable API logs repeated `ECONNREFUSED`
   errors but still produces an SSG portfolio containing the unavailable-content fallback. Choose
   one explicit mode:
   - recommended: fail the deployment build when required portfolio data is unavailable;
   - alternative: make API-backed portfolio routes runtime-rendered so deploys do not depend on API
     availability.
5. Run cold/warm API load tests from the same AWS region as the web runtime; retain p50/p95/p99,
   error rate, and RDS connection counts.

**Exit criteria:** evidence table populated; no deployment can silently publish a fallback home
page; request traces identify time spent in edge, Next, API, and database.

### Phase 2 — cache and freshness contracts (P1)

1. Replace one-request-per-tag revalidation with one authenticated request containing a validated
   tag array. Retry failed invalidations with bounded backoff or a durable queue if CMS freshness is
   operationally important.
2. Give every public resource an explicit owner, TTL, tag, invalidation event, and stale-data
   tolerance. Keep admin reads `no-store`.
3. Stop regenerating the sitemap every minute while sequentially walking post pages. Add a lean
   API projection for all published slugs/`updatedAt`, cache the sitemap for 30-60 minutes, and
   invalidate it on publish/unpublish/delete.
4. Move view counting out of the cached `GET /blog/posts/:slug`. A cached server GET cannot represent
   page views accurately and creates a write on cache misses. Use a sampled/deduplicated event
   endpoint or analytics service.
5. If the API runs more than one process, move feature-setting coherence from per-process TTL alone
   to a shared cache/pub-sub invalidation mechanism.

**Exit criteria:** zero writes on cached public GETs; one revalidation call per mutation; sitemap
generation is one bounded API read.

### Phase 3 — browser main-thread and payload work (P1)

1. Profile the smoke, wave, scroll-note, audio visualizer, and theme transitions on a 4x CPU
   throttled mobile trace. Disable or simplify effects based on measured long tasks, not device-name
   guesses.
2. Convert the contact section shell to a server component and keep only copy controls/form state as
   client islands if this saves meaningful route JS.
3. Replace per-instance `IntersectionObserver` objects in scroll reveals with a shared observer or a
   CSS-first approach if traces show observer churn.
4. Lazy-load the admin Markdown preview/highlighter until preview is visible; target the 221 kB
   editor route without spending public-page complexity.
5. Verify actual font requests per locale. Subset or self-host only if transfer/late text rendering
   remains material after CDN caching.

**Exit criteria:** mobile INP p75 below 200 ms; no decorative animation produces recurring long
tasks; public route JS stays at or below the current baseline.

### Phase 4 — database and moderation scaling (P1/P2)

1. Capture `EXPLAIN (ANALYZE, BUFFERS)` for published-post pagination, tag filtering, approved
   comments, moderation queues, and dashboard counts using production-like row counts.
2. Replace application-side tag aggregation with a PostgreSQL `unnest`/group query if post volume
   makes it visible in traces.
3. Cache compiled blocklist rules briefly and invalidate on blocklist mutations; avoid loading every
   rule for every comment submission.
4. Replace sequential bulk moderation (one transaction and revalidation sequence per ID) with a
   single bounded transaction and per-post count deltas.
5. Add cursor pagination when offset-based admin/public lists become large enough for query plans to
   degrade.

**Exit criteria:** public DB query p95 below 50 ms at target scale; bulk moderation cost grows with
the batch, not with network revalidation per item.

### Phase 5 — delivery and resilience (P2)

1. Prefer same-site web/API routing where practical; it simplifies cookies and lets public API
   responses share edge compression/caching policy.
2. Confirm Brotli/gzip at CloudFront/ALB and immutable caching for hashed Next assets and media.
3. Add API readiness separate from liveness and include database connectivity with a strict timeout.
4. Set performance budgets in CI for route JS and run scheduled Lighthouse against staging rather
   than making local synthetic scores a merge blocker.

## Performance targets

Use these as release goals, measured at p75 unless noted:

| Metric | Target |
| --- | ---: |
| Mobile LCP | < 2.5 s |
| Mobile INP | < 200 ms |
| CLS | < 0.10 |
| Warm public TTFB in primary region | < 800 ms |
| Public API latency, p95 | < 200 ms |
| Public Prisma query latency, p95 | < 50 ms |
| Homepage First Load JS | <= 127 kB |
| Blog detail First Load JS | <= 122 kB |
| 5xx rate | < 0.1% |

## Verification commands

```bash
corepack pnpm --filter @jazz-portfolio/database db:generate
corepack pnpm --filter @jazz-portfolio/api lint
corepack pnpm --filter @jazz-portfolio/api type-check
corepack pnpm --filter @jazz-portfolio/api test -- --runInBand
corepack pnpm --filter @jazz-portfolio/api build
corepack pnpm --filter @jazz-portfolio/web lint
corepack pnpm --filter @jazz-portfolio/web type-check
corepack pnpm --filter @jazz-portfolio/web test -- --runInBand
corepack pnpm --filter @jazz-portfolio/web build
```

For runtime validation, run Lighthouse and load tests against staging with the API and database
available. A placeholder-API production build validates compilation and bundle shape, not real
TTFB/LCP or content correctness.
