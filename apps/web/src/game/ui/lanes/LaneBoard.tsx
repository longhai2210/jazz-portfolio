'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { correctedTime, type BeatClock } from '../../core/clock';
import { BUTTON_LABELS } from '../../core/config';
import { laneGuides, type LaneSide } from '../../core/difficulty';
import type { Button, CallBar, Tap, TargetNote } from '../../core/types';
import type { AudioClock } from '../input/tap-time';
import Feedback, { type FeedbackEvent } from './Feedback';
import LaneShape, { type LaneShapeVariant } from './LaneShape';
import { LANE_IDENTITY, LANE_ORDER, NO_TRANSITION } from './lane-identity';
import {
  BAR_LINE_FRACTIONS,
  BEAT_LINE_FRACTIONS,
  HALF_STEP_FRACTION,
  PHASE_BARS,
  barInPhase,
  clampFraction,
  playerPhraseRuns,
  stepFraction,
  timeFraction,
} from './lane-layout';

/** How a target note stands: still to play, hit (amber ring) or missed (dimmed). */
export type TargetState = 'pending' | 'hit' | 'miss';

export interface LaneTarget {
  readonly note: TargetNote;
  readonly state: TargetState;
}

export interface LaneBoardProps {
  /** The game audio, or anything with its `currentTime`: the playhead follows it every frame. */
  readonly audio: AudioClock;
  /** Timing of the duel. Its difficulty sets the swing and which guides are drawn (AC-DUEL-011.2). */
  readonly clock: BeatClock;
  /** Bar on the duel clock where the 4 bars on screen start. */
  readonly firstBar: number;
  /** Who plays the bars on screen. */
  readonly side: LaneSide;
  /** The opponent's call for these 4 bars, bar `i` being `firstBar + i` (side `opponent`). */
  readonly call?: readonly CallBar[];
  /** The notes the player must play in these bars, with how each one went (side `player`). */
  readonly targets?: readonly LaneTarget[];
  /** The player's taps in these bars, drawn where they were judged (raw time minus offset). */
  readonly taps?: readonly Tap[];
  /** Calibration offset in ms, taken off tap times so a tap on the beat sits on the beat. */
  readonly offsetMs?: number;
  /** The line of text over the lanes. */
  readonly feedback?: FeedbackEvent | null;
  /** Phone layout: 26 px lanes with shape-only key labels, no bar header. */
  readonly compact?: boolean;
}

interface Marker {
  readonly id: string;
  readonly button: Button;
  readonly fraction: number;
  readonly kind: 'call' | 'target' | 'tap';
  readonly variant: LaneShapeVariant;
  readonly state?: TargetState;
}

function buildMarkers(props: LaneBoardProps, noteMarkers: boolean): Marker[] {
  const { clock, firstBar, side, call = [], targets = [], taps = [], offsetMs = 0 } = props;
  const markers: Marker[] = [];
  if (noteMarkers && side === 'opponent') {
    call.slice(0, PHASE_BARS).forEach((bar, index) => {
      for (const note of bar.notes) {
        markers.push({
          id: `call-${index}-${note.step}-${note.button}`,
          button: note.button,
          fraction: stepFraction(clock, firstBar, firstBar + index, note.step),
          kind: 'call',
          variant: 'filled',
        });
      }
    });
  }
  if (noteMarkers && side === 'player') {
    for (const { note, state } of targets) {
      markers.push({
        id: `target-${note.bar}-${note.step}-${note.button}`,
        button: note.button,
        fraction: stepFraction(clock, firstBar, note.bar, note.step),
        kind: 'target',
        variant: 'hollow',
        state,
      });
    }
  }
  taps.forEach((tap, index) => {
    const fraction = timeFraction(clock, firstBar, correctedTime(tap.time, offsetMs));
    if (fraction < -HALF_STEP_FRACTION || fraction >= 1 + HALF_STEP_FRACTION) return;
    markers.push({
      id: `tap-${index}`,
      button: tap.button,
      fraction: clampFraction(fraction),
      kind: 'tap',
      variant: 'filled',
    });
  });
  return markers.filter((marker) => marker.fraction >= 0 && marker.fraction <= 1);
}

function percent(fraction: number): string {
  return `${fraction * 100}%`;
}

/**
 * The lane board of one 4-bar phase (design "Duel board"): 4 lanes, K on top, each with its own
 * shape and color (AC-DUEL-013.11); bar and beat lines; note markers; the "Your phrase" label over
 * bars built from the player's solo (AC-DUEL-007.4); and a playhead redrawn every animation frame
 * from the audio clock. Lanes are decorative for screen readers; the pads carry the names.
 */
