'use client';

export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[50vh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <h1 className="mb-3 text-2xl font-semibold text-jazz-text">Something went wrong</h1>
      <p className="mb-6 max-w-md text-jazz-text-muted">
        {error.message || 'An unexpected error occurred while rendering this page.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded bg-jazz-gold px-4 py-2 font-medium text-jazz-black transition hover:opacity-90"
      >
        Try again
      </button>
    </main>
  );
}
