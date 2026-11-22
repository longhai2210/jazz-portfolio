'use client';

import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { GameAudio } from '../../audio';
import {
  calibrate,
  calibrationClickTimes,
  type CalibrationResult,
} from '../../core/calibration';
import {
  BEATS_PER_BAR,
  CALIBRATION_CLICKS,
  CALIBRATION_MAX_MS,
  CALIBRATION_SKIP_TAPS,
} from '../../core/config';
import type { Button } from '../../core/types';
import { buttonForKey, isTapKeyDown } from '../input/keys';
import { createTap } from '../input/tap-time';
import { NO_TRANSITION } from '../lanes/lane-identity';
import { Actions, GameButton, PanelText, PanelTitle, ScreenShell } from './ui';

/** Seconds between the screen opening (or a retry) and the first click. */
export const CALIBRATION_LEAD_S = 1;

/** Seconds after the last click's window closes before the taps are scored. */
const CALIBRATION_END_MARGIN_S = 0.1;

export interface CalibrationScreenProps {
  /** The game audio: the clicks play on it and taps are timed on its clock. */
  readonly audio: GameAudio;
  /** The player moves on with this offset in ms: the measured one, or 0 without it. */
  readonly onDone: (offsetMs: number) => void;
}

type DotState = 'skipped' | 'done' | 'now' | 'pending';

const DOT_CLASSES: Readonly<Record<DotState, string>> = {
  skipped: 'border-dashed border-jazz-text-dim',
  done: 'border-jazz-gold bg-jazz-gold',
  now: 'border-jazz-amber shadow-[0_0_0_4px_color-mix(in_srgb,var(--color-jazz-amber)_25%,transparent)]',
  pending: 'border-jazz-steel',
};

function dotState(index: number, played: number, taps: number): DotState {
  if (index < CALIBRATION_SKIP_TAPS) return 'skipped';
  if (index < taps) return 'done';
  return index === played - 1 ? 'now' : 'pending';
}

/** Space counts as a calibration tap, as D, F, J and K do (design "Calibration"). */
function isSpace(event: KeyboardEvent): boolean {
  return event.code === 'Space' || event.key === ' ';
}

/**
 * Screen 4, Calibration (REQ-DUEL-002): CALIBRATION_CLICKS clicks play, and the player taps along
 * on the pad, with D F J K or with Space. Every tap goes through `createTap`, so the offset is
 * measured on the same clock and with the same event timing as a tap in the match. The first two
 * taps are practice. With enough valid taps the delay is shown; with too few the offset is 0 and
 * the screen invites a retry (AC-DUEL-002.2).
 */
export default function CalibrationScreen({ audio, onDone }: CalibrationScreenProps) {
  const t = useTranslations('game');
  const titleId = useId();
  const [attempt, setAttempt] = useState(0);
  const [played, setPlayed] = useState(0);
  const [tapCount, setTapCount] = useState(0);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const run = useRef<{ taps: number[]; running: boolean }>({ taps: [], running: false });

  // One attempt: queue the clicks, follow them on the audio clock, then score the taps.
  useEffect(() => {
    const clicks = calibrationClickTimes(audio.currentTime + CALIBRATION_LEAD_S);
    const current = { taps: [] as number[], running: true };
    run.current = current;
    setPlayed(0);
    setTapCount(0);
    setResult(null);
    clicks.forEach((time, index) => audio.scheduleClick(time, index % BEATS_PER_BAR === 0));
    const end = clicks[clicks.length - 1] + CALIBRATION_MAX_MS / 1000 + CALIBRATION_END_MARGIN_S;

    let frame = 0;
    function follow() {
      const now = audio.currentTime;
      setPlayed(clicks.filter((time) => time <= now).length);
      if (now > end) {
        current.running = false;
        setResult(calibrate(clicks, current.taps));
        return;
      }
      frame = requestAnimationFrame(follow);
    }
    frame = requestAnimationFrame(follow);
    return () => {
      current.running = false;
      cancelAnimationFrame(frame);
      audio.clearScheduled();
    };
  }, [audio, attempt]);

  function record(button: Button, timeStamp: number) {
    const current = run.current;
    if (!current.running) return;
    current.taps.push(createTap(audio, button, timeStamp).time);
    setTapCount(current.taps.length);
  }
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  });

  const running = result === null;
  useEffect(() => {
    if (!running) return;
    function handleKeyDown(event: KeyboardEvent) {
      const button = isSpace(event) ? 0 : buttonForKey(event);
      if (button === null || !isTapKeyDown(event)) return;
      event.preventDefault();
      recordRef.current(button, event.timeStamp);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [running]);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button > 0) return;
    record(0, event.timeStamp);
  }

  if (result !== null && !result.needsRetry) {
    return (
      <ScreenShell labelledBy={titleId}>
        <PanelTitle id={titleId}>
          {t('calibration.done', { ms: Math.round(result.offsetMs) })}
        </PanelTitle>
        <PanelText>{t('calibration.doneBody')}</PanelText>
        <Actions>
          <GameButton variant="primary" onClick={() => onDone(result.offsetMs)}>
            {t('calibration.startMatch')}
          </GameButton>
          <GameButton variant="ghost" onClick={() => setAttempt((n) => n + 1)}>
            {t('calibration.again')}
          </GameButton>
        </Actions>
      </ScreenShell>
    );
  }

  if (result !== null) {
    return (
      <ScreenShell labelledBy={titleId}>
        <PanelTitle id={titleId}>{t('calibration.failTitle')}</PanelTitle>
        <div
          role="status"
          className="rounded-xl border border-jazz-copper bg-jazz-charcoal px-3.5 py-3 font-body text-[13px] text-jazz-amber"
        >
          {t('calibration.failBody')}
        </div>
        <Actions>
          <GameButton variant="primary" onClick={() => setAttempt((n) => n + 1)}>
            {t('calibration.retry')}
          </GameButton>
          <GameButton variant="ghost" onClick={() => onDone(0)}>
            {t('calibration.skip')}
          </GameButton>
        </Actions>
      </ScreenShell>
    );
  }

  const progress = t('calibration.progress', { count: played, total: CALIBRATION_CLICKS });
  return (
    <ScreenShell labelledBy={titleId}>
      <PanelTitle id={titleId}>{t('calibration.title')}</PanelTitle>
      <PanelText>{t('calibration.body')}</PanelText>
      <div
        role="progressbar"
        aria-labelledby={titleId}
        aria-valuemin={0}
        aria-valuemax={CALIBRATION_CLICKS}
        aria-valuenow={played}
        aria-valuetext={progress}
        className="flex gap-2.5"
      >
        {Array.from({ length: CALIBRATION_CLICKS }, (_, index) => {
          const state = dotState(index, played, tapCount);
          return (
            <i
              key={index}
              data-state={state}
              style={NO_TRANSITION}
              className={`block h-[18px] w-[18px] rounded-full border-2 ${DOT_CLASSES[state]}`}
            />
          );
        })}
      </div>
      <p className="font-mono text-sm text-jazz-text-muted" aria-hidden="true">
        {progress}
      </p>
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onContextMenu={(event) => event.preventDefault()}
        style={NO_TRANSITION}
        className="h-[120px] w-[220px] touch-none select-none rounded-[20px] border-2 border-jazz-gold bg-jazz-charcoal font-body text-lg font-bold text-jazz-gold [-webkit-tap-highlight-color:transparent]"
      >
        {t('calibration.tap')}
      </button>
    </ScreenShell>
  );
}
