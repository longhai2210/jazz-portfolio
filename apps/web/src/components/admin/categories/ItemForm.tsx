'use client';

export interface ItemFormValues {
  titleEn: string;
  titleVi: string;
  titleJa: string;
  descEn: string;
  descVi: string;
  descJa: string;
  metadata: string;
}

interface ItemFormProps {
  values: ItemFormValues;
  editingId: string | null;
  saving: boolean;
  onChange: (values: ItemFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function ItemForm({
  values,
  editingId,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: ItemFormProps) {
  const set = <K extends keyof ItemFormValues>(key: K, value: ItemFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl">
      <h3 className="text-xs font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2 mb-4 uppercase tracking-wider">
        {editingId ? 'Edit Category Item' : 'Add Item to Category'}
      </h3>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
            Title (EN / VI / JA)
          </label>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              required
              placeholder="English title"
              value={values.titleEn}
              onChange={(e) => set('titleEn', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
            <input
              type="text"
              required
              placeholder="Vietnamese title"
              value={values.titleVi}
              onChange={(e) => set('titleVi', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
            <input
              type="text"
              required
              placeholder="Japanese title"
              value={values.titleJa}
              onChange={(e) => set('titleJa', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
            Description (EN / VI / JA)
          </label>
          <div className="flex flex-col gap-2">
            <textarea
              rows={2}
              placeholder="English description"
              value={values.descEn}
              onChange={(e) => set('descEn', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg p-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
            <textarea
              rows={2}
              placeholder="Vietnamese description"
              value={values.descVi}
              onChange={(e) => set('descVi', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg p-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
            <textarea
              rows={2}
              placeholder="Japanese description"
              value={values.descJa}
              onChange={(e) => set('descJa', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg p-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
            Metadata (JSON String)
          </label>
          <textarea
            rows={4}
            value={values.metadata}
            onChange={(e) => set('metadata', e.target.value)}
            className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg p-2.5 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            placeholder='{ "company": "Labs", "tags": ["React"] }'
          />
          <p className="text-[9px] text-jazz-text-dim mt-1 font-mono">
            For experience, add: &quot;company&quot;, &quot;period&quot;, &quot;tags&quot; array. For
            skill: &quot;group&quot;
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            {editingId ? 'Save' : 'Add Item'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={onCancel}
              className="border border-jazz-slate text-jazz-text px-4 py-2 rounded-lg text-xs"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
