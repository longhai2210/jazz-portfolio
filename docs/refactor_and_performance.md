# Refactor & Performance — Rationale and Best Practices

> How Jazz Portfolio was hardened for correctness and speed (phases 1–6), and the rules to keep when you change it again.
>
> **Measurement companion:** [perf-notes.md](./perf-notes.md)  
> **Architecture SoT:** [PROJECT_BIBLE.md](./PROJECT_BIBLE.md)

---

## 1. Context — what was wrong

Before the refactor, the app looked feature-complete but had structural debt that hurt both CMS reliability and public-page performance:

| Symptom | Root cause |
|---|---|
| Admin create/update/reorder often failed silently | UI called invented paths (`/admin/categories`) while Nest exposed `/categories/admin/...`; field names drifted (`presignedUrl` vs `uploadUrl`) |
| Homepage felt slow on first paint | Layout and page both fetched `/profile`; three sequential API awaits; mocks lived inside the page module |
| Heavy JS on every visitor | Music player, playlist fetcher, and canvas smoke imported eagerly into the portfolio shell |
| Stale or wrong admin data risk | One `ApiClient.get` always set `next: { revalidate: 60 }`, including authenticated GETs |
| Extra DB work on hot paths | Settings `upsert` on every public read; JWT `validate` hit the DB; public playlist returned `s3Key`; unbounded contact lists |
| XSS-readable admin session | JWT persisted in `localStorage` via Zustand |
| CI could not catch build breakage | Pipeline ran lint + type-check only |

The work shipped as six reviewable phases: **correctness first**, then SSR/data, client assets, admin structure, backend/auth, then quality gates.

```
Contracts → Public SSR → Client JS → Admin TQ → Backend/Auth → CI/SEO
```

---

## 2. Principles we optimized for

1. **Correctness before speed** — Broken CMS writes are worse than a 50ms slower homepage. Align contracts before micro-optimizing.
2. **Public cache ≠ admin cache** — ISR and Data Cache are for anonymous portfolio reads. Authenticated CMS traffic must be `no-store`.
3. **Nest controllers are the route source of truth** — The web app consumes shared path builders; it does not invent URLs.
4. **Trust boundaries for auth** — Tokens the browser JS can read are tokens an XSS payload can steal. Prefer httpOnly cookies.
5. **Measure what you change** — Bundle sizes, cache tags, and Lighthouse after deploy beat guessing. See [perf-notes.md](./perf-notes.md).

---

## 3. Themes

Each theme: **Problem → Thinking → What we did → Best practice**.

### 3.1 API contracts (`ApiRoutes`)

**Problem.** Admin mutations mostly failed. Nest used resource-prefixed routes (`/categories/admin/create`, `/music/admin/:id`, `/profile/admin/update`). The UI used flat `/admin/...` paths and mismatched bodies (`oldPassword`, `{ targetSortOrder }`, `presignedUrl`).

**Thinking.** In a monorepo, “the frontend knows the API” is not enough unless the knowledge is **shared code**. String literals in pages drift the moment a controller is renamed. Nest remains SoT for HTTP shape; shared helpers are the adapter the web must use.

**What we did.** Added [`packages/shared/src/api-routes.ts`](../packages/shared/src/api-routes.ts) with path builders plus request/response types (`PresignUploadResponse.uploadUrl`, `ChangePasswordRequest.currentPassword`, `ReorderRequest.ids`). Admin pages import `ApiRoutes`. Declared Nest `admin/*` routes **before** `@Get(':slug')` so `"admin"` is never captured as a slug.

**Best practice.**

- Add or change a route in Nest first, then update `ApiRoutes`, then call sites.
- Prefer typed helpers over raw `'/whatever'` strings for admin ops.
- Never put parameterized routes ahead of static siblings (`:slug` before `admin/all`).

---

### 3.2 Public vs admin fetch clients

