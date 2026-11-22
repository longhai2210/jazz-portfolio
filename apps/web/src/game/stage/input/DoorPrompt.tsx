'use client';

import { useTranslations } from 'next-intl';

export interface DoorPromptProps {
  /** The character stands within `DOOR_PROMPT_RADIUS` of the club door. */
  readonly near: boolean;
  /** The Enter the club press. */
  readonly onEnter: () => void;
  /** Show the E / Enter key label in the button: false on a touch screen. */
  readonly showKeys: boolean;
}

function DoorIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17" />
      <path d="M3 21h18" />
      <circle cx="15" cy="12" r="1" />
    </svg>
  );
}

/**
 * The club door prompt (design.md section 3, AC-STAGE-003.3). By the door, an Enter the club
 * button shows; away from it there is nothing. A polite live region says once that the character
 * reached the door; it stays in the page so screen readers hear the change.
 *
 * The key label is `aria-hidden`: the button's name already says what it does.
 */
export default function DoorPrompt({ near, onEnter, showKeys }: DoorPromptProps) {
  const t = useTranslations('game');
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {near ? t('stage.street.doorNear') : ''}
      </p>
      {near && (
        <button
          type="button"
          onClick={onEnter}
          className="pointer-events-auto inline-flex min-h-12 min-w-40 items-center justify-center gap-2.5 rounded-xl border border-jazz-gold bg-jazz-gold px-5 font-body text-sm font-semibold text-jazz-black hover:bg-jazz-amber"
        >
          <DoorIcon />
          <span>{t('stage.street.enterClub')}</span>
          {showKeys && (
            <span
              aria-hidden="true"
              className="rounded-md border border-jazz-black/40 px-1.5 py-0.5 font-mono text-[11px]"
            >
              {t('stage.street.enterClubKeys')}
            </span>
          )}
        </button>
      )}
    </>
  );
}
