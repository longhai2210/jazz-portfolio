'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  AdminPostDto,
  ApiRoutes,
  CreatePostRequest,
  Locale,
  LocalizedString,
  PostStatus,
  PresignUploadResponse,
} from '@jazz-portfolio/shared';
import { AdminApiClient } from '@/lib/api-admin';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';
import PostBody from '@/components/blog/PostBody';

interface PostEditorProps {
  initialPost?: AdminPostDto | null;
  saving: boolean;
  error: string | null;
  onClearError: () => void;
  onSave: (data: CreatePostRequest) => Promise<boolean>;
  onCancel: () => void;
}

export default function PostEditor({
  initialPost,
  saving,
  error,
  onClearError,
  onSave,
  onCancel,
}: PostEditorProps) {
  const isEditing = !!initialPost;

  const [activeLocale, setActiveLocale] = useState<Locale>('en');
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');

  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [title, setTitle] = useState<LocalizedString>({ en: '', vi: '', ja: '' });
  const [excerpt, setExcerpt] = useState<LocalizedString>({ en: '', vi: '', ja: '' });
  const [content, setContent] = useState<LocalizedString>({ en: '', vi: '', ja: '' });
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [status, setStatus] = useState<PostStatus>(PostStatus.DRAFT);
  const [areCommentsEnabled, setAreCommentsEnabled] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (initialPost) {
      setSlug(initialPost.slug);
      setSlugManual(true);
      setTitle(initialPost.title || { en: '', vi: '', ja: '' });
      setExcerpt(initialPost.excerpt || { en: '', vi: '', ja: '' });
      setContent(initialPost.content || { en: '', vi: '', ja: '' });
      setCoverImageUrl(initialPost.coverImageUrl);
      setTags(initialPost.tags || []);
      setStatus(initialPost.status);
      setAreCommentsEnabled(initialPost.areCommentsEnabled);
    }
  }, [initialPost]);

  // Auto-slugify EN title if slug was not manually set
  const handleEnTitleChange = (val: string) => {
    setTitle((prev) => ({ ...prev, en: val }));
    setIsDirty(true);
    if (!slugManual && !isEditing) {
      const generated = val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setSlug(generated);
    }
  };

  // Warn on unsaved changes when closing tab
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Handle cover image presigned upload
  const handleCoverUpload = async (file: File) => {
    setUploadingCover(true);
    setUploadError(null);
    try {
      const presignRes = await AdminApiClient.post<PresignUploadResponse>(
        ApiRoutes.media.adminPresign(),
        {
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
          context: 'GENERAL',
        },
      );

      if (!presignRes.data?.uploadUrl) {
        throw new Error('Failed to get presigned upload URL');
      }

      const uploadUrl = presignRes.data.uploadUrl;
      const cloudfrontUrl = presignRes.data.cloudfrontUrl;

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed with status ${uploadRes.status}`);
      }

      setCoverImageUrl(cloudfrontUrl);
      setIsDirty(true);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload cover image.');
    } finally {
      setUploadingCover(false);
    }
  };

  const addTag = () => {
    const trimmed = tagInput
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');
    if (trimmed && !tags.includes(trimmed) && tags.length < 8) {
      setTags([...tags, trimmed]);
      setTagInput('');
      setIsDirty(true);
    }
  };

  const removeTag = (t: string) => {
    setTags(tags.filter((item) => item !== t));
    setIsDirty(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const saved = await onSave({
      slug,
      title,
      excerpt,
      content,
      coverImageUrl,
      tags,
      status,
      areCommentsEnabled,
    });
    if (saved) setIsDirty(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <MutationErrorBanner
        message={error || uploadError}
        onDismiss={() => {
          onClearError();
          setUploadError(null);
        }}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Top bar: Mode & Actions */}
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-heading font-bold text-jazz-gold">
              {isEditing ? 'Edit Blog Post' : 'Create New Blog Post'}
            </h2>
            <p className="text-xs text-jazz-text-muted mt-1 font-mono">
              Multilingual markdown content (EN / VI / JA)
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2.5 border border-jazz-slate text-jazz-text hover:border-jazz-gold/50 rounded-xl text-xs font-mono transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-2.5 px-6 rounded-xl transition-all shadow-[0_0_15px_rgba(212,165,116,0.15)] disabled:opacity-50 text-xs cursor-pointer"
            >
              {saving ? 'Saving Post...' : isEditing ? 'Update Post' : 'Create Post'}
            </button>
          </div>
        </div>

        {/* Global Metadata Block */}
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5">
          <h3 className="text-sm font-heading font-bold text-jazz-gold border-b border-jazz-slate pb-2">
            Post Settings & Metadata
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                URL Slug <span className="text-jazz-gold">*</span>
              </label>
              <input
                type="text"
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManual(true);
                  setIsDirty(true);
                }}
                placeholder="my-first-post"
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                Publishing Status
              </label>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value as PostStatus);
                  setIsDirty(true);
                }}
                className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold transition-colors font-mono cursor-pointer"
              >
                <option value={PostStatus.DRAFT}>Draft (Private)</option>
                <option value={PostStatus.PUBLISHED}>Published (Public)</option>
                <option value={PostStatus.ARCHIVED}>Archived</option>
              </select>
            </div>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Cover Image
            </label>
            <div className="flex items-center gap-4">
              {coverImageUrl ? (
                <div className="relative w-32 h-20 rounded-xl overflow-hidden border border-jazz-slate group">
                  <Image
                    src={coverImageUrl}
                    alt="Cover preview"
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverImageUrl(null);
                      setIsDirty(true);
                    }}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-mono text-red-400 transition-opacity cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-jazz-slate hover:border-jazz-gold rounded-xl p-4 text-center cursor-pointer transition-colors w-full md:w-auto">
                  <span className="text-xs font-mono text-jazz-text-muted">
                    {uploadingCover ? 'Uploading...' : '📁 Click to upload cover image'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingCover}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCoverUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
              Tags (max 8)
            </label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-jazz-charcoal border border-jazz-slate text-jazz-gold text-xs font-mono"
                >
                  #{t}
                  <button
                    type="button"
                    onClick={() => removeTag(t)}
                    className="text-jazz-text-muted hover:text-red-400 font-bold cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            {tags.length < 8 && (
              <div className="flex items-center gap-2 max-w-sm">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                  placeholder="Add tag and press Enter"
                  className="flex-1 bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-jazz-gold"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-jazz-charcoal border border-jazz-slate text-jazz-text hover:text-jazz-gold rounded-xl text-xs font-mono cursor-pointer"
                >
                  + Add
                </button>
              </div>
            )}
          </div>

          {/* Comments Toggle */}
          <div className="flex items-center justify-between gap-4 pt-2">
            <div>
              <span className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
                Allow Comments on this post
              </span>
              <p className="text-xs text-jazz-text-muted mt-0.5">
                When enabled, visitors can leave comments if the global comments feature is active.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={areCommentsEnabled}
                onChange={(e) => {
                  setAreCommentsEnabled(e.target.checked);
                  setIsDirty(true);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-jazz-charcoal peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-jazz-slate after:border-jazz-slate after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-jazz-gold peer-checked:after:bg-jazz-black" />
            </label>
          </div>
        </div>

        {/* Content Block (Locale Tabs & Mode Toggle) */}
        <div className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-jazz-slate/40 pb-3">
            {/* Locale Tabs */}
            <div className="flex items-center gap-1.5">
              {(['en', 'vi', 'ja'] as Locale[]).map((loc) => {
                const hasContent = !!content[loc]?.trim();
                return (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setActiveLocale(loc)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                      activeLocale === loc
                        ? 'bg-jazz-gold text-jazz-black'
                        : 'bg-jazz-charcoal border border-jazz-slate text-jazz-text-muted hover:text-jazz-text'
                    }`}
                  >
                    {loc} {hasContent && <span className="text-[10px] ml-1 opacity-80">✓</span>}
                  </button>
                );
              })}
            </div>

            {/* View Mode: Editor / Preview */}
            <div className="flex items-center gap-1 bg-jazz-charcoal p-1 rounded-xl border border-jazz-slate">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  activeTab === 'editor'
                    ? 'bg-jazz-gold/20 text-jazz-gold font-bold'
                    : 'text-jazz-text-muted hover:text-jazz-text'
                }`}
              >
                ✏ Edit Markdown
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-lg text-xs font-mono transition-colors cursor-pointer ${
                  activeTab === 'preview'
                    ? 'bg-jazz-gold/20 text-jazz-gold font-bold'
                    : 'text-jazz-text-muted hover:text-jazz-text'
                }`}
              >
                👁 Live Preview
              </button>
            </div>
          </div>

          {activeTab === 'editor' ? (
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                  Title ({activeLocale.toUpperCase()}) <span className="text-jazz-gold">*</span>
                </label>
                <input
                  type="text"
                  required={activeLocale === 'en'}
                  value={title[activeLocale] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (activeLocale === 'en') {
                      handleEnTitleChange(val);
                    } else {
                      setTitle({ ...title, [activeLocale]: val });
                      setIsDirty(true);
                    }
                  }}
                  placeholder={`Post title in ${activeLocale.toUpperCase()}`}
                  className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                  Excerpt / Summary ({activeLocale.toUpperCase()})
                </label>
                <textarea
                  rows={2}
                  value={excerpt[activeLocale] || ''}
                  onChange={(e) => {
                    setExcerpt({ ...excerpt, [activeLocale]: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder={`Short summary of post in ${activeLocale.toUpperCase()}`}
                  className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-jazz-text-dim mb-2">
                  Body Content ({activeLocale.toUpperCase()}) — Markdown
                </label>
                <textarea
                  rows={14}
                  value={content[activeLocale] || ''}
                  onChange={(e) => {
                    setContent({ ...content, [activeLocale]: e.target.value });
                    setIsDirty(true);
                  }}
                  placeholder={`Write post body in Markdown (${activeLocale.toUpperCase()})...`}
                  className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-jazz-gold font-mono leading-relaxed resize-y"
                />
              </div>
            </div>
          ) : (
            <div className="min-h-[400px] p-6 bg-jazz-charcoal/60 border border-jazz-slate rounded-xl overflow-y-auto">
              <h1 className="text-2xl font-heading font-bold text-jazz-gold mb-2">
                {title[activeLocale] || 'Untitled Post'}
              </h1>
              <p className="text-sm text-jazz-text-muted italic mb-6">
                {excerpt[activeLocale] || 'No summary provided.'}
              </p>
              <div className="border-t border-jazz-slate/50 pt-4">
                <PostBody content={content[activeLocale] || ''} />
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
