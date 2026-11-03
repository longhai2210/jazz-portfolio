# Building Jazz Portfolio with TypeORM — Senior Developer's Complete Walkthrough

> How a senior NestJS/TypeORM developer would build this exact system from an empty directory to production.
> Every design decision explained. Every command shown. Every pattern production-proven.

---

## Table of Contents

1. [System Analysis & Requirements](#1-system-analysis--requirements)
2. [Database Design Reasoning](#2-database-design-reasoning)
3. [Database Normalization — Three Steps](#3-database-normalization--three-steps)
4. [Project Bootstrap](#4-project-bootstrap)
5. [DataSource Configuration](#5-datasource-configuration)
6. [Entity Implementation](#6-entity-implementation)
7. [Migration Workflow](#7-migration-workflow)
8. [Indexes & Performance Tuning](#8-indexes--performance-tuning)
9. [Seeding Strategy](#9-seeding-strategy)
10. [NestJS Module Architecture](#10-nestjs-module-architecture)
11. [Service Layer Implementation](#11-service-layer-implementation)
12. [Transaction Patterns in Practice](#12-transaction-patterns-in-practice)
13. [Pagination & Query Patterns](#13-pagination--query-patterns)
14. [Soft Delete Strategy](#14-soft-delete-strategy)
15. [Caching & In-Memory Settings](#15-caching--in-memory-settings)
16. [Error Handling Strategy](#16-error-handling-strategy)
17. [Testing Setup](#17-testing-setup)
18. [Production Deployment](#18-production-deployment)
19. [Full File Tree](#19-full-file-tree)

---

## 1. System Analysis & Requirements

Before writing a single line of code, a senior developer maps every business entity and its relationships. Here's what the jazz-portfolio system requires:

### Domain Entities

| Entity | Purpose | Key Behavior |
| --- | --- | --- |
| **AdminUser** | CMS authentication | Password hashing, JWT auth |
| **Profile** | Owner's portfolio info | Singleton row, i18n JSON fields |
| **Category** | Resume sections (Skills, Experience, Education) | Tree-like with ordered items, soft delete |
| **CategoryItem** | Individual items within a category | Belongs to category, ordered, soft delete |
| **Track** | Music player tracks | S3/CloudFront URLs, ordered |
| **Media** | Uploaded files (images, PDFs) | S3 storage metadata |
| **SiteSettings** | Global feature flags & config | Singleton row, cached in-process |
| **Post** | Blog articles | i18n JSON, tags array, soft delete, status workflow |
| **Comment** | Blog comments | Self-referencing (threaded), spam detection, moderation |
| **CommentBlocklist** | Spam filter rules | IP/email/keyword blocking |
| **ContactSubmission** | Contact form messages | Read/unread status |

### Cross-Cutting Concerns

- **Internationalization (i18n)**: Title/content stored as `{ en, vi, ja }` JSON objects
- **Soft Delete**: `isDeleted` flag on most entities (not hard delete)
- **Ordering**: `sortOrder` integer for drag-and-drop reordering
- **Audit Timestamps**: `createdAt` + `updatedAt` on every table

---

## 2. Database Design Reasoning

### Why PostgreSQL?

A senior developer chooses PostgreSQL for this system because:

1. **JSONB support** — i18n content stored as typed JSON, queryable with `->>`
2. **Array columns** — `tags` on posts stored as `text[]`, queryable with `ANY()`
3. **GIN indexes** — Full-text search and array containment queries
4. **UUID generation** — `gen_random_uuid()` built-in, no extension needed (PG 13+)
5. **Robust** — Battle-tested for CMS workloads with complex queries

### Design Decisions

#### Decision 1: JSON vs Separate Translation Tables

```
❌ Option A: Translation table (normalized)
   posts → post_translations(post_id, locale, title, excerpt, content)
   Problem: Every read requires JOIN. 3 locales = 3 rows per post.
   Query: SELECT * FROM posts JOIN post_translations ON ...
   This is overkill for 3 fixed locales.

✅ Option B: JSONB columns (denormalized)
   posts.title = {"en": "Hello", "vi": "Xin chào", "ja": "こんにちは"}
   Benefit: Single row read. No JOINs. Simple updates.
   Tradeoff: Can't add locales without schema knowledge.
   Verdict: Perfect for a fixed set of 3 locales.
```

#### Decision 2: Tags as Array vs Join Table

```
❌ Option A: Join table
   posts → post_tags(post_id, tag_id) → tags(id, name)
   Problem: Over-engineered for free-form tags. Requires 2 JOINs.

✅ Option B: PostgreSQL text[] array
   posts.tags = {'jazz', 'nodejs', 'typescript'}
   Benefit: Simple queries. GIN index for fast containment checks.
   Tradeoff: No referential integrity on tag names (acceptable for tags).
```

#### Decision 3: Comment Threading

```
✅ Self-referencing table
   comments.parent_id → comments.id (nullable)
   Top-level comments: parent_id IS NULL
   Replies: parent_id = parent comment's id
   Benefit: Single table. Simple queries. CASCADE delete.
```

#### Decision 4: Soft Delete vs Hard Delete

```
✅ Boolean flag: is_deleted = true/false
   Why: Audit trail. Recovery possible. No data loss.
   Every query adds WHERE is_deleted = false.
   Alternative: @DeleteDateColumn — TypeORM built-in, but we use
   manual boolean to match the existing Prisma pattern exactly.
```

#### Decision 5: Settings as Singleton Row

```
✅ Single row with fixed ID
   site_settings.id = 'default' (known constant)
   Why: Simple. No need for key-value table complexity.
   All settings read in one query. Cached in-process with TTL.
```

---

## 3. Database Normalization — Three Steps

### Step 1: First Normal Form (1NF)

> Every column contains atomic (indivisible) values. No repeating groups.

**Before (violating 1NF):**
```
posts table:
| id | title | tags          | author_name | author_email |
| 1  | Hello | jazz,nodejs   | Long Hai    | hai@mail.com |
```

**Problems:**
- `tags` contains a comma-separated list (not atomic)
- `author_name` and `author_email` are repeated across posts

**After (1NF compliant):**
```
posts table:
| id | title | tags (text[])          |  ← PostgreSQL array = atomic in PG
| 1  | Hello | {jazz,nodejs}          |

Note: In PostgreSQL, an array column IS 1NF-compliant because the DB
engine treats it as a first-class type with indexing and querying support.
For strict relational purists, you'd use a join table — but PG arrays
are the pragmatic production choice for free-form tags.
```

### Step 2: Second Normal Form (2NF)

> Every non-key column depends on the ENTIRE primary key (no partial dependencies).

**Before (violating 2NF):**
```
category_items table:
| category_id | item_id | item_title | category_name | category_slug |
```

**Problem:** `category_name` and `category_slug` depend only on `category_id`, not on the full composite key `(category_id, item_id)`. This is a partial dependency.

**After (2NF compliant) — Separate into two tables:**
```
categories:
| id (PK) | name | slug |

category_items:
| id (PK) | category_id (FK) | title | sort_order |
```

**Every non-key column in `category_items` depends on the whole PK (`id`).**

### Step 3: Third Normal Form (3NF)

> No transitive dependencies — non-key columns don't depend on other non-key columns.

**Before (violating 3NF):**
```
comments table:
| id | post_id | post_slug | post_title | author_name | body |
```

**Problem:** `post_slug` and `post_title` depend on `post_id`, not on the comment's PK. This is a transitive dependency: `comment.id → post_id → post_slug`.

**After (3NF compliant):**
```
comments:
| id (PK) | post_id (FK) | author_name | body |

posts:
| id (PK) | slug | title |
```

**Access post data through the FK relationship, never duplicate it.**

### Final Normalized Schema Diagram

```
┌──────────────┐     ┌──────────────────┐
│ admin_users  │     │ profiles         │
│──────────────│     │──────────────────│
│ id (PK)      │     │ id (PK)          │
│ username (UQ)│     │ name (jsonb)     │
│ password_hash│     │ title (jsonb)    │
│ created_at   │     │ bio (jsonb)      │
│ updated_at   │     │ social_links     │
└──────────────┘     └──────────────────┘

┌──────────────┐     ┌──────────────────┐
│ categories   │───┐ │ site_settings    │
│──────────────│   │ │──────────────────│
│ id (PK)      │   │ │ id (PK)          │
│ name (jsonb) │   │ │ is_blog_enabled  │
│ slug (UQ)    │   │ │ are_comments_on  │
│ type         │   │ │ mail_provider    │
│ sort_order   │   │ │ ... (15+ flags)  │
│ is_active    │   │ └──────────────────┘
│ is_deleted   │   │
└──────────────┘   │ ┌──────────────────┐
                   └─│ category_items   │
                     │──────────────────│
                     │ id (PK)          │
                     │ category_id (FK) │──→ categories.id
                     │ title (jsonb)    │
                     │ metadata (jsonb) │
                     │ sort_order       │
                     │ is_active        │
                     │ is_deleted       │
                     └──────────────────┘

┌──────────────┐     ┌──────────────────┐
│ posts        │───┐ │ comment_blocklist│
│──────────────│   │ │──────────────────│
│ id (PK)      │   │ │ id (PK)          │
│ slug (UQ)    │   │ │ type             │
│ title (jsonb)│   │ │ value            │
│ content(json)│   │ │ @@unique(type,   │
│ tags (text[])│   │ │   value)         │
│ status       │   │ └──────────────────┘
│ comment_count│   │
│ view_count   │   │ ┌──────────────────┐
│ published_at │   └─│ comments         │
│ is_deleted   │     │──────────────────│
└──────────────┘     │ id (PK)          │
                     │ post_id (FK)     │──→ posts.id (CASCADE)
                     │ parent_id (FK)   │──→ comments.id (CASCADE, self-ref)
                     │ author_name      │
                     │ body             │
                     │ status           │
                     │ spam_score       │
                     │ ip_hash          │
                     │ is_deleted       │
                     └──────────────────┘

┌──────────────┐     ┌──────────────────────┐
│ tracks       │     │ contact_submissions   │
│──────────────│     │──────────────────────│
│ id (PK)      │     │ id (PK)              │
│ title        │     │ sender_name          │
│ artist       │     │ sender_email         │
│ s3_key       │     │ subject              │
│ cloudfront_  │     │ message_body         │
│   url        │     │ is_read              │
│ sort_order   │     └──────────────────────┘
│ is_active    │
└──────────────┘     ┌──────────────────┐
                     │ media            │
                     │──────────────────│
                     │ id (PK)          │
                     │ filename         │
                     │ s3_key           │
                     │ cloudfront_url   │
                     │ mime_type        │
                     │ file_size_bytes  │
                     │ context          │
                     └──────────────────┘
```

---

## 4. Project Bootstrap

### Step-by-Step Commands

```bash
# 1. Create project directory and initialize
mkdir -p packages/database
cd packages/database
npm init -y

# 2. Install TypeORM core dependencies
npm install typeorm reflect-metadata pg
npm install -D typescript ts-node @types/node tsx

# 3. Initialize TypeScript
npx tsc --init

# 4. Create project structure
mkdir -p src/entities src/migrations src/subscribers scripts
```

### tsconfig.json — Critical Settings

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "commonjs",
    "lib": ["ES2021"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "strictPropertyInitialization": false,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

> ⚠️ **Critical:** `emitDecoratorMetadata: true` and `experimentalDecorators: true` are **mandatory**. Without them, TypeORM decorators silently fail and entities have no columns.

> ⚠️ **Critical:** `strictPropertyInitialization: false` is required because entity properties are populated by TypeORM, not by constructors.

### package.json Scripts

```json
{
  "name": "@jazz-portfolio/database",
  "version": "1.0.0",
  "scripts": {
    "typeorm": "ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js",
    "migration:generate": "npm run typeorm -- migration:generate -d src/data-source.ts",
    "migration:create": "npm run typeorm -- migration:create",
    "migration:run": "npm run typeorm -- migration:run -d src/data-source.ts",
    "migration:revert": "npm run typeorm -- migration:revert -d src/data-source.ts",
    "migration:show": "npm run typeorm -- migration:show -d src/data-source.ts",
    "seed": "tsx scripts/seed.ts",
    "build": "tsc"
  }
}
```

---

## 5. DataSource Configuration

### `src/data-source.ts`

```typescript
import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';

// Import all entities
import { AdminUser } from './entities/admin-user.entity';
import { Profile } from './entities/profile.entity';
import { Category } from './entities/category.entity';
import { CategoryItem } from './entities/category-item.entity';
import { Track } from './entities/track.entity';
import { Media } from './entities/media.entity';
import { SiteSettings } from './entities/site-settings.entity';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { CommentBlocklist } from './entities/comment-blocklist.entity';
import { ContactSubmission } from './entities/contact-submission.entity';

export const entities = [
  AdminUser,
  Profile,
  Category,
  CategoryItem,
  Track,
  Media,
  SiteSettings,
  Post,
  Comment,
  CommentBlocklist,
  ContactSubmission,
];

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,

  // Entity registration
  entities,

  // Migration files
  migrations: [path.join(__dirname, 'migrations', '*{.ts,.js}')],

  // NEVER true in production — use migrations instead
  synchronize: false,

  // Logging configuration
  logging:
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn', 'migration']
      : ['query', 'error', 'warn', 'migration'],

  // Log queries slower than 1 second
  maxQueryExecutionTime: 1000,

  // Connection pool (PostgreSQL pg driver options)
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '5', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 30000, // Kill queries after 30s
  },

  // SSL for cloud databases
  ssl:
    process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Export the DataSource instance (used by CLI and seed scripts)
export const AppDataSource = new DataSource(dataSourceOptions);
```

### Why These Pool Settings?

```
max: 20   → Each NestJS worker can hold up to 20 connections.
            For most CMS workloads, 10-20 is sufficient.
            Rule of thumb: cores × 2 + effective_disk_count

min: 5    → Keep 5 warm connections to avoid cold-start latency.

idleTimeoutMillis: 30000
          → Release idle connections after 30s to free DB resources.

statement_timeout: 30000
          → Kill any query running longer than 30s.
            Prevents runaway queries from holding connections.
```

---

## 6. Entity Implementation

### Common Pattern: Base Entity

Before writing individual entities, create a reusable base:

```typescript
// src/entities/base.entity.ts
import { PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export abstract class BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### Entity 1: AdminUser

```typescript
// src/entities/admin-user.entity.ts
import { Entity, Column, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('admin_users')
@Unique(['username'])
export class AdminUser extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  username: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;
}
```

### Entity 2: Profile (Singleton)

```typescript
// src/entities/profile.entity.ts
import { Entity, Column, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

// No BaseEntity — Profile has custom timestamp pattern (no createdAt)
@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  name: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  title: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  introduction: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  bio: { en: string; vi: string; ja: string };

  @Column({ name: 'avatar_url', type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'background_url', type: 'varchar', nullable: true })
  backgroundUrl: string | null;

  @Column({ name: 'social_links', type: 'jsonb', default: () => "'{}'" })
  socialLinks: Record<string, string>;

  @Column({ name: 'contact_info', type: 'jsonb', default: () => "'{}'" })
  contactInfo: Record<string, string>;

  @Column({ name: 'is_music_enabled', type: 'boolean', default: true })
  isMusicEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### Entity 3 & 4: Category + CategoryItem (One-to-Many)

```typescript
// src/entities/category.entity.ts
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { CategoryItem } from './category-item.entity';

@Entity('categories')
@Index('idx_categories_deleted_active_sort', ['isDeleted', 'isActive', 'sortOrder'])
export class Category extends BaseEntity {
  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  name: { en: string; vi: string; ja: string };

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', length: 20, default: 'CUSTOM' })
  type: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  // Relation: Category has many items
  @OneToMany(() => CategoryItem, (item) => item.category, {
    cascade: true, // save/remove cascade
  })
  items: CategoryItem[];
}
```

```typescript
// src/entities/category-item.entity.ts
import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Category } from './category.entity';

@Entity('category_items')
@Index('idx_catitems_cat_del_active_sort', [
  'categoryId', 'isDeleted', 'isActive', 'sortOrder',
])
export class CategoryItem extends BaseEntity {
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  title: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  description: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, any>;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  // Relation: Item belongs to Category
  @ManyToOne(() => Category, (cat) => cat.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;
}
```

### Entity 5: Track

```typescript
// src/entities/track.entity.ts
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('tracks')
@Index('idx_tracks_active_sort', ['isActive', 'sortOrder'])
export class Track extends BaseEntity {
  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  artist: string;

  @Column({ name: 's3_key', type: 'varchar' })
  s3Key: string;

  @Column({ name: 'cloudfront_url', type: 'varchar' })
  cloudfrontUrl: string;

  @Column({ name: 'duration_seconds', type: 'int', default: 0 })
  durationSeconds: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;
}
```

### Entity 6: Media

```typescript
// src/entities/media.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('media')
@Index('idx_media_created', ['createdAt'])
export class Media {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  filename: string;

  @Column({ name: 's3_key', type: 'varchar' })
  s3Key: string;

  @Column({ name: 'cloudfront_url', type: 'varchar' })
  cloudfrontUrl: string;

  @Column({ name: 'mime_type', type: 'varchar' })
  mimeType: string;

  @Column({ name: 'file_size_bytes', type: 'int' })
  fileSizeBytes: number;

  @Column({ type: 'varchar', length: 20, default: 'GENERAL' })
  context: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
  // No updatedAt — media records are immutable once uploaded
}
```

### Entity 7: SiteSettings (Singleton)

```typescript
// src/entities/site-settings.entity.ts
import { Entity, Column, UpdateDateColumn, PrimaryColumn } from 'typeorm';

@Entity('site_settings')
export class SiteSettings {
  // Use a known constant PK, not auto-generated
  @PrimaryColumn({ type: 'varchar', default: 'default' })
  id: string;

  @Column({ name: 'is_contact_form_enabled', type: 'boolean', default: true })
  isContactFormEnabled: boolean;

  @Column({ name: 'mail_provider', type: 'varchar', default: 'resend' })
  mailProvider: string;

  @Column({ name: 'mail_from', type: 'varchar', default: '' })
  mailFrom: string;

  @Column({ name: 'mail_to', type: 'varchar', default: '' })
  mailTo: string;

  @Column({ name: 'is_blog_enabled', type: 'boolean', default: false })
  isBlogEnabled: boolean;

  @Column({ name: 'are_comments_enabled', type: 'boolean', default: false })
  areCommentsEnabled: boolean;

  @Column({ name: 'comment_moderation_mode', type: 'varchar', default: 'ALL' })
  commentModerationMode: string;

  @Column({ name: 'is_comment_captcha_enabled', type: 'boolean', default: false })
  isCommentCaptchaEnabled: boolean;

  @Column({ name: 'comment_auto_close_days', type: 'int', default: 0 })
  commentAutoCloseDays: number;

  @Column({ name: 'comment_max_per_post', type: 'int', default: 500 })
  commentMaxPerPost: number;

  @Column({ name: 'comment_spam_threshold', type: 'int', default: 60 })
  commentSpamThreshold: number;

  @Column({ name: 'comment_notify_email', type: 'boolean', default: true })
  commentNotifyEmail: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

### Entity 8: Post (The Most Complex)

```typescript
// src/entities/post.entity.ts
import { Entity, Column, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Comment } from './comment.entity';

@Entity('posts')
@Index('idx_posts_deleted_status_pub', ['isDeleted', 'status', 'publishedAt'])
@Index('idx_posts_status_pub', ['status', 'publishedAt'])
// GIN index on tags[] must be created in a raw migration — see Section 7
export class Post extends BaseEntity {
  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  title: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  excerpt: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  content: { en: string; vi: string; ja: string };

  @Column({ name: 'cover_image_url', type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'varchar', length: 20, default: 'DRAFT' })
  status: string;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column({ name: 'reading_minutes', type: 'int', default: 0 })
  readingMinutes: number;

  @Column({ name: 'are_comments_enabled', type: 'boolean', default: true })
  areCommentsEnabled: boolean;

  @Column({ name: 'comments_closed_at', type: 'timestamp', nullable: true })
  commentsClosedAt: Date | null;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount: number;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'published_at', type: 'timestamp', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  // Relation: Post has many comments
  @OneToMany(() => Comment, (comment) => comment.post, { cascade: true })
  comments: Comment[];
}
```

### Entity 9: Comment (Self-Referencing)

```typescript
// src/entities/comment.entity.ts
import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Post } from './post.entity';

@Entity('comments')
@Index('idx_comments_post_status_created', ['postId', 'status', 'createdAt'])
@Index('idx_comments_status_created', ['status', 'createdAt'])
@Index('idx_comments_iphash_created', ['ipHash', 'createdAt'])
@Index('idx_comments_contenthash', ['contentHash'])
export class Comment extends BaseEntity {
  @Column({ name: 'post_id', type: 'uuid' })
  postId: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @Column({ name: 'author_name', type: 'varchar', length: 60 })
  authorName: string;

  @Column({ name: 'author_email', type: 'varchar', length: 254 })
  authorEmail: string;

  @Column({ type: 'varchar', length: 2000 })
  body: string;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'spam_score', type: 'int', default: 0 })
  spamScore: number;

  @Column({ name: 'spam_reasons', type: 'jsonb', default: () => "'[]'" })
  spamReasons: any[];

  @Column({ name: 'ip_hash', type: 'varchar', length: 64 })
  ipHash: string;

  @Column({ name: 'user_agent', type: 'varchar', length: 400, default: '' })
  userAgent: string;

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash: string;

  @Column({ type: 'varchar', length: 5, default: 'en' })
  locale: string;

  @Column({ name: 'moderated_at', type: 'timestamp', nullable: true })
  moderatedAt: Date | null;

  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  // Relation: Comment belongs to Post
  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  // Self-referencing: Comment belongs to parent Comment
  @ManyToOne(() => Comment, (c) => c.replies, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment | null;

  // Self-referencing: Comment has many replies
  @OneToMany(() => Comment, (c) => c.parent)
  replies: Comment[];
}
```

### Entity 10: CommentBlocklist

```typescript
// src/entities/comment-blocklist.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

@Entity('comment_blocklist')
@Unique(['type', 'value']) // Compound unique constraint
@Index('idx_blocklist_type', ['type'])
export class CommentBlocklist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: string; // EMAIL | EMAIL_DOMAIN | IP_HASH | KEYWORD

  @Column({ type: 'varchar', length: 200 })
  value: string;

  @Column({ type: 'varchar', length: 200, default: '' })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
```

### Entity 11: ContactSubmission

```typescript
// src/entities/contact-submission.entity.ts
import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('contact_submissions')
@Index('idx_contact_read_created', ['isRead', 'createdAt'])
export class ContactSubmission extends BaseEntity {
  @Column({ name: 'sender_name', type: 'varchar', length: 100 })
  senderName: string;

  @Column({ name: 'sender_email', type: 'varchar', length: 254 })
  senderEmail: string;

  @Column({ type: 'varchar', length: 200 })
  subject: string;

  @Column({ name: 'message_body', type: 'varchar', length: 5000 })
  messageBody: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;
}
```

### Export All Entities

```typescript
// src/index.ts
export { AdminUser } from './entities/admin-user.entity';
export { Profile } from './entities/profile.entity';
export { Category } from './entities/category.entity';
export { CategoryItem } from './entities/category-item.entity';
export { Track } from './entities/track.entity';
export { Media } from './entities/media.entity';
export { SiteSettings } from './entities/site-settings.entity';
export { Post } from './entities/post.entity';
export { Comment } from './entities/comment.entity';
export { CommentBlocklist } from './entities/comment-blocklist.entity';
export { ContactSubmission } from './entities/contact-submission.entity';
export { AppDataSource, dataSourceOptions, entities } from './data-source';
```

---

## 7. Migration Workflow

### Step 1: Generate Initial Migration

```bash
# This compares entities to the (empty) database and generates SQL
npx typeorm migration:generate -d src/data-source.ts src/migrations/InitialSchema

# Output: Migration src/migrations/1700000000000-InitialSchema.ts has been generated
```

This auto-generates a migration like:

```typescript
// src/migrations/1700000000000-InitialSchema.ts
export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // TypeORM generates CREATE TABLE statements for all 11 entities
    await queryRunner.query(`
      CREATE TABLE "admin_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "username" varchar(50) NOT NULL,
        "password_hash" varchar(255) NOT NULL,
        CONSTRAINT "UQ_admin_users_username" UNIQUE ("username"),
        CONSTRAINT "PK_admin_users" PRIMARY KEY ("id")
      )
    `);

    // ... (TypeORM generates ALL tables, indexes, and FK constraints)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.query(`DROP TABLE "comment_blocklist"`);
    await queryRunner.query(`DROP TABLE "comments"`);
    await queryRunner.query(`DROP TABLE "posts"`);
    await queryRunner.query(`DROP TABLE "category_items"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    // ... etc
  }
}
```

### Step 2: Create Manual Migration for GIN Index

TypeORM **cannot** generate GIN indexes from decorators. Create a manual migration:

```bash
npx typeorm migration:create src/migrations/AddGinIndexes
```

```typescript
// src/migrations/1700000000001-AddGinIndexes.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGinIndexes1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // GIN index for fast tag containment queries
    await queryRunner.query(`
      CREATE INDEX idx_posts_tags_gin ON posts USING GIN (tags)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_posts_tags_gin`);
  }
}
```

### Step 3: Run Migrations

```bash
# Apply all pending migrations to your database
npx typeorm migration:run -d src/data-source.ts

# Check migration status
npx typeorm migration:show -d src/data-source.ts
# [X] InitialSchema1700000000000
# [X] AddGinIndexes1700000000001

# If you made a mistake, revert the last migration
npx typeorm migration:revert -d src/data-source.ts
```

### Adding Blog & Comments Later (Incremental Migration)

When you add the Post and Comment entities later in development:

```bash
# 1. Create the entities (post.entity.ts, comment.entity.ts)
# 2. Generate migration diff
npx typeorm migration:generate -d src/data-source.ts src/migrations/AddBlogComments

# 3. Review the generated SQL (always review before running!)
cat src/migrations/*-AddBlogComments.ts

# 4. If GIN index is needed, create a follow-up manual migration
npx typeorm migration:create src/migrations/AddPostTagsGin

# 5. Apply
npx typeorm migration:run -d src/data-source.ts
```

### Full Migration Commands Reference

```bash
# Development workflow
npx typeorm migration:generate -d src/data-source.ts src/migrations/DescriptiveName
npx typeorm migration:run -d src/data-source.ts

# Create empty migration for custom SQL
npx typeorm migration:create src/migrations/DescriptiveName

# Check status
npx typeorm migration:show -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts

# Production (use compiled JS)
npx typeorm migration:run -d dist/data-source.js

# ⚠️ NEVER use in production:
# synchronize: true  ← Can drop columns and data!
```

---

## 8. Indexes & Performance Tuning

### Index Strategy by Table

| Table | Index | Type | Purpose |
| --- | --- | --- | --- |
| `categories` | `(is_deleted, is_active, sort_order)` | B-tree | Public listing query |
| `category_items` | `(category_id, is_deleted, is_active, sort_order)` | B-tree | Items within category |
| `posts` | `(is_deleted, status, published_at DESC)` | B-tree | Admin listing (all states) |
| `posts` | `(status, published_at DESC)` | B-tree | Public listing (published only) |
| `posts` | `(tags)` | **GIN** | Tag containment: `WHERE :tag = ANY(tags)` |
| `posts` | `(slug)` | B-tree (unique) | Slug lookup |
| `comments` | `(post_id, status, created_at)` | B-tree | Comments per post |
| `comments` | `(status, created_at DESC)` | B-tree | Admin moderation queue |
| `comments` | `(ip_hash, created_at)` | B-tree | Rate limiting by IP |
| `comments` | `(content_hash)` | B-tree | Duplicate detection |
| `comment_blocklist` | `(type)` | B-tree | Blocklist lookup by type |
| `comment_blocklist` | `(type, value)` | Unique | Prevent duplicate rules |
| `contact_submissions` | `(is_read, created_at)` | B-tree | Unread messages listing |
| `tracks` | `(is_active, sort_order)` | B-tree | Active tracks listing |
| `media` | `(created_at)` | B-tree | Media gallery (recent first) |

### Index Design Rules

```
Rule 1: Index columns in the order they appear in WHERE clauses.
   WHERE is_deleted = false AND status = 'PUBLISHED'
   → Index: (is_deleted, status)

Rule 2: Put equality filters first, range filters last.
   WHERE status = 'PUBLISHED' AND published_at > '2024-01-01'
   → Index: (status, published_at)

Rule 3: Include ORDER BY column at the end if it follows WHERE columns.
   WHERE status = 'PUBLISHED' ORDER BY published_at DESC
   → Index: (status, published_at DESC)

Rule 4: Use GIN for array containment (PostgreSQL).
   WHERE :tag = ANY(tags)
   → GIN index on tags column

Rule 5: Don't over-index. Each index slows writes.
   Only index columns used in WHERE, ORDER BY, and JOIN conditions.
```

---

## 9. Seeding Strategy

### `scripts/seed.ts`

```typescript
import 'reflect-metadata';
import { AppDataSource } from '../src/data-source';
import { AdminUser } from '../src/entities/admin-user.entity';
import { SiteSettings } from '../src/entities/site-settings.entity';
import { Category } from '../src/entities/category.entity';
import { CategoryItem } from '../src/entities/category-item.entity';
import * as bcrypt from 'bcrypt';

// Seed data constants (equivalent to Prisma's seed-data.ts)
const SEED_CATEGORIES = [
  { slug: 'skills', name: { en: 'Skills', vi: 'Kỹ năng', ja: 'スキル' }, type: 'SKILL', sortOrder: 0 },
  { slug: 'experience', name: { en: 'Experience', vi: 'Kinh nghiệm', ja: '経験' }, type: 'EXPERIENCE', sortOrder: 1 },
  { slug: 'education', name: { en: 'Education', vi: 'Học vấn', ja: '学歴' }, type: 'EDUCATION', sortOrder: 2 },
];

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding database...');

  const adminRepo = AppDataSource.getRepository(AdminUser);
  const settingsRepo = AppDataSource.getRepository(SiteSettings);
  const categoryRepo = AppDataSource.getRepository(Category);

  // 1. Seed admin user (idempotent with upsert)
  const passwordHash = await bcrypt.hash('admin123', 12);
  await adminRepo.upsert(
    { username: 'admin', passwordHash },
    { conflictPaths: ['username'] },
  );
  console.log('  ✓ Admin user seeded');

  // 2. Seed site settings singleton
  const existingSettings = await settingsRepo.findOneBy({ id: 'default' });
  if (!existingSettings) {
    await settingsRepo.save(
      settingsRepo.create({
        id: 'default',
        isContactFormEnabled: true,
        mailProvider: 'resend',
        isBlogEnabled: false,
        areCommentsEnabled: false,
      }),
    );
    console.log('  ✓ Site settings seeded');
  } else {
    console.log('  ⏩ Site settings already exist');
  }

  // 3. Seed categories (idempotent with upsert)
  for (const cat of SEED_CATEGORIES) {
    await categoryRepo.upsert(
      {
        slug: cat.slug,
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
        isActive: true,
        isDeleted: false,
      },
      { conflictPaths: ['slug'] },
    );
  }
  console.log('  ✓ Categories seeded');

  console.log('✅ Seeding complete!');
  await AppDataSource.destroy();
}

seed().catch((e) => {
  console.error('❌ Seeding failed:', e);
  process.exit(1);
});
```

```bash
# Run seed
npm run seed

# Or directly
npx tsx scripts/seed.ts
```

---

## 10. NestJS Module Architecture

### `app.module.ts` — Root Module

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities, dataSourceOptions } from '@jazz-portfolio/database';

// Feature modules
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { BlogModule } from './blog/blog.module';
import { CommentsModule } from './comments/comments.module';
import { SettingsModule } from './settings/settings.module';
import { StatsModule } from './stats/stats.module';
import { ContactModule } from './contact/contact.module';
import { MediaModule } from './media/media.module';
import { TracksModule } from './tracks/tracks.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM database connection
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...dataSourceOptions,
        url: config.get<string>('DATABASE_URL'),
        synchronize: false, // NEVER true in production
        logging:
          config.get('NODE_ENV') !== 'production'
            ? ['query', 'error']
            : ['error'],
      }),
    }),

    // Feature modules
    AuthModule,
    ProfileModule,
    CategoriesModule,
    BlogModule,
    CommentsModule,
    SettingsModule,
    StatsModule,
    ContactModule,
    MediaModule,
    TracksModule,
  ],
})
export class AppModule {}
```

### Feature Module Pattern

```typescript
// blog/blog.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '@jazz-portfolio/database';
import { BlogService } from './blog.service';
import { BlogPublicController } from './blog-public.controller';
import { BlogAdminController } from './blog-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post]), // Register Post entity for this module
  ],
  providers: [BlogService],
  controllers: [BlogPublicController, BlogAdminController],
  exports: [BlogService],
})
export class BlogModule {}
```

### Injection Pattern

```typescript
// blog/blog.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Post } from '@jazz-portfolio/database';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly dataSource: DataSource, // For transactions
  ) {}
}
```

### Key Difference from Prisma

```
Prisma:  One PrismaService → access ALL models via this.prisma.post, this.prisma.comment
TypeORM: One Repository per entity → inject separately where needed

# In Prisma:
constructor(private readonly prisma: PrismaService) {}
this.prisma.post.findMany(...)
this.prisma.comment.create(...)

# In TypeORM:
constructor(
  @InjectRepository(Post) private readonly postRepo: Repository<Post>,
  @InjectRepository(Comment) private readonly commentRepo: Repository<Comment>,
) {}
this.postRepo.find(...)
this.commentRepo.save(...)
```

---

## 11. Service Layer Implementation

### Blog Service (TypeORM equivalent)

```typescript
// blog/blog.service.ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '@jazz-portfolio/database';
import { normalizePagination, paginatedResponse } from '../common/pagination';
import { ensureUniqueSlug, estimateReadingMinutes } from './slug.util';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    private readonly revalidationService: RevalidationService,
  ) {}

  // === Public Methods ===

  async getPublicPosts(rawPage = 1, rawLimit = 10, tag?: string) {
    const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

    // Build query dynamically
    const qb = this.postRepository
      .createQueryBuilder('post')
      .select([
        'post.id',
        'post.slug',
        'post.title',
        'post.excerpt',
        'post.coverImageUrl',
        'post.tags',
        'post.readingMinutes',
        'post.commentCount',
        'post.publishedAt',
      ])
      .where('post.isDeleted = false')
      .andWhere('post.status = :status', { status: 'PUBLISHED' });

    // Tag filter using PostgreSQL array contains
    if (tag) {
      qb.andWhere(':tag = ANY(post.tags)', { tag });
    }

    const [rows, total] = await qb
      .orderBy('post.publishedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return paginatedResponse(rows, total, page, limit);
  }

  async getPublicPostBySlug(slug: string) {
    const post = await this.postRepository.findOne({
      where: { slug, isDeleted: false, status: 'PUBLISHED' },
    });

    if (!post) {
      throw new NotFoundException(`Post with slug "${slug}" not found`);
    }

    // Fire-and-forget view count increment
    void this.postRepository
      .increment({ id: post.id }, 'viewCount', 1)
      .catch(() => {});

    return post;
  }

  async getPublicTags(): Promise<{ tag: string; count: number }[]> {
    const rows = await this.postRepository.find({
      where: { isDeleted: false, status: 'PUBLISHED' },
      select: ['tags'],
    });

    const frequencyMap = new Map<string, number>();
    for (const r of rows) {
      for (const tag of r.tags) {
        frequencyMap.set(tag, (frequencyMap.get(tag) || 0) + 1);
      }
    }

    return Array.from(frequencyMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  // === Admin Methods ===

  async getAdminPosts(rawPage = 1, rawLimit = 20, status?: string, includeDeleted = false) {
    const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

    const where: any = {};
    if (!includeDeleted) where.isDeleted = false;
    if (status && status !== 'ALL') where.status = status;

    const [rows, total] = await this.postRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return paginatedResponse(rows, total, page, limit);
  }

  async createPost(dto: CreatePostDto) {
    const uniqueSlug = await ensureUniqueSlug(this.postRepository, dto.slug);
    const readingMinutes = estimateReadingMinutes(dto.content);

    const status = dto.status || 'DRAFT';
    const publishedAt = status === 'PUBLISHED' ? new Date() : null;

    const post = this.postRepository.create({
      slug: uniqueSlug,
      title: dto.title,
      excerpt: dto.excerpt,
      content: dto.content,
      coverImageUrl: dto.coverImageUrl || null,
      tags: dto.tags || [],
      status,
      readingMinutes,
      areCommentsEnabled: dto.areCommentsEnabled ?? true,
      publishedAt,
    });

    const saved = await this.postRepository.save(post);

    if (status === 'PUBLISHED') {
      void this.revalidationService.purge(['posts']);
    }

    return saved;
  }

  async updatePost(id: string, dto: UpdatePostDto) {
    const existing = await this.postRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`Post "${id}" not found`);

    // Merge changes into entity
    if (dto.slug && dto.slug !== existing.slug) {
      existing.slug = await ensureUniqueSlug(this.postRepository, dto.slug, id);
    }
    if (dto.title !== undefined) existing.title = dto.title;
    if (dto.excerpt !== undefined) existing.excerpt = dto.excerpt;
    if (dto.content !== undefined) {
      existing.content = dto.content;
      existing.readingMinutes = estimateReadingMinutes(dto.content);
    }
    if (dto.coverImageUrl !== undefined) existing.coverImageUrl = dto.coverImageUrl;
    if (dto.tags !== undefined) existing.tags = dto.tags;
    if (dto.status !== undefined) {
      existing.status = dto.status;
      if (dto.status === 'PUBLISHED' && !existing.publishedAt) {
        existing.publishedAt = new Date();
      }
    }
    if (dto.areCommentsEnabled !== undefined) {
      existing.areCommentsEnabled = dto.areCommentsEnabled;
    }

    const saved = await this.postRepository.save(existing);

    if (existing.status === 'PUBLISHED' || saved.status === 'PUBLISHED') {
      void this.revalidationService.purge(['posts']);
    }

    return saved;
  }

  async deletePost(id: string) {
    const existing = await this.postRepository.findOneBy({ id });
    if (!existing) throw new NotFoundException(`Post "${id}" not found`);

    // Soft delete — just set the flag
    await this.postRepository.update(id, { isDeleted: true });

    if (existing.status === 'PUBLISHED') {
      void this.revalidationService.purge(['posts']);
    }

    return { success: true };
  }
}
```

### Slug Utility (TypeORM version)

```typescript
// blog/slug.util.ts
import { Repository } from 'typeorm';
import { Post } from '@jazz-portfolio/database';

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// TypeORM version — uses Repository instead of PrismaService
export async function ensureUniqueSlug(
  postRepository: Repository<Post>,
  baseSlug: string,
  currentPostId?: string,
): Promise<string> {
  const cleanBase = slugify(baseSlug) || 'post';
  let candidate = cleanBase;
  let counter = 2;

  while (true) {
    const qb = postRepository
      .createQueryBuilder('post')
      .where('post.slug = :slug', { slug: candidate })
      .andWhere('post.isDeleted = false');

    if (currentPostId) {
      qb.andWhere('post.id != :id', { id: currentPostId });
    }

    const existing = await qb.getOne();
    if (!existing) return candidate;

    candidate = `${cleanBase}-${counter}`;
    counter++;
  }
}
```

---

## 12. Transaction Patterns in Practice

### Pattern 1: Soft Delete Category with Children

```typescript
// categories/categories.service.ts
async softDeleteCategory(id: string) {
  const category = await this.categoryRepository.findOneBy({ id });
  if (!category || category.isDeleted) {
    throw new NotFoundException('Category not found');
  }

  // Transaction: delete children + parent atomically
  return this.dataSource.transaction(async (manager) => {
    await manager.update(CategoryItem, { categoryId: id }, { isDeleted: true });
    return manager.update(Category, { id }, { isDeleted: true });
  });
}
```

### Pattern 2: Reorder with Batch Update

```typescript
async reorderCategories(dto: ReorderDto) {
  // Transaction: all sort_order updates are atomic
  await this.dataSource.transaction(async (manager) => {
    for (let i = 0; i < dto.ids.length; i++) {
      await manager.update(Category, { id: dto.ids[i] }, { sortOrder: i });
    }
  });
  return { success: true };
}
```

### Pattern 3: Comment Moderation with Counter Update

```typescript
async moderateComment(id: string, newStatus: CommentStatus) {
  const existing = await this.commentRepository.findOne({
    where: { id },
    relations: { post: true },
  });

  if (!existing) throw new NotFoundException('Comment not found');

  const previousStatus = existing.status;

  return this.dataSource.transaction(async (manager) => {
    // Update comment status
    await manager.update(Comment, { id }, { status: newStatus });

    // Adjust post comment count based on status transition
    if (previousStatus !== 'APPROVED' && newStatus === 'APPROVED') {
      await manager.increment(Post, { id: existing.postId }, 'commentCount', 1);
    } else if (previousStatus === 'APPROVED' && newStatus !== 'APPROVED') {
      await manager.decrement(Post, { id: existing.postId }, 'commentCount', 1);
    }

    return manager.findOneBy(Comment, { id });
  });
}
```

---

## 13. Pagination & Query Patterns

### Reusable Pagination Helper

```typescript
// common/pagination.ts — Same as the Prisma version, works with any ORM
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export function normalizePagination(page?: number, limit?: number) {
  const safePage =
    Number.isFinite(page) && (page as number) > 0
      ? Math.floor(page as number)
      : DEFAULT_PAGE;
  const rawLimit =
    Number.isFinite(limit) && (limit as number) > 0
      ? Math.floor(limit as number)
      : DEFAULT_LIMIT;
  const safeLimit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (safePage - 1) * safeLimit;

  return { page: safePage, limit: safeLimit, skip };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
```

### TypeORM `findAndCount` vs Prisma `$transaction`

```typescript
// Prisma way: two queries in a transaction
const [rows, total] = await prisma.$transaction([
  prisma.post.findMany({ where, skip, take: limit }),
  prisma.post.count({ where }),
]);

// TypeORM way: single method that does both
const [rows, total] = await this.postRepository.findAndCount({
  where,
  order: { publishedAt: 'DESC' },
  skip,
  take: limit,
});
// ✅ Simpler API, same result
```

### QueryBuilder for Complex Filtering

```typescript
// Admin comments with post slug/title (relation partial select)
async getAdminComments(rawPage = 1, rawLimit = 20, status?: string, postId?: string) {
  const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

  const qb = this.commentRepository
    .createQueryBuilder('comment')
    .leftJoin('comment.post', 'post')
    .addSelect(['post.slug', 'post.title'])
    .where('comment.isDeleted = false');

  if (status && status !== 'ALL') {
    qb.andWhere('comment.status = :status', { status });
  }
  if (postId) {
    qb.andWhere('comment.postId = :postId', { postId });
  }

  const [rows, total] = await qb
    .orderBy('comment.createdAt', 'DESC')
    .skip(skip)
    .take(limit)
    .getManyAndCount();

  return paginatedResponse(rows, total, page, limit);
}
```

---

## 14. Soft Delete Strategy

### Manual Boolean Flag (Matching the Prisma Pattern)

```typescript
// Every query that reads data adds: WHERE is_deleted = false
const categories = await this.categoryRepository.find({
  where: { isDeleted: false, isActive: true },
  order: { sortOrder: 'ASC' },
});

// Delete = update the flag
await this.postRepository.update(id, { isDeleted: true });
```

### Alternative: TypeORM's Built-in `@DeleteDateColumn`

```typescript
// If you want TypeORM's built-in soft delete:
@Entity()
export class Post {
  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}

// Usage:
await this.postRepository.softDelete(id);  // Sets deleted_at = now()
await this.postRepository.restore(id);     // Sets deleted_at = null

// find() automatically excludes soft-deleted records
const posts = await this.postRepository.find();        // Only non-deleted
const all = await this.postRepository.find({ withDeleted: true }); // All
```

### Why We Use Manual Boolean

For this project, we use `isDeleted: boolean` instead of `@DeleteDateColumn` because:
1. **Prisma compatibility** — The existing schema uses boolean flags
2. **Explicit control** — Every query explicitly filters, no hidden behavior
3. **Simpler reasoning** — No need to remember `withDeleted: true` gotchas

---

## 15. Caching & In-Memory Settings

### Settings Service (TypeORM Version)

```typescript
@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly SETTINGS_ID = 'default';
  private cachedSettings: CachedSiteSettings | null = null;
  private cacheExpiresAt = 0;
  private readonly CACHE_TTL_MS = 30_000; // 30 seconds

  constructor(
    @InjectRepository(SiteSettings)
    private readonly settingsRepository: Repository<SiteSettings>,
  ) {}

  async onModuleInit() {
    await this.ensureSettingsSeeded();
  }

  private async ensureSettingsSeeded() {
    const existing = await this.settingsRepository.findOneBy({
      id: this.SETTINGS_ID,
    });
    if (existing) return;

    await this.settingsRepository.save(
      this.settingsRepository.create({
        id: this.SETTINGS_ID,
        isContactFormEnabled: true,
        mailProvider: 'resend',
      }),
    );
  }

  invalidateCache() {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
  }

  async getCachedSettings(): Promise<CachedSiteSettings> {
    const now = Date.now();
    if (this.cachedSettings && now < this.cacheExpiresAt) {
      return this.cachedSettings;
    }

    const row = await this.settingsRepository.findOneByOrFail({
      id: this.SETTINGS_ID,
    });

    this.cachedSettings = {
      isContactFormEnabled: row.isContactFormEnabled,
      isBlogEnabled: row.isBlogEnabled,
      areCommentsEnabled: row.areCommentsEnabled,
      commentModerationMode: row.commentModerationMode,
      isCommentCaptchaEnabled: row.isCommentCaptchaEnabled,
      commentAutoCloseDays: row.commentAutoCloseDays,
      commentMaxPerPost: row.commentMaxPerPost,
      commentSpamThreshold: row.commentSpamThreshold,
      commentNotifyEmail: row.commentNotifyEmail,
    };

    this.cacheExpiresAt = now + this.CACHE_TTL_MS;
    return this.cachedSettings;
  }

  async updateSettings(dto: UpdateSiteSettingsDto) {
    await this.settingsRepository.update(this.SETTINGS_ID, dto);
    this.invalidateCache(); // Force re-read on next access

    return this.settingsRepository.findOneByOrFail({ id: this.SETTINGS_ID });
  }
}
```

---

## 16. Error Handling Strategy

### TypeORM Exception Filter

```typescript
// common/filters/typeorm-exception.filter.ts
import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { QueryFailedError, EntityNotFoundError } from 'typeorm';

@Catch(QueryFailedError, EntityNotFoundError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError | EntityNotFoundError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof EntityNotFoundError) {
      return response.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Record not found',
      });
    }

    const pgError = exception as any;
    switch (pgError.code) {
      case '23505': // unique_violation
        return response.status(HttpStatus.CONFLICT).json({
          statusCode: HttpStatus.CONFLICT,
          message: 'A record with this value already exists',
          detail: pgError.detail,
        });

      case '23503': // foreign_key_violation
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Referenced record does not exist',
        });

      case '23502': // not_null_violation
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: `Missing required field: ${pgError.column}`,
        });

      case '22P02': // invalid_text_representation (bad UUID)
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Invalid ID format',
        });

      default:
        console.error('Unhandled database error:', pgError);
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Internal server error',
        });
    }
  }
}
```

### Register in `main.ts`

```typescript
// main.ts
import { TypeOrmExceptionFilter } from './common/filters/typeorm-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Register the TypeORM exception filter globally
  app.useGlobalFilters(new TypeOrmExceptionFilter());
  // ... rest of bootstrap
}
```

---

## 17. Testing Setup

### Unit Test with Mocked Repository

```typescript
// blog/blog.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '@jazz-portfolio/database';
import { BlogService } from './blog.service';

