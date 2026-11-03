# TypeORM — Complete Mastery Guide for Production Systems

> Everything you need to know to build, scale, and maintain production-grade systems with TypeORM.
> Practical examples mapped to real-world patterns from a portfolio/CMS system.

---

Deep TypeORM mastery covering 20 topics — all examples mapped to the same CMS/portfolio domain:

Entity decorators (every column type, embedded entities), Repository API, Active Record vs Data Mapper (with recommendation), QueryBuilder mastery (WHERE, JOINs, subqueries, aggregation, INSERT/UPDATE builders), 4 relation loading strategies, transaction patterns (QueryRunner, DataSource.transaction, savepoints, optimistic locking), migration generation & reversal, entity lifecycle hooks & subscribers, custom repository pattern for NestJS, @DeleteDateColumn soft delete, column transformers, PostgreSQL error codes, and 8 common pitfalls

## Table of Contents

1. [Core Concepts & Mental Model](#1-core-concepts--mental-model)
2. [Project Setup & Architecture](#2-project-setup--architecture)
3. [Entity Design Deep Dive](#3-entity-design-deep-dive)
4. [Repository API — Complete CRUD Reference](#4-repository-api--complete-crud-reference)
5. [Relations & Loading Strategies](#5-relations--loading-strategies)
6. [QueryBuilder Mastery](#6-querybuilder-mastery)
7. [Transactions & Atomicity](#7-transactions--atomicity)
8. [Migrations Mastery](#8-migrations-mastery)
9. [Seeding & Data Management](#9-seeding--data-management)
10. [Active Record vs Data Mapper](#10-active-record-vs-data-mapper)
11. [Raw SQL & Advanced Queries](#11-raw-sql--advanced-queries)
12. [Entity Lifecycle Hooks & Subscribers](#12-entity-lifecycle-hooks--subscribers)
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

### What TypeORM Actually Is

TypeORM is a **traditional ORM** for TypeScript/JavaScript that follows familiar ORM patterns from Java (Hibernate), C# (Entity Framework), and Python (SQLAlchemy):

```
┌──────────────────────────────────────────────────┐
│                   Your App Code                   │
│          (TypeScript / JavaScript)                │
├──────────────────────────────────────────────────┤
│              TypeORM                              │
│   Entity Manager / Repository / QueryBuilder      │
│   Pure TypeScript — no external binary            │
├──────────────────────────────────────────────────┤
│              Database Driver                      │
│   pg / mysql2 / better-sqlite3 / oracledb / etc. │
├──────────────────────────────────────────────────┤
│              Database                             │
│   PostgreSQL / MySQL / SQLite / SQL Server /      │
│   Oracle / CockroachDB / SAP HANA / etc.         │
└──────────────────────────────────────────────────┘
```

### Key Principles

1. **Code-first**: Entity classes with decorators are the source of truth
2. **Two paradigms**: Active Record (entities save themselves) or Data Mapper (repositories handle persistence)
3. **Class instances**: Query results are hydrated class instances (not plain objects)
4. **Full SQL control**: QueryBuilder gives you near-raw SQL power with type hints
5. **Pure TypeScript**: No external binary — everything runs in Node.js

### Active Record vs Data Mapper

```typescript
// === ACTIVE RECORD ===
// The entity knows how to save itself
@Entity()
export class Post extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;
}

// Usage:
const post = new Post();
post.title = 'Hello World';
await post.save(); // Entity saves itself

const posts = await Post.find(); // Static method on entity class
await Post.delete({ id: 'xxx' }); // Static method

// === DATA MAPPER ===
// Repository handles all persistence
@Entity()
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;
}

// Usage:
const postRepository = dataSource.getRepository(Post);
const post = postRepository.create({ title: 'Hello World' });
await postRepository.save(post); // Repository saves entity

const posts = await postRepository.find();
await postRepository.delete({ id: 'xxx' });
```

> **Recommendation:** Use **Data Mapper** for production systems. It's more testable, follows SOLID principles, and separates concerns better.

---

## 2. Project Setup & Architecture

### Basic Setup

```bash
npm install typeorm reflect-metadata pg
npm install -D @types/node typescript ts-node

# Initialize (creates project structure)
npx typeorm init --name my-project --database postgres
```

**Critical:** Add to your entry point:

```typescript
// main.ts — MUST be the first import
import 'reflect-metadata';
```

**tsconfig.json** — Required compiler options:

```json
{
  "compilerOptions": {
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "strictPropertyInitialization": false,
    "target": "ES2021",
    "module": "commonjs",
    "outDir": "./dist",
    "strict": true
  }
}
```

### DataSource Configuration

```typescript
// data-source.ts
import { DataSource, DataSourceOptions } from 'typeorm';
import { Post } from './entities/post.entity';
import { Comment } from './entities/comment.entity';
import { Category } from './entities/category.entity';
import { CategoryItem } from './entities/category-item.entity';

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,

  // Entity registration
  entities: [Post, Comment, Category, CategoryItem],
  // OR use glob pattern:
  // entities: [__dirname + '/entities/**/*.entity{.ts,.js}'],

  // Migration files
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],

  // Connection pool
  extra: {
    max: 20,
    min: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  },

  // Logging
  logging: process.env.NODE_ENV !== 'production' ? ['query', 'error'] : ['error'],
  maxQueryExecutionTime: 1000, // Log queries slower than 1s

  // Schema sync (NEVER true in production!)
  synchronize: false,

  // SSL for cloud databases
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

export const AppDataSource = new DataSource(dataSourceOptions);
```

### Project Structure

```
src/
├── entities/
│   ├── post.entity.ts
│   ├── comment.entity.ts
│   ├── category.entity.ts
│   ├── category-item.entity.ts
│   ├── admin-user.entity.ts
│   └── contact-submission.entity.ts
├── migrations/
│   ├── 1700000000000-InitSchema.ts
│   └── 1700000000001-AddComments.ts
├── repositories/           (optional — custom repos)
│   └── post.repository.ts
├── services/
│   ├── blog.service.ts
│   └── comments.service.ts
├── data-source.ts
└── main.ts
```

---

## 3. Entity Design Deep Dive

### Complete Entity Example

Equivalent to the Prisma `Post` model from the jazz-portfolio project:

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Comment } from './comment.entity';

@Entity('posts')
@Index('idx_posts_deleted_status_published', ['isDeleted', 'status', 'publishedAt'])
@Index('idx_posts_status_published', ['status', 'publishedAt'])
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  slug: string;

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  title: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  excerpt: { en: string; vi: string; ja: string };

  @Column({ type: 'jsonb', default: () => `'{"en":"","vi":"","ja":""}'` })
  content: { en: string; vi: string; ja: string };

  @Column({ name: 'cover_image_url', type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'varchar', default: 'DRAFT' })
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @OneToMany(() => Comment, (comment) => comment.post, { cascade: true })
  comments: Comment[];
}
```

### Column Types Reference

```typescript
@Entity()
export class AllColumnTypes {
  // === Primary Keys ===
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @PrimaryGeneratedColumn() // Auto-increment integer
  autoId: number;

  @PrimaryColumn() // Manual primary key
  customId: string;

  // === Scalar Types ===
  @Column() // Inferred from TypeScript type
  name: string; // → varchar(255)

  @Column({ type: 'varchar', length: 254 })
  email: string; // → varchar(254)

  @Column({ type: 'text' })
  description: string; // → text (unlimited)

  @Column({ type: 'int' })
  age: number; // → integer

  @Column({ type: 'float' })
  price: number; // → double precision

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: string; // → decimal(10,2) — string to avoid precision loss!

  @Column({ type: 'bigint' })
  bigNumber: string; // → bigint — string to avoid precision loss!

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // → boolean

  @Column({ type: 'jsonb', default: () => "'{}'" })
  metadata: Record<string, any>; // → jsonb

  @Column({ type: 'bytea' })
  binaryData: Buffer; // → bytea

  // === Date/Time ===
  @Column({ type: 'timestamp' })
  eventTime: Date; // → timestamp without time zone

  @Column({ type: 'timestamptz' })
  utcTime: Date; // → timestamp with time zone

  @Column({ type: 'date' })
  birthDate: string; // → date

  @Column({ type: 'time' })
  startTime: string; // → time

  // === Special Columns ===
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date; // Auto-set on INSERT

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date; // Auto-set on INSERT and UPDATE

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null; // For built-in soft delete

  @VersionColumn()
  version: number; // Optimistic locking counter

  // === Arrays (PostgreSQL only) ===
  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column('int', { array: true, default: '{}' })
  scores: number[];

  // === Enums ===
  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;
  // OR using string column (more portable):
  @Column({ type: 'varchar', default: 'USER' })
  role: string;

  // === Nullable & Default ===
  @Column({ nullable: true })
  optionalField: string | null;

  @Column({ default: 'hello' })
  withDefault: string;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  withSqlDefault: Date;

  // === Column transformers ===
  @Column({
    type: 'varchar',
    transformer: {
      to: (value: string) => value.toLowerCase(), // Before INSERT/UPDATE
      from: (value: string) => value.toUpperCase(), // After SELECT
    },
  })
  normalizedEmail: string;
}
```

### Enum Handling

```typescript
// Option 1: PostgreSQL native enum
export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

@Column({ type: 'enum', enum: PostStatus, default: PostStatus.DRAFT })
status: PostStatus;

// Option 2: String column (more portable, easier to migrate)
@Column({ type: 'varchar', length: 20, default: 'DRAFT' })
status: string;
```

### Relations Complete Reference

```typescript
// === ONE-TO-MANY / MANY-TO-ONE ===
@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToMany(() => CategoryItem, (item) => item.category, {
    cascade: true, // Auto-save/delete related items
    eager: false, // Don't auto-load (default)
  })
  items: CategoryItem[];
}

@Entity('category_items')
export class CategoryItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'category_id' })
  categoryId: string; // Store FK as a regular column too

  @ManyToOne(() => Category, (cat) => cat.items, {
    onDelete: 'CASCADE', // Delete items when category deleted
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: Category;
}

// === ONE-TO-ONE ===
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Profile, (profile) => profile.user, { cascade: true })
  profile: Profile;
}

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @OneToOne(() => User, (user) => user.profile)
  @JoinColumn({ name: 'user_id' }) // JoinColumn goes on the owning side
  user: User;
}

// === MANY-TO-MANY (auto join table) ===
@Entity('posts')
export class Post {
  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'post_tags', // Custom join table name
    joinColumn: { name: 'post_id' },
    inverseJoinColumn: { name: 'tag_id' },
  })
  tags: Tag[];
}

@Entity('tags')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToMany(() => Post, (post) => post.tags)
  posts: Post[];
}

// === MANY-TO-MANY (explicit join entity — more control) ===
@Entity('post_categories')
export class PostCategory {
  @PrimaryColumn({ name: 'post_id' })
  postId: string;

  @PrimaryColumn({ name: 'category_id' })
  categoryId: string;

  @Column({ name: 'assigned_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assignedAt: Date;

  @ManyToOne(() => Post, (post) => post.categories, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post: Post;

  @ManyToOne(() => Category, (cat) => cat.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;
}

// === SELF-REFERENCING (threaded comments) ===
@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'parent_id', nullable: true })
  parentId: string | null;

  @ManyToOne(() => Comment, (c) => c.replies, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Comment | null;

  @OneToMany(() => Comment, (c) => c.parent)
  replies: Comment[];
}
```

### Indexes and Constraints

```typescript
import { Entity, Index, Unique, Check } from 'typeorm';

// Table-level indexes (decorator on class)
@Entity('posts')
@Index('idx_posts_status_published', ['status', 'publishedAt'])
@Index('idx_posts_slug', ['slug'], { unique: true })
@Index('idx_posts_search', { synchronize: false }) // Managed manually via migration
@Unique(['slug']) // Unique constraint (different from unique index)
@Check(`"status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED')`)
export class Post {
  // Column-level unique
  @Column({ unique: true })
  slug: string;

  // Column-level index
  @Index()
  @Column()
  status: string;
}
```

> **Note:** TypeORM cannot create GIN indexes via decorators. Use a raw migration for PostgreSQL-specific index types.

### Embedded Entities

```typescript
// For reusable column groups
export class LocalizedString {
  @Column({ type: 'varchar', default: '' })
  en: string;

  @Column({ type: 'varchar', default: '' })
  vi: string;

  @Column({ type: 'varchar', default: '' })
  ja: string;
}

@Entity('posts')
export class Post {
  @Column(() => LocalizedString, { prefix: 'title' })
  title: LocalizedString;
  // Creates columns: title_en, title_vi, title_ja
}
```

---

## 4. Repository API — Complete CRUD Reference

### Create

```typescript
// Method 1: create() + save() — two steps, triggers hooks
const post = postRepository.create({
  slug: 'my-post',
  title: { en: 'Hello', vi: 'Xin chào', ja: 'こんにちは' },
  tags: ['tech', 'nodejs'],
  status: 'DRAFT',
});
const savedPost = await postRepository.save(post);

// Method 2: save() directly — single step
const savedPost = await postRepository.save({
  slug: 'my-post',
  title: { en: 'Hello' },
});

// Method 3: insert() — direct INSERT, no hooks, returns InsertResult
const result = await postRepository.insert({
  slug: 'my-post',
  title: { en: 'Hello' },
});
// result.identifiers → [{ id: 'uuid' }]

// Bulk insert
const result = await postRepository.insert([
  { slug: 'post-1', title: { en: 'Post 1' } },
  { slug: 'post-2', title: { en: 'Post 2' } },
]);

// Create with nested relations (cascade must be enabled)
const category = categoryRepository.create({
  name: { en: 'Skills' },
  slug: 'skills',
  items: [
    { title: { en: 'TypeScript' }, sortOrder: 0 },
    { title: { en: 'PostgreSQL' }, sortOrder: 1 },
  ],
});
await categoryRepository.save(category);
```

### Read

```typescript
// Find by primary key
const post = await postRepository.findOneBy({ id: 'uuid' });
// post: Post | null

// Find with conditions
const post = await postRepository.findOne({
  where: { slug: 'my-post', isDeleted: false, status: 'PUBLISHED' },
});

// Find or throw
const post = await postRepository.findOneByOrFail({ id: 'uuid' });
// Throws EntityNotFoundError if not found

// Find many
const posts = await postRepository.find({
  where: { status: 'PUBLISHED', isDeleted: false },
  order: { publishedAt: 'DESC' },
  skip: 0,
  take: 10,
});

// Find with relations
const posts = await postRepository.find({
  where: { isDeleted: false },
  relations: { comments: true },
  order: { publishedAt: 'DESC' },
});

// Find with select (specific columns)
const posts = await postRepository.find({
  where: { isDeleted: false },
  select: ['id', 'slug', 'title', 'publishedAt'],
});
// Note: Still returns Post[] type, not narrowed

// Find and count (pagination)
const [posts, total] = await postRepository.findAndCount({
  where: { status: 'PUBLISHED', isDeleted: false },
  order: { publishedAt: 'DESC' },
  skip: 0,
  take: 10,
});

// Count
const count = await postRepository.count({
  where: { status: 'PUBLISHED' },
});

// Count by
const count = await postRepository.countBy({ status: 'PUBLISHED' });

// Check existence
const exists = await postRepository.existsBy({ slug: 'my-post' });

// Sum / Average / Min / Max
const sum = await postRepository.sum('viewCount', { status: 'PUBLISHED' });
const avg = await postRepository.average('viewCount', { status: 'PUBLISHED' });
const max = await postRepository.maximum('viewCount', { status: 'PUBLISHED' });
const min = await postRepository.minimum('viewCount', { status: 'PUBLISHED' });
```

### Update

```typescript
// Method 1: Load + modify + save (triggers hooks, returns entity)
const post = await postRepository.findOneBy({ id });
post.status = 'PUBLISHED';
post.publishedAt = new Date();
await postRepository.save(post);

// Method 2: update() — direct UPDATE, no hooks, returns UpdateResult
await postRepository.update({ id }, { status: 'PUBLISHED', publishedAt: new Date() });
// Returns: { affected: 1, ... }

// Method 3: update() with conditions
await postRepository.update(
  { categoryId: id }, // WHERE clause
  { isDeleted: true }, // SET clause
);

// Increment / Decrement
await postRepository.increment({ id }, 'viewCount', 1);
await postRepository.decrement({ id }, 'commentCount', 1);

// Update with QueryBuilder (most flexible)
await postRepository
  .createQueryBuilder()
  .update(Post)
  .set({
    viewCount: () => '"view_count" + 1',
    updatedAt: () => 'CURRENT_TIMESTAMP',
  })
  .where('id = :id', { id })
  .execute();
```

### Delete

```typescript
// Hard delete by ID
await postRepository.delete(id);

// Hard delete by conditions
await postRepository.delete({ status: 'SPAM', isDeleted: true });

// Remove (load first, then delete — triggers hooks)
const post = await postRepository.findOneBy({ id });
await postRepository.remove(post);

// Soft delete (built-in — requires @DeleteDateColumn)
await postRepository.softDelete(id); // Sets deletedAt = now()
await postRepository.restore(id); // Sets deletedAt = null

// Soft delete — find operations automatically exclude soft-deleted records
const posts = await postRepository.find(); // Only non-deleted
const allPosts = await postRepository.find({ withDeleted: true }); // Include deleted
```

### Upsert

```typescript
// Upsert (TypeORM 0.3+)
await postRepository.upsert(
  {
    slug: 'my-post',
    title: { en: 'Hello' },
    status: 'DRAFT',
  },
  {
    conflictPaths: ['slug'], // ON CONFLICT (slug)
    skipUpdateIfNoValuesChanged: true, // Don't update if same values
  },
);

// Bulk upsert
await postRepository.upsert(
  [
    { slug: 'post-1', title: { en: 'Post 1' } },
    { slug: 'post-2', title: { en: 'Post 2' } },
  ],
  { conflictPaths: ['slug'] },
);

// Upsert with specific update columns
await postRepository.upsert(
  { slug: 'my-post', title: { en: 'Updated' }, status: 'PUBLISHED' },
  {
    conflictPaths: ['slug'],
    upsertType: 'on-conflict-do-update',
  },
);
```

---

## 5. Relations & Loading Strategies

### Strategy 1: `relations` Option (Similar to Prisma's `include`)

```typescript
// Load category with its items
const categories = await categoryRepository.find({
  where: { isDeleted: false, isActive: true },
  relations: {
    items: true,
  },
  order: { sortOrder: 'ASC' },
});

// Nested relations
const comment = await commentRepository.findOne({
  where: { id },
  relations: {
    post: true,
    parent: true,
    replies: {
      replies: true, // Grandchild comments
    },
  },
});
```

### Strategy 2: Eager Loading (On Entity Definition)

```typescript
@Entity()
export class Post {
  // WARNING: This loads comments on EVERY post query!
  @OneToMany(() => Comment, (c) => c.post, { eager: true })
  comments: Comment[];
}

// Now every find() automatically includes comments
const post = await postRepository.findOneBy({ id });
// post.comments is already loaded
```

> ⚠️ **Avoid `eager: true` in production.** It causes performance problems as your data grows.

### Strategy 3: QueryBuilder Joins (Most Flexible)

```typescript
// Equivalent to Prisma's include + select on relations
const comments = await commentRepository
  .createQueryBuilder('comment')
  .leftJoinAndSelect('comment.post', 'post')
  .addSelect(['post.slug', 'post.title'])
  .where('comment.isDeleted = :isDeleted', { isDeleted: false })
  .orderBy('comment.createdAt', 'DESC')
  .skip(skip)
  .take(limit)
  .getMany();
```

### Strategy 4: Lazy Loading

```typescript
@Entity()
export class Post {
  @OneToMany(() => Comment, (c) => c.post, { lazy: true })
  comments: Promise<Comment[]>; // Note the Promise type
}

// Usage:
const post = await postRepository.findOneBy({ id });
const comments = await post.comments; // SQL executes HERE
```

### Loading Relations After the Fact

```typescript
// Method 1: Using relation loader
const post = await postRepository.findOneBy({ id });
const comments = await commentRepository.find({
  where: { postId: post.id },
});

// Method 2: Using createQueryBuilder to load specific relation
const commentsQB = await postRepository
  .createQueryBuilder()
  .relation(Post, 'comments')
  .of(postId)
  .loadMany();
```

### Filtering on Relations

```typescript
// TypeORM cannot filter on relations in find() options
// You MUST use QueryBuilder for this

// ❌ This does NOT filter — it loads ALL items, then joins
const categories = await categoryRepository.find({
  relations: { items: true },
  // No way to filter items here!
});

// ✅ Use QueryBuilder to filter related records
const categories = await categoryRepository
  .createQueryBuilder('category')
  .leftJoinAndSelect(
    'category.items',
    'item',
    'item.is_deleted = :del AND item.is_active = :active',
    { del: false, active: true },
  )
  .where('category.is_deleted = false AND category.is_active = true')
  .orderBy('category.sort_order', 'ASC')
  .addOrderBy('item.sort_order', 'ASC')
  .getMany();
```

---

## 6. QueryBuilder Mastery

### Basic QueryBuilder

```typescript
const posts = await postRepository
  .createQueryBuilder('post') // 'post' is the alias
  .where('post.isDeleted = :del', { del: false })
  .andWhere('post.status = :status', { status: 'PUBLISHED' })
  .orderBy('post.publishedAt', 'DESC')
  .skip(skip)
  .take(limit)
  .getMany(); // Returns Post[]
```

### SELECT Variations

```typescript
// Get entities (hydrated class instances)
.getMany()          // Post[]
.getOne()           // Post | null
.getOneOrFail()     // Post (throws if not found)

// Get raw results (plain objects)
.getRawMany()       // any[]
.getRawOne()        // any | null
.getRawAndEntities() // { entities: Post[], raw: any[] }

// Get count
.getCount()         // number

// Get entities with count
.getManyAndCount()  // [Post[], number]
```

### WHERE Conditions

```typescript
// Simple conditions
.where('post.status = :status', { status: 'PUBLISHED' })
.andWhere('post.isDeleted = false')
.orWhere('post.status = :alt', { alt: 'FEATURED' })

// IN operator
.where('post.status IN (:...statuses)', { statuses: ['DRAFT', 'PUBLISHED'] })

// LIKE / ILIKE
.where('post.slug ILIKE :search', { search: `%${query}%` })

// NULL checks
.where('post.publishedAt IS NOT NULL')
.where('post.publishedAt IS NULL')

// Between
.where('post.viewCount BETWEEN :min AND :max', { min: 10, max: 100 })

// Subquery
.where('post.id IN ' +
  postRepository.createQueryBuilder('sub')
    .select('sub.id')
    .where('sub.viewCount > :minViews', { minViews: 100 })
    .getQuery()
)

// Brackets (complex OR/AND groups)
.where(new Brackets((qb) => {
  qb.where('post.status = :status1', { status1: 'PUBLISHED' })
    .orWhere('post.status = :status2', { status2: 'FEATURED' });
}))
.andWhere('post.isDeleted = false')
// → WHERE (status = 'PUBLISHED' OR status = 'FEATURED') AND is_deleted = false

// PostgreSQL array contains
.where(':tag = ANY(post.tags)', { tag: 'jazz' })

// JSON field access (PostgreSQL)
.where("post.title->>'en' ILIKE :search", { search: `%${query}%` })
```

### JOINs

```typescript
// LEFT JOIN + SELECT (load relation data)
.leftJoinAndSelect('post.comments', 'comment')

// LEFT JOIN with condition
.leftJoinAndSelect(
  'post.comments', 'comment',
  'comment.status = :cs AND comment.is_deleted = false',
  { cs: 'APPROVED' }
)

// LEFT JOIN without SELECT (for filtering only)
.leftJoin('post.comments', 'comment')
.where('comment.status = :s', { s: 'APPROVED' })

// INNER JOIN (only posts WITH comments)
.innerJoinAndSelect('post.comments', 'comment')

// Partial SELECT on joined entity
.leftJoin('comment.post', 'post')
.addSelect(['post.slug', 'post.title'])

// Multiple joins
.leftJoinAndSelect('post.comments', 'comment')
.leftJoinAndSelect('comment.replies', 'reply')
.leftJoin('post.author', 'author')
.addSelect(['author.name', 'author.avatar'])
```

### Aggregation

```typescript
// Count per status
const stats = await postRepository
  .createQueryBuilder('post')
  .select('post.status', 'status')
  .addSelect('COUNT(*)', 'count')
  .addSelect('AVG(post.view_count)', 'avgViews')
  .groupBy('post.status')
  .getRawMany();
// → [{ status: 'PUBLISHED', count: '42', avgViews: '156.3' }, ...]

// HAVING
.groupBy('post.status')
.having('COUNT(*) > :min', { min: 5 })

// Window functions
const ranked = await postRepository
  .createQueryBuilder('post')
  .select('post.*')
  .addSelect('ROW_NUMBER() OVER (PARTITION BY post.status ORDER BY post.view_count DESC)', 'rank')
  .getRawMany();
```

### Subqueries

```typescript
// Subquery in WHERE
const topPosts = await postRepository
  .createQueryBuilder('post')
  .where((qb) => {
    const subQuery = qb
      .subQuery()
      .select('comment.postId')
      .from(Comment, 'comment')
      .where('comment.status = :s', { s: 'APPROVED' })
      .groupBy('comment.postId')
      .having('COUNT(*) > :min', { min: 5 })
      .getQuery();
    return `post.id IN ${subQuery}`;
  })
  .setParameter('s', 'APPROVED')
  .setParameter('min', 5)
  .getMany();

// Subquery in SELECT
const postsWithCommentCount = await postRepository
  .createQueryBuilder('post')
  .addSelect((subQuery) => {
    return subQuery
      .select('COUNT(*)')
      .from(Comment, 'comment')
      .where('comment.postId = post.id')
      .andWhere('comment.status = :s');
  }, 'commentCount')
  .setParameter('s', 'APPROVED')
  .getRawMany();
```

### INSERT / UPDATE / DELETE QueryBuilder

```typescript
// INSERT
await dataSource
  .createQueryBuilder()
  .insert()
  .into(Post)
  .values([
    { slug: 'post-1', title: { en: 'Post 1' } },
    { slug: 'post-2', title: { en: 'Post 2' } },
  ])
  .orIgnore() // Skip on conflict
  // .orUpdate(['title'], ['slug'])  // Update on conflict
  .execute();

// UPDATE
await postRepository
  .createQueryBuilder()
  .update(Post)
  .set({
    status: 'PUBLISHED',
    publishedAt: () => 'CURRENT_TIMESTAMP',
    viewCount: () => '"view_count" + 1',
  })
  .where('id = :id', { id })
  .execute();

// DELETE
await commentRepository
  .createQueryBuilder()
  .delete()
  .from(Comment)
  .where('status = :s AND is_deleted = true', { s: 'SPAM' })
  .execute();
```

---

## 7. Transactions & Atomicity

### Method 1: `DataSource.transaction()` (Recommended)

```typescript
// Auto commit/rollback — rollback on any thrown error
const result = await dataSource.transaction(async (manager) => {
  // All operations use the transactional manager
  await manager.update(CategoryItem, { categoryId: id }, { isDeleted: true });

  const deleted = await manager.findOneBy(Category, { id });
  if (!deleted) throw new Error('Category not found');

  await manager.update(Category, { id }, { isDeleted: true });
  return deleted;
});
```

### Method 2: `QueryRunner` (Full Control)

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Use queryRunner.manager for all operations inside the transaction
  await queryRunner.manager.update(CategoryItem, { categoryId: id }, { isDeleted: true });

  await queryRunner.manager.update(Category, { id }, { isDeleted: true });

  // Explicit commit
  await queryRunner.commitTransaction();
} catch (err) {
  // Explicit rollback
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  // ALWAYS release the query runner
  await queryRunner.release();
}
```

### Isolation Levels

```typescript
// DataSource.transaction with isolation level
await dataSource.transaction('SERIALIZABLE', async (manager) => {
  // Operations run with SERIALIZABLE isolation
});

// QueryRunner with isolation level
await queryRunner.startTransaction('READ COMMITTED');
// Options: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'
```

### Savepoints (Nested Transactions)

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  await queryRunner.manager.save(order);

  // Create a savepoint
  await queryRunner.query('SAVEPOINT process_items');

  try {
    for (const item of items) {
      await queryRunner.manager.save(item);
    }
  } catch {
    // Rollback only to the savepoint
    await queryRunner.query('ROLLBACK TO SAVEPOINT process_items');
    // Order is still saved!
  }

  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}
```

### Transaction Patterns

```typescript
// Pattern: Batch reorder (equivalent to Prisma's batched transaction)
await dataSource.transaction(async (manager) => {
  for (let i = 0; i < dto.ids.length; i++) {
    await manager.update(Category, { id: dto.ids[i] }, { sortOrder: i });
  }
});

// Pattern: Optimistic locking with @VersionColumn
@Entity()
export class Post {
  @VersionColumn()
  version: number;
}

// This automatically checks version before update
try {
  await postRepository.save(post);
} catch (error) {
  if (error instanceof OptimisticLockVersionMismatchError) {
    // Someone else updated this record — handle conflict
    throw new ConflictException('Record was modified by another request');
  }
}
```

---

## 8. Migrations Mastery

### CLI Commands

```bash
# Generate migration from entity changes
npx typeorm migration:generate -d src/data-source.ts src/migrations/AddBlogTables
# Compares entities to database schema, generates diff

# Create empty migration (for manual SQL)
npx typeorm migration:create src/migrations/SeedInitialData

# Run all pending migrations
npx typeorm migration:run -d src/data-source.ts

# Revert last migration
npx typeorm migration:revert -d src/data-source.ts

# Show migration status
npx typeorm migration:show -d src/data-source.ts
```

### Migration File Structure

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class AddBlogTables1700000000000 implements MigrationInterface {
  // Optional: set to true for auto-generated migrations
  public name = 'AddBlogTables1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // === Create table ===
    await queryRunner.createTable(
      new Table({
        name: 'posts',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'slug',
            type: 'varchar',
            isUnique: true,
          },
          {
            name: 'title',
            type: 'jsonb',
            default: `'{"en":"","vi":"","ja":""}'`,
          },
          {
            name: 'status',
            type: 'varchar',
            default: `'DRAFT'`,
          },
          {
            name: 'tags',
            type: 'text',
            isArray: true,
            default: `'{}'`,
          },
          {
            name: 'view_count',
            type: 'int',
            default: 0,
          },
          {
            name: 'is_deleted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'published_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true, // ifNotExists
    );

    // === Create index ===
    await queryRunner.createIndex(
      'posts',
      new TableIndex({
        name: 'idx_posts_status_published',
        columnNames: ['status', 'published_at'],
      }),
    );

    // === GIN index (raw SQL needed) ===
    await queryRunner.query(`
      CREATE INDEX idx_posts_tags ON posts USING GIN (tags)
    `);

    // === Data migration ===
    await queryRunner.query(`
      UPDATE posts SET reading_minutes = GREATEST(1,
        LENGTH(title->>'en') / 200)
      WHERE reading_minutes = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('posts', 'idx_posts_tags');
    await queryRunner.dropIndex('posts', 'idx_posts_status_published');
    await queryRunner.dropTable('posts');
  }
}
```

### Auto-Generated Migration (raw SQL style)

```typescript
// Generated by: typeorm migration:generate
export class AddComments1700000000001 implements MigrationInterface {
  name = 'AddComments1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "post_id" uuid NOT NULL,
        "parent_id" uuid,
        "author_name" varchar(60) NOT NULL,
        "body" varchar(2000) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "is_deleted" boolean NOT NULL DEFAULT false,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
      ADD CONSTRAINT "FK_comments_post"
      FOREIGN KEY ("post_id") REFERENCES "posts"("id")
      ON DELETE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
```

### CI/CD Migration Pattern

```bash
# In CI/CD pipeline:
npx typeorm migration:run -d dist/data-source.js

# In package.json:
{
  "scripts": {
    "migration:run": "typeorm migration:run -d dist/data-source.js",
    "migration:revert": "typeorm migration:revert -d dist/data-source.js",
    "migration:generate": "typeorm migration:generate -d src/data-source.ts"
  }
}
```

---

## 9. Seeding & Data Management

TypeORM has **no built-in seeding** mechanism. Here are the best approaches:

### Approach 1: Custom Seed Script

```typescript
// scripts/seed.ts
import 'reflect-metadata';
import { AppDataSource } from '../data-source';
import { AdminUser } from '../entities/admin-user.entity';
import { Category } from '../entities/category.entity';
import * as bcrypt from 'bcrypt';

async function seed() {
  await AppDataSource.initialize();
  console.log('🌱 Seeding database...');

  const adminRepo = AppDataSource.getRepository(AdminUser);
  const categoryRepo = AppDataSource.getRepository(Category);

  // Idempotent admin creation
  const existingAdmin = await adminRepo.findOneBy({ username: 'admin' });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash('admin123', 12);
    await adminRepo.save(adminRepo.create({ username: 'admin', passwordHash }));
    console.log('  ✓ Admin user created');
  }

  // Upsert categories
  const categories = [
    { slug: 'skills', name: { en: 'Skills' }, sortOrder: 0 },
    { slug: 'experience', name: { en: 'Experience' }, sortOrder: 1 },
    { slug: 'education', name: { en: 'Education' }, sortOrder: 2 },
  ];

  for (const cat of categories) {
    await categoryRepo.upsert(cat, { conflictPaths: ['slug'] });
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

```json
// package.json
{
  "scripts": {
    "seed": "ts-node scripts/seed.ts"
  }
}
```

### Approach 2: Seed Migration (Runs Once)

```typescript
// migrations/1700000000099-SeedInitialData.ts
export class SeedInitialData1700000000099 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const passwordHash = await bcrypt.hash('admin123', 12);

    await queryRunner.query(
      `
      INSERT INTO admin_users (username, password_hash)
      VALUES ('admin', $1)
      ON CONFLICT (username) DO NOTHING
    `,
      [passwordHash],
    );

    await queryRunner.query(`
      INSERT INTO categories (slug, name, sort_order)
      VALUES
        ('skills', '{"en":"Skills"}', 0),
        ('experience', '{"en":"Experience"}', 1)
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM categories WHERE slug IN ('skills', 'experience')`);
    await queryRunner.query(`DELETE FROM admin_users WHERE username = 'admin'`);
  }
}
```

### Approach 3: typeorm-extension Package

```bash
npm install typeorm-extension
```

```typescript
// seeds/admin.seeder.ts
import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { AdminUser } from '../entities/admin-user.entity';

export class AdminSeeder implements Seeder {
  public async run(dataSource: DataSource, factoryManager: SeederFactoryManager): Promise<void> {
    const repo = dataSource.getRepository(AdminUser);
    await repo.insert({ username: 'admin', passwordHash: '...' });
  }
}
```

---

## 10. Active Record vs Data Mapper

### Active Record Pattern

```typescript
// Entity extends BaseEntity
import { BaseEntity, Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('posts')
export class Post extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  slug: string;

  @Column({ default: 'DRAFT' })
  status: string;
}

// Usage — entity knows how to persist itself
const post = new Post();
post.slug = 'hello';
post.status = 'DRAFT';
await post.save(); // Post.save() — instance method

// Static methods for querying
const posts = await Post.find({ where: { status: 'PUBLISHED' } });
const post = await Post.findOneBy({ id: 'uuid' });
const count = await Post.count({ where: { status: 'PUBLISHED' } });
await Post.delete({ id: 'uuid' });
```

### Data Mapper Pattern (Recommended)

```typescript
// Entity is a plain class — no BaseEntity
@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  slug: string;

  @Column({ default: 'DRAFT' })
  status: string;
}

// Repository handles all persistence
@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async create(slug: string) {
    const post = this.postRepository.create({ slug, status: 'DRAFT' });
    return this.postRepository.save(post);
  }

  async findPublished() {
    return this.postRepository.find({ where: { status: 'PUBLISHED' } });
  }
}
```

### Why Data Mapper is Better for Production

| Concern                    | Active Record                       | Data Mapper                          |
| -------------------------- | ----------------------------------- | ------------------------------------ |
| **Testability**            | Hard to mock — static methods       | Easy to mock — inject repository     |
| **Separation of concerns** | Entity = data + persistence logic   | Entity = data only                   |
| **Dependency injection**   | Not DI-friendly                     | Works perfectly with NestJS DI       |
| **Multiple databases**     | Tricky to use different DataSources | Easy — inject different repositories |
| **SOLID principles**       | Violates SRP                        | Follows SRP                          |

---

## 11. Raw SQL & Advanced Queries

### Using `query()` Method

```typescript
// Direct SQL query
const posts = await dataSource.query(
  'SELECT * FROM posts WHERE status = $1 AND is_deleted = false',
  ['PUBLISHED'],
);
// Returns: any[] — raw row objects

// Insert with returning
const [inserted] = await dataSource.query(
  `INSERT INTO posts (slug, title, status)
   VALUES ($1, $2, $3)
   RETURNING *`,
  ['my-post', '{"en":"Hello"}', 'DRAFT'],
);

// Complex aggregation
const stats = await dataSource.query(`
  SELECT
    p.status,
    COUNT(*) as post_count,
    COALESCE(SUM(p.view_count), 0) as total_views,
    COALESCE(AVG(p.view_count), 0) as avg_views,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.status = 'APPROVED') as approved_comments
  FROM posts p
  WHERE p.is_deleted = false
  GROUP BY p.status
`);
```

### QueryRunner for Raw SQL in Transactions

```typescript
const queryRunner = dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Recalculate all comment counts
  await queryRunner.query(`
    UPDATE posts SET comment_count = (
      SELECT COUNT(*)
      FROM comments
      WHERE comments.post_id = posts.id
      AND comments.status = 'APPROVED'
      AND comments.is_deleted = false
    )
  `);

  await queryRunner.commitTransaction();
} catch (err) {
  await queryRunner.rollbackTransaction();
  throw err;
} finally {
  await queryRunner.release();
}
```

---

## 12. Entity Lifecycle Hooks & Subscribers

### Entity-Level Hooks (Decorators)

```typescript
@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  slug: string;

  @Column({ type: 'jsonb' })
  title: { en: string; vi: string; ja: string };

  // === Lifecycle hooks ===

  @BeforeInsert()
  generateSlugIfMissing() {
    if (!this.slug && this.title?.en) {
      this.slug = this.title.en
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  }

  @BeforeUpdate()
  validateStatus() {
    if (this.status === 'PUBLISHED' && !this.publishedAt) {
      this.publishedAt = new Date();
    }
  }

  @AfterLoad()
  computeFlags() {
    // Computed property available after loading from DB
    this.isCommentsClosed = !!(this.commentsClosedAt && this.commentsClosedAt <= new Date());
  }

  @AfterInsert()
  logCreation() {
    console.log(`Post ${this.id} created`);
  }

  @AfterUpdate()
  logUpdate() {
    console.log(`Post ${this.id} updated`);
  }

  @BeforeRemove()
  checkCanDelete() {
    if (this.status === 'PUBLISHED') {
      throw new Error('Cannot delete published posts');
    }
  }

  // Non-persisted computed field
  isCommentsClosed: boolean;
}
```

> ⚠️ **Entity hooks only fire when using `save()`/`remove()`**, NOT when using `update()`/`delete()`/`insert()`.

### Entity Subscribers (Global Hooks)

```typescript
import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
} from 'typeorm';
import { Post } from './entities/post.entity';

@EventSubscriber()
export class PostSubscriber implements EntitySubscriberInterface<Post> {
  // Specify which entity to listen to
  listenTo() {
    return Post;
  }

  beforeInsert(event: InsertEvent<Post>) {
    console.log(`BEFORE POST INSERT: `, event.entity);
    // Modify entity before insert
    event.entity.slug = event.entity.slug.toLowerCase();
  }

  afterInsert(event: InsertEvent<Post>) {
    console.log(`POST INSERTED: ${event.entity.id}`);
    // Fire side effects (e.g., cache invalidation)
  }

  beforeUpdate(event: UpdateEvent<Post>) {
    // Access both old and new values
    console.log(`Updating post from ${event.databaseEntity?.status} to ${event.entity?.status}`);
  }

  afterUpdate(event: UpdateEvent<Post>) {
    console.log(`POST UPDATED: ${event.entity?.id}`);
  }

  afterRemove(event: RemoveEvent<Post>) {
    console.log(`POST REMOVED: ${event.entityId}`);
  }
}

// Register subscriber in DataSource config
const dataSourceOptions = {
  subscribers: [PostSubscriber],
  // OR use glob pattern:
  // subscribers: [__dirname + '/subscribers/**/*{.ts,.js}'],
};
```

### Audit Log Subscriber

```typescript
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  // Listen to ALL entities (no listenTo method)

  async afterInsert(event: InsertEvent<any>) {
    await this.log(event, 'INSERT');
  }

  async afterUpdate(event: UpdateEvent<any>) {
    await this.log(event, 'UPDATE');
  }

  async afterRemove(event: RemoveEvent<any>) {
    await this.log(event, 'DELETE');
  }

  private async log(event: any, action: string) {
    const entity = event.entity || event.databaseEntity;
    if (!entity) return;

    await event.manager.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, timestamp)
       VALUES ($1, $2, $3, NOW())`,
      [event.metadata.tableName, entity.id, action],
    );
  }
}
```

---

## 13. Performance Optimization

### Use `select` to Limit Columns

```typescript
// ❌ Fetches all columns including large content
const posts = await postRepository.find();

