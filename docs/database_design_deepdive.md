# 🎷 PostgreSQL Database Design: From Concept to Production

This document details the database architecture of the Jazz Portfolio project. It walks through the conceptual modeling, design tradeoffs (such as JSONB for translations), schema layouts, indexing strategies, and production readiness requirements.

---

## 1. Requirements Modeling & Scope

The application requires persistent storage for eight main business entities:
1. **AdminUser:** Credential management for a single administrative account.
2. **Profile:** Multilingual core biographical data (name, title, bio, intro) and static contact details.
3. **Category:** Dynamic sections (e.g. Skills, Career Milestones, Education History) which can be added, deleted, or reordered.
4. **CategoryItem:** Content details nested inside specific categories (e.g., individual jobs, specific skill tags).
5. **Track:** Playlist tracks tracking S3 object keys, CloudFront paths, and sort order.
6. **Media:** Audit logging for S3 file uploads.
7. **ContactSubmission:** Form submissions containing name, email, subject, message body, and read flags.
8. **SiteSettings:** System configurations controlling contact form visibility and dynamic email delivery parameters.

---

## 2. Design Tradeoffs & Reasoning

### Rationale: Relational Database (PostgreSQL) vs. Document Store (MongoDB)
- **Data Integrity:** Portfolio categories and items form a strict 1-to-many relationship. PostgreSQL guarantees referential integrity through foreign key constraints (`ON DELETE CASCADE`), ensuring database orphans cannot occur.
- **Transactional Safety:** Category and item reordering operations require updating multiple sort orders simultaneously. Relational SQL guarantees ACID compliance natively.

### Rationale: Multilingual Storage Options

When modeling translation data for `EN`, `VI`, and `JA`, three architectural patterns exist:

| Strategy | Structure | Pros | Cons |
|---|---|---|---|
| **Column-per-Language** | `title_en`, `title_vi`, `title_ja` | Simple queries, no complex parsers. | Adding a language requires running DB migrations to alter tables. |
| **Translation Tables** | `CategoryTranslations` table with foreign keys | Infinite language scalability. | Join overhead; queries require joining multiple translation tables. |
| **JSONB Columns** | `title JSONB` holding `{ "en": "...", "vi": "..." }` | No schema changes for new languages; simple payload updates; fast key reads in PostgreSQL. | No native SQL type constraints on internal properties. |

#### Decision
We chose **JSONB** because:
1. We have a fixed set of three target languages (`en`, `vi`, `ja`).
2. It allows us to retrieve a complete profile or category record in a single, fast SQL read without performing joins.
3. Node.js backend pipelines can parse the JSON structure directly without mapping complex ORM structures.

---

## 3. Schema Architecture (Prisma Schema)

```
  +--------------+          +------------+
  |  AdminUser   |          |   Profile  |
  +--------------+          +------------+
  
  +--------------+ 1      * +----------------+
  |   Category   |----------|  CategoryItem  |
  +--------------+          +----------------+
  
  +--------------+          +------------+
  |    Track     |          |    Media   |
  +--------------+          +------------+
```

