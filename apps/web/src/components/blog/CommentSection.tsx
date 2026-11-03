'use client';

import { useRef, useState } from 'react';
import { ApiRoutes, PaginatedResponse, PublicCommentDto } from '@jazz-portfolio/shared';
import { PublicApiClient } from '@/lib/api-public';
import { OptimisticComment } from '@/hooks/useCommentForm';
import CommentForm from './CommentForm';
import CommentList from './CommentList';

interface CommentSectionProps {
  postId: string;
  postSlug: string;
  initialComments: PublicCommentDto[];
  areCommentsEnabled: boolean;
  isCaptchaEnabled: boolean;
  locale: string;
}

export default function CommentSection({
  postId,
  postSlug,
  initialComments,
  areCommentsEnabled,
  isCaptchaEnabled,
  locale,
}: CommentSectionProps) {
  const [publishedComments, setPublishedComments] =
    useState<(PublicCommentDto | OptimisticComment)[]>(initialComments);
  const [activeReply, setActiveReply] = useState<{ id: string; author: string } | null>(null);

  const formRef = useRef<HTMLDivElement>(null);

  const reloadComments = async () => {
    try {
      const res = await PublicApiClient.get<PaginatedResponse<PublicCommentDto>>(
        ApiRoutes.blog.publicComments(postSlug),
      );
      if (res.data?.items) {
        setPublishedComments(res.data.items);
      }
    } catch {
      // Ignore background reload failure
    }
  };

  const handleReplyTrigger = (commentId: string, authorName: string) => {
    setActiveReply({ id: commentId, author: authorName });
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleCancelReply = () => {
    setActiveReply(null);
  };

  const handleCommentSubmitted = (comment: OptimisticComment) => {
    if (comment.isPendingModeration) {
      setPublishedComments((current) => [comment, ...current]);
      return;
    }
    void reloadComments();
  };

  return (
    <div id="comments" className="flex flex-col gap-8 border-t border-jazz-slate/40 pt-10 mt-10">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-heading font-bold text-jazz-gold">
          Discussion ({publishedComments.length})
        </h3>
      </div>

      {areCommentsEnabled ? (
        <>
          <div ref={formRef}>
            <CommentForm
              postId={postId}
              postSlug={postSlug}
              isCaptchaEnabled={isCaptchaEnabled}
              onCommentSubmitted={handleCommentSubmitted}
              externalReplyTo={activeReply}
              onCancelExternalReply={handleCancelReply}
            />
          </div>
          <CommentList comments={publishedComments} locale={locale} onReply={handleReplyTrigger} />
        </>
      ) : (
        <div className="bg-jazz-dark/30 border border-jazz-slate/40 p-6 rounded-2xl text-center text-xs font-mono text-jazz-text-muted italic">
          💬 Comments are closed for this article.
        </div>
      )}
    </div>
  );
}