**Problem.** A single `ApiClient.get` applied `next: { revalidate: 60 }` to every GET. That is useful for public portfolio ISR and dangerous for admin reads (stale CMS data for up to a minute).

**Thinking.** Next.js `fetch` cache options are part of the **product contract**, not an implementation detail. Public and admin have opposite needs: cache aggressively vs never cache.

**What we did.**

| Client | File | Behavior |
|---|---|---|
| `ServerPublicApiClient` | [`apps/web/src/lib/api-public-server.ts`](../apps/web/src/lib/api-public-server.ts) | RSC/ISR `revalidate` + cache tags; optional private API origin |
| `PublicApiClient` | [`apps/web/src/lib/api-public.ts`](../apps/web/src/lib/api-public.ts) | Live browser requests with `cache: 'no-store'` |
| `AdminApiClient` | [`apps/web/src/lib/api-admin.ts`](../apps/web/src/lib/api-admin.ts) | `cache: 'no-store'`, `credentials: 'include'` |

**Best practice.**

- Keep cached RSC reads, live browser reads, and credentialed admin calls in separate clients.
- Configure `API_INTERNAL_URL` when the Next runtime can reach Nest over a private network.
- If you add a new public GET, assign a cache tag and document how to invalidate it.

---

### 3.3 RSC data layer (`cache` + `Promise.all`)

**Problem.** `(portfolio)/layout.tsx` and `page.tsx` each called `/profile`. Homepage awaited profile, then categories, then settings — three round trips in series. Large `MOCK_*` objects lived in the page module.

**Thinking.** In the App Router, layout and page can share work within a request if you wrap loaders in React `cache()`. Independent network calls should start together. Dev fallbacks should not bloat production modules.

**What we did.** [`apps/web/src/lib/portfolio-data.ts`](../apps/web/src/lib/portfolio-data.ts) exports `getProfile`, `getCategories`, `getPublicSettings` (and music) via `cache()`. Homepage uses `Promise.all`. Mocks live under [`apps/web/src/lib/mocks/`](../apps/web/src/lib/mocks/) and are gated for local/dev fallbacks.

**Best practice.**

- One shared loader per resource; import it everywhere that needs that resource in the same render tree.
- Parallelize independent awaits; only serialize when B needs A’s result.
- Keep mock payloads out of hot production entry modules.

---

### 3.4 Cache tags and revalidation

**Problem.** With ISR, CMS edits would not show on the public site until the revalidate window expired — unless tags are invalidated deliberately.

**Thinking.** Time-based revalidation alone (`60s`) is a blunt instrument. Tag-based invalidation lets a save of “profile” refresh only profile-backed pages.

**What we did.** Public GETs are tagged: `profile`, `categories`, `settings`, `music`. Next route [`apps/web/src/app/api/revalidate/route.ts`](../apps/web/src/app/api/revalidate/route.ts) accepts `POST` with a secret and `{ "tag": "..." }`.

**Best practice.**

