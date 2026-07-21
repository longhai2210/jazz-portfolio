'use client';

import { useEffect, useState } from 'react';
import {
  ContactSubmissionDto,
  ContactSubmissionListItemDto,
} from '@jazz-portfolio/shared';
import MutationErrorBanner from '@/components/admin/MutationErrorBanner';
import {
  CONTACT_INBOX_PAGE_SIZE,
  useContactInbox,
} from '@/hooks/admin/useContactInbox';

export default function AdminContactInboxPage() {
  const [page, setPage] = useState(1);
  const [selectedSub, setSelectedSub] = useState<ContactSubmissionDto | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const {
    items: submissions,
    total,
    totalPages,
    limit,
    isLoading,
    queryError,
    mutationError,
    clearMutationError,
    markAsRead,
    fetchDetail,
  } = useContactInbox(page, CONTACT_INBOX_PAGE_SIZE);

  // Auto-select first item when page data arrives / page changes
  useEffect(() => {
    if (isLoading) return;

    if (submissions.length === 0) {
      setSelectedSub(null);
      return;
    }

    const stillVisible = selectedSub && submissions.some((s) => s.id === selectedSub.id);
    if (stillVisible) return;

    const firstId = submissions[0].id;
    let cancelled = false;

    (async () => {
      try {
        setDetailError(null);
        const detail = await fetchDetail(firstId);
        if (!cancelled) setSelectedSub(detail);
      } catch (err) {
        if (!cancelled) {
          setDetailError(err instanceof Error ? err.message : 'Failed to load message details.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally keyed on page + list ids so we don't re-fetch on every mark-as-read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, isLoading, submissions.map((s) => s.id).join(',')]);

  const handleMarkAsRead = async (subId: string) => {
    clearMutationError();
    const originalSelected = selectedSub;

    if (selectedSub?.id === subId) {
      setSelectedSub((prev) => (prev ? { ...prev, isRead: true } : null));
    }

    try {
      await markAsRead.mutateAsync(subId);
    } catch {
      if (originalSelected?.id === subId) {
        setSelectedSub(originalSelected);
      }
    }
  };

  const handleSelectSub = async (sub: ContactSubmissionListItemDto) => {
    try {
      setDetailError(null);
      const detail = await fetchDetail(sub.id);
      setSelectedSub(detail);
      if (!sub.isRead) {
        await handleMarkAsRead(sub.id);
      }
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load message details.');
    }
  };

  if (isLoading && submissions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-jazz-gold font-mono text-sm">
        <svg
          className="w-8 h-8 fill-current animate-bounce text-jazz-gold"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
        <span>Fetching submissions...</span>
      </div>
    );
  }

  if (queryError && submissions.length === 0) {
    return (
      <div className="bg-red-950/20 border border-red-500/30 p-6 rounded-2xl text-red-400 font-mono flex items-center justify-center gap-3">
        <svg
          className="w-5 h-5 fill-current text-red-400 shrink-0"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
        </svg>
        <span>{queryError}</span>
      </div>
    );
  }

  if (!isLoading && total === 0) {
    return (
      <div className="bg-jazz-dark border border-jazz-slate p-12 rounded-2xl text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-jazz-charcoal/40 border border-jazz-slate/40 flex items-center justify-center text-jazz-gold mb-2 shadow-inner">
          <svg
            className="w-8 h-8 fill-current text-jazz-gold"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
          </svg>
        </div>
        <h3 className="text-xl font-heading font-bold text-jazz-gold">Your Inbox is Empty</h3>
        <p className="text-sm text-jazz-text-dim max-w-sm leading-relaxed">
          No one has submitted a contact form message yet. Check back later!
        </p>
      </div>
    );
  }

  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-4">
      <MutationErrorBanner
        message={detailError || mutationError}
        onDismiss={() => {
          setDetailError(null);
          clearMutationError();
        }}
      />

      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)] min-h-[450px]">
        {/* Submissions List Side */}
        <div className="w-full lg:w-5/12 bg-jazz-dark border border-jazz-slate rounded-2xl flex flex-col overflow-hidden h-full">
          <div className="p-4 border-b border-jazz-slate bg-jazz-charcoal/20 flex justify-between items-center">
            <h3 className="font-heading font-bold text-jazz-gold">Inbox ({total})</h3>
            <span className="text-[10px] font-mono bg-jazz-charcoal border border-jazz-slate px-2 py-0.5 rounded-full text-jazz-text-muted">
              {submissions.filter((s) => !s.isRead).length} Unread on page
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-jazz-slate/40">
            {submissions.map((sub) => {
              const isSelected = selectedSub?.id === sub.id;
              const dateStr = new Date(sub.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <button
                  key={sub.id}
                  onClick={() => handleSelectSub(sub)}
                  className={`w-full p-4 text-left transition-all hover:bg-jazz-charcoal/30 flex flex-col gap-1.5 focus:outline-none ${
                    isSelected
                      ? 'bg-jazz-gold/5 border-l-2 border-jazz-gold'
                      : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <span
                      className={`text-sm font-bold truncate ${
                        !sub.isRead
                          ? 'text-jazz-text font-extrabold'
                          : 'text-jazz-text-muted font-normal'
                      }`}
                    >
                      {sub.senderName}
                    </span>
                    <span className="text-[10px] font-mono text-jazz-text-dim shrink-0">
                      {dateStr}
                    </span>
                  </div>

                  <div className="text-xs text-jazz-brass truncate max-w-full font-medium">
                    {sub.subject}
                  </div>

                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-jazz-text-dim truncate max-w-full italic">
                      {sub.senderEmail}
                    </span>
                    {!sub.isRead && (
                      <span
                        className="w-2.5 h-2.5 rounded-full bg-jazz-gold shrink-0 shadow-[0_0_10px_rgba(212,165,116,0.85)] animate-pulse"
                        title="Unread"
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination controls */}
          <div className="p-3 border-t border-jazz-slate bg-jazz-charcoal/20 flex items-center justify-between gap-2">
            <span className="text-[10px] font-mono text-jazz-text-dim">
              {from}–{to} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-[10px] font-mono rounded-lg border border-jazz-slate text-jazz-text-muted hover:border-jazz-gold hover:text-jazz-gold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Prev
              </button>
              <span className="text-[10px] font-mono text-jazz-text-dim">
                Page {page} / {Math.max(totalPages, 1)}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-[10px] font-mono rounded-lg border border-jazz-slate text-jazz-text-muted hover:border-jazz-gold hover:text-jazz-gold disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* Message Details Pane */}
        <div className="flex-1 bg-jazz-dark border border-jazz-slate rounded-2xl flex flex-col overflow-hidden h-full">
          {selectedSub ? (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-jazz-slate bg-jazz-charcoal/20 flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <h4 className="text-lg font-heading font-bold text-jazz-gold">
                      {selectedSub.subject}
                    </h4>
                    <p className="text-sm text-jazz-text-muted mt-1">
                      From: <span className="font-bold text-jazz-text">{selectedSub.senderName}</span>{' '}
                      &lt;
                      <a
                        href={`mailto:${selectedSub.senderEmail}`}
                        className="text-jazz-brass hover:text-jazz-amber underline font-mono text-xs break-all"
                      >
                        {selectedSub.senderEmail}
                      </a>
                      &gt;
                    </p>
                  </div>
                  <div className="flex flex-col items-end shrink-0 font-mono text-xs text-jazz-text-dim">
                    <span>Received:</span>
                    <span>{new Date(selectedSub.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center border-t border-jazz-slate/40 pt-3">
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                      selectedSub.isRead
                        ? 'border-jazz-slate text-jazz-text-dim bg-jazz-charcoal/10'
                        : 'border-jazz-gold text-jazz-gold bg-jazz-gold/5'
                    }`}
                  >
                    {selectedSub.isRead ? 'Read' : 'Unread'}
                  </span>

                  {!selectedSub.isRead && (
                    <button
                      onClick={() => handleMarkAsRead(selectedSub.id)}
                      className="text-xs font-mono text-jazz-gold hover:text-jazz-amber px-3 py-1 rounded border border-jazz-gold/30 hover:border-jazz-gold transition-all cursor-pointer"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 p-6 overflow-y-auto text-jazz-text-muted leading-relaxed whitespace-pre-wrap text-sm md:text-base font-sans">
                {selectedSub.messageBody}
              </div>

              <div className="p-4 border-t border-jazz-slate/30 bg-jazz-charcoal/10 flex justify-end gap-3">
                <a
                  href={`mailto:${selectedSub.senderEmail}?subject=Re: ${encodeURIComponent(selectedSub.subject)}`}
                  className="px-5 py-2 rounded-full bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-semibold text-xs transition-all duration-300 shadow-[0_0_10px_rgba(212,165,116,0.1)] hover:shadow-[0_0_15px_rgba(212,165,116,0.3)] flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4 fill-current"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
                  </svg>
                  Reply by Email
                </a>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-jazz-text-dim text-sm italic">
              Select a message to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
