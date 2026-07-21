'use client';

import { CategoryDto, CategoryItemDto } from '@jazz-portfolio/shared';

interface ItemListProps {
  category: CategoryDto;
  onClose: () => void;
  onEdit: (item: CategoryItemDto) => void;
  onDelete: (id: string) => void;
  onReorder: (item: CategoryItemDto, index: number, direction: 'up' | 'down') => void;
}

export default function ItemList({
  category,
  onClose,
  onEdit,
  onDelete,
  onReorder,
}: ItemListProps) {
  const items = category.items || [];

  return (
    <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4 border-b border-jazz-slate pb-2">
        <h3 className="text-sm font-heading font-bold text-jazz-gold">
          Items in: <span className="text-jazz-text">{category.name.en}</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-mono text-jazz-text-dim hover:text-jazz-gold"
        >
          Close Manager
        </button>
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="text-xs font-mono text-jazz-text-dim py-4">
            No items inside this category.
          </div>
        ) : (
          items.map((item, itemIdx) => (
            <div
              key={item.id}
              className="bg-jazz-charcoal/50 border border-jazz-slate p-4 rounded-xl flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-semibold text-jazz-text">{item.title.en}</h4>
                <p className="text-[10px] text-jazz-text-muted mt-1 leading-relaxed truncate max-w-sm">
                  {item.description.en || 'No description.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onReorder(item, itemIdx, 'up')}
                  className="text-xs p-1 hover:text-jazz-gold"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(item, itemIdx, 'down')}
                  className="text-xs p-1 hover:text-jazz-gold"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(item)}
                  className="text-xs p-1 text-jazz-brass hover:text-jazz-amber"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  className="text-xs p-1 text-red-400 hover:text-red-300"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