// ✅ Fetch only what you need
const posts = await postRepository.find({
  select: ['id', 'slug', 'title', 'publishedAt'],
});
```

### Use `findAndCount` Instead of Separate Queries

```typescript
// ❌ Two database round-trips
const posts = await postRepository.find({ where, skip, take: limit });
const total = await postRepository.count({ where });

// ✅ Single database round-trip
const [posts, total] = await postRepository.findAndCount({
  where,
  order: { publishedAt: 'DESC' },
  skip,
  take: limit,
});
```

### Use QueryBuilder for Complex Queries

```typescript
// ✅ Better than multiple find() calls
const stats = await postRepository
  .createQueryBuilder('post')
  .select('post.status', 'status')
  .addSelect('COUNT(*)', 'count')
  .where('post.is_deleted = false')
  .groupBy('post.status')
  .getRawMany();
```

### Avoid N+1 — Use Joins

```typescript
// ❌ N+1 problem
const posts = await postRepository.find();
for (const post of posts) {
  const comments = await commentRepository.find({ where: { postId: post.id } });
}

// ✅ Single query with join
const posts = await postRepository.find({
  relations: { comments: true },
});

// ✅ QueryBuilder with selective join
const posts = await postRepository
  .createQueryBuilder('post')
  .leftJoinAndSelect('post.comments', 'comment', 'comment.status = :s', { s: 'APPROVED' })
  .where('post.isDeleted = false')
  .getMany();
