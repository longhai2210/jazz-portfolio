import { PostListItemDto } from '@jazz-portfolio/shared';
import PostCard from './PostCard';

interface PostListProps {
  posts: PostListItemDto[];
  locale: string;
}

export default function PostList({ posts, locale }: PostListProps) {
  if (!posts || posts.length === 0) {
    return (
      <div className="bg-jazz-dark/40 border border-jazz-slate rounded-2xl p-12 text-center text-jazz-text-muted text-sm font-mono">
        No blog posts published yet. Check back soon! 🎷
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} locale={locale} />
      ))}
    </div>
  );
}
