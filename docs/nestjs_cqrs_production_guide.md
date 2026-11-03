# NestJS CQRS — Complete Production Mastery Guide

> A comprehensive architectural guide to implementing Command Query Responsibility Segregation (CQRS) in production-grade NestJS applications using Prisma and TypeORM.

---

## Table of Contents

1. [Core Mental Model & Philosophy](#1-core-mental-model--philosophy)
2. [Ecosystem & Tooling](#2-ecosystem--tooling)
3. [Architecture & Folder Structure Comparison](#3-architecture--folder-structure-comparison)
4. [Step-by-Step Implementation: Case Study (Blog & Comments)](#4-step-by-step-implementation-case-study-blog--comments)
   - [4.1 Commands & Command Handlers](#41-commands--command-handlers)
   - [4.2 Queries & Query Handlers](#42-queries--query-handlers)
   - [4.3 Domain Events & Event Handlers](#43-domain-events--event-handlers)
   - [4.4 Sagas (Process Managers)](#44-sagas-process-managers)
5. [Prisma vs. TypeORM in CQRS Systems](#5-prisma-vs-typeorm-in-cqrs-systems)
   - [5.1 CQRS with Prisma](#51-cqrs-with-prisma)
   - [5.2 CQRS with TypeORM](#52-cqrs-with-typeorm)
6. [Advanced Production Patterns](#6-advanced-production-patterns)
   - [6.1 Read/Write DB Splitting (Master / Replica)](#61-readwrite-db-splitting-master--replica)
   - [6.2 Transaction Management Boundaries](#62-transaction-management-boundaries)
   - [6.3 The Transactional Outbox Pattern (Guaranteed Event Delivery)](#63-the-transactional-outbox-pattern-guaranteed-event-delivery)
   - [6.4 High-Performance Projections (Redis & Materialized Views)](#64-high-performance-projections-redis--materialized-views)
   - [6.5 Eventual Consistency & Idempotency](#65-eventual-consistency--idempotency)
7. [CQRS vs. Event Sourcing (Demystified)](#7-cqrs-vs-event-sourcing-demystified)
8. [Exception Handling, Validation & Telemetry](#8-exception-handling-validation--telemetry)
   - [8.1 Syntactic DTO Validation vs. Semantic Domain Invariants](#81-syntactic-dto-validation-vs-semantic-domain-invariants)
   - [8.2 CQRS Exception Filters & Command Interceptors](#82-cqrs-exception-filters--command-interceptors)
9. [Testing Strategy for CQRS](#9-testing-strategy-for-cqrs)
10. [Zero-Downtime Migration Blueprint for `jazz-portfolio`](#10-zero-downtime-migration-blueprint-for-jazz-portfolio)
11. [Decision Matrix: When to Migrate to CQRS](#11-decision-matrix-when-to-migrate-to-cqrs)

---

## 1. Core Mental Model & Philosophy

### What is CQRS?

**CQRS (Command Query Responsibility Segregation)** is an architectural pattern that strictly separates operations that modify data (**Commands**) from operations that read data (**Queries**).

```
                      ┌──────────────────────────────────────────────────┐
                      │                   Client / UI                    │
                      └────────────────────────┬─────────────────────────┘
                                               │
                        ┌──────────────────────┴──────────────────────┐
                        │                                             │
               HTTP POST / PUT / DELETE                     HTTP GET
                        │                                             │
                        ▼                                             ▼
             ┌─────────────────────┐                       ┌────────────────────┐
             │    Command Bus      │                       │     Query Bus      │
             └──────────┬──────────┘                       └─────────┬──────────┘
                        │                                            │
                        ▼                                            ▼
             ┌─────────────────────┐                       ┌────────────────────┐
             │   Command Handler   │                       │   Query Handler    │
             │ (Business Rules &   │                       │ (Fast, Read-Only   │
             │    Validation)      │                       │    Projections)    │
             └──────────┬──────────┘                       └─────────┬──────────┘
                        │                                            │
                        ▼                                            ▼
             ┌─────────────────────┐                       ┌────────────────────┐
             │    WRITE MODEL      │                       │     READ MODEL     │
             │ (Primary DB / Master)│                       │ (Replica / Redis / │
             └──────────┬──────────┘                       │   Elasticsearch)   │
                        │                                  └────────────────────┘
                        │ (Transactional Outbox / Event)              ▲
                        ▼                                             │
             ┌─────────────────────┐                                  │
             │     Event Bus       ├──────────────────────────────────┘
             └─────────────────────┘   (Updates Read Cache / Revalidates)
```

### The CQS Principle (Bertrand Meyer)

> *"Asking a question should not change the answer."*

- **Command**: Changes state, returns **no business data** (or just status/ID). Side-effects allowed.
- **Query**: Returns data, **causes zero state mutations**. Pure function semantics.

### Why Separate Reads and Writes in Production?

1. **Divergent Scale Requirements**: In 95% of production web applications, **reads outnumber writes by 10:1 to 100:1**. Queries require high concurrency and low latency (indexing, caching, projections). Commands require transactional integrity, validation, and domain invariants.
2. **Simplified Mental Models**: Command Handlers focus 100% on business logic and rules without worrying about formatting UI responses. Query Handlers focus 100% on optimized DTO projections without worrying about validation state machines.
3. **Decoupled Side Effects**: Creating a blog post might trigger cache purging, sending newsletter emails, updating search indexes, and auditing. In a standard service, this leads to bloated procedural functions. In CQRS, publishing a `PostPublishedEvent` handles side effects cleanly via asynchronous handlers.

---

## 2. Ecosystem & Tooling

### Primary NestJS Package

NestJS provides first-class support for CQRS via `@nestjs/cqrs`.

```bash
npm install @nestjs/cqrs
```

### Core Primitives in `@nestjs/cqrs`

| Primitive | Purpose | Class Base |
| --- | --- | --- |
| **Command** | Data object representing an intention to mutate state | Implements `ICommand` |
| **Command Handler** | Executes business logic for a single Command | Implements `ICommandHandler<T>` |
| **Query** | Data object representing an intention to fetch data | Implements `IQuery` |
| **Query Handler** | Executes optimized read query for a single Query | Implements `IQueryHandler<T>` |
| **Event** | Data object representing a factual domain occurrence | Implements `IEvent` |
| **Event Handler** | Executes side effects when an Event occurs | Implements `IEventHandler<T>` |
| **Saga** | Reactive process manager reacting to Events to dispatch new Commands | Method returning `Observable<ICommand>` |
| **EventPublisher** | Connects domain models to the NestJS EventBus | Injectable service |

### Infrastructure Tooling for Scaling CQRS

For production systems handling higher throughput, the in-process NestJS EventBus can be bridged to distributed infrastructure:

- **Message Brokers**: Redis Pub/Sub, RabbitMQ, NATS, or AWS SQS/SNS (for multi-service Event delivery).
- **Read Caching**: Redis / Next.js On-Demand Revalidation (for instant Query acceleration).
- **Read Engine**: PostgreSQL Read Replicas, Elasticsearch, or MongoDB (optimized for search/aggregations).

---

## 3. Architecture & Folder Structure Comparison

### Current Architecture (`jazz-portfolio`)

Currently, `apps/api` uses a **Layered Monolithic Service Pattern**. A single `BlogService` handles both read queries, state mutations, cache invalidation, and slug generation.

```
apps/api/src/blog/
├── blog-admin.controller.ts
├── blog.controller.ts
├── blog.module.ts
├── blog.service.ts          ← Handles EVERYTHING (Create, Read, Update, Delete, Cache)
├── blog.service.spec.ts
├── dto/
│   ├── create-post.dto.ts
│   └── update-post.dto.ts
├── slug.util.spec.ts
└── slug.util.ts
```

#### Disadvantages at Scale:
- `BlogService` becomes a "God Class" growing to 1000+ lines as features expand.
- Adding a side effect (e.g., sending an email on new post) requires editing `BlogService`, violating the Open/Closed Principle.
- Tight coupling between write validation and read query optimization.

---

### Production-Grade CQRS Architecture

In a production CQRS application, we group by **Domain Feature**, separating Commands, Queries, Events, and Handlers.

```
apps/api/src/blog/
├── blog.module.ts                   ← Imports CqrsModule and registers handlers
├── controllers/
│   ├── blog-public.controller.ts     ← Dispatches Queries
│   └── blog-admin.controller.ts      ← Dispatches Commands
├── commands/
│   ├── create-post.command.ts
│   ├── update-post.command.ts
│   ├── publish-post.command.ts
│   ├── delete-post.command.ts
│   └── handlers/
│       ├── create-post.handler.ts
│       ├── update-post.handler.ts
│       ├── publish-post.handler.ts
│       └── delete-post.handler.ts
├── queries/
│   ├── get-public-posts.query.ts
│   ├── get-post-by-slug.query.ts
│   ├── get-admin-posts.query.ts
│   └── handlers/
│       ├── get-public-posts.handler.ts
│       ├── get-post-by-slug.handler.ts
│       └── get-admin-posts.handler.ts
├── events/
│   ├── post-created.event.ts
│   ├── post-published.event.ts
│   └── handlers/
│       ├── purge-cache-on-publish.handler.ts
│       └── update-redis-tags-on-publish.handler.ts
├── sagas/
│   └── blog.sagas.ts                ← Complex async workflows
├── domain/
│   ├── post.aggregate.ts            ← Domain model with business methods
│   └── slug.value-object.ts
└── dto/
    ├── create-post.dto.ts
    └── update-post.dto.ts
```

#### Why This Structure Scales:
- **Single Responsibility Principle**: Each handler file contains exactly ONE class with ONE method (`execute()`).
- **Parallel Team Workflow**: Developer A can build `CreatePostHandler` while Developer B optimizes `GetPublicPostsHandler` without git merge conflicts.
- **Plug-and-Play Side Effects**: Adding a new reaction to `PostPublishedEvent` only requires adding a new Event Handler file. Zero modifications to existing code.

---

## 4. Step-by-Step Implementation: Case Study (Blog & Comments)

Let's convert the **Blog & Comments** domain from `jazz-portfolio` to a full production NestJS CQRS implementation.

---

### 4.1 Commands & Command Handlers

A **Command** is an immutable DTO representing an intent to mutate state.

#### Command Definition

```typescript
// apps/api/src/blog/commands/publish-post.command.ts
import { ICommand } from '@nestjs/cqrs';

export class PublishPostCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly adminUserId: string,
  ) {}
}
```

#### Command Handler

The handler contains business validation, executes state changes, and publishes events.

```typescript
// apps/api/src/blog/commands/handlers/publish-post.handler.ts
import { CommandHandler, ICommandHandler, EventPublisher } from '@nestjs/cqrs';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { PublishPostCommand } from '../publish-post.command';
import { PrismaService } from '../../../prisma/prisma.service';
import { PostStatus } from '@jazz-portfolio/shared';
import { PostPublishedEvent } from '../../events/post-published.event';

@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
  ) {}

  async execute(command: PublishPostCommand): Promise<{ id: string; publishedAt: string }> {
    const { id } = command;

    const existing = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!existing || existing.isDeleted) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    if (existing.status === PostStatus.PUBLISHED) {
      throw new ConflictException(`Post "${id}" is already published`);
    }

    const publishedAt = existing.publishedAt || new Date();

    const updatedRow = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt,
      },
    });

    // Merge domain events with EventPublisher
    const postEvent = this.publisher.mergeObjectContext({
      commit: () => {},
    });

    // Publish event asynchronously via NestJS EventBus
    this.publisher.mergeContext(
      new PostPublishedEvent(updatedRow.id, updatedRow.slug, publishedAt.toISOString(), updatedRow.tags)
    );

    return {
      id: updatedRow.id,
      publishedAt: publishedAt.toISOString(),
    };
  }
}
```

---

### 4.2 Queries & Query Handlers

A **Query** represents an intent to fetch data. Query Handlers bypass heavy domain models and perform direct, ultra-fast projections.

#### Query Definition

```typescript
// apps/api/src/blog/queries/get-public-posts.query.ts
import { IQuery } from '@nestjs/cqrs';

export class GetPublicPostsQuery implements IQuery {
  constructor(
    public readonly page: number = 1,
    public readonly limit: number = 10,
    public readonly tag?: string,
  ) {}
}
```

#### Query Handler

```typescript
// apps/api/src/blog/queries/handlers/get-public-posts.handler.ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { GetPublicPostsQuery } from '../get-public-posts.query';
import { PrismaService } from '../../../prisma/prisma.service';
import { normalizePagination, paginatedResponse } from '../../../common/pagination';
import { PaginatedResponse, PostListItemDto, PostStatus } from '@jazz-portfolio/shared';

@QueryHandler(GetPublicPostsQuery)
export class GetPublicPostsHandler implements IQueryHandler<GetPublicPostsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPublicPostsQuery): Promise<PaginatedResponse<PostListItemDto>> {
    const { page, limit, skip } = normalizePagination(query.page, query.limit);

    const where: any = {
      isDeleted: false,
      status: PostStatus.PUBLISHED,
    };

    if (query.tag) {
      where.tags = { has: query.tag };
    }

    // Direct read projection — select ONLY public fields to minimize memory & payload
    const [rows, total] = await this.prisma.$transaction([
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
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    const items: PostListItemDto[] = rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      title: r.title as any,
      excerpt: r.excerpt as any,
      coverImageUrl: r.coverImageUrl,
      tags: r.tags,
      readingMinutes: r.readingMinutes,
      commentCount: r.commentCount,
      publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    }));

    return paginatedResponse(items, total, page, limit);
  }
}
```

---

### 4.3 Domain Events & Event Handlers

**Events** represent immutable facts about something that HAS ALREADY HAPPENED in the system. They use past-tense naming (`PostPublishedEvent`, `CommentSubmittedEvent`).

#### Event Definition

```typescript
// apps/api/src/blog/events/post-published.event.ts
import { IEvent } from '@nestjs/cqrs';

export class PostPublishedEvent implements IEvent {
  constructor(
    public readonly postId: string,
    public readonly slug: string,
    public readonly publishedAt: string,
    public readonly tags: string[],
  ) {}
}
```

#### Event Handler 1: Purging Frontend Cache (Revalidation)

```typescript
// apps/api/src/blog/events/handlers/purge-cache-on-publish.handler.ts
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { PostPublishedEvent } from '../post-published.event';
import { RevalidationService } from '../../../common/revalidation.service';

@EventsHandler(PostPublishedEvent)
export class PurgeCacheOnPublishHandler implements IEventHandler<PostPublishedEvent> {
  constructor(private readonly revalidationService: RevalidationService) {}

  async handle(event: PostPublishedEvent): Promise<void> {
    console.log(`[CQRS Event] Purging cache for published post: ${event.slug}`);
    
    // Asynchronous side-effect: purge Next.js cache
    await this.revalidationService.purge(['posts', `post-${event.slug}`]);
  }
}
```

---

### 4.4 Sagas (Process Managers)

A **Saga** is a long-running workflow that listens to Events, applies business rules, and emits new Commands. Sagas handle complex async orchestration without coupling modules together.

#### Case Study: Comment Moderation Workflow

When a comment is submitted (`CommentSubmittedEvent`), the Saga analyzes the spam score and automatically emits either a `ModerateCommentCommand` or a blocklist action.

```typescript
// apps/api/src/comments/sagas/comments.sagas.ts
import { Injectable } from '@nestjs/common';
import { Saga, ICommand, ofType } from '@nestjs/cqrs';
import { Observable } from 'rxjs';
import { mergeMap, map } from 'rxjs/operators';
import { CommentSubmittedEvent } from '../events/comment-submitted.event';
import { ModerateCommentCommand } from '../commands/moderate-comment.command';
import { CommentStatus } from '@jazz-portfolio/shared';

@Injectable()
export class CommentsSagas {
  @Saga()
  commentSubmitted = (events$: Observable<any>): Observable<ICommand> => {
    return events$.pipe(
      ofType(CommentSubmittedEvent),
      map((event: CommentSubmittedEvent) => {
        console.log(`[Saga] Processing comment ${event.commentId} (Spam Score: ${event.spamScore})`);

        // If spam score is low and moderation mode allows, auto-approve
        if (event.spamScore < 30 && event.autoApproveAllowed) {
          return new ModerateCommentCommand(event.commentId, CommentStatus.APPROVED);
        }

        // If spam score is very high, flag as spam
        if (event.spamScore >= 80) {
          return new ModerateCommentCommand(event.commentId, CommentStatus.SPAM);
        }

        // Default: leave in PENDING status
        return null;
      }),
      // Filter out null commands
      mergeMap((command) => (command ? [command] : []))
    );
  };
}
```

---

### Controller Wiring

Controllers become extremely slim. They delegate 100% of execution to `CommandBus` and `QueryBus`.

```typescript
// apps/api/src/blog/controllers/blog-admin.controller.ts
import { Controller, Post, Body, Param, UseGuards, Get, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PublishPostCommand } from '../commands/publish-post.command';
import { GetAdminPostsQuery } from '../queries/get-admin-posts.query';

@Controller('admin/posts')
@UseGuards(JwtAuthGuard)
export class BlogAdminController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post(':id/publish')
  async publishPost(@Param('id') id: string) {
    // Dispatch command to CommandBus
    return this.commandBus.execute(new PublishPostCommand(id, 'admin-user-id'));
  }

  @Get()
  async getPosts(@Query('page') page = 1, @Query('limit') limit = 20) {
    // Dispatch query to QueryBus
    return this.queryBus.execute(new GetAdminPostsQuery(page, limit));
  }
}
```

---

## 5. Prisma vs. TypeORM in CQRS Systems

Both Prisma and TypeORM fit into CQRS, but they serve different strengths depending on whether you are writing Commands or executing Query projections.

---

### 5.1 CQRS with Prisma

Prisma excels at Query projections because of its type-safe `select` API.

```typescript
// Command Handler (Write Model using Prisma)
@CommandHandler(CreatePostCommand)
export class CreatePostHandler implements ICommandHandler<CreatePostCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: CreatePostCommand) {
    return this.prisma.post.create({
      data: {
        slug: cmd.slug,
        title: cmd.title as any,
        content: cmd.content as any,
        status: PostStatus.DRAFT,
      },
    });
  }
}

// Query Handler (Read Model using Prisma — Bypasses full models)
@QueryHandler(GetPostBySlugQuery)
export class GetPostBySlugHandler implements IQueryHandler<GetPostBySlugQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPostBySlugQuery) {
    return this.prisma.post.findFirst({
      where: { slug: query.slug, isDeleted: false, status: PostStatus.PUBLISHED },
      select: {
        id: true,
        slug: true,
        title: true,
        content: true,
        publishedAt: true,
      },
    });
  }
}
```

---

### 5.2 CQRS with TypeORM

TypeORM excels in Command Handlers when using Domain Aggregates, Entity Subscribers, and explicit Transaction Runners (`QueryRunner`).

```typescript
// Command Handler (Write Model using TypeORM + QueryRunner for strict isolation)
@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  constructor(private readonly dataSource: DataSource) {}

  async execute(cmd: PublishPostCommand) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('SERIALIZABLE');

    try {
      const post = await queryRunner.manager.findOneBy(Post, { id: cmd.id });
      if (!post) throw new NotFoundException('Post not found');

      post.status = 'PUBLISHED';
      post.publishedAt = new Date();

      await queryRunner.manager.save(post);
      await queryRunner.commitTransaction();

      return { id: post.id, status: post.status };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

// Query Handler (Read Model using TypeORM QueryBuilder for maximum query performance)
@QueryHandler(GetPublicPostsQuery)
export class GetPublicPostsHandler implements IQueryHandler<GetPublicPostsQuery> {
  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
  ) {}

  async execute(query: GetPublicPostsQuery) {
    const [items, total] = await this.postRepository
      .createQueryBuilder('post')
      .select([
        'post.id',
        'post.slug',
        'post.title',
        'post.excerpt',
        'post.publishedAt',
      ])
      .where('post.isDeleted = false')
      .andWhere('post.status = :status', { status: 'PUBLISHED' })
      .orderBy('post.publishedAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return { items, total, page: query.page, limit: query.limit };
  }
}
```

---

## 6. Advanced Production Patterns

### 6.1 Read/Write DB Splitting (Master / Replica)

In high-scale production systems, Command Handlers write to the **Primary Database (Master)**, while Query Handlers read from **Read Replicas**.

```typescript
// TypeORM DataSource configuration with Replication support
export const AppDataSource = new DataSource({
  type: 'postgres',
  replication: {
    master: {
      url: process.env.DATABASE_MASTER_URL,
    },
    slaves: [
      { url: process.env.DATABASE_REPLICA_1_URL },
      { url: process.env.DATABASE_REPLICA_2_URL },
    ],
  },
  entities: [Post, Comment],
});
```

---

### 6.2 Transaction Management Boundaries

A fundamental rule of production CQRS:

> **Transactions MUST NEVER span across Command Handlers and Event Handlers.**

```
❌ WRONG (Transactional Coupon Trap):
Begin Transaction
  └─ Save Order to DB
  └─ Publish OrderCreatedEvent
        └─ Send Email (HTTP call fails!)
Rollback Transaction (Order rolled back because email failed!)

✅ CORRECT (Eventual Consistency Boundary):
Begin Transaction
  └─ Save Order to DB
Commit Transaction

Async EventBus: OrderCreatedEvent
  ├─ Handler A: Send Email (Fails -> Retried in queue)
  └─ Handler B: Purge Cache (Succeeds)
```

---

### 6.3 The Transactional Outbox Pattern (Guaranteed Event Delivery)

#### The Problem with In-Memory EventBuses
If the Node.js process crashes right after saving a `Post` to PostgreSQL but *before* publishing `PostPublishedEvent`, the event is **lost forever**.

#### The Production Solution
Store events in an `outbox` table within the **same SQL transaction** as the business mutation, then dispatch them reliably via a background worker or Change Data Capture (CDC).

```sql
-- Outbox Table Migration
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(50) NOT NULL,
  aggregate_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX idx_outbox_pending ON outbox_events(status, created_at);
```

#### Command Handler with Outbox

```typescript
@CommandHandler(PublishPostCommand)
export class PublishPostHandler implements ICommandHandler<PublishPostCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(cmd: PublishPostCommand) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Mutate State
      const post = await tx.post.update({
        where: { id: cmd.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      });

      // 2. Persist Event into Outbox within SAME transaction
      await tx.$executeRaw`
        INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload)
        VALUES ('Post', ${post.id}, 'PostPublishedEvent', ${JSON.stringify({
          postId: post.id,
          slug: post.slug,
          publishedAt: post.publishedAt,
          tags: post.tags,
        })}::jsonb)
      `;

      return post;
    });
  }
}
```

#### Outbox Processor Worker

```typescript
@Injectable()
export class OutboxProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  // Poll every 3 seconds for pending outbox events
  @Cron('*/3 * * * * *')
  async processOutbox() {
    const events = await this.prisma.$queryRaw<any[]>`
      SELECT * FROM outbox_events
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    `;

    for (const evt of events) {
      try {
        // Dispatch to NestJS EventBus
        if (evt.event_type === 'PostPublishedEvent') {
          this.eventBus.publish(new PostPublishedEvent(
            evt.payload.postId,
            evt.payload.slug,
            evt.payload.publishedAt,
            evt.payload.tags,
          ));
        }

        // Mark as PROCESSED
        await this.prisma.$executeRaw`
          UPDATE outbox_events SET status = 'PROCESSED', processed_at = NOW() WHERE id = ${evt.id}::uuid
        `;
      } catch (err) {
        console.error(`Failed to process outbox event ${evt.id}:`, err);
      }
    }
  }
}
```

---

### 6.4 High-Performance Projections (Redis & Materialized Views)

Instead of calculating complex stats dynamically on every Read Query, Event Handlers maintain pre-computed Read Projections.

#### Example: Tag Frequency Projection with Redis

In `BlogService`, `getPublicTags()` currently iterates over all posts in Node.js memory ($O(N)$). With CQRS, an Event Handler updates a **Redis Sorted Set (`ZINCRBY`)** on publication ($O(1)$).

```typescript
// events/handlers/update-redis-tags-on-publish.handler.ts
@EventsHandler(PostPublishedEvent)
export class UpdateRedisTagsOnPublishHandler implements IEventHandler<PostPublishedEvent> {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: any) {}

  async handle(event: PostPublishedEvent): Promise<void> {
    // Atomically increment tag counts in Redis Sorted Set
    for (const tag of event.tags) {
      await this.redis.zincrby('blog:tags:frequency', 1, tag);
    }
  }
}

// Query Handler: Ultra-fast O(1) Tag Fetching
@QueryHandler(GetPublicTagsQuery)
export class GetPublicTagsHandler implements IQueryHandler<GetPublicTagsQuery> {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: any) {}

  async execute(): Promise<{ tag: string; count: number }[]> {
    // ZREVRANGEBYSCORE returns top tags sorted by score in < 1ms
    const raw = await this.redis.zrevrange('blog:tags:frequency', 0, -1, 'WITHSCORES');
    
    const result: { tag: string; count: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ tag: raw[i], count: parseInt(raw[i + 1], 10) });
    }
    return result;
  }
}
```

---

### 6.5 Eventual Consistency & Idempotency

When Event Handlers run asynchronously, there is a small propagation delay (typically 5ms - 500ms) before read models/caches update.

To handle eventual consistency reliably in production:

1. **Idempotent Handlers**: Ensure Event Handlers can safely execute multiple times without duplicating side-effects.

```typescript
@EventsHandler(CommentSubmittedEvent)
export class SendAdminNotificationHandler implements IEventHandler<CommentSubmittedEvent> {
  async handle(event: CommentSubmittedEvent) {
    // Check idempotency record in Redis before sending
    const alreadySent = await this.redis.get(`notification:${event.commentId}`);
    if (alreadySent) return;

    await this.mailer.send(...);
    await this.redis.set(`notification:${event.commentId}`, 'true', 'EX', 86400);
  }
}
```

2. **Optimistic UI Updates**: The frontend immediately updates local state upon Command HTTP 200 response rather than waiting for the read query to catch up.

---

## 7. CQRS vs. Event Sourcing (Demystified)

Developers often confuse CQRS with Event Sourcing. They are related, but completely distinct choices:

| Concept | Data Storage Mechanism | Historical Audit Trail | Complexity | Use Cases |
| --- | --- | --- | --- | --- |
| **Standard CRUD** | Current state only in relational DB | None (unless audit tables added) | Low | Basic websites, internal tools |
| **CQRS (No Event Sourcing)** | Current state in Primary DB + optional read caches | None | Medium | High-traffic CMS, E-commerce, APIs |
| **CQRS + Event Sourcing** | Append-only event store (`PostCreated`, `PostTitleUpdated`) | 100% Complete historical audit log | High | Banking, Healthcare, Order Fulfillment |

> **Key Takeaway**: 90% of production applications need **CQRS without Event Sourcing**. You get clean separation of reads/writes without the architectural complexity of event stores and state reconstruction.

---

## 8. Exception Handling, Validation & Telemetry

### 8.1 Syntactic DTO Validation vs. Semantic Domain Invariants

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      HTTP Request (Controller)                          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 Syntactic Validation (class-validator)
            Checks types, non-null, email formats, lengths
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      Command Bus -> Command Handler                      │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 Semantic Domain Invariants (Business Rules)
     Checks slug uniqueness, post status transitions, quota limits
```

### 8.2 CQRS Exception Filters & Command Interceptors

When a Command Handler throws a domain exception, `@nestjs/cqrs` can wrap it. Use a custom NestJS Interceptor to log telemetry and format responses clean.

```typescript
// common/interceptors/cqrs-telemetry.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CqrsTelemetryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const className = context.getClass().name;
    const handlerName = context.getHandler().name;

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        if (duration > 200) {
          console.warn(`[CQRS Latency Warning] ${className}.${handlerName} took ${duration}ms`);
        }
      }),
    );
  }
}
```

---

## 9. Testing Strategy for CQRS

CQRS makes testing drastically simpler because Commands, Queries, and Handlers are isolated units.

### Unit Testing Command Handlers (Zero HTTP / Zero Query Overhead)

```typescript
// create-post.handler.spec.ts
import { Test } from '@nestjs/testing';
import { CreatePostHandler } from './create-post.handler';
import { CreatePostCommand } from '../create-post.command';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CreatePostHandler', () => {
  let handler: CreatePostHandler;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      post: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'post-123', slug: 'my-first-post' }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        CreatePostHandler,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    handler = module.get(CreatePostHandler);
  });

  it('creates post successfully', async () => {
    const cmd = new CreatePostCommand('My First Post', { en: 'Hello' } as any);
    const result = await handler.execute(cmd);

    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'my-first-post' }),
      })
    );
    expect(result.id).toBe('post-123');
  });
});
```

---

## 10. Zero-Downtime Migration Blueprint for `jazz-portfolio`

If you decide to refactor `apps/api/src/blog` from layered monolith to CQRS in production:

```
Step 1: Install `@nestjs/cqrs` and register `CqrsModule` in `BlogModule`.
Step 2: Extract Read Queries into Query Handlers (`GetPublicPostsHandler`, `GetPostBySlugHandler`).
Step 3: Extract Write Mutations into Command Handlers (`CreatePostHandler`, `PublishPostHandler`).
Step 4: Update `BlogController` and `BlogAdminController` to inject `CommandBus` / `QueryBus` instead of `BlogService`.
Step 5: Move cache invalidation logic into `PostPublishedEvent` handlers.
Step 6: Safely delete legacy `BlogService`.
```

---

## 11. Decision Matrix: When to Migrate to CQRS

| Metric / Scenario | Standard CRUD Architecture | CQRS Architecture |
| --- | --- | --- |
| **System Complexity** | Low to Medium | Medium to High |
| **Read / Write Divergence** | Reads and writes use same models | Reads require specialized caches/views |
| **Team Size** | 1 - 3 developers | 4+ developers working in parallel |
| **Business Logic** | Standard CRUD updates | Complex domain workflows, sagas, audit rules |
| **Performance Overhead** | Minimal latency overhead | Slight latency overhead on events |
| **Code Maintainability** | Degrades as features grow | High maintainability via isolated handlers |

### Final Recommendation for `jazz-portfolio`

- **Current State**: The portfolio system is a lightweight CMS where a standard layered architecture (`BlogService`, `CategoriesService`) is lean, fast, and maintainable.
- **When to Adopt CQRS**: If you expand `jazz-portfolio` to include complex features like **multi-author editorial workflows**, **asynchronous spam detection queues**, **full-text search indexing (Elasticsearch)**, or **event-driven analytics tracking**, migrating the `Blog` and `Comments` modules to NestJS CQRS using `@nestjs/cqrs` will deliver exceptional scalability and code clarity.