```

### Connection Pool Configuration

```typescript
const dataSourceOptions = {
  extra: {
    max: 20, // Max connections in pool
    min: 5, // Min connections in pool
    idleTimeoutMillis: 30000, // Close idle connections after 30s
    connectionTimeoutMillis: 10000, // Connection acquisition timeout
    statement_timeout: 30000, // Query timeout (PostgreSQL)
  },
  maxQueryExecutionTime: 1000, // Log queries > 1 second
};
```

### Query Logging

```typescript
const dataSourceOptions = {
  // Simple logging
  logging: true, // Log everything
  logging: ['query'], // Log only queries
  logging: ['query', 'error'], // Log queries and errors
  logging: ['error', 'warn', 'schema', 'migration'], // Production

  // Custom logger
  logger: new MyCustomLogger(),

  // Slow query threshold
  maxQueryExecutionTime: 1000, // Log queries taking > 1s
};
```

### Batch Operations

```typescript
// ❌ N database calls
for (const item of items) {
  await itemRepository.save(item);
}

// ✅ Single batch insert
await itemRepository.save(items); // save() accepts arrays

// ✅ Bulk insert (faster, no hooks)
await itemRepository.insert(items);

// ✅ Bulk update with QueryBuilder
await itemRepository
  .createQueryBuilder()
  .update()
  .set({ isDeleted: true })
  .where('categoryId = :categoryId', { categoryId })
  .execute();
