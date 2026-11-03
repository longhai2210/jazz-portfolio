'use client';

import { useState } from 'react';
import { AdminCommentDto, BlocklistType, CommentStatus } from '@jazz-portfolio/shared';
import {
  useBlocklistAdmin,
  useCommentsAdminList,
  useCommentsAdminMutations,
} from '@/hooks/admin/useCommentsAdmin';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';

export default function AdminCommentsPage() {
  const [activeTab, setActiveTab] = useState<'moderation' | 'blocklist'>('moderation');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedComment, setSelectedComment] = useState<AdminCommentDto | null>(null);

  const { data, isLoading, error: queryError, refetch } = useCommentsAdminList(page, 20, statusFilter);
  const { data: blocklist, isLoading: loadingBlocklist } = useBlocklistAdmin();

  const {
    moderateComment,
    bulkModerate,
    deleteComment,
    createBlocklistItem,
    deleteBlocklistItem,
    mutationError,
    clearMutationError,
  } = useCommentsAdminMutations();

  // Blocklist Form State
  const [newRuleType, setNewRuleType] = useState<BlocklistType>(BlocklistType.KEYWORD);
  const [newRuleValue, setNewRuleValue] = useState('');

  const handleModerate = async (id: string, status: CommentStatus) => {
    clearMutationError();
    await moderateComment.mutateAsync({ id, status });
    if (selectedComment?.id === id) {
      if (statusFilter !== 'ALL' && statusFilter !== status) {
        setSelectedComment(null);
      } else {
        setSelectedComment((prev) => (prev ? { ...prev, status } : null));
      }
    }
  };

  const handleBulkAction = async (status: CommentStatus) => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to mark ${selectedIds.length} comments as ${status}?`,
      )
    ) {
      return;
    }
    clearMutationError();
    await bulkModerate.mutateAsync({ ids: selectedIds, status });
    setSelectedIds([]);
  };


  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      clearMutationError();
      await deleteComment.mutateAsync(id);
      if (selectedComment?.id === id) {
        setSelectedComment(null);
      }
    }
  };

  const handleAddBlocklistRule = async (type: BlocklistType, value: string) => {
    if (!value.trim()) return;
    clearMutationError();
    await createBlocklistItem.mutateAsync({
      type,
      value: value.trim(),
    });
  };

  const handleAddBlocklistForm = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleAddBlocklistRule(newRuleType, newRuleValue);
    setNewRuleValue('');
  };

  const handleDeleteBlocklist = async (id: string) => {
    clearMutationError();
    await deleteBlocklistItem.mutateAsync(id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (!data?.items) return;
    if (selectedIds.length === data.items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.items.map((c) => c.id));
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-heading font-bold text-jazz-gold">
          Comments Moderation
        </h1>
        <p className="text-sm text-jazz-text-muted mt-2">
          Review community discussions, manage automated spam filters, and configure blocklist rules.
        </p>
      </div>

      <MutationErrorBanner message={mutationError} onDismiss={clearMutationError} />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-4 border-b border-jazz-slate/40 pb-3">
        <button
          onClick={() => setActiveTab('moderation')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'moderation'
              ? 'bg-jazz-gold text-jazz-black'
              : 'bg-jazz-charcoal border border-jazz-slate text-jazz-text-muted hover:text-jazz-text'
          }`}
        >
          💬 Moderation Queue
        </button>
        <button
          onClick={() => setActiveTab('blocklist')}
          className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
            activeTab === 'blocklist'
              ? 'bg-jazz-gold text-jazz-black'
              : 'bg-jazz-charcoal border border-jazz-slate text-jazz-text-muted hover:text-jazz-text'
          }`}
        >
          🛡 Spam & Blocklist Rules ({blocklist?.length || 0})
        </button>
      </div>

      {activeTab === 'moderation' ? (
        <div className="flex flex-col gap-6">
          {/* Status Filters & Bulk Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {['PENDING', CommentStatus.APPROVED, CommentStatus.REJECTED, CommentStatus.SPAM, 'ALL'].map(
                (st) => (
                  <button
                    key={st}
                    onClick={() => {
                      setStatusFilter(st);
                      setPage(1);
                      setSelectedIds([]);
                      setSelectedComment(null);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                      statusFilter === st
                        ? 'bg-jazz-gold/20 text-jazz-gold border border-jazz-gold/40'
                        : 'bg-jazz-charcoal border border-jazz-slate text-jazz-text-muted hover:text-jazz-text'
                    }`}
                  >
                    {st}
                  </button>
                ),
              )}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-jazz-charcoal p-1.5 rounded-xl border border-jazz-slate">
                <span className="text-xs font-mono text-jazz-text-dim px-2">
                  {selectedIds.length} selected
                </span>
                <button
                  onClick={() => handleBulkAction(CommentStatus.APPROVED)}
                  className="px-2.5 py-1 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 rounded-lg text-[11px] font-mono cursor-pointer hover:bg-emerald-900/40"
                >
                  ✓ Approve ({selectedIds.length})
                </button>
                <button
                  onClick={() => handleBulkAction(CommentStatus.REJECTED)}
                  className="px-2.5 py-1 bg-yellow-950/40 border border-yellow-500/30 text-yellow-400 rounded-lg text-[11px] font-mono cursor-pointer hover:bg-yellow-900/40"
                >
                  ✗ Reject ({selectedIds.length})
                </button>
                <button
                  onClick={() => handleBulkAction(CommentStatus.SPAM)}
                  className="px-2.5 py-1 bg-red-950/40 border border-red-500/30 text-red-400 rounded-lg text-[11px] font-mono cursor-pointer hover:bg-red-900/40"
                >
                  🚫 Mark Spam ({selectedIds.length})
                </button>
              </div>
            )}
          </div>

          {/* Split Pane View */}
          {isLoading ? (
            <div className="text-sm font-mono text-jazz-gold animate-pulse py-12">
              🎷 Loading Comments Queue...
            </div>
          ) : queryError ? (
            <div className="flex items-center gap-4 text-sm text-red-400 font-mono py-6">
              <span>Failed to load comments moderation queue.</span>
              <button
                onClick={() => refetch()}
                className="px-3 py-1 bg-red-950/40 border border-red-500/30 hover:bg-red-900/40 text-red-300 rounded-lg text-xs font-mono cursor-pointer"
              >
                🔄 Retry
              </button>
            </div>
          ) : !data || data.items.length === 0 ? (

            <div className="bg-jazz-dark/50 border border-jazz-slate rounded-2xl p-12 text-center text-jazz-text-muted text-sm font-mono">
              No comments found in status filter &quot;{statusFilter}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left List Pane (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="bg-jazz-dark/50 border border-jazz-slate rounded-2xl overflow-hidden">
                  <div className="bg-jazz-charcoal border-b border-jazz-slate px-4 py-2.5 flex items-center justify-between text-xs font-mono text-jazz-text-dim">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === data.items.length}
                        onChange={toggleSelectAll}
                      />
                      <span>Select All</span>
                    </label>
                    <span>
                      {data.items.length} of {data.total}
                    </span>
                  </div>

                  <div className="divide-y divide-jazz-slate/40 max-h-[600px] overflow-y-auto">
                    {data.items.map((comment) => {
                      const isSelected = selectedComment?.id === comment.id;

                      return (
                        <div
                          key={comment.id}
                          onClick={() => setSelectedComment(comment)}
                          className={`p-4 flex flex-col gap-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-jazz-gold/10 border-l-4 border-l-jazz-gold'
                              : 'hover:bg-jazz-charcoal/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(comment.id)}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleSelect(comment.id);
                                }}
                              />
                              <span className="font-bold text-jazz-gold text-xs font-mono">
                                {comment.authorName}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                                comment.status === CommentStatus.APPROVED
                                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                                  : comment.status === CommentStatus.PENDING
                                  ? 'bg-yellow-950/40 text-yellow-400 border border-yellow-500/30'
                                  : 'bg-red-950/40 text-red-400 border border-red-500/30'
                              }`}
                            >
                              {comment.status}
                            </span>
                          </div>

                          <p className="text-xs text-jazz-text font-sans line-clamp-2 leading-relaxed">
                            {comment.content}
                          </p>

                          <div className="flex items-center justify-between text-[10px] font-mono text-jazz-text-dim pt-1">
                            <span>/{comment.postSlug}</span>
                            <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Pagination Controls */}
                {data.totalPages > 1 && (
                  <div className="flex items-center justify-between text-xs font-mono text-jazz-text-muted">
                    <span>
                      Page {data.page} of {data.totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 border border-jazz-slate rounded-lg disabled:opacity-40 cursor-pointer"
                      >
                        ← Prev
                      </button>
                      <button
                        disabled={page >= data.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className="px-3 py-1.5 border border-jazz-slate rounded-lg disabled:opacity-40 cursor-pointer"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Detail & Inspection Pane (5 Cols) */}
              <div className="lg:col-span-5">
                {selectedComment ? (
                  <div className="bg-jazz-dark/60 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-5 sticky top-6">
                    <div className="flex items-center justify-between border-b border-jazz-slate/40 pb-3">
                      <h3 className="text-sm font-heading font-bold text-jazz-gold uppercase tracking-wider">
                        Inspect Comment
                      </h3>
                      <button
                        onClick={() => setSelectedComment(null)}
                        className="text-xs font-mono text-jazz-text-muted hover:text-jazz-text cursor-pointer"
                      >
                        ✕ Close
                      </button>
                    </div>

                    {/* Author Metadata */}
                    <div className="flex flex-col gap-1 text-xs font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-jazz-text-dim">Author:</span>
                        <span className="font-bold text-jazz-gold">
                          {selectedComment.authorName}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-jazz-text-dim">Email:</span>
                        <span className="text-jazz-text">{selectedComment.authorEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-jazz-text-dim">IP Address:</span>
                        <span className="text-jazz-text">{selectedComment.ipAddress}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-jazz-text-dim">Target Post:</span>
                        <span className="text-jazz-gold font-bold">
                          /{selectedComment.postSlug}
                        </span>
                      </div>
                    </div>

                    {/* Spam Analysis Badge */}
                    <div className="bg-jazz-charcoal p-3.5 rounded-xl border border-jazz-slate flex flex-col gap-2">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-jazz-text-dim">Spam Score:</span>
                        <span
                          className={`font-bold ${
                            selectedComment.spamScore >= 50
                              ? 'text-red-400'
                              : selectedComment.spamScore > 0
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {selectedComment.spamScore} / 100
                        </span>
                      </div>
                      {selectedComment.blockReason && (
                        <p className="text-[11px] font-mono text-red-400 italic">
                          ⚠️ {selectedComment.blockReason}
                        </p>
                      )}
                    </div>

                    {/* Full Body */}
                    <div>
                      <span className="block text-[11px] font-mono text-jazz-text-dim mb-1 uppercase">
                        Message Content:
                      </span>
                      <div className="bg-jazz-charcoal/80 p-4 rounded-xl border border-jazz-slate/50 text-xs font-sans text-jazz-text leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {selectedComment.content}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-2">
                      <span className="text-[11px] font-mono text-jazz-text-dim uppercase">
                        Moderation Actions:
                      </span>
                      <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                        {selectedComment.status !== CommentStatus.APPROVED && (
                          <button
                            onClick={() =>
                              handleModerate(selectedComment.id, CommentStatus.APPROVED)
                            }
                            className="py-2 bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/40 rounded-xl cursor-pointer"
                          >
                            ✓ Approve
                          </button>
                        )}
                        {selectedComment.status !== CommentStatus.REJECTED && (
                          <button
                            onClick={() =>
                              handleModerate(selectedComment.id, CommentStatus.REJECTED)
                            }
                            className="py-2 bg-yellow-950/40 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-900/40 rounded-xl cursor-pointer"
                          >
                            ✗ Reject
                          </button>
                        )}
                        {selectedComment.status !== CommentStatus.SPAM && (
                          <button
                            onClick={() =>
                              handleModerate(selectedComment.id, CommentStatus.SPAM)
                            }
                            className="py-2 bg-red-950/40 border border-red-500/30 text-red-400 hover:bg-red-900/40 rounded-xl cursor-pointer"
                          >
                            🚫 Mark Spam
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(selectedComment.id)}
                          className="py-2 border border-zinc-700 text-zinc-400 hover:text-red-400 rounded-xl cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>

                      {/* One-click Blocklist Shortcuts */}
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-jazz-slate/40">
                        <span className="text-[10px] font-mono text-jazz-text-dim uppercase">
                          One-Click Blocklist Shortcuts:
                        </span>
                        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                          <button
                            onClick={() =>
                              handleAddBlocklistRule(
                                BlocklistType.EMAIL,
                                selectedComment.authorEmail,
                              )
                            }
                            className="px-2.5 py-1 bg-red-950/30 border border-red-500/20 text-red-300 hover:bg-red-900/40 rounded-lg cursor-pointer"
                          >
                            🚫 Block Email
                          </button>
                          {selectedComment.authorEmail.includes('@') && (
                            <button
                              onClick={() =>
                                handleAddBlocklistRule(
                                  BlocklistType.EMAIL_DOMAIN,
                                  selectedComment.authorEmail.split('@')[1],
                                )
                              }
                              className="px-2.5 py-1 bg-amber-950/30 border border-amber-500/20 text-amber-300 hover:bg-amber-900/40 rounded-lg cursor-pointer"
                            >
                              🚫 Block Domain
                            </button>
                          )}
                          <button
                            onClick={() =>
                              handleAddBlocklistRule(
                                BlocklistType.IP_HASH,
                                selectedComment.ipAddress,
                              )
                            }
                            className="px-2.5 py-1 bg-purple-950/30 border border-purple-500/20 text-purple-300 hover:bg-purple-900/40 rounded-lg cursor-pointer"
                          >
                            🚫 Block IP
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-jazz-dark/30 border border-jazz-slate/40 rounded-2xl p-12 text-center text-xs font-mono text-jazz-text-muted">
                    Click any comment from the left queue to inspect details & perform moderation actions.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Blocklist Tab */
        <div className="flex flex-col gap-6">
          <form
            onSubmit={handleAddBlocklistForm}
            className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-4"
          >
            <h3 className="text-sm font-heading font-bold text-jazz-gold uppercase tracking-wider">
              Add Blocklist Rule
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-jazz-text-dim mb-1">
                  Rule Type
                </label>
                <select
                  value={newRuleType}
                  onChange={(e) => setNewRuleType(e.target.value as BlocklistType)}
                  className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-2.5 text-xs font-mono cursor-pointer"
                >
                  <option value={BlocklistType.KEYWORD}>Keyword</option>
                  <option value={BlocklistType.EMAIL}>Email Address</option>
                  <option value={BlocklistType.EMAIL_DOMAIN}>Email Domain</option>
                  <option value={BlocklistType.IP_HASH}>IP Address / Hash</option>
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-mono text-jazz-text-dim mb-1">
                  Value / Pattern <span className="text-jazz-gold">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    required
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    placeholder="e.g. casino, spammer@domain.com, 192.168.1.1"
                    className="flex-1 bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-2.5 text-xs font-mono"
                  />
                  <button
                    type="submit"
                    className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold px-6 py-2.5 rounded-xl text-xs font-mono cursor-pointer"
                  >
                    + Add Rule
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Blocklist Table */}
          {loadingBlocklist ? (
            <div className="text-sm font-mono text-jazz-gold animate-pulse py-6">
              🎷 Loading Blocklist Rules...
            </div>
          ) : !blocklist || blocklist.length === 0 ? (
            <div className="bg-jazz-dark/50 border border-jazz-slate rounded-2xl p-8 text-center text-jazz-text-muted text-xs font-mono">
              No blocklist rules configured.
            </div>
          ) : (
            <div className="bg-jazz-dark/50 border border-jazz-slate rounded-2xl overflow-hidden">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-jazz-charcoal border-b border-jazz-slate text-jazz-text-dim uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Type</th>
                    <th className="px-6 py-3">Pattern Value</th>
                    <th className="px-6 py-3">Added Date</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-jazz-slate/40 text-jazz-text">
                  {blocklist.map((item) => (
                    <tr key={item.id} className="hover:bg-jazz-charcoal/30">
                      <td className="px-6 py-3 font-bold text-jazz-gold">
                        {item.type}
                      </td>
                      <td className="px-6 py-3 font-mono">{item.value}</td>
                      <td className="px-6 py-3 text-jazz-text-dim">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => handleDeleteBlocklist(item.id)}
                          className="px-2.5 py-1 border border-red-500/30 text-red-400 hover:bg-red-950/30 rounded-lg text-xs font-mono cursor-pointer"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
