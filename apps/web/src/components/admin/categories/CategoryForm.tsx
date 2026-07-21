'use client';

export interface CategoryFormValues {
  nameEn: string;
  nameVi: string;
  nameJa: string;
  slug: string;
  type: string;
}

interface CategoryFormProps {
  values: CategoryFormValues;
  editingId: string | null;
  saving: boolean;
  onChange: (values: CategoryFormValues) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function CategoryForm({
  values,
  editingId,
  saving,
  onChange,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const set = <K extends keyof CategoryFormValues>(key: K, value: CategoryFormValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl">
      <h3 className="text-xs font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2 mb-4 uppercase tracking-wider">
        {editingId ? 'Edit Category' : 'Create Category'}
      </h3>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">
            Name (EN / VI / JA)
          </label>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              required
              placeholder="English name"
              value={values.nameEn}
              onChange={(e) => set('nameEn', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
            <input
              type="text"
              required
              placeholder="Vietnamese name"
              value={values.nameVi}
              onChange={(e) => set('nameVi', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
            <input
              type="text"
              required
              placeholder="Japanese name"
              value={values.nameJa}
              onChange={(e) => set('nameJa', e.target.value)}
              className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">Slug</label>
          <input
            type="text"
            required
            placeholder="skills"
            value={values.slug}
            onChange={(e) => set('slug', e.target.value)}
            className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
          />
        </div>

        <div>
          <label className="block text-[10px] font-mono text-jazz-text-dim mb-1">Type</label>
          <select
            value={values.type}
            onChange={(e) => set('type', e.target.value)}
            className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-jazz-gold transition-colors font-mono"
          >
            <option value="CUSTOM">CUSTOM</option>
            <option value="SKILL">SKILL</option>
            <option value="EXPERIENCE">EXPERIENCE</option>
            <option value="EDUCATION">EDUCATION</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            {editingId ? 'Save' : 'Create'}
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
