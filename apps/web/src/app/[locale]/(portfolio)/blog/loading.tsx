export default function BlogIndexLoading() {
  return (
    <div
      className="max-w-5xl mx-auto px-6 py-12 flex flex-col gap-10"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading articles...</span>

      <div className="flex flex-col gap-4 border-b border-jazz-slate/40 pb-8">
        <div className="h-10 w-64 rounded-xl jazz-shimmer" />
        <div className="h-4 w-96 rounded-lg jazz-shimmer" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-64 bg-jazz-dark/50 border border-jazz-slate/40 rounded-2xl p-6 flex flex-col justify-between"
          >
            <div className="flex flex-col gap-3">
              <div className="h-4 w-32 rounded jazz-shimmer" />
              <div className="h-6 w-3/4 rounded-lg jazz-shimmer" />
              <div className="h-4 w-full rounded jazz-shimmer" />
              <div className="h-4 w-5/6 rounded jazz-shimmer" />
            </div>
            <div className="h-4 w-24 rounded jazz-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
