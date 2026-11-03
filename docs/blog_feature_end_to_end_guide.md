# 🎷 End-to-End Guide: Multilingual Blog Posts & Moderated Comments System

This master architectural document provides a complete, step-by-step guide for designing, building, testing, and deploying the **Blog Posts & Moderated Comments System** in Jazzfolio.

It covers everything from database schema design and Prisma migrations to NestJS backend APIs, security & anti-spam pipelines, Next.js 15 Server Components, and Admin CMS moderation tools.

---

## 📋 Table of Contents

1. [Architecture & System Overview](#1-architecture--system-overview)
2. [Database Design & Migrations](#2-database-design--migrations)
3. [Shared Contracts & Feature Flags](#3-shared-contracts--feature-flags)
4. [Backend API Development (NestJS)](#4-backend-api-development-nestjs)
5. [Anti-Spam Engine & Comment Security](#5-anti-spam-engine--comment-security)
6. [Public Frontend UI (Next.js 15 RSC & i18n)](#6-public-frontend-ui-nextjs-15-rsc--i18n)
7. [Public Comment System & Dwell-Time Gate](#7-public-comment-system--dwell-time-gate)
8. [Admin CMS & Split-Pane Moderation](#8-admin-cms--split-pane-moderation)
9. [Hardening, Security Tests & PII Protection](#9-hardening-security-tests--pii-protection)
10. [Staged Production Rollout & Operations](#10-staged-production-rollout--operations)

---

## 1. Architecture & System Overview

```
+-----------------------------------------------------------------------------------+
|                                 NEXT.JS 15 WEB APP                                |
|                                                                                   |
|  Public Blog (RSC)               Public Comments               Admin CMS (CSR)     |
|  - react-markdown + sanitize    - useCommentForm hook         - PostEditor (EN/VI/JA)|
|  - JSON-LD + RSS + Sitemap      - Dwell time & Honeypots      - Split-pane queue   |
+------------------------------------------+----------------------------------------+
                                           |
                              HTTP / REST  |  JWT / Session Cookie
                                           v
+-----------------------------------------------------------------------------------+
|                                  NESTJS 11 API                                    |
|                                                                                   |
|  FeatureFlagGuard  --->  BlogModule                --->  CommentsModule           |
|  - 30s TTL Cache         - Slugify + Diacritics            - HMAC Form Token        |
|                          - Lean Prisma Select              - 14-Layer Spam Shield   |
+------------------------------------------+----------------------------------------+
                                           |
                                Prisma ORM |
                                           v
+-----------------------------------------------------------------------------------+
|                                POSTGRESQL 16 DATABASE                             |
|                                                                                   |
|  - posts (GIN index on tags)   - comments (Tree parentId)   - comment_blocklists |
+-----------------------------------------------------------------------------------+
```

### Core Design Invariants
1. **Safety First (Zero Downtime / Feature Flagged)**: Both `isBlogEnabled` and `areCommentsEnabled` default to `false`. Every public endpoint returns `404` or `403` when disabled.
2. **Zero Client Markdown JS Overhead**: Blog post bodies are rendered on the server with `react-markdown` + `rehype-sanitize`. Zero markdown parser JS ships to browser client bundles.
3. **Strict PII Protection**: Public serializers **never** leak author emails, IP addresses, spam scores, or block reasons.
4. **14-Layer Anti-Spam Defense**: HMAC tokens, 5s dwell-time floor, hidden bot honeypots, Cloudflare Turnstile CAPTCHA, active blocklists, and heuristic scoring.

---

## 2. Database Design & Migrations

### 2.1 Prisma Models (`packages/database/prisma/schema.prisma`)

```prisma
enum PostStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum CommentStatus {
  PENDING
  APPROVED
  SPAM
  REJECTED
}

enum CommentModerationMode {
  ALL
  SPAM_ONLY
  CLOSED
  AUTO_APPROVE
}

enum BlocklistType {
  EMAIL
  EMAIL_DOMAIN
  IP_HASH
  KEYWORD
}

model Post {
  id                 String     @id @default(uuid())
  slug               String     @unique
  title              Json       // { en, vi, ja }
  excerpt            Json       // { en, vi, ja }
  content            Json       // { en, vi, ja }
  coverImageUrl      String?
  status             PostStatus @default(DRAFT)
  tags               String[]   @default([])
  readingMinutes     Int        @default(1)
  commentCount       Int        @default(0)
  viewCount          Int        @default(0)
  areCommentsEnabled Boolean    @default(true)
  commentsClosedAt   DateTime?
  publishedAt        DateTime?
  isDeleted          Boolean    @default(false)
  createdAt          DateTime   @default(now())
  updatedAt          DateTime   @updatedAt

  comments           Comment[]

  @@index([status, isDeleted, publishedAt(sort: Desc)])
  @@index([tags], type: Gin)
  @@map("posts")
}

model Comment {
  id          String        @id @default(uuid())
  postId      String
  parentId    String?
  authorName  String
  authorEmail String
  content     String        @db.Text
  ipAddress   String
  userAgent   String?
  status      CommentStatus @default(PENDING)
  spamScore   Int           @default(0)
  blockReason String?
  isDeleted   Boolean       @default(false)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  post        Post          @relation(fields: [postId], references: [id], onDelete: Cascade)
  parent      Comment?      @relation("CommentReplies", fields: [parentId], references: [id], onDelete: SetNull)
  replies     Comment[]     @relation("CommentReplies")

  @@index([postId, status, isDeleted, createdAt(sort: Asc)])
  @@index([authorEmail])
  @@index([ipAddress])
  @@map("comments")
}

model CommentBlocklist {
  id        String        @id @default(uuid())
  type      BlocklistType
  value     String
  pattern   String?
  isActive  Boolean       @default(true)
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt

  @@index([type, isActive])
  @@map("comment_blocklists")
}
```

### 2.2 Migration Execution & Verification Commands

```bash
# 1. Generate migration in database workspace
pnpm --filter @jazz-portfolio/database exec prisma migrate dev --name blog_comments_schema

# 2. Apply seed data
pnpm db:seed
```

---

## 3. Shared Contracts & Feature Flags

### 3.1 DTO Contracts (`packages/shared/src/types/index.ts`)

- `PostListItemDto`: Light representation for lists (omits heavy `content` JSONB body).
- `PostDetailDto`: Includes full multilingual `content` Markdown body.
- `PublicCommentDto`: Public comment shape (`id`, `authorName`, `content`, `parentId`, `createdAt`). Zero PII fields.
- `AdminCommentDto`: Includes `authorEmail`, `ipAddress`, `spamScore`, `blockReason`, `status`.

### 3.2 API Path Builders (`packages/shared/src/api-routes.ts`)

```typescript
export const ApiRoutes = {
  blog: {
    publicList: (q?: { page?: number; limit?: number; tag?: string }) => ...,
    publicBySlug: (slug: string) => `/blog/posts/${slug}`,
    submitComment: () => `/blog/comments`,
    commentToken: (slug: string) => `/blog/posts/${slug}/comment-token`,
    // Admin CRUD routes...
  },
  comments: {
    adminList: (q?: { page?: number; limit?: number; status?: string }) => ...,
    adminModerate: (id: string) => `/admin/comments/${id}/moderate`,
    adminBlocklist: () => `/admin/comments/blocklist`,
  },
};
```

### 3.3 NestJS Feature Flag Guard (`apps/api/src/common/feature-flag/`)

- `SettingsService.getCachedSettings()` retains feature configuration in memory with a **30-second TTL** and invalidates instantly when updated via Admin CMS.
- `@RequireFeature('blog' | 'comments' | 'contact', { notFoundWhenOff })`: Custom decorator checking settings flags. Returns `404` for public read routes and `403` for mutation endpoints when feature is off.

---

## 4. Backend API Development (NestJS)

### 4.1 Unicode Slug Generation with Diacritics Stripping (`slug.util.ts`)

```typescript
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Strips Vietnamese diacritical marks
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
```

### 4.2 Lean Prisma Queries

```typescript
// Explicit select prevents fetching large content JSONB on list requests
const posts = await this.prisma.post.findMany({
  where: { status: 'PUBLISHED', isDeleted: false },
  select: {
    id: true,
    slug: true,
    title: true,
    excerpt: true,
    coverImageUrl: true,
    tags: true,
    readingMinutes: true,
    commentCount: true,
    publishedAt: true,
  },
});
```

---

## 5. Anti-Spam Engine & Comment Security

### 5.1 HMAC Form Token (`token.util.ts`)
Generates 15-minute cryptographically signed tokens containing `postId` + `ipAddress` + `timestamp` using `crypto.createHmac('sha256', secret)`.

### 5.2 14-Layer Defense Pipeline (`spam-shield.service.ts`)

```
1. Feature Gate Check -> 2. Global Rate Limit -> 3. Validation Pipe -> 4. Dual Honeypots (_hp, _website)
-> 5. HMAC Token Verification -> 6. Dwell Time Floor (5s) -> 7. Turnstile CAPTCHA -> 8. Blocklist Matcher
-> 9. Content Sanitization -> 10. Duplicate Check -> 11. Heuristic Spam Scoring -> 12. Transactional Moderation Queue
```

---

## 6. Public Frontend UI (Next.js 15 RSC & i18n)

### 6.1 Server Component Markdown Renderer (`PostBody.tsx`)

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

const customSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    a: ['href', 'target', 'rel'],
  },
};

export default function PostBody({ content }: { content: string }) {
  return (
    <div className="prose prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeSanitize, customSanitizeSchema]]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

### 6.2 Microdata JSON-LD & Metadata (`blog/[slug]/page.tsx`)

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const post = await getPublicPostBySlug(params.slug);
  return {
    title: `${post.title.en} | Journal`,
    description: post.excerpt.en,
    openGraph: { images: post.coverImageUrl ? [post.coverImageUrl] : [] },
  };
}
```

---

## 7. Public Comment System & Dwell-Time Gate

### 7.1 Dwell-Time & Security Hook (`useCommentForm.ts`)

- **Credentials Memory**: Saves `authorName` and `authorEmail` in `localStorage`.
- **Dwell Time Gate**: Enforces a 5-second countdown timer on mount before enabling submit (`Please wait (3s)...`).
- **Optimistic Preview**: Submits comment and immediately renders a local translucent **"⏳ Awaiting Moderation"** badge in `CommentList`.

### 7.2 Color-Coded Initials Avatars (`CommentList.tsx`)

Generates deterministic avatar backgrounds based on string hash of the author's name (e.g., `Miles Davis` -> `MD`).

---

## 8. Admin CMS & Split-Pane Moderation

### 8.1 Split-Pane Inspector View (`/admin/comments`)

- **Left Queue Pane**: Filter by `PENDING`, `APPROVED`, `REJECTED`, `SPAM`, `ALL`.
- **Right Inspector Pane**: Full content inspection, author email, IP address, target post link, and automated `spamScore` risk bar.
- **One-Click Blocklist Shortcuts**: Instant buttons to `Block Email`, `Block Email Domain`, or `Block IP`.
- **Bulk Actions**: Select multiple comments and execute bulk `Approve`, `Reject`, or `Mark Spam`.

---

## 9. Hardening, Security Tests & PII Protection

### 9.1 Test Execution (`pnpm --filter @jazz-portfolio/api test`)

Includes dedicated unit test suites:
- `comments.service.spec.ts`: Test anti-spam pipeline & state transitions.
- `comments-security.spec.ts`: Automated regression assertions verifying zero PII leakage.

---

## 10. Staged Production Rollout & Operations

1. **Deploy Phase**: Deploy API & Web code with flags set to `false`.
2. **Phase A**: Turn on `isBlogEnabled = true`. Publish initial article. Verify RSS (`/blog/rss.xml`) & Sitemap.
3. **Phase B**: Turn on `areCommentsEnabled = true` with `commentModerationMode = ALL`.
4. **Phase C**: Soak for 1-2 weeks, tune blocklists, and evaluate `AUTO_APPROVE` mode.
