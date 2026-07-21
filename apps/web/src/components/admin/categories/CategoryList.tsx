'use client';

import { CategoryDto } from '@jazz-portfolio/shared';

interface CategoryListProps {
  categories: CategoryDto[];
  selectedCategoryId: string | null;
  loading: boolean;
  onSelect: (category: CategoryDto) => void;
  onEdit: (category: CategoryDto) => void;
  onDelete: (id: string) => void;
  onReorder: (id: string, index: number, direction: 'up' | 'down') => void;
}

export default function CategoryList({
  categories,
  selectedCategoryId,
  loading,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
}: CategoryListProps) {
  return (
    <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl">
      <h3 className="text-sm font-heading font-bold text-jazz-gold mb-4 border-b border-jazz-slate pb-2">
        Portfolio Categories
      </h3>

      {loading ? (
        <div className="text-xs font-mono text-jazz-text-dim py-6 animate-pulse">Fetching records...</div>
      ) : categories.length === 0 ? (
        <div className="text-xs font-mono text-jazz-text-dim py-6">No categories created yet.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {categories.map((cat, idx) => (
            <div
              key={cat.id}
              onClick={() => onSelect(cat)}
              className={`p-4 rounded-xl border transition-all duration-300 flex items-center justify-between cursor-pointer ${
                selectedCategoryId === cat.id
                  ? 'bg-jazz-gold/10 border-jazz-gold text-jazz-text shadow-[0_0_10px_rgba(212,165,116,0.15)]'
                  : 'bg-jazz-charcoal/50 border-jazz-slate text-jazz-text-muted hover:border-jazz-gold/50'
              }`}
            >
              <div>
                <h4
                  className={`text-sm font-semibold ${
                    selectedCategoryId === cat.id ? 'text-jazz-gold' : 'text-jazz-text'
                  }`}
                >
                  {cat.name.en}{' '}
                  <span className="text-[10px] font-mono font-normal text-jazz-text-dim">
                    ({cat.type})
                  </span>
                </h4>
                <p className="text-[10px] text-jazz-text-dim mt-1 font-mono">
                  slug: {cat.slug} | Items: {cat.items?.length || 0}
                </p>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onReorder(cat.id, idx, 'up')}
                  className="text-xs p-1 hover:text-jazz-gold"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(cat.id, idx, 'down')}
                  className="text-xs p-1 hover:text-jazz-gold"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(cat)}
                  className="text-xs p-1 text-jazz-brass hover:text-jazz-amber"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(cat.id)}
                  className="text-xs p-1 text-red-400 hover:text-red-300"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
