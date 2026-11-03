# Prisma vs TypeORM — Comprehensive Comparison Guide

> A practical, deep-dive comparison for production-grade Node.js / TypeScript applications.
> All Prisma examples are drawn from the real jazz-portfolio codebase.

---

Side-by-side comparison covering 18 topics with matching code examples from both ORMs:

Architecture & philosophy, setup, schema definition, CRUD, relations, querying, transactions, migrations, seeding, type safety, raw SQL, performance, testing, NestJS integration, monorepo patterns, advanced patterns, production checklist, and decision criteria

## Table of Contents

1. [Philosophy & Architecture](#1-philosophy--architecture)
2. [Setup & Configuration](#2-setup--configuration)
3. [Schema Definition](#3-schema-definition)
4. [CRUD Operations](#4-crud-operations)
5. [Relations & Eager/Lazy Loading](#5-relations--eagerlazy-loading)
6. [Querying & Filtering](#6-querying--filtering)
7. [Transactions](#7-transactions)
8. [Migrations](#8-migrations)
9. [Seeding](#9-seeding)
10. [Type Safety](#10-type-safety)
11. [Raw SQL](#11-raw-sql)
12. [Performance & Connection Pooling](#12-performance--connection-pooling)
13. [Testing](#13-testing)
14. [NestJS Integration](#14-nestjs-integration)
15. [Monorepo / Multi-Package Setup](#15-monorepo--multi-package-setup)
16. [Advanced Patterns](#16-advanced-patterns)
17. [Production Checklist](#17-production-checklist)
18. [When to Choose Which](#18-when-to-choose-which)

---

## 1. Philosophy & Architecture

| Aspect                     | Prisma                                           | TypeORM                                                                 |
| -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| **Paradigm**               | Schema-first (declarative `.prisma` file)        | Code-first (entity classes with decorators)                             |
| **Query Engine**           | Rust binary that runs alongside Node.js          | Pure TypeScript/JavaScript                                              |
| **Type Generation**        | Auto-generated from schema (`prisma generate`)   | Inferred from entity class decorators at runtime                        |
| **ORM Style**              | Query builder / Data mapper (no class instances) | Active Record **or** Data Mapper                                        |
| **SQL Access**             | `$queryRaw` / `$executeRaw` escape hatches       | QueryBuilder, raw SQL, or entity manager                                |
| **Schema Source of Truth** | `schema.prisma` file                             | Entity classes (`.ts` files)                                            |
| **Relation Loading**       | Explicit `include` / `select` per query          | `eager: true` on relation, or `relations` option, or QueryBuilder joins |

### Key Mental Model Difference

```
Prisma:   schema.prisma  →  prisma generate  →  typed client  →  plain objects
TypeORM:  entity classes  →  decorators parse →  repository    →  class instances
```

**Prisma** returns plain JavaScript objects. There are no entity instances, no `.save()` method on returned objects. You always go through the client.

**TypeORM** (Active Record) returns class instances — you can call `user.save()` directly. In Data Mapper mode, you go through repositories, similar to Prisma's client.

---

## 2. Setup & Configuration

### Prisma

```bash
# Install
npm install @prisma/client
npm install -D prisma

# Initialize (creates prisma/schema.prisma + .env)
npx prisma init
```

**Configuration** lives in `schema.prisma`:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### TypeORM

```bash
npm install typeorm reflect-metadata pg
```

**Configuration** can live in `ormconfig.json`, `data-source.ts`, or module options:

```typescript
// data-source.ts
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
  synchronize: false, // NEVER true in production
  logging: ['error', 'warn'],
});
```

### Comparison

| Aspect                | Prisma                                 | TypeORM                         |
| --------------------- | -------------------------------------- | ------------------------------- |
| Config format         | `.prisma` DSL file                     | TypeScript / JSON / YAML        |
| Environment variables | `env("VAR")` in schema                 | Standard `process.env`          |
| Multiple databases    | Multiple `datasource` blocks (limited) | Multiple `DataSource` instances |
| Config validation     | Built-in schema validation             | Manual / runtime errors         |

---

## 3. Schema Definition

### Prisma — Declarative Schema File

From the real project:

```prisma
model Post {
  id                 String    @id @default(uuid())
  slug               String    @unique
  title              Json      @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  excerpt            Json      @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  content            Json      @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  coverImageUrl      String?   @map("cover_image_url")
  status             String    @default("DRAFT")
  tags               String[]  @default([])
  readingMinutes     Int       @default(0) @map("reading_minutes")
  areCommentsEnabled Boolean   @default(true) @map("are_comments_enabled")
  commentsClosedAt   DateTime? @map("comments_closed_at")
  commentCount       Int       @default(0) @map("comment_count")
  viewCount          Int       @default(0) @map("view_count")
  publishedAt        DateTime? @map("published_at")
  isDeleted          Boolean   @default(false) @map("is_deleted")
  createdAt          DateTime  @default(now()) @map("created_at")
  updatedAt          DateTime  @updatedAt @map("updated_at")
  comments           Comment[]

  @@index([isDeleted, status, publishedAt(sort: Desc)])
  @@index([status, publishedAt(sort: Desc)])
  @@index([tags], type: Gin)
  @@map("posts")
}

model Comment {
  id          String    @id @default(uuid())
  postId      String    @map("post_id")
  parentId    String?   @map("parent_id")
  authorName  String    @map("author_name") @db.VarChar(60)
  authorEmail String    @map("author_email") @db.VarChar(254)
  body        String    @db.VarChar(2000)
  status      String    @default("PENDING")
  spamScore   Int       @default(0) @map("spam_score")
  ipHash      String    @map("ip_hash") @db.VarChar(64)
  isDeleted   Boolean   @default(false) @map("is_deleted")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  post     Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  parent   Comment?  @relation("CommentReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies  Comment[] @relation("CommentReplies")

  @@index([postId, status, createdAt])
  @@index([status, createdAt(sort: Desc)])
  @@map("comments")
}
```

### TypeORM — Entity Classes with Decorators

The equivalent in TypeORM:

```typescript
// entities/post.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Comment } from './comment.entity';

@Entity('posts')
@Index(['isDeleted', 'status', 'publishedAt'])
@Index(['status', 'publishedAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  title: Record<string, string>;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  excerpt: Record<string, string>;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  content: Record<string, string>;

  @Column({ name: 'cover_image_url', nullable: true })
  coverImageUrl: string | null;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column({ name: 'reading_minutes', default: 0 })
  readingMinutes: number;

  @Column({ name: 'are_comments_enabled', default: true })
  areCommentsEnabled: boolean;

  @Column({ name: 'comments_closed_at', nullable: true })
  commentsClosedAt: Date | null;

  @Column({ name: 'comment_count', default: 0 })
  commentCount: number;

  @Column({ name: 'view_count', default: 0 })
  viewCount: number;

  @Column({ name: 'published_at', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => Comment, (comment) => comment.post)
  comments: Comment[];
}

// entities/comment.entity.ts
@Entity('comments')
@Index(['postId', 'status', 'createdAt'])
@Index(['status', 'createdAt'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'post_id' })
  postId: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column({ name: 'author_name', length: 60 })
  authorName: string;

  @Column({ name: 'author_email', length: 254 })
  authorEmail: string;

  @Column({ length: 2000 })
  body: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ name: 'spam_score', default: 0 })
  spamScore: number;

  @Column({ name: 'ip_hash', length: 64 })
  ipHash: string;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Post, (post) => post.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => Comment, (c) => c.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment | null;

  @OneToMany(() => Comment, (c) => c.parent)
  replies: Comment[];
}
```

### Key Differences in Schema

| Feature                                | Prisma                                       | TypeORM                                                 |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------- |
| Field mapping (camelCase → snake_case) | `@map("column_name")`                        | `{ name: 'column_name' }` in decorator                  |
| Table mapping                          | `@@map("table_name")`                        | `@Entity('table_name')`                                 |
| Auto-updated timestamp                 | `@updatedAt` (built-in)                      | `@UpdateDateColumn()` decorator                         |
| UUID generation                        | `@default(uuid())`                           | `@PrimaryGeneratedColumn('uuid')`                       |
| Native DB types                        | `@db.VarChar(200)`                           | `{ length: 200 }` or `{ type: 'varchar' }`              |
| PostgreSQL arrays                      | `String[]` native support                    | `'text'`, `{ array: true }`                             |
| GIN indexes                            | `@@index([tags], type: Gin)`                 | `@Index({ synchronize: false })` + raw migration        |
| Self-referencing relations             | Named relation `@relation("CommentReplies")` | Circular `@ManyToOne`/`@OneToMany` with lazy resolution |
| Compound unique                        | `@@unique([type, value])`                    | `@Unique(['type', 'value'])`                            |
| Composite indexes                      | `@@index([field1, field2])`                  | `@Index(['field1', 'field2'])`                          |

---

## 4. CRUD Operations

### CREATE

**Prisma** (from the real project — blog post creation):

```typescript
const row = await this.prisma.post.create({
  data: {
    slug: uniqueSlug,
    title: dto.title as any,
    excerpt: dto.excerpt as any,
    content: dto.content as any,
    coverImageUrl: dto.coverImageUrl || null,
    tags: dto.tags || [],
    status,
    readingMinutes,
    areCommentsEnabled: dto.areCommentsEnabled ?? true,
    publishedAt,
  },
});
```

**TypeORM** (Repository pattern):

```typescript
// Using repository
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
const row = await this.postRepository.save(post);

// Or in one step:
const row = await this.postRepository.save({
  slug: uniqueSlug,
  title: dto.title,
  // ...
});
```

### READ (findUnique / findOne)

**Prisma:**

```typescript
const row = await this.prisma.post.findUnique({
  where: { id },
});

const row = await this.prisma.post.findFirst({
  where: { slug, isDeleted: false, status: 'PUBLISHED' },
});
```

**TypeORM:**

```typescript
const row = await this.postRepository.findOneBy({ id });

const row = await this.postRepository.findOne({
  where: { slug, isDeleted: false, status: 'PUBLISHED' },
});
```

### UPDATE

**Prisma** (from the real project — view count increment):

```typescript
await this.prisma.post.update({
  where: { id: row.id },
  data: { viewCount: { increment: 1 } },
});
```

**TypeORM:**

```typescript
// Method 1: Load then save (triggers hooks, returns entity)
const post = await this.postRepository.findOneBy({ id });
post.viewCount += 1;
await this.postRepository.save(post);

// Method 2: Direct update (no hooks, more performant)
await this.postRepository.increment({ id }, 'viewCount', 1);

// Method 3: QueryBuilder (most flexible)
await this.postRepository
  .createQueryBuilder()
  .update()
  .set({ viewCount: () => '"view_count" + 1' })
  .where('id = :id', { id })
  .execute();
```

### DELETE (Soft Delete)

**Prisma** (from the real project):

```typescript
await this.prisma.post.update({
  where: { id },
  data: { isDeleted: true },
});
```

**TypeORM** (has built-in soft delete support):

```typescript
// Manual approach (same as Prisma)
await this.postRepository.update(id, { isDeleted: true });

// TypeORM built-in soft delete (uses @DeleteDateColumn)
await this.postRepository.softDelete(id); // Sets deletedAt = now()
await this.postRepository.restore(id); // Sets deletedAt = null

// With @DeleteDateColumn decorator, softDeleted rows are
// automatically excluded from find operations
```

### UPSERT

**Prisma** (from the real project — seeding):

```typescript
await prisma.adminUser.upsert({
  where: { username: 'admin' },
  update: {}, // Don't change if exists
  create: {
    username: 'admin',
    passwordHash,
  },
});
```

**TypeORM:**

```typescript
// Method 1: Using upsert (TypeORM 0.3+)
await this.adminUserRepository.upsert(
  { username: 'admin', passwordHash },
  { conflictPaths: ['username'] },
);

// Method 2: Manual check (more control)
let user = await this.adminUserRepository.findOneBy({ username: 'admin' });
if (!user) {
  user = this.adminUserRepository.create({ username: 'admin', passwordHash });
}
await this.adminUserRepository.save(user);
```

### BATCH OPERATIONS (updateMany)

**Prisma** (from the real project — soft delete children):

```typescript
await tx.categoryItem.updateMany({
  where: { categoryId: id },
  data: { isDeleted: true },
});
```

**TypeORM:**

```typescript
await this.categoryItemRepository.update({ categoryId: id }, { isDeleted: true });
```

---

## 5. Relations & Eager/Lazy Loading

### Prisma — Explicit `include` / `select`

Prisma **never** loads relations automatically. You must explicitly request them:

```typescript
// From the real project: Category with items
const categories = await this.prisma.category.findMany({
  where: { isDeleted: false, isActive: true },
  include: {
    items: {
      where: { isDeleted: false, isActive: true },
      orderBy: { sortOrder: 'asc' },
    },
  },
  orderBy: { sortOrder: 'asc' },
});

// Nested include with select
const comments = await this.prisma.comment.findMany({
  where,
  include: { post: { select: { slug: true, title: true } } },
  orderBy: { createdAt: 'desc' },
});
```

### TypeORM — Multiple Strategies

```typescript
// Strategy 1: Eager loading (on entity definition)
@OneToMany(() => Comment, c => c.post, { eager: true })
comments: Comment[]; // Always loaded — dangerous for performance!

// Strategy 2: Explicit relations (like Prisma's include)
const categories = await this.categoryRepository.find({
  where: { isDeleted: false, isActive: true },
  relations: { items: true },
  order: { sortOrder: 'ASC' },
});

// Strategy 3: QueryBuilder with joins (most flexible)
const comments = await this.commentRepository
  .createQueryBuilder('comment')
  .leftJoinAndSelect('comment.post', 'post')
  .select(['comment', 'post.slug', 'post.title'])
  .where('comment.isDeleted = :isDeleted', { isDeleted: false })
  .orderBy('comment.createdAt', 'DESC')
  .getMany();

// Strategy 4: Lazy loading with Promises
@OneToMany(() => Comment, c => c.post, { lazy: true })
comments: Promise<Comment[]>; // Loaded only when accessed
```

### Comparison

| Aspect                        | Prisma                       | TypeORM                                   |
| ----------------------------- | ---------------------------- | ----------------------------------------- |
| Default loading               | Nothing loaded (explicit)    | Nothing loaded (unless `eager: true`)     |
| Nested filtering on relations | ✅ `include.items.where`     | ❌ Not in `find()`, need QueryBuilder     |
| Selective fields on relations | ✅ `select` inside `include` | ⚠️ QueryBuilder only                      |
| Lazy loading                  | ❌ Not supported             | ✅ `Promise<T>` properties                |
| N+1 prevention                | Built-in (batched SQL)       | Must use QueryBuilder `leftJoinAndSelect` |

---

## 6. Querying & Filtering

### Prisma Operators

```typescript
// From the real project: Array contains (PostgreSQL)
where.tags = { has: tag };

// Comparison operators
where: {
  spamScore: { gte: 50 },
  createdAt: { lte: new Date() },
  authorName: { contains: 'john', mode: 'insensitive' },
  status: { in: ['PENDING', 'APPROVED'] },
  email: { not: null },
}

// Logical operators
where: {
  OR: [
    { title: { contains: query } },
    { content: { contains: query } },
  ],
  AND: [
    { isDeleted: false },
    { status: 'PUBLISHED' },
  ],
  NOT: { status: 'SPAM' },
}
```

### TypeORM Operators

```typescript
import {
  In, LessThanOrEqual, MoreThanOrEqual, Like,
  ILike, Not, IsNull, Between, Raw,
} from 'typeorm';

// Equivalent queries
where: {
  spamScore: MoreThanOrEqual(50),
  createdAt: LessThanOrEqual(new Date()),
  authorName: ILike(`%john%`),
  status: In(['PENDING', 'APPROVED']),
  email: Not(IsNull()),
}

// Logical operators — multiple where objects = OR
where: [
  { title: ILike(`%${query}%`), isDeleted: false },
  { content: ILike(`%${query}%`), isDeleted: false },
]

// PostgreSQL array contains — requires Raw or QueryBuilder
where: {
  tags: Raw((alias) => `:tag = ANY(${alias})`, { tag }),
}

// QueryBuilder for complex queries
const posts = await this.postRepository
  .createQueryBuilder('post')
  .where('post.is_deleted = false')
  .andWhere('post.status = :status', { status: 'PUBLISHED' })
  .andWhere(':tag = ANY(post.tags)', { tag: 'jazz' })
  .orderBy('post.published_at', 'DESC')
  .skip(skip)
  .take(limit)
  .getMany();
```

### Pagination

**Prisma** (from the real project):

```typescript
const [rows, total] = await this.prisma.$transaction([
  this.prisma.post.findMany({
    where,
    orderBy: { publishedAt: 'desc' },
    skip,
    take: limit,
  }),
  this.prisma.post.count({ where }),
]);
```

**TypeORM:**

```typescript
// Method 1: findAndCount (single call)
const [rows, total] = await this.postRepository.findAndCount({
  where,
  order: { publishedAt: 'DESC' },
  skip,
  take: limit,
});

// Method 2: QueryBuilder with getManyAndCount
const [rows, total] = await this.postRepository
  .createQueryBuilder('post')
  .where(whereClause)
  .orderBy('post.published_at', 'DESC')
  .skip(skip)
  .take(limit)
  .getManyAndCount();
```

### Field Selection

**Prisma** (from the real project — select specific columns):

```typescript
this.prisma.post.findMany({
  where,
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
  orderBy: { publishedAt: 'desc' },
});
```

**TypeORM:**

```typescript
// Method 1: select option
this.postRepository.find({
  where,
  select: [
    'id',
    'slug',
    'title',
    'excerpt',
    'coverImageUrl',
    'tags',
    'readingMinutes',
    'commentCount',
    'publishedAt',
  ],
  order: { publishedAt: 'DESC' },
});

// Method 2: QueryBuilder with select
this.postRepository
  .createQueryBuilder('post')
  .select(['post.id', 'post.slug', 'post.title', 'post.excerpt'])
  .where(whereClause)
  .getMany();
```

---

## 7. Transactions

### Prisma — Two Modes

**Mode 1: Batched Queries** (from the real project):

```typescript
// Multiple independent queries in one round-trip
const [rows, total] = await this.prisma.$transaction([
  this.prisma.post.findMany({ where, skip, take: limit }),
  this.prisma.post.count({ where }),
]);
```

**Mode 2: Interactive Transaction** (from the real project — soft delete with children):

```typescript
const deleted = await this.prisma.$transaction(async (tx) => {
  // Step 1: Soft-delete all child items
  await tx.categoryItem.updateMany({
    where: { categoryId: id },
    data: { isDeleted: true },
  });

  // Step 2: Soft-delete the category itself
  return tx.category.update({
    where: { id },
    data: { isDeleted: true },
  });
});
```

**Mode 3: Batched updates** (from the real project — reordering):

```typescript
await this.prisma.$transaction(
  dto.ids.map((id, index) =>
    this.prisma.category.update({
      where: { id },
      data: { sortOrder: index },
    }),
  ),
);
```

### TypeORM — Transaction Approaches

```typescript
// Method 1: QueryRunner (most control, manual commit/rollback)
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();
try {
  await queryRunner.manager.update(CategoryItem, { categoryId: id }, { isDeleted: true });
  const deleted = await queryRunner.manager.update(Category, { id }, { isDeleted: true });
  await queryRunner.commitTransaction();
  return deleted;
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}

// Method 2: DataSource.transaction (simpler, auto rollback)
const deleted = await this.dataSource.transaction(async (manager) => {
  await manager.update(CategoryItem, { categoryId: id }, { isDeleted: true });
  return manager.update(Category, { id }, { isDeleted: true });
});
```

### Comparison

| Aspect                   | Prisma                                 | TypeORM                                             |
| ------------------------ | -------------------------------------- | --------------------------------------------------- |
| Batched queries          | `$transaction([query1, query2])`       | No direct equivalent (use `Promise.all` outside tx) |
| Interactive transactions | `$transaction(async (tx) => {})`       | `dataSource.transaction(async (manager) => {})`     |
| Manual commit/rollback   | ❌ Auto-managed only                   | ✅ `QueryRunner` gives full control                 |
| Isolation level          | `$transaction(fn, { isolationLevel })` | `queryRunner.startTransaction('SERIALIZABLE')`      |
| Timeout                  | `$transaction(fn, { timeout: 5000 })`  | Manual with `setTimeout`                            |
| Nested transactions      | ❌ Not supported                       | ✅ Savepoints via QueryRunner                       |

---

## 8. Migrations

### Prisma

```bash
# Create migration from schema diff
npx prisma migrate dev --name add_blog_tables

# Apply in production (no generation, only apply)
npx prisma migrate deploy

# Reset database (dangerous!)
npx prisma migrate reset

# Check migration status
npx prisma migrate status
```

Migration files are auto-generated SQL in `prisma/migrations/<timestamp>_<name>/migration.sql`. You can edit them before applying.

### TypeORM

```bash
# Generate migration from entity diff
npx typeorm migration:generate -d src/data-source.ts src/migrations/AddBlogTables

# Create empty migration (for manual SQL)
npx typeorm migration:create src/migrations/AddBlogTables

# Run pending migrations
npx typeorm migration:run -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts
```

Migration files contain TypeScript with `up()` and `down()` methods:

```typescript
export class AddBlogTables1690000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "posts" (
        "id" uuid DEFAULT uuid_generate_v4() NOT NULL,
        "slug" varchar NOT NULL UNIQUE,
        ...
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "posts"`);
  }
}
```

### Comparison

| Aspect                     | Prisma                        | TypeORM                                 |
| -------------------------- | ----------------------------- | --------------------------------------- |
| Migration format           | Raw SQL (auto-generated)      | TypeScript with `up()`/`down()` methods |
| Auto-generation            | From `.prisma` schema diff    | From entity class diff                  |
| Down migrations            | ❌ No down migrations         | ✅ `down()` method for rollback         |
| Schema push (no migration) | `prisma db push`              | `synchronize: true` (dev only!)         |
| Migration editing          | Edit SQL before `migrate dev` | Edit TypeScript directly                |
| Migration squashing        | ❌ Must reset + re-baseline   | ❌ Manual merge                         |
| Drift detection            | `prisma migrate diff`         | ❌ No built-in tool                     |

---

## 9. Seeding

### Prisma

Defined in `package.json` and run via `npx prisma db seed`:

From the real project — idempotent seeding with `upsert`:

```typescript
const prisma = new PrismaClient();

async function main() {
  // Upsert ensures idempotent re-runs
  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash },
  });

  for (const cat of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, type: cat.type, sortOrder: cat.sortOrder },
      create: { slug: cat.slug, name: cat.name, type: cat.type, sortOrder: cat.sortOrder },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

### TypeORM

TypeORM has no built-in seeding mechanism. Common approaches:

```typescript
// Approach 1: Custom seed script
import { AppDataSource } from './data-source';

async function seed() {
  await AppDataSource.initialize();

  const adminRepo = AppDataSource.getRepository(AdminUser);
  let admin = await adminRepo.findOneBy({ username: 'admin' });
  if (!admin) {
    admin = adminRepo.create({ username: 'admin', passwordHash });
    await adminRepo.save(admin);
  }

  await AppDataSource.destroy();
}

// Approach 2: Use typeorm-extension or typeorm-seeding package
// Approach 3: Put seed logic inside a migration
```

---

## 10. Type Safety

### Prisma — Generated Types

```typescript
import { Post, Comment, Category, CategoryItem } from '@prisma/client';

// Types are auto-generated and always in sync with schema
// Return types of queries are precisely inferred:

const post = await prisma.post.findUnique({ where: { id } });
// post: Post | null ← exact type

const posts = await prisma.post.findMany({
  select: { id: true, slug: true, title: true },
});
// posts: { id: string; slug: string; title: JsonValue }[] ← only selected fields

// You CANNOT pass invalid fields:
await prisma.post.create({
  data: { nonExistentField: 'foo' }, // ← TypeScript error!
});
```

### TypeORM — Decorator-based Types

```typescript
// Types come from your entity classes
const post = await this.postRepository.findOneBy({ id });
// post: Post | null ← entity class type

// Less strict: TypeORM doesn't narrow types based on select
const posts = await this.postRepository.find({
  select: ['id', 'slug'],
});
// posts: Post[] ← still full Post type, not narrowed

// QueryBuilder has even less type safety
const result = await this.postRepository.createQueryBuilder('post').select('post.id').getRawOne();
// result: any
```

### Comparison

| Aspect                  | Prisma                                     | TypeORM                                           |
| ----------------------- | ------------------------------------------ | ------------------------------------------------- |
| Type generation         | Auto-generated from schema                 | Defined by developer in entity classes            |
| Select narrowing        | ✅ Return type matches selected fields     | ❌ Always returns full entity type                |
| Invalid field detection | ✅ Compile-time error                      | ⚠️ Runtime error or silently ignored              |
| Relation types          | Precise (`Post & { comments: Comment[] }`) | Full entity type always                           |
| JSON field types        | `JsonValue` (can be typed with helpers)    | Any type you define on the column                 |
| Query input validation  | ✅ Compile-time typed                      | ⚠️ Partial compile-time, runtime for QueryBuilder |

---

## 11. Raw SQL

### Prisma

```typescript
// Tagged template literal (safe, parameterized)
const users = await prisma.$queryRaw`
  SELECT * FROM admin_users WHERE username = ${username}
`;

// Execute (INSERT/UPDATE/DELETE, returns affected count)
const count = await prisma.$executeRaw`
  UPDATE posts SET view_count = view_count + 1 WHERE id = ${id}
`;

// Unsafe (for dynamic table/column names — use with caution!)
import { Prisma } from '@prisma/client';
const result = await prisma.$queryRawUnsafe(
  `SELECT COUNT(*) FROM posts WHERE status = $1`,
  'PUBLISHED',
);
```

### TypeORM

```typescript
// Via EntityManager
const users = await this.dataSource.query('SELECT * FROM admin_users WHERE username = $1', [
  username,
]);

// Via QueryRunner (inside transactions)
await queryRunner.query('INSERT INTO audit_log (action, entity_id) VALUES ($1, $2)', [
  'DELETE',
  id,
]);
```

---

## 12. Performance & Connection Pooling

### Prisma

```
# Connection pool is managed by the Rust query engine
# Configure via URL params:
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=20&pool_timeout=10"
```

### TypeORM

```typescript
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  extra: {
    max: 20, // Max pool size
    min: 5, // Min pool size
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 10000,
  },
});
```

### Comparison

| Aspect               | Prisma                               | TypeORM                                 |
| -------------------- | ------------------------------------ | --------------------------------------- |
| Pool management      | Rust engine (limited config via URL) | pg pool (fully configurable)            |
| Connection limits    | URL param `?connection_limit=N`      | `poolSize` or `extra.max`               |
| Query logging        | `prisma.$on('query', ...)`           | `logging: true` or `logging: ['query']` |
| Slow query detection | Event listener with duration         | `maxQueryExecutionTime: 1000`           |

---

## 13. Testing

### Prisma (from the real project)

Mock the entire `PrismaService`:

```typescript
describe('BlogService', () => {
  let service: BlogService;
  let prisma: any;

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

    const module = await Test.createTestingModule({
      providers: [BlogService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  it('returns paginated posts', async () => {
    prisma.$transaction.mockResolvedValue([[mockPostRow], 1]);
    const result = await service.getPublicPosts(1, 10);
    expect(result.items).toHaveLength(1);
  });
});
```

### TypeORM

```typescript
describe('BlogService', () => {
  let service: BlogService;
  let postRepository: Repository<Post>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
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
          },
        },
      ],
    }).compile();

    service = module.get(BlogService);
    postRepository = module.get(getRepositoryToken(Post));
  });

  it('returns paginated posts', async () => {
    jest.spyOn(postRepository, 'findAndCount').mockResolvedValue([[mockPostEntity], 1]);
    const result = await service.getPublicPosts(1, 10);
    expect(result.items).toHaveLength(1);
  });
});
```

---

## 14. NestJS Integration

### Prisma in NestJS (from the real project)

```typescript
// prisma.service.ts — extends PrismaClient with lifecycle hooks
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }
  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// prisma.module.ts — global module
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

// Usage in any service — just inject PrismaService
@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}
}
```

### TypeORM in NestJS

```typescript
// app.module.ts — using TypeOrmModule
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get('DATABASE_URL'),
        entities: [Post, Comment, Category],
        synchronize: false,
      }),
    }),
    BlogModule,
  ],
})
export class AppModule {}

// blog.module.ts — register entities per feature module
@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  providers: [BlogService],
})
export class BlogModule {}

// blog.service.ts — inject repository
@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}
}
```

### Key Differences

| Aspect                   | Prisma + NestJS                | TypeORM + NestJS                     |
| ------------------------ | ------------------------------ | ------------------------------------ |
| Module setup             | Custom `PrismaModule` (manual) | `TypeOrmModule.forRoot()` (built-in) |
| Per-feature registration | Not needed (global service)    | `TypeOrmModule.forFeature([Entity])` |
| Injection token          | `PrismaService` class          | `@InjectRepository(Entity)`          |
| Repository pattern       | Single client for all models   | One repository per entity            |

---

## 15. Monorepo / Multi-Package Setup

### Prisma (from the real project)

```
packages/database/
  prisma/schema.prisma      ← Single source of truth
  src/index.ts               ← Re-exports PrismaClient + types
apps/api/
  src/prisma/
    prisma.service.ts        ← Extends PrismaClient for NestJS
    prisma.module.ts
```

```typescript
// packages/database/src/index.ts
export { PrismaClient } from '@prisma/client';
export type * from '@prisma/client';
```

### TypeORM Monorepo

```
packages/database/
  src/entities/              ← Entity classes
  src/migrations/            ← Migration files
  src/data-source.ts         ← DataSource configuration
  src/index.ts               ← Re-exports entities + DataSource
apps/api/
  src/app.module.ts          ← TypeOrmModule.forRoot() with entities
```

---

## 16. Advanced Patterns

### Middleware / Hooks

**Prisma:**

```typescript
// Query-level middleware
prisma.$use(async (params, next) => {
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { isDeleted: true };
  }
  return next(params);
});
```

**TypeORM:**

```typescript
// Entity subscribers (lifecycle hooks)
@EventSubscriber()
export class PostSubscriber implements EntitySubscriberInterface<Post> {
  listenTo() {
    return Post;
  }

  beforeInsert(event: InsertEvent<Post>) {
    event.entity.slug = slugify(event.entity.title.en);
  }
}

// Entity-level hooks (decorators)
@Entity()
export class Post {
  @BeforeInsert()
  generateSlug() {
    this.slug = slugify(this.title.en);
  }
}
```

---

## 17. Production Checklist

| Concern                 | Prisma                               | TypeORM                                        |
| ----------------------- | ------------------------------------ | ---------------------------------------------- |
| **Migrations in CI/CD** | `prisma migrate deploy`              | `typeorm migration:run`                        |
| **Connection pooling**  | URL params + PgBouncer               | `poolSize` + PgBouncer                         |
| **Query logging**       | `$on('query')` + duration            | `logging: ['query']` + `maxQueryExecutionTime` |
| **N+1 prevention**      | Explicit `include` (safe by default) | Avoid `eager: true`, use QueryBuilder          |
| **Soft delete**         | Manual `isDeleted` field             | Built-in `@DeleteDateColumn()`                 |
| **Audit logging**       | Middleware `$use()`                  | Entity subscribers                             |
| **Sync check**          | ❌ Never use `db push` in prod       | ❌ Never use `synchronize: true` in prod       |

---

## 18. When to Choose Which

### Choose Prisma When:

- You want **maximum type safety** with auto-generated types
- Your team values a **declarative, schema-first** approach
- You want **simpler API** — less code for standard CRUD
- Your application is **query-heavy** (reads > writes)

### Choose TypeORM When:

- You need **Active Record pattern** (entity instances with `.save()`)
- You need **maximum SQL control** via QueryBuilder
- You need **lifecycle hooks** on entity classes
- You need **multiple database connections** in a single app
- You need **built-in soft delete** with `@DeleteDateColumn`
- You work with **SQL Server, Oracle, or SAP HANA** (not in Prisma)

> **Bottom Line:** Prisma trades flexibility for safety and simplicity. TypeORM trades simplicity for power and flexibility. Neither is objectively "better" — choose based on your team's priorities and project complexity.