```

---

## 14. Testing Strategies

### Unit Testing with Mocked Repositories

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from '../entities/post.entity';
import { BlogService } from './blog.service';

describe('BlogService', () => {
  let service: BlogService;
  let postRepository: jest.Mocked<Repository<Post>>;

  const mockPost: Post = {
    id: 'post-1',
    slug: 'test-post',
    title: { en: 'Test', vi: '', ja: '' },
    status: 'PUBLISHED',
    tags: ['jazz'],
    viewCount: 10,
    commentCount: 5,
    isDeleted: false,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Post;

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
            findOneByOrFail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            increment: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(BlogService);
    postRepository = module.get(getRepositoryToken(Post));
  });

  it('should return paginated published posts', async () => {
    postRepository.findAndCount.mockResolvedValue([[mockPost], 1]);

    const result = await service.getPublicPosts(1, 10);

    expect(postRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isDeleted: false, status: 'PUBLISHED' },
        order: { publishedAt: 'DESC' },
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should increment view count', async () => {
    postRepository.findOneBy.mockResolvedValue(mockPost);
    postRepository.increment.mockResolvedValue({ affected: 1 } as any);

    await service.viewPost('post-1');

    expect(postRepository.increment).toHaveBeenCalledWith({ id: 'post-1' }, 'viewCount', 1);
  });
});
```

