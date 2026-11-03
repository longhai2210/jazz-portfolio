import {
  ApiRoutes,
  PaginatedResponse,
  PublicCommentDto,
} from '@jazz-portfolio/shared';
import { CACHE_TAGS } from '@/lib/api-public';
import { ServerPublicApiClient } from '@/lib/api-public-server';
import CommentSection from './CommentSection';

interface BlogCommentsProps {
  postId: string;
  postSlug: string;
  areCommentsEnabled: boolean;
  isCaptchaEnabled: boolean;
  locale: string;
}

/**
 * Async server boundary for the discussion area. Article HTML can stream to
 * the browser while this lower-priority request resolves.
 */
export default async function BlogComments({
  postId,
  postSlug,
  areCommentsEnabled,
  isCaptchaEnabled,
  locale,
}: BlogCommentsProps) {
  let initialComments: PublicCommentDto[] = [];

  // Do not call the comments API when the feature is disabled or the post is closed.
  if (areCommentsEnabled) {
    try {
      const commentsRes = await ServerPublicApiClient.get<
        PaginatedResponse<PublicCommentDto>
      >(ApiRoutes.blog.publicComments(postSlug), {
        tags: [CACHE_TAGS.comments],
        revalidate: 30,
      });
      initialComments = commentsRes.data?.items ?? [];
    } catch {
      // Keep the article available if its discussion endpoint is unavailable.
    }
  }

  return (
    <CommentSection
      postId={postId}
      postSlug={postSlug}
      initialComments={initialComments}
      areCommentsEnabled={areCommentsEnabled}
      isCaptchaEnabled={isCaptchaEnabled}
      locale={locale}
    />
  );
}
