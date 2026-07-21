import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[50vh] w-full flex-col items-center justify-center px-6 py-24 text-center">
      <p className="mb-2 text-sm uppercase tracking-[0.2em] text-jazz-gold">404</p>
      <h1 className="mb-3 text-2xl font-semibold text-jazz-text">Page not found</h1>
      <p className="mb-6 max-w-md text-jazz-text-muted">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        href="/en"
        className="rounded bg-jazz-gold px-4 py-2 font-medium text-jazz-black transition hover:opacity-90"
      >
        Back to portfolio
      </Link>
    </main>
  );
}