### Integration Testing with Real Database

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../entities/post.entity';
import { BlogService } from './blog.service';

describe('BlogService (Integration)', () => {
  let module: TestingModule;
  let service: BlogService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env.TEST_DATABASE_URL,
          entities: [Post, Comment],
          synchronize: true, // OK for test database
          dropSchema: true, // Clean slate each run
        }),
        TypeOrmModule.forFeature([Post, Comment]),
      ],
      providers: [BlogService],
    }).compile();

    service = module.get(BlogService);
  });

  afterAll(async () => {
    await module.close();
  });

  it('creates and retrieves a post', async () => {
    const created = await service.createPost({
      slug: 'test',
      title: { en: 'Test' },
    });
    expect(created.id).toBeDefined();

    const found = await service.getPostBySlug('test');
    expect(found.title.en).toBe('Test');
  });
});
```

### Testing with SQLite (Faster)

```typescript
TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  database: ':memory:',
  entities: [Post, Comment],
  synchronize: true,
}),
```

> ⚠️ SQLite doesn't support PostgreSQL-specific features (arrays, JSONB, GIN indexes). Use it for basic logic tests only.

---

## 15. NestJS Integration Patterns

### Module Configuration

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        url: config.get('DATABASE_URL'),
        entities: [
          Post,
          Comment,
          Category,
          CategoryItem,
          AdminUser,
          ContactSubmission,
          SiteSettings,
        ],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: false,
        logging: config.get('NODE_ENV') !== 'production' ? ['query', 'error'] : ['error'],
        extra: {
          max: config.get('DB_POOL_MAX', 20),
          min: config.get('DB_POOL_MIN', 5),
        },
      }),
    }),

    BlogModule,
    CommentsModule,
    CategoriesModule,
  ],
})
export class AppModule {}
```

