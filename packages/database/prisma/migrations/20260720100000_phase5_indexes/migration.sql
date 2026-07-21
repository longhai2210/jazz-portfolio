-- CreateIndex
CREATE INDEX "categories_is_deleted_is_active_sort_order_idx" ON "categories"("is_deleted", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "category_items_category_id_is_deleted_is_active_sort_order_idx" ON "category_items"("category_id", "is_deleted", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "tracks_is_active_sort_order_idx" ON "tracks"("is_active", "sort_order");

-- CreateIndex
CREATE INDEX "media_created_at_idx" ON "media"("created_at");

-- CreateIndex
CREATE INDEX "contact_submissions_is_read_created_at_idx" ON "contact_submissions"("is_read", "created_at");
