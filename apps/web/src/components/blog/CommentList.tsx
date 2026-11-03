'use client';

import { useMemo } from 'react';
import { PublicCommentDto } from '@jazz-portfolio/shared';

import { OptimisticComment } from '@/hooks/useCommentForm';

interface CommentListProps {
  comments: (PublicCommentDto | OptimisticComment)[];
  locale: string;
  onReply?: (commentId: string, authorName: string) => void;
}

// Generate deterministic avatar color from author name
function getAvatarColor(name: string): string {
  const colors = [
    'bg-amber-900/60 text-amber-300 border-amber-500/30',
    'bg-emerald-900/60 text-emerald-300 border-emerald-500/30',
    'bg-blue-900/60 text-blue-300 border-blue-500/30',
    'bg-purple-900/60 text-purple-300 border-purple-500/30',
    'bg-rose-900/60 text-rose-300 border-rose-500/30',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// Extract initials (e.g., "Miles Davis" -> "MD")
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function CommentList({ comments, locale, onReply }: CommentListProps) {
  const { topLevel, repliesMap } = useMemo(() => {
    if (!comments || comments.length === 0) {
      return { topLevel: [], repliesMap: new Map() };
    }
    const topLevelList = comments.filter((c) => !c.parentId);
    const map = new Map<string, (PublicCommentDto | OptimisticComment)[]>();

    for (const c of comments) {
      if (c.parentId) {
        const list = map.get(c.parentId) || [];
        list.push(c);
        map.set(c.parentId, list);
      }
    }
    return { topLevel: topLevelList, repliesMap: map };
  }, [comments]);

  if (!comments || comments.length === 0) {
    return (
      <div className="bg-jazz-dark/30 border border-jazz-slate/40 rounded-2xl p-8 text-center text-jazz-text-muted text-xs font-mono">
        No comments published yet. Be the first to share your thoughts! 🎷
      </div>
    );
  }

  const renderCommentItem = (
    comment: PublicCommentDto | OptimisticComment,
    depth = 0,
  ) => {
    const formattedDate = new Date(comment.createdAt).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const isPending = (comment as OptimisticComment).isPendingModeration;
    const avatarStyle = getAvatarColor(comment.authorName);
    const indentClass =
      depth === 0 ? '' : depth === 1 ? 'ml-4 md:ml-8' : 'ml-4 md:ml-8';

    return (
      <div
        key={comment.id}
        className={`flex flex-col gap-3 p-5 rounded-2xl border transition-all ${
          depth > 0 ? 'bg-jazz-dark/30 border-jazz-slate/40' : 'bg-jazz-dark/50 border-jazz-slate'
        } ${indentClass} ${isPending ? 'border-amber-500/40 bg-amber-950/20' : ''}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Initials Avatar */}
            <div
              className={`w-8 h-8 rounded-full border flex items-center justify-center font-mono font-bold text-xs ${avatarStyle}`}
            >
              {getInitials(comment.authorName)}
            </div>

            <div className="flex flex-col">
              <span className="font-bold text-jazz-gold text-xs font-mono">
                {comment.authorName}
              </span>
              <span className="text-[10px] font-mono text-jazz-text-dim">
                {formattedDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPending && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-500/30 animate-pulse">
                ⏳ Awaiting Moderation
              </span>
            )}
            {!isPending && onReply && (
              <button
                onClick={() => onReply(comment.id, comment.authorName)}
                className="text-[11px] font-mono text-jazz-gold hover:text-jazz-amber hover:underline cursor-pointer"
              >
                Reply ↩
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-jazz-text leading-relaxed font-sans whitespace-pre-wrap pl-11">
          {comment.content}
        </p>

        {/* Render child replies (capped indentation depth) */}
        {repliesMap.has(comment.id) && (
          <div className="flex flex-col gap-3 pt-2">
            {repliesMap.get(comment.id)!.map((reply: PublicCommentDto | OptimisticComment) =>
              renderCommentItem(reply, depth + 1),
            )}
          </div>
        )}

      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {topLevel.map((c) => renderCommentItem(c, 0))}
    </div>
  );
}