### Feature Module Pattern

```typescript
// blog.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([Post]), // Register entities for this module
  ],
  providers: [BlogService],
  controllers: [BlogController],
  exports: [BlogService],
})
export class BlogModule {}

// blog.service.ts
@Injectable()
export class BlogService {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async getPublicPosts(page: number, limit: number) {
    const [rows, total] = await this.postRepository.findAndCount({
      where: { isDeleted: false, status: 'PUBLISHED' },
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items: rows, total, page, limit };
  }
}
```

### Custom Repository Pattern

```typescript
// repositories/post.repository.ts
@Injectable()
export class PostRepository extends Repository<Post> {
  constructor(private dataSource: DataSource) {
    super(Post, dataSource.createEntityManager());
  }

  async findPublished(page: number, limit: number) {
    return this.findAndCount({
      where: { isDeleted: false, status: 'PUBLISHED' },
      order: { publishedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findByTag(tag: string) {
    return this.createQueryBuilder('post')
      .where(':tag = ANY(post.tags)', { tag })
      .andWhere('post.is_deleted = false')
      .andWhere('post.status = :status', { status: 'PUBLISHED' })
      .getMany();
  }

  async incrementViewCount(id: string) {
    return this.increment({ id }, 'viewCount', 1);
  }
}

// blog.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Post])],
  providers: [BlogService, PostRepository],
})
export class BlogModule {}

// blog.service.ts
@Injectable()
export class BlogService {
  constructor(private readonly postRepository: PostRepository) {}
}
```

