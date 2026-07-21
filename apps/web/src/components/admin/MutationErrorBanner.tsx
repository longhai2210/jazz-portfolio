'use client';

interface MutationErrorBannerProps {
  message: string | null | undefined;
  onDismiss?: () => void;
}

export default function MutationErrorBanner({ message, onDismiss }: MutationErrorBannerProps) {
  if (!message) return null;

  return (
    <div className="p-4 rounded-xl border bg-red-500/10 border-red-500/30 text-red-300 text-xs font-mono flex items-start justify-between gap-3">
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-red-400 hover:text-red-200"
          aria-label="Dismiss error"
        >
          ✕
        </button>
      )}
    </div>
  );
}
