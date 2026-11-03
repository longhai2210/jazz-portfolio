-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "are_comments_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "comment_auto_close_days" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "comment_max_per_post" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "comment_moderation_mode" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN     "comment_notify_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "comment_spam_threshold" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "is_blog_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_comment_captcha_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" JSONB NOT NULL DEFAULT '{"en": "", "vi": "", "ja": ""}',
    "excerpt" JSONB NOT NULL DEFAULT '{"en": "", "vi": "", "ja": ""}',
    "content" JSONB NOT NULL DEFAULT '{"en": "", "vi": "", "ja": ""}',
    "cover_image_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reading_minutes" INTEGER NOT NULL DEFAULT 0,
    "are_comments_enabled" BOOLEAN NOT NULL DEFAULT true,
    "comments_closed_at" TIMESTAMP(3),
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "author_name" VARCHAR(60) NOT NULL,
    "author_email" VARCHAR(254) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "spam_score" INTEGER NOT NULL DEFAULT 0,
    "spam_reasons" JSONB NOT NULL DEFAULT '[]',
    "ip_hash" VARCHAR(64) NOT NULL,
    "user_agent" VARCHAR(400) NOT NULL DEFAULT '',
    "content_hash" VARCHAR(64) NOT NULL,
    "locale" VARCHAR(5) NOT NULL DEFAULT 'en',
    "moderated_at" TIMESTAMP(3),
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_blocklist" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" VARCHAR(200) NOT NULL,
    "note" VARCHAR(200) NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_blocklist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_is_deleted_status_published_at_idx" ON "posts"("is_deleted", "status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "posts_status_published_at_idx" ON "posts"("status", "published_at" DESC);

-- CreateIndex
CREATE INDEX "posts_tags_idx" ON "posts" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "comments_post_id_status_created_at_idx" ON "comments"("post_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "comments_status_created_at_idx" ON "comments"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "comments_ip_hash_created_at_idx" ON "comments"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "comments_content_hash_idx" ON "comments"("content_hash");

-- CreateIndex
CREATE INDEX "comment_blocklist_type_idx" ON "comment_blocklist"("type");

-- CreateIndex
CREATE UNIQUE INDEX "comment_blocklist_type_value_key" ON "comment_blocklist"("type", "value");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
