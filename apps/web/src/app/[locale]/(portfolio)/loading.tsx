export default function PortfolioLoading() {
  return (
    <div
      className="w-full max-w-5xl mx-auto px-6 py-12 flex flex-col gap-20"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">Loading portfolio content...</span>

      {/* Hero Section Skeleton */}
      <section className="flex flex-col items-center text-center gap-6 pt-12">
        <div className="w-32 h-32 md:w-40 md:h-40 rounded-full jazz-shimmer border-2 border-jazz-slate/40" />
        <div className="h-10 w-72 md:w-96 rounded-2xl jazz-shimmer" />
        <div className="h-5 w-60 md:w-80 rounded-xl jazz-shimmer" />
        <div className="h-4 w-full max-w-md rounded-lg jazz-shimmer" />
        <div className="flex gap-4 mt-4">
          <div className="h-12 w-36 rounded-full jazz-shimmer" />
          <div className="h-12 w-36 rounded-full jazz-shimmer" />
        </div>
      </section>

      {/* About Section Skeleton */}
      <section className="space-y-6 max-w-3xl mx-auto w-full">
        <div className="h-8 w-44 rounded-xl jazz-shimmer mx-auto" />
        <div className="bg-jazz-dark/60 border border-jazz-slate/40 p-8 rounded-2xl space-y-4">
          <div className="h-4 w-full rounded jazz-shimmer" />
          <div className="h-4 w-5/6 rounded jazz-shimmer" />
          <div className="h-4 w-4/6 rounded jazz-shimmer" />
        </div>
      </section>

      {/* Experience Section Skeleton */}
      <section className="space-y-6 max-w-4xl mx-auto w-full">
        <div className="h-8 w-48 rounded-xl jazz-shimmer mx-auto" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 bg-jazz-dark/60 border border-jazz-slate/40 p-6 rounded-2xl space-y-3"
            >
              <div className="h-5 w-3/4 rounded-lg jazz-shimmer" />
              <div className="h-4 w-1/2 rounded jazz-shimmer" />
              <div className="h-4 w-full rounded jazz-shimmer" />
            </div>
          ))}
        </div>
      </section>

      {/* Skills Section Skeleton */}
      <section className="space-y-6 max-w-4xl mx-auto w-full">
        <div className="h-8 w-40 rounded-xl jazz-shimmer mx-auto" />
        <div className="flex flex-wrap justify-center gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-10 w-28 rounded-full jazz-shimmer" />
          ))}
        </div>
      </section>

      {/* Contact Section Skeleton */}
      <section className="space-y-6 max-w-3xl mx-auto w-full">
        <div className="h-8 w-44 rounded-xl jazz-shimmer mx-auto" />
        <div className="h-64 bg-jazz-dark/60 border border-jazz-slate/40 rounded-2xl p-8 space-y-4">
          <div className="h-10 w-full rounded-xl jazz-shimmer" />
          <div className="h-10 w-full rounded-xl jazz-shimmer" />
          <div className="h-24 w-full rounded-xl jazz-shimmer" />
        </div>
      </section>
    </div>
  );
}