describe('BlogService', () => {
  let service: BlogService;
  let postRepo: jest.Mocked<Repository<Post>>;

  const mockPost: Partial<Post> = {
    id: 'uuid-1',
    slug: 'test-post',
    title: { en: 'Test', vi: '', ja: '' },
    status: 'PUBLISHED',
    tags: ['jazz'],
    isDeleted: false,
    publishedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        {
          provide: getRepositoryToken(Post),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneBy: jest.fn(),
            findAndCount: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            increment: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        // Mock other dependencies...
      ],
    }).compile();

    service = module.get(BlogService);
    postRepo = module.get(getRepositoryToken(Post));
  });

  it('should return paginated published posts', async () => {
    postRepo.findAndCount.mockResolvedValue([[mockPost as Post], 1]);

    const result = await service.getAdminPosts(1, 10, 'PUBLISHED');

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
```

---

## 18. Production Deployment

### Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY packages/database/package*.json ./packages/database/
RUN npm ci

# Build database package
COPY packages/database ./packages/database
RUN cd packages/database && npm run build

# Build API
COPY apps/api ./apps/api
RUN cd apps/api && npm run build

# --- Production image ---
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Run migrations then start server
CMD npx typeorm migration:run -d packages/database/dist/data-source.js \
    && node apps/api/dist/main.js
```

### CI/CD Pipeline

```bash
# 1. Build step
npm run build --workspace=packages/database
npm run build --workspace=apps/api

# 2. Migration step (before deploying new code)
npx typeorm migration:run -d dist/data-source.js

# 3. Deploy new code
# ... (container restart, blue-green deploy, etc.)
```

### Production Checklist

| Concern | What to Do |
| --- | --- |
| `synchronize` | **Always `false`** in production |
| Migrations | Run `migration:run` in CI/CD before deploy |
| Connection pool | `max: 20`, `min: 5`, tune based on load |
| Query timeout | `statement_timeout: 30000` (30s) |
| Logging | `['error', 'warn', 'migration']` only |
| SSL | `ssl: { rejectUnauthorized: false }` for cloud DBs |
| Health check | `SELECT 1` query in health endpoint |
| Graceful shutdown | `app.enableShutdownHooks()` in NestJS |

---

## 19. Full File Tree

```
packages/database/
├── src/
│   ├── entities/
│   │   ├── base.entity.ts             ← Shared PK + timestamps
│   │   ├── admin-user.entity.ts
│   │   ├── profile.entity.ts
│   │   ├── category.entity.ts
│   │   ├── category-item.entity.ts
│   │   ├── track.entity.ts
│   │   ├── media.entity.ts
│   │   ├── site-settings.entity.ts
│   │   ├── post.entity.ts
│   │   ├── comment.entity.ts
│   │   ├── comment-blocklist.entity.ts
│   │   └── contact-submission.entity.ts
│   ├── migrations/
│   │   ├── 1700000000000-InitialSchema.ts    ← Auto-generated
│   │   ├── 1700000000001-AddGinIndexes.ts    ← Manual (GIN index)
│   │   └── 1700000000002-AddBlogComments.ts  ← Incremental
│   ├── data-source.ts                 ← DataSource config
│   └── index.ts                       ← Re-exports
├── scripts/
│   └── seed.ts                        ← Idempotent seeding
├── package.json
└── tsconfig.json

apps/api/
├── src/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   └── auth.guard.ts
│   ├── blog/
│   │   ├── blog.module.ts             ← TypeOrmModule.forFeature([Post])
│   │   ├── blog.service.ts            ← @InjectRepository(Post)
│   │   ├── blog-public.controller.ts
│   │   ├── blog-admin.controller.ts
│   │   ├── slug.util.ts               ← Uses Repository<Post>
│   │   └── dto/
│   │       ├── create-post.dto.ts
│   │       └── update-post.dto.ts
│   ├── categories/
│   │   ├── categories.module.ts       ← TypeOrmModule.forFeature([Category, CategoryItem])
│   │   ├── categories.service.ts      ← DataSource for transactions
│   │   └── dto/
│   ├── comments/
│   │   ├── comments.module.ts         ← TypeOrmModule.forFeature([Comment, CommentBlocklist, Post])
│   │   ├── comments.service.ts        ← DataSource for counter updates
│   │   └── spam-shield.service.ts
│   ├── settings/
│   │   ├── settings.module.ts         ← TypeOrmModule.forFeature([SiteSettings])
│   │   └── settings.service.ts        ← In-process cache with TTL
│   ├── stats/
│   │   ├── stats.module.ts
│   │   └── stats.service.ts           ← Promise.all([repo.count(), ...])
│   ├── contact/
│   ├── media/
│   ├── tracks/
│   ├── profile/
│   ├── common/
│   │   ├── pagination.ts
│   │   ├── filters/
│   │   │   ├── http-exception.filter.ts
│   │   │   └── typeorm-exception.filter.ts
│   │   └── interceptors/
│   │       └── transform.interceptor.ts
│   ├── app.module.ts                  ← TypeOrmModule.forRootAsync()
│   └── main.ts                        ← import 'reflect-metadata'
├── package.json
└── tsconfig.json
```

---

## Complete Build Sequence — From Zero to Running

```bash
# 1. Bootstrap
mkdir jazz-portfolio && cd jazz-portfolio
npm init -y
npx tsc --init

# 2. Install all dependencies
npm install typeorm reflect-metadata pg @nestjs/typeorm
npm install @nestjs/common @nestjs/core @nestjs/config @nestjs/platform-express
npm install class-validator class-transformer helmet cookie-parser bcrypt
npm install -D typescript @types/node ts-node tsx @types/bcrypt

# 3. Create entities (all 11 files from Section 6)

# 4. Configure DataSource (Section 5)

# 5. Generate first migration
npx typeorm migration:generate -d src/data-source.ts src/migrations/InitialSchema

# 6. Create GIN index migration manually
npx typeorm migration:create src/migrations/AddGinIndexes
# (Edit the file to add CREATE INDEX ... USING GIN)

# 7. Start PostgreSQL and run migrations
docker run -d --name postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/jazz_portfolio"
createdb jazz_portfolio  # or: docker exec postgres createdb -U postgres jazz_portfolio
npx typeorm migration:run -d src/data-source.ts

# 8. Run seed
npx tsx scripts/seed.ts

# 9. Create NestJS modules (Section 10-11)

# 10. Start development server
npm run start:dev

# 11. Verify
curl http://localhost:3001/api/health
curl http://localhost:3001/api/categories
```

---

> **This document captures the complete thought process, design decisions, and implementation steps a senior TypeORM developer would follow to build the jazz-portfolio system from scratch.** Every pattern shown is production-proven and maps directly to the existing Prisma implementation.