### Transaction Injection

```typescript
@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
    @InjectRepository(CategoryItem)
    private readonly itemRepo: Repository<CategoryItem>,
    private readonly dataSource: DataSource, // Inject DataSource for transactions
  ) {}

  async softDeleteCategory(id: string) {
    return this.dataSource.transaction(async (manager) => {
      await manager.update(CategoryItem, { categoryId: id }, { isDeleted: true });
      return manager.update(Category, { id }, { isDeleted: true });
    });
  }
}
```

---

## 16. Monorepo & Multi-Package

### Structure

```
packages/
  database/
    src/
      entities/
        post.entity.ts
        comment.entity.ts
        category.entity.ts
      migrations/
        1700000000000-Init.ts
      data-source.ts
      index.ts            ← Re-exports
    package.json
    tsconfig.json

apps/
  api/
    src/
      blog/
        blog.service.ts
        blog.module.ts
      app.module.ts
    package.json
```

```typescript
// packages/database/src/index.ts
export { Post } from './entities/post.entity';
export { Comment } from './entities/comment.entity';
export { Category } from './entities/category.entity';
export { CategoryItem } from './entities/category-item.entity';
export { AppDataSource, dataSourceOptions } from './data-source';

// apps/api/src/app.module.ts
import { Post, Comment, Category, dataSourceOptions } from '@my-org/database';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...dataSourceOptions,
      entities: [Post, Comment, Category],
    }),
  ],
})
export class AppModule {}
```

---

## 17. Error Handling

### Common TypeORM Errors

