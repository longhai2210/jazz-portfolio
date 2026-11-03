# 🎷 Blog Posts & Moderated Comments System — Walkthrough & Operations Manual

This document details the architecture, configuration, security pipeline, and operational guidelines for the **Blog Posts & Moderated Comments System** in Jazzfolio.

---

## 1. Overview & Key Capabilities

- **Multilingual Publishing (`EN` / `VI` / `JA`)**: Create, draft, edit, and publish blog articles with diacritics-stripping slug generation (`Chào mừng` → `chao-mung`), automatic reading time estimation, tag categorization, and presigned S3 cover image uploads.
- **RSC Safe Markdown Rendering**: Rendered on the server with `react-markdown` + `remark-gfm` + `rehype-sanitize`. Zero client JS overhead for Markdown parsing. External links are automatically assigned `rel="nofollow ugc noopener noreferrer"`.
- **Feature Flag System**: Both `isBlogEnabled` and `areCommentsEnabled` flags default to `false`. Public read routes return `404` and write endpoints return `403` when disabled.
- **14-Layer Anti-Spam Pipeline**: Includes 15-minute HMAC form tokens, 5-second reading dwell-time floor, dual hidden honeypots, Cloudflare Turnstile CAPTCHA integration, active blocklisting (`KEYWORD`, `EMAIL`, `EMAIL_DOMAIN`, `IP_HASH`), and heuristic spam scoring.
- **Master-Detail Admin Moderation CMS**: Filterable queue by status (`PENDING`, `APPROVED`, `REJECTED`, `SPAM`, `ALL`), split-pane detail inspection, spam score breakdown, bulk actions, and one-click blocklist creation shortcuts.

---

## 2. Staged Production Rollout Strategy

To maintain maximum stability and eliminate spam risk during initial rollout, follow this 4-step deployment cadence:

```
Step 1: Deploy with flags = false
Step 2: Enable Blog flag -> Publish 1 test article -> Verify SEO & RSS
Step 3: Enable Comments flag in ALL moderation mode
Step 4: Soak for 1-2 weeks -> Monitor moderation queue -> Optionally switch to AUTO_APPROVE mode
```

### Rollout Timeline

| Phase | Action | Moderation Mode | Goal |
| :--- | :--- | :--- | :--- |
| **Day 1** | Enable `isBlogEnabled = true` | `areCommentsEnabled = false` | Verify blog list rendering, RSS 2.0 XML feed, and sitemap indexing. |
| **Day 2** | Enable `areCommentsEnabled = true` | `commentModerationMode = ALL` | Every comment submission enters the pending moderation queue for admin review. |
| **Week 1–2** | Monitoring & Blocklist Tuning | `ALL` | Review incoming submissions, tune keyword blocklists, and verify email privacy. |
| **Week 3+** | Automated Approval (Optional) | `AUTO_APPROVE` | Clean comments score 0 and pass shield -> auto-published. High-risk comments flagged for review. |

---

## 3. Environment Variables Configuration

### API Backend (`apps/api/.env`)

```env
# Comment Security Tokens (HMAC sha256 key, minimum 32 characters)
COMMENT_TOKEN_SECRET="jazzfolio-comment-token-secret-key-32-chars-min"

# Optional Cloudflare Turnstile CAPTCHA (Server Secret)
TURNSTILE_SECRET_KEY="0x4AAAAAA..."
```

### Next.js Web Frontend (`apps/web/.env`)

```env
# Optional Cloudflare Turnstile CAPTCHA (Public Site Key)
NEXT_PUBLIC_TURNSTILE_SITE_KEY="0x4AAAAAA..."
```

---

## 4. Operational Checklist & Verification Commands

To verify full system integrity before deploying updates:

```bash
# 1. Run all NestJS API unit and security regression test suites
pnpm --filter @jazz-portfolio/api test

# 2. Rebuild shared package contracts
pnpm --filter @jazz-portfolio/shared build

# 3. Execute TypeScript type-check on web application
pnpm --filter @jazz-portfolio/web type-check

# 4. Perform Next.js production build & static generation check
pnpm --filter @jazz-portfolio/web build
```