### Schema Definition
```prisma
model AdminUser {
  id           String   @id @default(uuid())
  username     String   @unique
  passwordHash String   @map("password_hash")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("admin_users")
}

model Profile {
  id            String   @id @default(uuid())
  name          Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  title         Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  introduction  Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  bio           Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  avatarUrl     String?  @map("avatar_url")
  backgroundUrl String?  @map("background_url")
  socialLinks   Json     @default("{}")
  contactInfo   Json     @default("{}") @map("contact_info")
  updatedAt     DateTime @updatedAt @map("updated_at")

  @@map("profiles")
}

model Category {
  id        String         @id @default(uuid())
  name      Json           @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  slug      String         @unique
  type      String         @default("CUSTOM")
  sortOrder Int            @default(0) @map("sort_order")
  isActive  Boolean        @default(true) @map("is_active")
  isDeleted Boolean        @default(false) @map("is_deleted")
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")
  items     CategoryItem[]

  @@map("categories")
}

model CategoryItem {
  id          String   @id @default(uuid())
  categoryId  String   @map("category_id")
  title       Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  description Json     @default("{\"en\": \"\", \"vi\": \"\", \"ja\": \"\"}")
  metadata    Json     @default("{}")
  imageUrl    String?  @map("image_url")
  sortOrder   Int      @default(0) @map("sort_order")
  isActive    Boolean  @default(true) @map("is_active")
  isDeleted   Boolean  @default(false) @map("is_deleted")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  category    Category @relation(fields: [categoryId], references: [id], onDelete: Cascade)

  @@map("category_items")
}

model Track {
  id              String   @id @default(uuid())
  title           String
  artist          String
  s3Key           String   @map("s3_key")
  cloudfrontUrl   String   @map("cloudfront_url")
  durationSeconds Int      @default(0) @map("duration_seconds")
  sortOrder       Int      @default(0) @map("sort_order")
  isActive        Boolean  @default(true) @map("is_active")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("tracks")
}

model Media {
  id            String   @id @default(uuid())
  filename      String
  s3Key         String   @map("s3_key")
  cloudfrontUrl String   @map("cloudfront_url")
  mimeType      String   @map("mime_type")
  fileSizeBytes Int      @map("file_size_bytes")
  context       String   @default("GENERAL")
  createdAt     DateTime @default(now()) @map("created_at")

  @@map("media")
}

model ContactSubmission {
  id          String   @id @default(uuid())
  senderName  String   @map("sender_name") @db.VarChar(100)
  senderEmail String   @map("sender_email") @db.VarChar(254)
  subject     String   @db.VarChar(200)
  messageBody String   @map("message_body") @db.VarChar(5000)
  isRead      Boolean  @default(false) @map("is_read")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("contact_submissions")
}

model SiteSettings {
  id                   String   @id @default(uuid())
  isContactFormEnabled Boolean  @default(true) @map("is_contact_form_enabled")
  mailProvider         String   @default("resend") @map("mail_provider")
  mailFrom             String   @default("") @map("mail_from")
  mailTo               String   @default("") @map("mail_to")
  updatedAt            DateTime @updatedAt @map("updated_at")

  @@map("site_settings")
}
```

---

## 4. Query Performance & Indexing Strategies

Standard primary keys are indexed by default. However, executing filters or sorting on columns without indexes triggers slow sequential table scans. We optimize queries using key indexes.

### 1. Unique Constraints & Slugs
- `categories.slug` has a unique index, ensuring fast retrieval of specific categories:
  ```sql
  CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");
  ```

### 2. Foreign Key Indexes
Prisma handles database joins at the application layer or executes nested SELECT commands. We must index foreign key columns to optimize item lookups inside specific categories:
```sql
CREATE INDEX "category_items_category_id_idx" ON "category_items"("category_id");
```

### 3. Soft-Delete Filtering Indexes
Since public users retrieve only active, non-deleted entries (`is_deleted = false` and `is_active = true`), we index these columns:
```sql
CREATE INDEX "categories_active_idx" ON "categories"("is_deleted", "is_active");
CREATE INDEX "category_items_active_idx" ON "category_items"("is_deleted", "is_active");
```

---

## 5. Production Operations Checklist

Transitioning a database from local development to AWS RDS requires the following:

### 1. Connection Pooling
AWS Lambdas or serverless containers scale horizontally, creating many concurrent connections that can exhaust RDS database limits.
- **Solution:** Configure a connection pooler like **PgBouncer** or use AWS RDS Proxy to manage connection queues.

### 2. Auto-vacuum Configurations
Autovacuum removes dead tuples created by updates/deletes (e.g. reordering category items).
- **Takeaway:** Monitor table bloat and configure autovacuum settings to run during off-peak hours.

### 3. Database Migration Safety
Never execute raw `prisma db push` on a production database, as it can cause accidental table truncation.
- **Best Practice:** Run `prisma migrate deploy` in your CI/CD pipeline, which applies pre-generated, version-controlled SQL migration scripts incrementally.
