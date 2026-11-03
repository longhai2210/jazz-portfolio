# Prisma — Complete Mastery Guide for Production Systems

> Everything you need to know to build, scale, and maintain production-grade systems with Prisma ORM.
> Real-world patterns drawn from the jazz-portfolio project.

---

Deep Prisma mastery covering 20 topics — all examples extracted from your real jazz-portfolio codebase:

Schema design (relations, indexes, GIN, cascades), complete Client API, include/select strategies, $transaction modes (batched, interactive, mapped), migrations workflow, idempotent seeding with upsert, generated types & Prisma.Validator, $queryRaw/$executeRaw, middleware & $extends client extensions, performance patterns (fire-and-forget, field selection, batched counts), testing with mocked PrismaService, NestJS @Global() module pattern, error codes (P2002/P2025/P2003), and 6 common pitfalls

## Table of Contents

1. [Core Concepts & Mental Model](#1-core-concepts--mental-model)
2. [Project Setup & Architecture](#2-project-setup--architecture)
3. [Schema Design Deep Dive](#3-schema-design-deep-dive)
4. [Client API — Complete CRUD Reference](#4-client-api--complete-crud-reference)
5. [Relations & Loading Strategies](#5-relations--loading-strategies)
6. [Advanced Querying](#6-advanced-querying)
7. [Transactions & Atomicity](#7-transactions--atomicity)
8. [Migrations Mastery](#8-migrations-mastery)
9. [Seeding & Data Management](#9-seeding--data-management)
10. [Type System & Code Generation](#10-type-system--code-generation)
11. [Raw SQL & Escape Hatches](#11-raw-sql--escape-hatches)
12. [Middleware, Extensions & Hooks](#12-middleware-extensions--hooks)
13. [Performance Optimization](#13-performance-optimization)
14. [Testing Strategies](#14-testing-strategies)
15. [NestJS Integration Patterns](#15-nestjs-integration-patterns)
16. [Monorepo & Multi-Package](#16-monorepo--multi-package)
17. [Error Handling](#17-error-handling)
18. [Security Best Practices](#18-security-best-practices)
19. [Production Deployment](#19-production-deployment)
20. [Common Pitfalls & Solutions](#20-common-pitfalls--solutions)

---

## 1. Core Concepts & Mental Model

### What Prisma Actually Is

Prisma is **not** a traditional ORM. It's a **database toolkit** consisting of three parts:

```
┌──────────────────────────────────────────────────┐
│                   Your App Code                   │
│          (TypeScript / JavaScript)                │
├──────────────────────────────────────────────────┤
│              Prisma Client                        │
│   Auto-generated, type-safe query builder         │
│   Returns plain objects (NOT class instances)      │
├──────────────────────────────────────────────────┤
│              Prisma Query Engine                  │
│   Rust binary that translates queries to SQL      │
│   Manages connection pool                         │
├──────────────────────────────────────────────────┤
│              Database                             │
│   PostgreSQL / MySQL / SQLite / MongoDB / etc.    │
└──────────────────────────────────────────────────┘
```

### Key Principles

1. **Schema-first**: The `schema.prisma` file is the single source of truth
2. **Generated client**: Types and client are auto-generated — never handwritten
3. **Explicit loading**: Relations are NEVER loaded unless you ask for them
4. **Plain objects**: Query results are plain JS objects, not class instances
5. **Rust engine**: The actual SQL generation happens in a Rust binary

### The Generation Workflow

```bash
# 1. You edit schema.prisma
# 2. Generate the client (creates types + query engine)
npx prisma generate

# 3. Create a migration (captures schema diff as SQL)
npx prisma migrate dev --name my_change

# 4. The client is now in sync with your database
```

---

## 2. Project Setup & Architecture

### Basic Setup

```bash
npm install @prisma/client
npm install -D prisma
npx prisma init --datasource-provider postgresql
```

This creates:

```
prisma/
  schema.prisma    ← Your schema definition
.env               ← DATABASE_URL goes here
```

### Monorepo Setup (from jazz-portfolio)

The real project uses a **shared database package** in a pnpm monorepo:

```
packages/database/
  ├── prisma/
  │   ├── schema.prisma          ← Schema lives here
  │   ├── migrations/            ← Migration history
  │   ├── seed.ts                ← Seed script
  │   └── seed-data.ts           ← Seed data constants
  ├── src/
  │   └── index.ts               ← Re-exports PrismaClient + types
  ├── package.json
  └── tsconfig.json
```

```json
// packages/database/package.json
{
  "name": "@jazz-portfolio/database",
  "scripts": {
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^6.0.0"
  },
  "devDependencies": {
    "prisma": "^6.0.0",
    "tsx": "^4.0.0"
  }
}
```

```typescript
// packages/database/src/index.ts
export { PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
```

The API app then imports from this package:

```typescript
// apps/api/src/prisma/prisma.service.ts
import { PrismaClient } from '@jazz-portfolio/database';
```

### Environment Configuration

```env
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"

# With connection pool settings
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?connection_limit=20&pool_timeout=10"

# For PgBouncer (transaction mode)
DATABASE_URL="postgresql://user:password@pgbouncer:6432/mydb?pgbouncer=true"
```

---

## 3. Schema Design Deep Dive

### Generator & Datasource

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["fullTextSearch"]   // Enable preview features
  binaryTargets   = ["native", "linux-musl-arm64-openssl-3.0.x"] // For Docker
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Field Types

```prisma
model AllFieldTypes {
  // Primary keys
  id          String   @id @default(uuid())          // UUID
  autoId      Int      @id @default(autoincrement())  // Auto-increment
  cuid        String   @id @default(cuid())           // CUID

  // Scalar types
  name        String                                   // TEXT
  email       String   @db.VarChar(254)                // VARCHAR(254)
  age         Int                                      // INTEGER
  price       Float                                    // DOUBLE PRECISION
  amount      Decimal  @db.Decimal(10, 2)              // DECIMAL(10,2)
  isActive    Boolean  @default(true)                  // BOOLEAN
  metadata    Json     @default("{}")                   // JSONB
  content     Bytes                                     // BYTEA
  bigNum      BigInt                                    // BIGINT

  // Date/Time
  createdAt   DateTime @default(now())                  // TIMESTAMP
  updatedAt   DateTime @updatedAt                       // Auto-managed
  publishedAt DateTime?                                 // Nullable
  date        DateTime @db.Date                         // DATE only
  time        DateTime @db.Time                         // TIME only

  // Arrays (PostgreSQL only)
  tags        String[] @default([])
  scores      Int[]
  data        Float[]

  // Enums
  role        Role     @default(USER)
}

enum Role {
  USER
  ADMIN
  MODERATOR
}
```

### Field Modifiers Reference

```prisma
model Example {
  // Modifiers
  required    String                    // NOT NULL (default)
  optional    String?                   // NULL allowed
  list        String[]                  // Array type
  defaultVal  String   @default("hi")   // Default value
  unique      String   @unique          // UNIQUE constraint
  mapped      String   @map("db_name")  // Column name mapping
  dbType      String   @db.VarChar(200) // Native DB type

  // Attributes
  id          String   @id              // Primary key
  autoTime    DateTime @updatedAt       // Auto-update timestamp
  generated   String   @default(uuid()) // Generated value

  // Table-level
  @@map("table_name")                   // Table name mapping
  @@unique([field1, field2])            // Compound unique
  @@index([field1, field2])             // Composite index
  @@index([tags], type: Gin)            // GIN index (PostgreSQL)
  @@index([field1(sort: Desc)])         // Descending index
  @@id([field1, field2])                // Compound primary key
}
```

### Relations

```prisma
// === ONE-TO-MANY ===
model Category {
  id    String         @id @default(uuid())
  items CategoryItem[]  // "Has many" side
}

model CategoryItem {
  id         String   @id @default(uuid())
  categoryId String   @map("category_id")
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)
}

// === ONE-TO-ONE ===
model User {
  id      String   @id @default(uuid())
  profile Profile?  // Optional one-to-one
}

model Profile {
  id     String @id @default(uuid())
  userId String @unique @map("user_id")  // Unique = one-to-one
  user   User   @relation(fields: [userId], references: [id])
}

// === MANY-TO-MANY (implicit) ===
model Post {
  id         String     @id @default(uuid())
  categories Category[]
}

model Category {
  id    String @id @default(uuid())
  posts Post[]
}
// Prisma auto-creates a join table: _CategoryToPost

// === MANY-TO-MANY (explicit — more control) ===
model Post {
  id         String         @id @default(uuid())
  categories PostCategory[]
}

model Category {
  id    String         @id @default(uuid())
  posts PostCategory[]
}

model PostCategory {
  postId     String   @map("post_id")
  categoryId String   @map("category_id")
  assignedAt DateTime @default(now())
  post       Post     @relation(fields: [postId], references: [id])
  category   Category @relation(fields: [categoryId], references: [id])

  @@id([postId, categoryId])
}

// === SELF-REFERENCING (from the real project) ===
model Comment {
  id       String    @id @default(uuid())
  parentId String?   @map("parent_id")
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies  Comment[] @relation("CommentReplies")
}
```

### Cascade Actions

```prisma
// onDelete options:
@relation(... onDelete: Cascade)     // Delete children when parent deleted
@relation(... onDelete: Restrict)    // Prevent parent deletion if children exist
@relation(... onDelete: SetNull)     // Set FK to null (field must be optional)
@relation(... onDelete: SetDefault)  // Set FK to default value
@relation(... onDelete: NoAction)    // Database default behavior

// onUpdate options (same values)
@relation(... onUpdate: Cascade)     // Update FK when parent PK changes
```

### Indexes Deep Dive

```prisma
model Post {
  // From the real project:

  // Composite index for common query pattern
  @@index([isDeleted, status, publishedAt(sort: Desc)])

  // Index for published posts listing
  @@index([status, publishedAt(sort: Desc)])

  // GIN index for PostgreSQL array contains queries
  @@index([tags], type: Gin)

  // Other index types:
  @@index([title], type: BTree)           // Default B-tree
  @@index([content], type: Gin)           // Full-text search
  @@index([location], type: Gist)         // Spatial data
  @@index([hash_val], type: Hash)         // Hash index
  @@index([embedding], type: SpGist)      // Space-partitioned GiST

  // Partial index (PostgreSQL)
  @@index([email], map: "idx_active_users_email")
}
```

---

## 4. Client API — Complete CRUD Reference

### Create

```typescript
// Single record
const post = await prisma.post.create({
  data: {
    slug: 'my-post',
    title: { en: 'Hello', vi: 'Xin chào', ja: 'こんにちは' },
    tags: ['tech', 'nodejs'],
    status: 'DRAFT',
  },
});

// Create with nested relation
const category = await prisma.category.create({
  data: {
    name: { en: 'Skills' },
    slug: 'skills',
    items: {
      create: [
        { title: { en: 'TypeScript' }, sortOrder: 0 },
        { title: { en: 'PostgreSQL' }, sortOrder: 1 },
      ],
    },
  },
  include: { items: true },
});

// Create many (returns count, not records)
const result = await prisma.post.createMany({
  data: [
    { slug: 'post-1', title: { en: 'Post 1' } },
    { slug: 'post-2', title: { en: 'Post 2' } },
  ],
  skipDuplicates: true, // Ignore rows that violate unique constraints
});
// result: { count: 2 }

// Create many AND return records (Prisma 5.14+)
const posts = await prisma.post.createManyAndReturn({
  data: [
    { slug: 'post-1', title: { en: 'Post 1' } },
    { slug: 'post-2', title: { en: 'Post 2' } },
  ],
});
```

### Read

```typescript
// Find by unique field
const post = await prisma.post.findUnique({
  where: { id: 'uuid-here' },
});
// post: Post | null

const post = await prisma.post.findUnique({
  where: { slug: 'my-post' },
});

// Find first matching
const post = await prisma.post.findFirst({
  where: { status: 'PUBLISHED', isDeleted: false },
  orderBy: { publishedAt: 'desc' },
});

// Find first or throw
const post = await prisma.post.findFirstOrThrow({
  where: { slug: 'my-post' },
});
// Throws PrismaClientKnownRequestError if not found

// Find unique or throw
const post = await prisma.post.findUniqueOrThrow({
  where: { id: 'uuid-here' },
});

// Find many
const posts = await prisma.post.findMany({
  where: { status: 'PUBLISHED', isDeleted: false },
  orderBy: { publishedAt: 'desc' },
  skip: 0,
  take: 10,
});

// Count
const count = await prisma.post.count({
  where: { status: 'PUBLISHED' },
});

// Aggregate
const result = await prisma.post.aggregate({
  _avg: { viewCount: true, commentCount: true },
  _max: { viewCount: true },
  _min: { viewCount: true },
  _sum: { viewCount: true },
  _count: true,
  where: { status: 'PUBLISHED' },
});

// Group by
const grouped = await prisma.post.groupBy({
  by: ['status'],
  _count: { _all: true },
  _avg: { viewCount: true },
  orderBy: { _count: { _all: 'desc' } },
});
```

### Update

```typescript
// Update by unique field
const post = await prisma.post.update({
  where: { id: 'uuid-here' },
  data: {
    title: { en: 'Updated Title' },
    status: 'PUBLISHED',
    publishedAt: new Date(),
  },
});

// Atomic number operations (from the real project)
await prisma.post.update({
  where: { id: row.id },
  data: { viewCount: { increment: 1 } },
});

// All atomic operations:
data: {
  viewCount: { increment: 1 },   // viewCount + 1
  viewCount: { decrement: 1 },   // viewCount - 1
  viewCount: { multiply: 2 },    // viewCount * 2
  viewCount: { divide: 2 },      // viewCount / 2
  viewCount: { set: 0 },         // viewCount = 0
}

// Update many
const result = await prisma.categoryItem.updateMany({
  where: { categoryId: id },
  data: { isDeleted: true },
});
// result: { count: 5 }

// Update nested relations
const category = await prisma.category.update({
  where: { id },
  data: {
    items: {
      create: { title: { en: 'New Item' } },     // Add new
      update: {
        where: { id: 'item-1' },
        data: { title: { en: 'Updated' } },
      },
      delete: { id: 'item-2' },                   // Hard delete
      deleteMany: { isDeleted: true },             // Delete matching
      connect: { id: 'existing-item' },            // Link existing
      disconnect: { id: 'item-3' },                // Unlink
      set: [{ id: 'item-1' }, { id: 'item-2' }],  // Replace all
    },
  },
});
```

### Upsert

```typescript
// From the real project — idempotent seeding
await prisma.adminUser.upsert({
  where: { username: 'admin' },
  update: {}, // No changes if exists
  create: {
    username: 'admin',
    passwordHash,
  },
});

// Full upsert with update logic
await prisma.category.upsert({
  where: { slug: cat.slug },
  update: {
    name: cat.name,
    type: cat.type,
    sortOrder: cat.sortOrder,
    isActive: true,
    isDeleted: false,
  },
  create: {
    slug: cat.slug,
    name: cat.name,
    type: cat.type,
    sortOrder: cat.sortOrder,
  },
});
```

### Delete

```typescript
// Delete one
await prisma.post.delete({
  where: { id: 'uuid-here' },
});

// Delete many
const result = await prisma.comment.deleteMany({
  where: { postId: 'uuid-here', status: 'SPAM' },
});
// result: { count: 3 }

// Delete all records in a table
await prisma.comment.deleteMany({});
// CAUTION: Deletes everything!
```

---

## 5. Relations & Loading Strategies

### `include` — Load Full Relations

```typescript
// From the real project: Category with filtered items
const categories = await prisma.category.findMany({
  where: { isDeleted: false, isActive: true },
  include: {
    items: {
      where: { isDeleted: false, isActive: true },
      orderBy: { sortOrder: 'asc' },
    },
  },
  orderBy: { sortOrder: 'asc' },
});
// Returns: Category & { items: CategoryItem[] }

// Deeply nested includes
const comment = await prisma.comment.findUnique({
  where: { id },
  include: {
    post: true, // Full post object
    parent: true, // Parent comment
    replies: {
      // Child comments
      include: { replies: true }, // Grandchild comments
    },
  },
});
```

### `select` — Load Specific Fields

```typescript
// From the real project: Post list without content
const posts = await prisma.post.findMany({
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
    // content is intentionally excluded — saves bandwidth
  },
});
// Return type: { id: string; slug: string; title: JsonValue; ... }[]
```

### `select` Inside `include`

```typescript
// From the real project: Comments with partial post data
const comments = await prisma.comment.findMany({
  where,
  include: {
    post: {
      select: { slug: true, title: true }, // Only slug and title from post
    },
  },
});
// Returns: Comment & { post: { slug: string; title: JsonValue } }
```

### Important Rule: `include` vs `select` Cannot Be Mixed at Same Level

```typescript
// ❌ ERROR: Cannot use both include and select at the same level
await prisma.post.findMany({
  select: { id: true, title: true },
  include: { comments: true }, // This is invalid!
});

// ✅ Use select with nested select instead
await prisma.post.findMany({
  select: {
    id: true,
    title: true,
    comments: {
      // This works!
      select: { id: true, body: true },
    },
  },
});
```

### Relation Filters

```typescript
// Posts that HAVE at least one approved comment
const posts = await prisma.post.findMany({
  where: {
    comments: {
      some: { status: 'APPROVED' }, // At least one match
    },
  },
});

// Posts with NO spam comments
const posts = await prisma.post.findMany({
  where: {
    comments: {
      none: { status: 'SPAM' }, // Zero matches
    },
  },
});

// Posts where ALL comments are approved
const posts = await prisma.post.findMany({
  where: {
    comments: {
      every: { status: 'APPROVED' }, // All match
    },
  },
});

// Count relations
const posts = await prisma.post.findMany({
  include: {
    _count: {
      select: { comments: true }, // Count of comments per post
    },
  },
});
// post._count.comments → number
```

---

## 6. Advanced Querying

### Filtering Operators

```typescript
// Equality
where: { status: 'PUBLISHED' }                  // Equals
where: { status: { equals: 'PUBLISHED' } }      // Explicit equals
where: { status: { not: 'DRAFT' } }             // Not equals

// Comparison
where: { viewCount: { gt: 100 } }               // Greater than
where: { viewCount: { gte: 100 } }              // Greater than or equal
where: { viewCount: { lt: 50 } }                // Less than
where: { viewCount: { lte: 50 } }               // Less than or equal

// String operations
where: { title: { contains: 'prisma' } }                       // LIKE '%prisma%'
where: { title: { contains: 'prisma', mode: 'insensitive' } }  // ILIKE
where: { title: { startsWith: 'How' } }                        // LIKE 'How%'
where: { title: { endsWith: 'guide' } }                        // LIKE '%guide'
where: { email: { search: 'typescript & guide' } }             // Full-text search

// List/In
where: { status: { in: ['DRAFT', 'PUBLISHED'] } }
where: { status: { notIn: ['SPAM', 'REJECTED'] } }

// Null
where: { publishedAt: null }                    // IS NULL
where: { publishedAt: { not: null } }           // IS NOT NULL

// Array operations (PostgreSQL)
where: { tags: { has: 'jazz' } }                // Array contains element
where: { tags: { hasEvery: ['jazz', 'code'] } } // Array contains ALL
where: { tags: { hasSome: ['jazz', 'code'] } }  // Array contains ANY
where: { tags: { isEmpty: true } }              // Empty array

// JSON operations
where: {
  metadata: {
    path: ['address', 'city'],
    equals: 'Tokyo',
  },
}
```

### Logical Operators

```typescript
// AND (implicit — all fields in where are ANDed)
where: {
  isDeleted: false,
  status: 'PUBLISHED',
}

// AND (explicit)
where: {
  AND: [
    { isDeleted: false },
    { status: 'PUBLISHED' },
    { publishedAt: { not: null } },
  ],
}

// OR
where: {
  OR: [
    { title: { contains: query, mode: 'insensitive' } },
    { content: { contains: query, mode: 'insensitive' } },
    { tags: { has: query } },
  ],
}

// NOT
where: {
  NOT: { status: 'SPAM' },
}

// Complex nesting
where: {
  AND: [
    { isDeleted: false },
    {
      OR: [
        { status: 'PUBLISHED' },
        { AND: [{ status: 'DRAFT' }, { authorId: currentUserId }] },
      ],
    },
  ],
}
```

### Ordering

```typescript
// Single field
orderBy: { publishedAt: 'desc' }

// Multiple fields
orderBy: [
  { status: 'asc' },
  { publishedAt: 'desc' },
]

// Null handling
orderBy: { publishedAt: { sort: 'desc', nulls: 'last' } }

// Order by relation count
orderBy: { comments: { _count: 'desc' } }

// Order by relation field (relevant for one-to-one)
orderBy: { author: { name: 'asc' } }
```

### Distinct

```typescript
const uniqueStatuses = await prisma.post.findMany({
  distinct: ['status'],
  select: { status: true },
});
```

### Cursor-Based Pagination

```typescript
// First page
const firstPage = await prisma.post.findMany({
  take: 10,
  orderBy: { publishedAt: 'desc' },
});

// Next page (using cursor)
const nextPage = await prisma.post.findMany({
  take: 10,
  skip: 1, // Skip the cursor item itself
  cursor: { id: lastItemId },
  orderBy: { publishedAt: 'desc' },
});
```

---

## 7. Transactions & Atomicity

### Batched Transactions (Sequential Queries)

```typescript
// From the real project: Pagination with count
const [rows, total] = await prisma.$transaction([
  prisma.post.findMany({ where, skip, take: limit }),
  prisma.post.count({ where }),
]);

// From the real project: Dashboard stats
const [categories, items, tracks, published, drafts, pending] = await Promise.all([
  prisma.category.count({ where: { isDeleted: false } }),
  prisma.categoryItem.count({ where: { isDeleted: false } }),
  prisma.track.count(),
  prisma.post.count({ where: { isDeleted: false, status: 'PUBLISHED' } }),
  prisma.post.count({ where: { isDeleted: false, status: 'DRAFT' } }),
  prisma.comment.count({ where: { isDeleted: false, status: 'PENDING' } }),
]);
```

### Interactive Transactions

```typescript
// From the real project: Soft delete category with children
const deleted = await prisma.$transaction(async (tx) => {
  await tx.categoryItem.updateMany({
    where: { categoryId: id },
    data: { isDeleted: true },
  });

  return tx.category.update({
    where: { id },
    data: { isDeleted: true },
  });
});

// With options
const result = await prisma.$transaction(
  async (tx) => {
    // ... your operations using tx
  },
  {
    maxWait: 5000, // Max time to acquire a connection
    timeout: 10000, // Max time for the entire transaction
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  },
);
```

### Batched Updates in Transaction

```typescript
// From the real project: Reordering categories
await prisma.$transaction(
  dto.ids.map((id, index) =>
    prisma.category.update({
      where: { id },
      data: { sortOrder: index },
    }),
  ),
);
```

### Transaction Patterns

```typescript
// Pattern 1: Transfer money (classic example)
await prisma.$transaction(async (tx) => {
  const sender = await tx.account.update({
    where: { id: senderId },
    data: { balance: { decrement: amount } },
  });
  if (sender.balance < 0) {
    throw new Error('Insufficient funds');
    // Transaction automatically rolls back
  }
  await tx.account.update({
    where: { id: recipientId },
    data: { balance: { increment: amount } },
  });
});

// Pattern 2: Read-modify-write with check
await prisma.$transaction(async (tx) => {
  const post = await tx.post.findUnique({ where: { id } });
  if (!post) throw new NotFoundException('Post not found');
  if (post.commentCount >= maxComments) {
    throw new Error('Max comments reached');
  }
  await tx.comment.create({ data: { ... } });
  await tx.post.update({
    where: { id },
    data: { commentCount: { increment: 1 } },
  });
});
```

---

## 8. Migrations Mastery

### Development Workflow

```bash
# 1. Edit schema.prisma
# 2. Create migration (generates SQL + applies to dev DB)
npx prisma migrate dev --name add_comments_table

# 3. This does three things:
#    a) Generates migration SQL
#    b) Applies migration to database
#    c) Runs prisma generate (updates client)
```

### Migration Commands Reference

```bash
# Create & apply migration in development
npx prisma migrate dev --name my_change

# Create migration without applying
npx prisma migrate dev --create-only --name my_change

# Apply all pending migrations (production)
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Reset database (drops + recreates + applies all migrations + seeds)
npx prisma migrate reset

# Compare schema to database (diff)
npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma

# Push schema without creating migration (prototyping only)
npx prisma db push

# Pull existing database schema into schema.prisma
npx prisma db pull
```

### Migration Files

```
prisma/migrations/
  20250101000000_init/
    migration.sql           ← Auto-generated SQL
  20260720100000_phase5_indexes/
    migration.sql
  20260727100858_blog_comments_schema/
    migration.sql
  migration_lock.toml       ← Prevents running with wrong provider
```

Each `migration.sql` is raw SQL that you CAN edit before applying:

```sql
-- prisma/migrations/20260727100858_blog_comments_schema/migration.sql
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "parent_id" UUID,
    "author_name" VARCHAR(60) NOT NULL,
    "author_email" VARCHAR(254) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "spam_score" INTEGER NOT NULL DEFAULT 0,
    "ip_hash" VARCHAR(64) NOT NULL,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comments_post_id_status_created_at_idx"
ON "comments"("post_id", "status", "created_at");

ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey"
FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;
```

### Handling Data Migrations

```sql
-- Add column with a backfill
ALTER TABLE "posts" ADD COLUMN "reading_minutes" INTEGER NOT NULL DEFAULT 0;

-- Custom data migration inside the SQL file
UPDATE "posts" SET "reading_minutes" = GREATEST(1,
  (LENGTH(content->>'en') + LENGTH(content->>'vi') + LENGTH(content->>'ja')) / 1000
);
```

### CI/CD Migration Pattern

```bash
# In your CI/CD pipeline:
npx prisma migrate deploy    # Apply pending migrations
npx prisma generate          # Generate client for the app

# Never run in production:
# npx prisma migrate dev     ← This is for development only
# npx prisma db push         ← This bypasses migration history
```

---

## 9. Seeding & Data Management

### Seed Configuration

```json
// package.json (or in prisma section)
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

### Idempotent Seeding Pattern (from the real project)

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Pattern 1: Upsert by unique field (idempotent)
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('admin123', 12);

  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash },
  });

  // Pattern 2: Loop upsert for collections
  for (const cat of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
        isActive: true,
        isDeleted: false,
      },
      create: {
        slug: cat.slug,
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
      },
    });
  }

  // Pattern 3: Upsert by ID for stable references
  for (const item of SEED_ITEMS) {
    await prisma.categoryItem.upsert({
      where: { id: item.id },
      update: { ...item },
      create: { ...item },
    });
  }

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Running Seeds

```bash
# Explicitly
npx prisma db seed

# Automatically (runs after migrate reset)
npx prisma migrate reset   # Drops DB → applies all migrations → runs seed

# Using custom script
npx tsx prisma/seed.ts
```

---

## 10. Type System & Code Generation

### Generated Types

After `prisma generate`, types are in `node_modules/@prisma/client`:

```typescript
// Auto-generated model types
import { Post, Comment, Category } from '@prisma/client';

// post.id → string
// post.title → Prisma.JsonValue
// post.tags → string[]
// post.publishedAt → Date | null

// Input types for create/update
import { Prisma } from '@prisma/client';

type PostCreateInput = Prisma.PostCreateInput;
type PostUpdateInput = Prisma.PostUpdateInput;
type PostWhereInput = Prisma.PostWhereInput;
type PostWhereUniqueInput = Prisma.PostWhereUniqueInput;
type PostOrderByWithRelationInput = Prisma.PostOrderByWithRelationInput;
```

### Helper Types

```typescript
import { Prisma } from '@prisma/client';

// Get the return type of a specific query
type PostWithComments = Prisma.PostGetPayload<{
  include: { comments: true };
}>;

// Get select result type
type PostListItem = Prisma.PostGetPayload<{
  select: {
    id: true;
    slug: true;
    title: true;
    excerpt: true;
  };
}>;

// Validator — ensures a query object is type-correct
const query = Prisma.validator<Prisma.PostFindManyArgs>()({
  where: { isDeleted: false },
  select: { id: true, slug: true },
});
```

### Typing JSON Fields

```typescript
// Prisma schema uses Json type, which becomes Prisma.JsonValue
// To get proper typing, cast in your application code:

interface LocalizedString {
  en: string;
  vi: string;
  ja: string;
}

// From the real project:
private mapToListItemDto(row: any): PostListItemDto {
  return {
    title: row.title as LocalizedString,
    excerpt: row.excerpt as LocalizedString,
  };
}
```

---

## 11. Raw SQL & Escape Hatches

### `$queryRaw` — Safe Parameterized Queries

```typescript
// Tagged template literal — parameters are auto-escaped
const posts = await prisma.$queryRaw`
  SELECT id, slug, title
  FROM posts
  WHERE status = ${status}
  AND is_deleted = false
  ORDER BY published_at DESC
  LIMIT ${limit} OFFSET ${offset}
`;

// With Prisma.sql helper for dynamic parts
const orderColumn = Prisma.sql`published_at`;
const posts = await prisma.$queryRaw`
  SELECT * FROM posts ORDER BY ${orderColumn} DESC
`;

// Type the result
interface PostRow {
  id: string;
  slug: string;
  title: any;
}
const posts = await prisma.$queryRaw<PostRow[]>`
  SELECT id, slug, title FROM posts WHERE status = 'PUBLISHED'
`;
```

### `$executeRaw` — For Mutations

```typescript
// Returns the number of affected rows
const count = await prisma.$executeRaw`
  UPDATE posts
  SET view_count = view_count + 1
  WHERE id = ${postId}
`;
// count: number (rows affected)

// Complex raw update
await prisma.$executeRaw`
  UPDATE posts
  SET comment_count = (
    SELECT COUNT(*)
    FROM comments
    WHERE comments.post_id = posts.id
    AND comments.status = 'APPROVED'
    AND comments.is_deleted = false
  )
  WHERE id = ${postId}
`;
```

### `$queryRawUnsafe` — For Dynamic SQL (Use with Caution!)

```typescript
// Only when you need dynamic table/column names
// ALWAYS validate inputs before using this!
const allowedTables = ['posts', 'comments', 'categories'];
if (!allowedTables.includes(tableName)) {
  throw new Error('Invalid table name');
}

const result = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) as count FROM "${tableName}" WHERE is_deleted = false`,
);
```

---

## 12. Middleware, Extensions & Hooks

### Middleware (`$use` — deprecated in favor of extensions)

```typescript
// Soft delete middleware — intercept delete and convert to update
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { isDeleted: true };
  }
  if (params.action === 'deleteMany') {
    params.action = 'updateMany';
    params.args.data = { isDeleted: true };
  }
  return next(params);
});

// Logging middleware
prisma.$use(async (params, next) => {
  const before = Date.now();
  const result = await next(params);
  const after = Date.now();
  console.log(`${params.model}.${params.action} took ${after - before}ms`);
  return result;
});
```

### Client Extensions (`$extends` — modern approach)

```typescript
// Soft delete extension
const xprisma = prisma.$extends({
  model: {
    $allModels: {
      async softDelete<T>(this: T, id: string) {
        const context = Prisma.getExtensionContext(this);
        return (context as any).update({
          where: { id },
          data: { isDeleted: true },
        });
      },
    },
  },
  query: {
    $allModels: {
      // Auto-filter soft-deleted records
      async findMany({ model, operation, args, query }) {
        args.where = { ...args.where, isDeleted: false };
        return query(args);
      },
    },
  },
});

// Result extension — add computed fields
const xprisma = prisma.$extends({
  result: {
    post: {
      isPublished: {
        needs: { status: true },
        compute(post) {
          return post.status === 'PUBLISHED';
        },
      },
      summary: {
        needs: { title: true, excerpt: true },
        compute(post) {
          return `${post.title}: ${post.excerpt}`;
        },
      },
    },
  },
});

// Usage: post.isPublished → true/false (computed on read)
```

### Event Logging

```typescript
// Query-level event logging
const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
});

prisma.$on('query', (e) => {
  console.log(`Query: ${e.query}`);
  console.log(`Duration: ${e.duration}ms`);
  console.log(`Params: ${e.params}`);
});

prisma.$on('error', (e) => {
  console.error(`Database error: ${e.message}`);
});
```

---

## 13. Performance Optimization

### Select Only What You Need

```typescript
// ❌ Bad: Fetches all columns including large content field
const posts = await prisma.post.findMany();

// ✅ Good: From the real project — select only needed fields
const posts = await prisma.post.findMany({
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

### Batch Count with Transaction

```typescript
// ❌ Bad: Two separate round-trips
const rows = await prisma.post.findMany({ where, skip, take: limit });
const total = await prisma.post.count({ where });

// ✅ Good: From the real project — single round-trip
const [rows, total] = await prisma.$transaction([
  prisma.post.findMany({ where, skip, take: limit }),
  prisma.post.count({ where }),
]);
```

### Parallel Independent Queries

```typescript
// From the real project: Dashboard stats
const [categories, items, tracks, published, drafts, pending] = await Promise.all([
  prisma.category.count({ where: { isDeleted: false } }),
  prisma.categoryItem.count({ where: { isDeleted: false } }),
  prisma.track.count(),
  prisma.post.count({ where: { isDeleted: false, status: 'PUBLISHED' } }),
  prisma.post.count({ where: { isDeleted: false, status: 'DRAFT' } }),
  prisma.comment.count({ where: { isDeleted: false, status: 'PENDING' } }),
]);
```

### Fire-and-Forget for Non-Critical Updates

```typescript
// From the real project: View count increment (don't block response)
void prisma.post
  .update({
    where: { id: row.id },
    data: { viewCount: { increment: 1 } },
  })
  .catch(() => {}); // Silently ignore failures
```

### Index-Aware Queries

```typescript
// The real project has these indexes:
// @@index([isDeleted, status, publishedAt(sort: Desc)])

// ✅ This query will use the index efficiently
const posts = await prisma.post.findMany({
  where: { isDeleted: false, status: 'PUBLISHED' },
  orderBy: { publishedAt: 'desc' },
  take: 10,
});
```

### Connection Pooling

```env
# For standard PostgreSQL
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"

# For PgBouncer (transaction mode)
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/db?pgbouncer=true&connection_limit=20"

# For serverless (Prisma Accelerate)
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=..."
```

---

## 14. Testing Strategies

### Unit Testing with Mocks (from the real project)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';

describe('BlogService', () => {
  let service: BlogService;
  let prisma: any;

  const mockPostRow = {
    id: 'post-1',
    slug: 'test-post',
    title: { en: 'Test Title', vi: 'Tiêu đề', ja: 'タイトル' },
    status: 'PUBLISHED',
    publishedAt: new Date('2026-07-01'),
    createdAt: new Date('2026-07-01'),
    updatedAt: new Date('2026-07-01'),
    // ... all required fields
  };

  beforeEach(async () => {
    prisma = {
      post: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [BlogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  it('creates post as DRAFT', async () => {
    prisma.post.findFirst.mockResolvedValue(null);
    prisma.post.create.mockResolvedValue({
      ...mockPostRow,
      status: 'DRAFT',
      publishedAt: null,
    });

    const result = await service.createPost({
      slug: 'my-draft',
      title: { en: 'My Draft', vi: '', ja: '' },
      excerpt: { en: '', vi: '', ja: '' },
      content: { en: 'Content', vi: '', ja: '' },
    });

    expect(result.status).toBe('DRAFT');
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DRAFT' }),
      }),
    );
  });
});
```

### Integration Testing with Test Database

```typescript
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

beforeAll(async () => {
  prisma = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
  });
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Clean all tables between tests
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  for (const { tablename } of tables) {
    if (tablename !== '_prisma_migrations') {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
    }
  }
});

describe('Post creation', () => {
  it('creates a post in the database', async () => {
    const post = await prisma.post.create({
      data: { slug: 'test', title: { en: 'Test' } },
    });
    expect(post.id).toBeDefined();
    expect(post.status).toBe('DRAFT');
  });
});
```

---

## 15. NestJS Integration Patterns

### The Service Pattern (from the real project)

```typescript
// prisma.service.ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// prisma.module.ts
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Advanced Service with Logging & Health Check

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    // Log slow queries in development
    if (process.env.NODE_ENV !== 'production') {
      this.$on('query' as never, (event: any) => {
        if (event.duration > 100) {
          this.logger.warn(`Slow query (${event.duration}ms): ${event.query}`);
        }
      });
    }

    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  // Health check method
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
```

### Usage in Feature Services

```typescript
// From the real project: Every service receives PrismaService
@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidationService: RevalidationService,
  ) {}

  // All database operations go through this.prisma
  async getPublicPosts() {
    return this.prisma.post.findMany({
      where: { isDeleted: false, status: 'PUBLISHED' },
    });
  }
}
```

---

## 16. Monorepo & Multi-Package

### Architecture (from the real project)

```
root/
├── packages/
│   └── database/                    ← Shared database package
│       ├── prisma/
│       │   ├── schema.prisma        ← Schema definition
│       │   ├── migrations/          ← Migration history
│       │   ├── seed.ts              ← Seed script
│       │   └── seed-data.ts         ← Seed constants
│       ├── src/
│       │   └── index.ts             ← Re-exports
│       ├── package.json
│       └── tsconfig.json
├── apps/
│   ├── api/                         ← NestJS backend
│   │   └── src/prisma/
│   │       ├── prisma.service.ts    ← NestJS wrapper
│   │       └── prisma.module.ts     ← Global module
│   └── web/                         ← Next.js frontend
├── pnpm-workspace.yaml
└── turbo.json
```

### Key Configuration

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// turbo.json — build order matters
{
  "pipeline": {
    "db:generate": {},
    "build": {
      "dependsOn": ["^db:generate"]
    }
  }
}
```

---

## 17. Error Handling

### Prisma Error Types

```typescript
import { Prisma } from '@prisma/client';

try {
  await prisma.post.create({
    data: { slug: 'duplicate-slug', title: {} },
  });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint violation
        const target = (error.meta?.target as string[])?.join(', ');
        throw new ConflictException(`Duplicate value for: ${target}`);

      case 'P2025': // Record not found
        throw new NotFoundException('Record not found');

      case 'P2003': // Foreign key constraint violation
        throw new BadRequestException('Referenced record does not exist');

      case 'P2014': // Relation violation
        throw new BadRequestException('Would violate required relation');

      default:
        throw new InternalServerErrorException(`Database error: ${error.code}`);
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    throw new BadRequestException('Invalid data provided');
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    // Critical: Rust engine crashed. Log and restart.
    console.error('CRITICAL: Prisma engine panic', error);
    process.exit(1);
  }

  throw error;
}
```

### Common Error Codes

| Code    | Meaning                          | Typical Action                   |
| ------- | -------------------------------- | -------------------------------- |
| `P2002` | Unique constraint violation      | Return 409 Conflict              |
| `P2003` | Foreign key constraint violation | Return 400 Bad Request           |
| `P2025` | Record not found (update/delete) | Return 404 Not Found             |
| `P2014` | Required relation violation      | Return 400 Bad Request           |
| `P2024` | Connection pool timeout          | Retry or 503 Service Unavailable |
| `P2028` | Transaction API error            | Retry or 500 Internal Error      |

---

## 18. Security Best Practices

### Parameterized Queries (Default!)

```typescript
// ✅ SAFE: Tagged template literals auto-parameterize
const posts = await prisma.$queryRaw`
  SELECT * FROM posts WHERE slug = ${userInput}
`;

// ❌ DANGEROUS: Never build SQL strings from user input
const posts = await prisma.$queryRawUnsafe(
  `SELECT * FROM posts WHERE slug = '${userInput}'`, // SQL injection!
);
```

### Input Validation

```typescript
// Always validate before passing to Prisma
// From the real project: Using class-validator DTOs
class CreatePostDto {
  @IsString()
  @MaxLength(200)
  slug: string;

  @IsObject()
  title: LocalizedString;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

### Sensitive Data Handling

```typescript
// From the real project: Hash passwords before storing
const passwordHash = await bcrypt.hash('admin123', 12);
await prisma.adminUser.create({
  data: { username: 'admin', passwordHash },
});

// From the real project: Hash IP addresses for privacy
const ipHash = createHash('sha256')
  .update(ipAddress + salt)
  .digest('hex');
await prisma.comment.create({
  data: { ipHash, ... },
});
```

---

## 19. Production Deployment

### Migration Deployment

```bash
# In CI/CD pipeline:
npx prisma migrate deploy   # Apply pending migrations
npx prisma generate          # Generate client

# In Dockerfile:
RUN npx prisma generate
CMD ["node", "dist/main.js"]
```

### Docker Configuration

```dockerfile
FROM node:20-alpine

# Install OpenSSL for Prisma engine
RUN apk add --no-cache openssl

WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY . .
RUN npm run build

# Run migrations on startup (optional)
CMD npx prisma migrate deploy && node dist/main.js
```

### Environment Variables for Production

```env
# Database connection
DATABASE_URL="postgresql://user:pass@prod-host:5432/mydb?connection_limit=20&pool_timeout=10&sslmode=require"

# SSL for cloud databases
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require&sslcert=/path/to/cert"
```

### Health Check

```typescript
// From the NestJS health controller
@Get('health')
async check() {
  try {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  } catch {
    return { status: 'error', database: 'disconnected' };
  }
}
```

---

## 20. Common Pitfalls & Solutions

### Pitfall 1: Forgetting `prisma generate` After Schema Changes

```bash
# Symptom: Types don't match schema, or client methods missing
# Solution: Always run generate after schema changes
npx prisma generate
```

### Pitfall 2: Using `db push` in Production

```bash
# ❌ NEVER do this in production:
npx prisma db push    # Can cause data loss!

# ✅ Always use migrations:
npx prisma migrate deploy
```

### Pitfall 3: N+1 with Missing `include`

```typescript
// ❌ N+1: Fetching posts then looping to get comments
const posts = await prisma.post.findMany();
for (const post of posts) {
  const comments = await prisma.comment.findMany({
    where: { postId: post.id },
  });
}

// ✅ Single query with include
const posts = await prisma.post.findMany({
  include: { comments: true },
});
```

### Pitfall 4: Returning `@updatedAt` Fields from `createMany`

```typescript
// createMany returns { count: N } — not the records themselves!
const result = await prisma.post.createMany({
  data: posts,
});
// result: { count: 5 }

// Use createManyAndReturn (Prisma 5.14+) if you need records:
const posts = await prisma.post.createManyAndReturn({
  data: posts,
});
```

### Pitfall 5: JSON Field Typing

```typescript
// Prisma Json maps to Prisma.JsonValue — not your custom type
// Always cast explicitly:
const title = row.title as unknown as LocalizedString;

// Or use a helper:
function typedJson<T>(json: Prisma.JsonValue): T {
  return json as unknown as T;
}
```

### Pitfall 6: Transaction Timeout in Production

```typescript
// Default timeout is 5 seconds — may be too short for bulk operations
await prisma.$transaction(
  async (tx) => {
    // Bulk operation that takes > 5 seconds
    for (const item of thousandItems) {
      await tx.item.create({ data: item });
    }
  },
  {
    timeout: 30000, // Increase to 30 seconds
    maxWait: 10000, // Max wait for connection: 10 seconds
  },
);
```

---

> **You now have everything needed to build, deploy, and maintain production Prisma applications.** Bookmark this guide and refer to it when working on your jazz-portfolio and future Prisma projects.