```typescript
import { QueryFailedError, EntityNotFoundError } from 'typeorm';

try {
  await postRepository.save(post);
} catch (error) {
  // Unique constraint violation
  if (error instanceof QueryFailedError) {
    const pgError = error as any;

    switch (pgError.code) {
      case '23505': // unique_violation
        throw new ConflictException(`Duplicate value: ${pgError.detail}`);

      case '23503': // foreign_key_violation
        throw new BadRequestException('Referenced record does not exist');

      case '23502': // not_null_violation
        throw new BadRequestException(`Required field is missing: ${pgError.column}`);

      case '23514': // check_violation
        throw new BadRequestException(`Validation failed: ${pgError.detail}`);

      case '22P02': // invalid_text_representation (bad UUID)
        throw new BadRequestException('Invalid ID format');

      default:
        throw new InternalServerErrorException('Database error');
    }
  }

  // Entity not found (from findOneByOrFail)
  if (error instanceof EntityNotFoundError) {
    throw new NotFoundException('Record not found');
  }

  throw error;
}
```

### Global Exception Filter for TypeORM

```typescript
// filters/typeorm-exception.filter.ts
@Catch(QueryFailedError, EntityNotFoundError)
export class TypeOrmExceptionFilter implements ExceptionFilter {
  catch(exception: QueryFailedError | EntityNotFoundError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();

    if (exception instanceof EntityNotFoundError) {
      return response.status(404).json({
        statusCode: 404,
        message: 'Record not found',
      });
    }

    const pgError = exception as any;
    switch (pgError.code) {
      case '23505':
        return response.status(409).json({
          statusCode: 409,
          message: 'Record already exists',
        });
      default:
        return response.status(500).json({
          statusCode: 500,
          message: 'Internal server error',
        });
    }
  }
}
```

---

## 18. Security Best Practices

### Parameterized Queries (Default!)

```typescript
// ✅ SAFE: Parameters are auto-escaped
await postRepository.find({ where: { slug: userInput } });

// ✅ SAFE: QueryBuilder uses parameterized queries
await postRepository
  .createQueryBuilder('post')
  .where('post.slug = :slug', { slug: userInput })
  .getOne();

// ✅ SAFE: Raw query with parameters
await dataSource.query('SELECT * FROM posts WHERE slug = $1', [userInput]);

// ❌ DANGEROUS: String interpolation in raw SQL
await dataSource.query(`SELECT * FROM posts WHERE slug = '${userInput}'`);
```

### Column Transformers for Sensitive Data

```typescript
@Entity()
export class Comment {
  @Column({
    name: 'ip_hash',
    type: 'varchar',
    length: 64,
    transformer: {
      to: (value: string) => {
        // Hash IP before storing
        return createHash('sha256')
          .update(value + process.env.IP_SALT)
          .digest('hex');
      },
      from: (value: string) => value, // Already hashed
    },
  })
  ipHash: string;
}
```

### Select-Based Access Control

```typescript
// Never expose internal fields in API responses
const publicPosts = await postRepository.find({
  where: { status: 'PUBLISHED', isDeleted: false },
  select: ['id', 'slug', 'title', 'excerpt', 'publishedAt'],
  // Excludes: viewCount, isDeleted, etc.
});
```

---

## 19. Production Deployment

### Docker Configuration

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY dist ./dist
COPY src/migrations ./dist/migrations

# Run migrations on startup
CMD npm run migration:run && node dist/main.js
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/mydb
DB_POOL_MAX=20
DB_POOL_MIN=5
DB_SSL=true
```

### Health Check

```typescript
@Get('health')
async healthCheck() {
  try {
    await this.dataSource.query('SELECT 1');
    return { status: 'ok', database: 'connected' };
  } catch {
    return { status: 'error', database: 'disconnected' };
  }
}
```

### Graceful Shutdown

```typescript
// main.ts
app.enableShutdownHooks();

// TypeORM automatically closes connections when NestJS shuts down
// If using standalone DataSource:
process.on('SIGTERM', async () => {
  await AppDataSource.destroy();
  process.exit(0);
});
```

---

## 20. Common Pitfalls & Solutions

### Pitfall 1: `synchronize: true` in Production

```typescript
// ❌ NEVER in production — can drop columns and data!
{
  synchronize: true;
}

// ✅ Always use migrations
{
  synchronize: false;
}
```

### Pitfall 2: `eager: true` Causing Performance Issues

```typescript
// ❌ Every post query loads ALL comments
@OneToMany(() => Comment, c => c.post, { eager: true })
comments: Comment[];

// ✅ Load relations explicitly
@OneToMany(() => Comment, c => c.post)
comments: Comment[];

// Load when needed:
postRepository.find({ relations: { comments: true } });
```

### Pitfall 3: Hooks Not Firing on `update()`/`delete()`

```typescript
// ❌ Hooks do NOT fire with update()/delete()
await postRepository.update(id, { status: 'PUBLISHED' }); // No @BeforeUpdate hook

// ✅ Use save() to trigger hooks
const post = await postRepository.findOneBy({ id });
post.status = 'PUBLISHED';
await postRepository.save(post); // @BeforeUpdate fires!
```

### Pitfall 4: Decimal Precision Loss

```typescript
// ❌ Using number for decimals
@Column({ type: 'decimal' })
amount: number; // May lose precision: 10.50 → 10.5

// ✅ Use string for decimals
@Column({ type: 'decimal', precision: 10, scale: 2 })
amount: string; // Preserves precision: "10.50"
```

### Pitfall 5: Forgot `reflect-metadata`

```typescript
// ❌ Decorators silently fail without this import
// Error: columns are not recognized, entities have no columns

// ✅ Must be the first import in your entry point
import 'reflect-metadata'; // FIRST LINE of main.ts
```

### Pitfall 6: Not Releasing QueryRunner

```typescript
// ❌ Connection leak — queryRunner never released on error
const qr = dataSource.createQueryRunner();
await qr.connect();
await qr.startTransaction();
await qr.manager.save(entity); // If this throws, connection leaks!
await qr.commitTransaction();

// ✅ Always use try/finally
const qr = dataSource.createQueryRunner();
await qr.connect();
try {
  await qr.startTransaction();
  await qr.manager.save(entity);
  await qr.commitTransaction();
} catch (err) {
  await qr.rollbackTransaction();
  throw err;
} finally {
  await qr.release(); // ALWAYS release!
}
```

### Pitfall 7: Array Columns (PostgreSQL)

```typescript
// ❌ Wrong default for array columns
@Column('text', { array: true, default: [] }) // JavaScript array → error!
tags: string[];

// ✅ Use PostgreSQL array literal
@Column('text', { array: true, default: '{}' })
tags: string[];
```

### Pitfall 8: Filtering on Relations in find()

```typescript
// ❌ This does NOT filter items — it loads ALL items
const categories = await categoryRepo.find({
  relations: { items: true },
  where: {
    items: { isActive: true }, // This doesn't work as expected!
  },
});

// ✅ Use QueryBuilder for relation filtering
const categories = await categoryRepo
  .createQueryBuilder('category')
  .leftJoinAndSelect('category.items', 'item', 'item.is_active = true')
  .getMany();
```

---

> **You now have everything needed to build, deploy, and maintain production TypeORM applications.** Bookmark this guide and refer to it when working on TypeORM-based projects and transitioning between Prisma and TypeORM codebases.