export default function LaneBoard(props: LaneBoardProps) {
  const { audio, clock, firstBar, side, call = [], feedback = null, compact = false } = props;
  const t = useTranslations('game');
  const guides = laneGuides(clock.difficulty, side);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [currentBar, setCurrentBar] = useState<number | null>(() =>
    barInPhase(timeFraction(clock, firstBar, audio.currentTime)),
  );

  // Redraw the playhead on every frame from the audio clock. It is written straight to the DOM,
  // so a frame costs no React render; only a change of bar re-renders the header.
  useLayoutEffect(() => {
    let frame = 0;
    let shownBar: number | null | undefined;
    function draw() {
      const fraction = timeFraction(clock, firstBar, audio.currentTime);
      if (playheadRef.current) playheadRef.current.style.left = percent(clampFraction(fraction));
      const bar = barInPhase(fraction);
      if (bar !== shownBar) {
        shownBar = bar;
        setCurrentBar(bar);
      }
      frame = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(frame);
  }, [audio, clock, firstBar]);

  const markers = buildMarkers(props, guides.noteMarkers);
  const phraseRuns = side === 'opponent' ? playerPhraseRuns(call) : [];
  const trackClass = side === 'player' ? 'border-jazz-gold' : 'border-jazz-slate opacity-75';
  const markerSize = compact ? 'h-[15px] w-[15px]' : 'h-[22px] w-[22px]';

  return (
    <div
      className="flex flex-col gap-1.5"
      data-testid="lane-board"
      data-side={side}
      data-difficulty={clock.difficulty}
    >
      {!compact && (
        <div className="grid grid-cols-[44px_repeat(4,1fr)] font-mono text-[11px] text-jazz-text-dim">
          <span />
          {Array.from({ length: PHASE_BARS }, (_, index) => (
            <span
              key={index}
              data-current={index === currentBar}
              className={index === currentBar ? 'font-bold text-jazz-amber' : undefined}
            >
              {t('hud.bar', { n: index + 1 })}
            </span>
          ))}
        </div>
      )}

      <div className="grid min-h-[18px] grid-cols-[44px_repeat(4,1fr)]" data-testid="phrase-row">
        {phraseRuns.map((run) => (
          <span
            key={run.start}
            data-bars={Array.from({ length: run.length }, (_, i) => run.start + i + 1).join(' ')}
            style={{ gridColumn: `${run.start + 2} / span ${run.length}` }}
            className="mx-0.5 rounded-t-md bg-jazz-gold px-2 py-px text-center font-mono text-[11px] text-jazz-black"
          >
            {t('hud.yourPhrase')}
          </span>
        ))}
      </div>

      <Feedback event={feedback} />

      <div className="relative flex flex-col gap-1.5" aria-hidden="true">
        {LANE_ORDER.map((button) => {
          const identity = LANE_IDENTITY[button];
          return (
            <div
              key={button}
              data-lane={identity.key}
              className={`grid grid-cols-[44px_1fr] items-center ${compact ? 'h-[26px]' : 'h-11'}`}
            >
              <div
                className="flex items-center justify-center gap-1 font-mono text-xs text-jazz-text-muted"
                data-testid={`lane-key-${identity.key}`}
              >
                <LaneShape button={button} className="h-3.5 w-3.5" />
                {!compact && <span>{BUTTON_LABELS[button]}</span>}
              </div>
              <div
                className={`relative h-full rounded-lg border bg-jazz-black ${trackClass}`}
                style={NO_TRANSITION}
                data-testid={`lane-track-${identity.key}`}
              >
                {guides.beatLines &&
                  BEAT_LINE_FRACTIONS.map((fraction) => (
                    <span
                      key={`beat-${fraction}`}
                      data-line="beat"
                      className="absolute inset-y-0 w-px bg-jazz-steel"
                      style={{ left: percent(fraction) }}
                    />
                  ))}
                {BAR_LINE_FRACTIONS.map((fraction) => (
                  <span
                    key={`bar-${fraction}`}
                    data-line="bar"
                    className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-jazz-muted"
                    style={{ left: percent(fraction) }}
                  />
                ))}
                {markers
                  .filter((marker) => marker.button === button)
                  .map((marker) => (
                    <span
                      key={marker.id}
                      data-marker={marker.kind}
                      data-state={marker.state}
                      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${markerSize} ${
                        marker.kind === 'tap' ? 'z-2' : 'z-1'
                      } ${marker.state === 'hit' ? 'rounded-full ring-2 ring-jazz-amber' : ''} ${
                        marker.state === 'miss' ? 'opacity-35' : ''
                      }`}
                      style={{ left: percent(marker.fraction), transition: 'none' }}
                    >
                      <LaneShape
                        button={marker.button}
                        variant={marker.variant}
                        className="block h-full w-full"
                      />
                    </span>
                  ))}
              </div>
            </div>
          );
        })}

        <div className="pointer-events-none absolute -inset-y-1 left-[44px] right-0">
          <div
            ref={playheadRef}
            data-testid="playhead"
            className="absolute inset-y-0 z-3 w-0.5 -translate-x-1/2 bg-jazz-amber shadow-[0_0_6px_var(--color-jazz-amber)]"
            style={NO_TRANSITION}
          />
        </div>
      </div>
    </div>
  );
}
