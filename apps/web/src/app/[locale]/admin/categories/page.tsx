'use client';

import { useEffect, useState } from 'react';
import { buildReorderIds, CategoryDto, CategoryItemDto } from '@jazz-portfolio/shared';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';
import {
  CategoryForm,
  CategoryFormValues,
  CategoryList,
  ItemForm,
  ItemFormValues,
  ItemList,
} from '@/components/admin/categories';
import { useCategoriesAdmin } from '@/hooks/admin/useCategoriesAdmin';

const emptyCatForm = (): CategoryFormValues => ({
  nameEn: '',
  nameVi: '',
  nameJa: '',
  slug: '',
  type: 'CUSTOM',
});

const emptyItemForm = (): ItemFormValues => ({
  titleEn: '',
  titleVi: '',
  titleJa: '',
  descEn: '',
  descVi: '',
  descJa: '',
  metadata: '{}',
});

export default function AdminCategoriesPage() {
  const {
    categories,
    isLoading,
    queryError,
    mutationError,
    clearMutationError,
    saveCategory,
    deleteCategory,
    reorderCategories,
    saveItem,
    deleteItem,
    reorderItems,
  } = useCategoriesAdmin();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryFormValues>(emptyCatForm);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormValues>(emptyItemForm);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedCategory =
    categories.find((c) => c.id === selectedCategoryId) ?? null;

  useEffect(() => {
    if (selectedCategoryId && !categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(null);
    }
  }, [categories, selectedCategoryId]);

  const resetCatForm = () => {
    setEditingCatId(null);
    setCatForm(emptyCatForm());
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemForm(emptyItemForm());
  };

  const handleCatSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearMutationError();
    try {
      await saveCategory.mutateAsync({
        id: editingCatId,
        payload: {
          name: { en: catForm.nameEn, vi: catForm.nameVi, ja: catForm.nameJa },
          slug: catForm.slug,
          type: catForm.type,
        },
      });
      resetCatForm();
    } catch {
      // surfaced via mutationError
    }
  };

  const handleCatEdit = (cat: CategoryDto) => {
    setEditingCatId(cat.id);
    setCatForm({
      nameEn: cat.name.en,
      nameVi: cat.name.vi,
      nameJa: cat.name.ja,
      slug: cat.slug,
      type: cat.type,
    });
  };

  const handleCatDelete = async (id: string) => {
    if (!confirm('Are you sure you want to soft delete this category?')) return;
    clearMutationError();
    try {
      await deleteCategory.mutateAsync(id);
    } catch {
      // surfaced via mutationError
    }
  };

  const handleCatReorder = async (_id: string, index: number, direction: 'up' | 'down') => {
    const ids = buildReorderIds(
      categories.map((c) => c.id),
      index,
      direction,
    );
    if (!ids) return;
    clearMutationError();
    try {
      await reorderCategories.mutateAsync(ids);
    } catch {
      // surfaced via mutationError
    }
  };

  const handleItemSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    let parsedMeta: Record<string, unknown> = {};
    try {
      parsedMeta = JSON.parse(itemForm.metadata);
    } catch {
      setFormError('Invalid JSON metadata string.');
      return;
    }

    setFormError(null);
    clearMutationError();
    try {
      await saveItem.mutateAsync({
        categoryId: selectedCategory.id,
        itemId: editingItemId,
        payload: {
          title: { en: itemForm.titleEn, vi: itemForm.titleVi, ja: itemForm.titleJa },
          description: { en: itemForm.descEn, vi: itemForm.descVi, ja: itemForm.descJa },
          metadata: parsedMeta,
        },
      });
      resetItemForm();
    } catch {
      // surfaced via mutationError
    }
  };

  const handleItemEdit = (item: CategoryItemDto) => {
    setEditingItemId(item.id);
    setItemForm({
      titleEn: item.title.en,
      titleVi: item.title.vi,
      titleJa: item.title.ja,
      descEn: item.description.en || '',
      descVi: item.description.vi || '',
      descJa: item.description.ja || '',
      metadata: JSON.stringify(item.metadata, null, 2),
    });
  };

  const handleItemDelete = async (id: string) => {
    if (!confirm('Are you sure you want to soft delete this item?')) return;
    clearMutationError();
    try {
      await deleteItem.mutateAsync(id);
    } catch {
      // surfaced via mutationError
    }
  };

  const handleItemReorder = async (
    _item: CategoryItemDto,
    index: number,
    direction: 'up' | 'down',
  ) => {
    if (!selectedCategory) return;
    const items = selectedCategory.items || [];
    const ids = buildReorderIds(
      items.map((i) => i.id),
      index,
      direction,
    );
    if (!ids) return;
    clearMutationError();
    try {
      await reorderItems.mutateAsync(ids);
    } catch {
      // surfaced via mutationError
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">
          Categories & Content Manager
        </h1>
        <p className="text-sm text-jazz-text-muted mt-2">
          Manage dynamic portfolio sections (Skills, Experiences) and nest content details inside
          them.
        </p>
      </div>

      <MutationErrorBanner
        message={formError || queryError || mutationError}
        onDismiss={() => {
          setFormError(null);
          clearMutationError();
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 flex flex-col gap-6">
          <CategoryList
            categories={categories}
            selectedCategoryId={selectedCategoryId}
            loading={isLoading}
            onSelect={(cat) => setSelectedCategoryId(cat.id)}
            onEdit={handleCatEdit}
            onDelete={handleCatDelete}
            onReorder={handleCatReorder}
          />

          {selectedCategory && (
            <ItemList
              category={selectedCategory}
              onClose={() => setSelectedCategoryId(null)}
              onEdit={handleItemEdit}
              onDelete={handleItemDelete}
              onReorder={handleItemReorder}
            />
          )}
        </div>

        <div className="lg:col-span-5 flex flex-col gap-6">
          <CategoryForm
            values={catForm}
            editingId={editingCatId}
            saving={saveCategory.isPending}
            onChange={setCatForm}
            onSubmit={handleCatSave}
            onCancel={resetCatForm}
          />

          {selectedCategory && (
            <ItemForm
              values={itemForm}
              editingId={editingItemId}
              saving={saveItem.isPending}
              onChange={setItemForm}
              onSubmit={handleItemSave}
              onCancel={resetItemForm}
            />
          )}
        </div>
      </div>
    </div>
  );
}
