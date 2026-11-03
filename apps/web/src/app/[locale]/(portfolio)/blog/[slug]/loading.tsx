export default function BlogPostDetailLoading() {
  return (
    <div
      className="max-w-4xl mx-auto px-6 py-12 flex flex-col gap-8"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading article...</span>

      <div className="h-4 w-32 rounded jazz-shimmer" />

      <div className="flex flex-col gap-4 border-b border-jazz-slate/40 pb-6">
        <div className="h-4 w-48 rounded jazz-shimmer" />
        <div className="h-10 w-3/4 rounded-xl jazz-shimmer" />
        <div className="h-5 w-full rounded jazz-shimmer" />
      </div>

      <div className="w-full h-80 rounded-2xl jazz-shimmer border border-jazz-slate/40" />

      <div className="space-y-4">
        <div className="h-4 w-full rounded jazz-shimmer" />
        <div className="h-4 w-11/12 rounded jazz-shimmer" />
        <div className="h-4 w-4/5 rounded jazz-shimmer" />
        <div className="h-4 w-full rounded jazz-shimmer" />
        <div className="h-4 w-3/4 rounded jazz-shimmer" />
      </div>
    </div>
  );
}