- After a successful admin mutation that changes public content, invalidate the matching tag (or document the manual step until automation is wired end-to-end).
- Ops details: [perf-notes.md](./perf-notes.md#revalidation-after-cms-edits).

---

### 3.5 Client JS and assets

**Problem.** Every portfolio visitor paid for MusicPlayer, PlaylistFetcher, and SmokeEffect up front. Large JPEGs and `preload="auto"` on audio competed with LCP. Framer Motion and `react-icons` pulled more than needed without package optimization.

**Thinking.** Route-level splitting already separates `/admin` from the portfolio. The remaining win is **within** the public shell: defer non-critical chrome until after first paint, and shrink media.

**What we did.**

- `next/dynamic(..., { ssr: false })` via [`MusicChrome`](../apps/web/src/components/music/MusicChrome.tsx) and lazy SmokeEffect in PortfolioShell.
- `optimizePackageImports` for `react-icons` / `framer-motion` in [`next.config.ts`](../apps/web/next.config.ts).
- `images.remotePatterns` for CloudFront; avatars/skills via `next/image`.
- Vinyl as WebP; audio `preload="metadata"`.

**Best practice.**

- Ask: “Does a first-time visitor need this before they scroll or unmute?” If no, dynamic-import it.
- Prefer `next/image` for remote CDN media; keep `remotePatterns` in sync with CloudFront.
- Do not eagerly preload full audio unless play is the primary CTA.

---

### 3.6 Admin data UI (TanStack Query)

**Problem.** Hundreds of lines of categories/settings in single files; manual `useEffect` fetch/mutate; dashboard loaded full category trees just to show counts; errors often only `console.error`.

**Thinking.** Server Components are ideal for the public portfolio. The admin CMS is highly interactive and mutation-heavy — a client cache with invalidation (TanStack Query) fits better than ad-hoc effects. Split UI by responsibility so forms and lists can evolve independently.

**What we did.**

- `@tanstack/react-query` provider under **admin layout only**.
- Hooks in [`apps/web/src/hooks/admin/`](../apps/web/src/hooks/admin/) (`useCategoriesAdmin`, `useTracksAdmin`, `useProfileAdmin`, `useContactInbox`, `useSettingsAdmin`, `useAdminStats`).
- Components under `components/admin/categories/` and settings forms.
- Nest `GET /api/admin/stats` with Prisma `_count` for the dashboard.
- Contact inbox uses paginated list + detail fetch; mutation errors surface in UI banners.

**Best practice.**

- Scope React Query to the CMS; do not force it onto RSC portfolio pages.
- Prefer a stats/count endpoint over shipping full graphs for dashboards.
- Always show mutation failures to the operator.

---

### 3.7 Backend query hygiene

**Problem.** Settings upserted on every public read (write amplification). Public `/music` returned internal `s3Key`. Contact/media lists were unbounded. No indexes on hot filters (`isActive`, `sortOrder`, soft-delete flags). JWT strategy queried `AdminUser` on every authenticated request.

**Thinking.** Small portfolios hide these costs until traffic or inbox size grows. Habits matter: **reads should not write**, **DTOs should not leak storage keys**, **lists should paginate**, **indexes match WHERE/ORDER BY**, **auth validation should not be a free DB round-trip** unless you need immediate revocation.

**What we did.** Indexes + migration; `select` on public music; paginated contact/media; settings seed-on-boot; JWT `validate` trusts signed payload (`sub`, `username`); contact email fire-and-forget after insert.

**Best practice.**

- Seed defaults at boot or migrate — never upsert on a public GET.
- Public responses: only fields the UI needs.
- Paginate any admin list that can grow (inbox, media log).
- If you need instant user revoke, use a short-lived denylist/cache — not a mandatory DB hit on every request by default.

---

### 3.8 Auth (httpOnly cookie)

**Problem.** JWT in Zustand `persist` → `localStorage` is readable by any XSS. Middleware cannot securely “own” a token that lives only on the API origin without a deliberate cookie design.

**Thinking.** For a single-admin CMS with Nest as the API host and Next as the UI host (cross-origin in local/prod), the API should **set** an httpOnly cookie on login. The browser sends it automatically with `credentials: 'include'`. Next middleware may use a non-secret UX marker cookie to avoid flashing login, but **authorization** remains Nest + `/auth/me`.

**What we did.**

| Cookie | Host | Purpose |
|---|---|---|
| `jazz_access_token` | API | httpOnly JWT (real auth) |
| `jazz_admin_session` | Next | Non-httpOnly UX marker for middleware gating |

Login/logout on Nest; JWT strategy accepts **cookie or Bearer**; CORS `credentials: true` + origin allowlist; `AdminApiClient` uses `credentials: 'include'` and no Bearer from JS storage.

**Best practice.**

- Set `COOKIE_SAME_SITE=none` + `COOKIE_SECURE=true` for cross-origin web→api; use `lax` only when same-site.
- Clear old `jazz-auth-storage` from browsers after deploy.
- Do not put the JWT in Zustand or `localStorage`.

---

### 3.9 Quality gates

**Problem.** Lint/type-check-only CI misses broken builds and empty test suites. SEO/share polish and error UI were unfinished relative to the original launch checklist.

**Thinking.** Gates should prove “this still ships”: compile, test, and basic SEO surfaces. Lighthouse scores belong on a real URL after deploy — document how, don’t invent numbers.

**What we did.** CI runs `lint` → `type-check` → `build` → `test`. Added robots/sitemap/OG, error/not-found boundaries, focused unit tests (`ApiRoutes`, cache options, health/stats). Wrote [perf-notes.md](./perf-notes.md) with build metrics and Lighthouse commands.

**Best practice.**

- Keep CI green as a merge bar, not a nice-to-have.
- After Amplify deploy, fill Lighthouse numbers into the perf-notes table.

---

## 4. Do / Don’t checklist

### Do

- [ ] Update `ApiRoutes` when Nest routes or DTO field names change
- [ ] Use `ServerPublicApiClient` + tags for RSC, `PublicApiClient` for live browser reads, and `AdminApiClient` + credentials for CMS
- [ ] Wrap shared RSC loaders in `cache()`; parallelize independent fetches
- [ ] Dynamic-import non-critical portfolio chrome (music, canvas)
- [ ] Invalidate the right cache tag after public-facing CMS writes
- [ ] Paginate admin lists; use `_count`/stats for dashboards
- [ ] Keep JWT in httpOnly cookies; configure CORS + SameSite for your deploy topology

### Don’t

- [ ] Invent `/admin/...` paths that do not exist on Nest
- [ ] Put `revalidate` / Data Cache on authenticated admin GETs
- [ ] Duplicate profile (or other) fetches in layout and page without `cache()`
- [ ] Store JWTs in `localStorage` or Zustand persist
- [ ] Upsert or “ensure row” on every public read
- [ ] Return S3 keys or other internal fields on public DTOs
- [ ] Merge performance refactors with unrelated design rewrites in one PR when you can avoid it

---

## 5. Code pointers

| Concern | Where to look |
|---|---|
| Shared paths & reorder helpers | [`packages/shared/src/api-routes.ts`](../packages/shared/src/api-routes.ts) |
| Public / admin HTTP | [`apps/web/src/lib/api-public-server.ts`](../apps/web/src/lib/api-public-server.ts), [`api-public.ts`](../apps/web/src/lib/api-public.ts), [`api-admin.ts`](../apps/web/src/lib/api-admin.ts) |
| RSC loaders | [`apps/web/src/lib/portfolio-data.ts`](../apps/web/src/lib/portfolio-data.ts) |
| Revalidate API | [`apps/web/src/app/api/revalidate/route.ts`](../apps/web/src/app/api/revalidate/route.ts) |
| Music chrome lazy load | [`apps/web/src/components/music/MusicChrome.tsx`](../apps/web/src/components/music/MusicChrome.tsx) |
| Admin hooks | [`apps/web/src/hooks/admin/`](../apps/web/src/hooks/admin/) |
| Auth cookie helpers | [`apps/api/src/auth/auth-cookie.ts`](../apps/api/src/auth/auth-cookie.ts) |
| JWT strategy | [`apps/api/src/auth/strategies/jwt.strategy.ts`](../apps/api/src/auth/strategies/jwt.strategy.ts) |
| Prisma indexes | [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma) |
| Measure & revalidate ops | [perf-notes.md](./perf-notes.md) |

---

## Related reading

- [PROJECT_BIBLE.md](./PROJECT_BIBLE.md) — architecture SoT (auth, env, CI updated for this work)
- [backend_development_mastery.md](./backend_development_mastery.md) — Nest patterns (modules, pipes, uploads)
- [database_design_deepdive.md](./database_design_deepdive.md) — schema thinking
- [implementation_plan.md](./implementation_plan.md) — original phased build plan (historical)
