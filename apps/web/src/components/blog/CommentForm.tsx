'use client';

import { useEffect } from 'react';
import { OptimisticComment, useCommentForm } from '@/hooks/useCommentForm';
import TurnstileWidget from './TurnstileWidget';

interface CommentFormProps {
  postId: string;
  postSlug: string;
  isCaptchaEnabled: boolean;
  onCommentSubmitted: (comment: OptimisticComment) => void;
  externalReplyTo?: { id: string; author: string } | null;
  onCancelExternalReply?: () => void;
}

export default function CommentForm({
  postId,
  postSlug,
  isCaptchaEnabled,
  onCommentSubmitted,
  externalReplyTo,
  onCancelExternalReply,
}: CommentFormProps) {
  const {
    authorName,
    setAuthorName,
    authorEmail,
    setAuthorEmail,
    content,
    setContent,
    replyToName,
    handleReply,
    cancelReply,
    hp,
    setHp,
    website,
    setWebsite,
    fetchingToken,
    refetchToken,
    dwellSecondsRemaining,
    isDwellTimeMet,
    submitting,
    feedback,
    captchaToken,
    captchaResetKey,
    setCaptchaToken,
    submitComment,
  } = useCommentForm({
    postId,
    postSlug,
    isCaptchaEnabled,
    onCommentSubmitted,
  });

  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (externalReplyTo) {
      handleReply(externalReplyTo.id, externalReplyTo.author);
    }
  }, [externalReplyTo, handleReply]);

  const handleCancel = () => {
    cancelReply();
    if (onCancelExternalReply) {
      onCancelExternalReply();
    }
  };

  return (
    <form
      onSubmit={submitComment}
      className="bg-jazz-dark/50 border border-jazz-slate p-6 rounded-2xl flex flex-col gap-4 shadow-[0_0_20px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-heading font-bold text-jazz-gold uppercase tracking-wider">
          Leave a Comment
        </h4>
        {replyToName && (
          <div className="flex items-center gap-2 text-xs font-mono text-jazz-amber bg-jazz-charcoal px-3 py-1 rounded-lg border border-jazz-gold/30">
            <span>Replying to @{replyToName}</span>
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Cancel reply"
              className="hover:text-red-400 font-bold ml-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs font-mono border flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400'
              : 'bg-red-950/40 border-red-500/30 text-red-400'
          }`}
        >
          <span>{feedback.text}</span>
          {feedback.type === 'error' && (
            <button
              type="button"
              onClick={refetchToken}
              className="px-2.5 py-1 bg-red-900/40 hover:bg-red-800/40 text-red-200 rounded-lg text-[11px] font-mono cursor-pointer"
            >
              🔄 Retry
            </button>
          )}
        </div>
      )}

      {/* Honeypots for Bot Trapping (Hidden from users) */}
      <div className="hidden" aria-hidden="true">
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            htmlFor="comment-author-name"
            className="block text-xs font-mono text-jazz-text-dim mb-1"
          >
            Your Name{' '}
            <span className="text-jazz-gold" aria-hidden="true">
              *
            </span>
          </label>
          <input
            id="comment-author-name"
            type="text"
            required
            minLength={2}
            maxLength={60}
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Miles Davis"
            className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-jazz-gold"
          />
        </div>

        <div>
          <label
            htmlFor="comment-author-email"
            className="block text-xs font-mono text-jazz-text-dim mb-1"
          >
            Email Address{' '}
            <span className="text-jazz-gold" aria-hidden="true">
              *
            </span>{' '}
            (kept private)
          </label>
          <input
            id="comment-author-email"
            type="email"
            required
            value={authorEmail}
            onChange={(e) => setAuthorEmail(e.target.value)}
            placeholder="miles@jazzclub.io"
            className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none focus:border-jazz-gold"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label htmlFor="comment-content" className="block text-xs font-mono text-jazz-text-dim">
            Comment{' '}
            <span className="text-jazz-gold" aria-hidden="true">
              *
            </span>
          </label>
          <span className="text-[10px] font-mono text-jazz-text-muted">
            {content.length} / 2000
          </span>
        </div>
        <textarea
          id="comment-content"
          required
          minLength={2}
          maxLength={2000}
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your thoughts on this article..."
          className="w-full bg-jazz-charcoal border border-jazz-slate text-jazz-text rounded-xl px-4 py-2.5 text-xs font-mono leading-relaxed focus:outline-none focus:border-jazz-gold resize-y"
        />
      </div>

      {isCaptchaEnabled && (
        <div className="rounded-xl border border-jazz-slate/60 bg-jazz-charcoal/30 p-3">
          {turnstileSiteKey ? (
            <TurnstileWidget
              siteKey={turnstileSiteKey}
              resetKey={captchaResetKey}
              onToken={setCaptchaToken}
            />
          ) : (
            <p className="text-xs font-mono text-red-400">
              CAPTCHA is enabled but the public site key is not configured.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <span className="text-[11px] font-mono text-jazz-text-muted">
          🛡 Shielded by dwell-time gate & spam protection.
        </span>

        <button
          type="submit"
          disabled={
            submitting || fetchingToken || !isDwellTimeMet || (isCaptchaEnabled && !captchaToken)
          }
          className="bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-bold py-2.5 px-6 rounded-xl transition-all text-xs font-mono disabled:opacity-50 cursor-pointer shadow-[0_0_15px_rgba(212,165,116,0.15)]"
        >
          {submitting
            ? 'Submitting...'
            : !isDwellTimeMet
              ? `Please wait (${dwellSecondsRemaining}s)...`
              : 'Post Comment'}
        </button>
      </div>
    </form>
  );
}
