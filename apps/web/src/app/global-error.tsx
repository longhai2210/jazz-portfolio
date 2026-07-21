'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          fontFamily: 'Georgia, "Times New Roman", serif',
          background: '#0f0e0c',
          color: '#f2e8d5',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Something went wrong</h1>
          <p style={{ opacity: 0.75, marginBottom: '1.5rem' }}>
            {error.message || 'An unexpected error occurred.'}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#c4a35a',
              color: '#0f0e0c',
              border: 0,
              padding: '0.65rem 1.25rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
