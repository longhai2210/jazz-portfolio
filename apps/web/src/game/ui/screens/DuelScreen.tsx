'use client';

import { useEffect, useId } from 'react';
import { useTranslations } from 'next-intl';
import type { GameAudio } from '../../audio';
import { TURNS } from '../../core/call';
import type { Tap } from '../../core/types';
import { useKeyboardTaps } from '../input/use-keyboard-taps';
import TouchPads from '../input/TouchPads';
import LaneBoard from '../lanes/LaneBoard';
import LickBook from '../lick-book/LickBook';
import { useGameStore } from '@/stores/gameStore';
import { boardView } from './board-view';
import CountIn from './CountIn';
import type { DuelController } from './duel-controller';
import { CHARACTER_NAMES } from './game-ids';
import PauseOverlay from './PauseOverlay';
import RotateHint from './RotateHint';
import { Chip, STRIP_CLASS, TopBar, useStageLayout } from './ui';
import { COMPACT_QUERY, PORTRAIT_PHONE_QUERY, useMediaQuery } from './use-media-query';

export interface DuelScreenProps {
  /** The game audio itself, never a copy: its `currentTime` is a live getter. */
  readonly audio: GameAudio;
  readonly controller: DuelController;
}

const NO_TAPS: readonly Tap[] = [];

const ICON_BUTTON =
  'inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] border border-jazz-slate bg-jazz-charcoal font-body text-jazz-text hover:border-jazz-gold disabled:cursor-default disabled:opacity-60';

/**
 * Screen 5, the duel board: top bar, HUD, round tabs, lane board, pads and lick book; the count-in
 * and the pause dialog over it. It starts the take in the store, runs the frame loop, and pauses
 * when the tab is hidden, on the pause button, on Esc or when a phone turns upright
 * (AC-DUEL-014.1). Esc while paused resumes, through the same count-in as Resume.
 */
export default function DuelScreen({ audio, controller }: DuelScreenProps) {
  const t = useTranslations('game');
  const drawerId = useId();
  const portrait = useMediaQuery(PORTRAIT_PHONE_QUERY);
  const compact = useMediaQuery(COMPACT_QUERY);
  // In the stage (game-stage) the board fits the screen on a phone held sideways, and over a 3D
  // scene everywhere; otherwise it is the game-duel board, unchanged.
  const stage = useStageLayout();
  const backdrop = stage?.backdrop ?? false;
  const fitScreen = stage !== null && (compact || backdrop);

  const status = useGameStore((s) => s.session?.status ?? null);
  const config = useGameStore((s) => s.session?.config ?? null);
  const calls = useGameStore((s) => s.session?.calls ?? null);
  const clock = useGameStore((s) => s.session?.clock ?? null);
  const taps = useGameStore((s) => s.session?.taps ?? NO_TAPS);
  const turnIndex = useGameStore((s) => s.session?.turnIndex ?? 0);
  const player = useGameStore((s) => s.campaign?.player ?? null);
  const phase = useGameStore((s) => s.phase);
  const beat = useGameStore((s) => s.beat);
  const feedback = useGameStore((s) => s.feedback);
  const justQuoted = useGameStore((s) => s.justQuoted);
  const countInResumed = useGameStore((s) => s.countInResumed);
  const lickBookOpen = useGameStore((s) => s.lickBookOpen);
  const setLickBookOpen = useGameStore((s) => s.setLickBookOpen);

  const playing = status === 'playing';
  const paused = status === 'paused';

  // A take starts as soon as it is on screen, but never on a phone held upright.
  useEffect(() => {
    if (status === 'ready' && !portrait) controller.begin();
  }, [status, portrait, controller]);

  // Turning the phone upright mid-match pauses it.
  useEffect(() => {
    if (portrait && status === 'playing') controller.pause();
  }, [portrait, status, controller]);

  // The frame loop: the take follows the audio clock.
  useEffect(() => {
    let frame = 0;
    function loop() {
      controller.tick();
      frame = requestAnimationFrame(loop);
    }
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [controller]);

  // A hidden tab pauses; showing it again keeps the pause, so the player resumes when ready.
  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden') controller.pause();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [controller]);

  // Esc pauses a take in play and resumes a paused one.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.repeat) return;
      const current = useGameStore.getState().session?.status;
      if (current === 'playing') {
        event.preventDefault();
        controller.pause();
      } else if (current === 'paused') {
        event.preventDefault();
        void controller.resume();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controller]);

  const held = useKeyboardTaps({ clock: audio, onTap: controller.tap, enabled: playing });

  if (portrait) {
    // Over a 3D scene the hint gets a solid page of its own: the canvas keeps its last frame, and
    // no text may sit on it (design.md "Nguyên tắc").
    return backdrop ? (
      <div className="fixed inset-0 z-20 bg-jazz-black" data-testid="rotate-cover">
        <RotateHint />
      </div>
    ) : (
      <RotateHint />
    );
  }
  if (config === null || calls === null) return null;

  const view =
    clock === null
      ? null
      : boardView({
          calls,
          clock,
          offsetMs: config.offsetMs,
          assisted: config.assisted,
          taps,
          phase,
          beat,
          turnIndex,
        });
  const turn = view?.turn ?? TURNS[Math.min(turnIndex, TURNS.length - 1)];
  const round = TURNS.indexOf(turn) + 1;
  const opponent = CHARACTER_NAMES[config.character];
  const yourTurn = phase?.kind === 'player';
  const who = yourTurn
    ? t('hud.yourTurn')
    : phase?.kind === 'opponent' || paused
      ? t('hud.opponentPlays', { name: opponent })
      : t('hud.countIn');
  const avatar = yourTurn && player !== null ? CHARACTER_NAMES[player] : opponent;

  const pauseButton = (
    <button
      type="button"
      aria-label={t('pause.button')}
      disabled={!playing}
      onClick={() => controller.pause()}
      className={ICON_BUTTON}
    >
      <span aria-hidden="true">&#10074;&#10074;</span>
    </button>
  );
  const lickBookButton = (
    <button
      type="button"
      aria-label={t(lickBookOpen ? 'lickBook.close' : 'lickBook.open')}
      aria-expanded={lickBookOpen}
      aria-controls={drawerId}
      onClick={() => setLickBookOpen(!lickBookOpen)}
      className={ICON_BUTTON}
    >
      <span aria-hidden="true">&#9835;</span>
    </button>
  );

  // ---- The pieces of the board, shared by both layouts ----

  const hudWho = (
    <div className="flex items-center gap-2.5">
      <div
        aria-hidden="true"
        className={`grid place-items-center rounded-[10px] border font-heading text-jazz-gold ${
          compact ? 'h-7 w-7' : 'h-10 w-10'
        } ${
          yourTurn
            ? 'border-jazz-steel bg-jazz-slate'
            : 'border-dashed border-jazz-steel bg-jazz-indigo'
        }`}
      >
        {avatar.charAt(0)}
      </div>
      <div>
        <b className="block font-body text-[15px] text-jazz-text" data-testid="hud-who">
          {who}
        </b>
        <small className="font-mono text-[11px] text-jazz-text-muted">
          {t('hud.match', { n: config.duel })}
        </small>
      </div>
    </div>
  );

  const hudRow = (
    <div className="flex items-center justify-between gap-3 px-4 pt-2.5">
      {hudWho}
      {!compact && (
        <div className="text-right font-heading text-xl text-jazz-amber">
          <small className="block font-mono text-[11px] text-jazz-text-muted">
            {t('hud.round', { n: round })}
          </small>
          {t(`round.${turn}`)}
        </div>
      )}
    </div>
  );

  const roundChips = !compact && (
    <div className="flex gap-1.5 px-4 pt-2">
      {TURNS.map((name) => (
        <Chip key={name} on={name === turn}>
          {t(`round.${name}`)}
        </Chip>
      ))}
    </div>
  );

  const topBarRight = compact ? (
    <>
      {lickBookButton}
      {pauseButton}
    </>
  ) : (
    <>
      <Chip>{t(`difficulty.${config.difficulty}.name`)}</Chip>
      <Chip>{t('hud.bpm', { bpm: config.bpm })}</Chip>
      {pauseButton}
    </>
  );

  const compactChips = (
    <>
      <Chip on>{t(`round.${turn}`)}</Chip>
      {view?.barIndex != null && <Chip>{t('hud.bar', { n: view.barIndex + 1 })}</Chip>}
    </>
  );

  const laneBoard = (
    <>
      {view !== null && clock !== null && (
        <LaneBoard
          audio={audio}
          clock={clock}
          firstBar={view.firstBar}
          side={view.side}
          call={view.call}
          targets={view.targets}
          taps={view.taps}
          offsetMs={config.offsetMs}
          feedback={feedback}
          compact={compact}
        />
      )}
      {phase?.kind === 'countIn' && !paused && (
        <CountIn
          beat={phase.beat}
          caption={
            countInResumed
              ? t('round.restart', { n: round, round: t(`round.${turn}`) })
              : t('hud.countIn')
          }
        />
      )}
    </>
  );

  const touchPads = (
    <TouchPads
      clock={audio}
      onTap={controller.tap}
      disabled={!playing}
      held={held}
      compact={compact}
    />
  );

  const drawer = compact && (
    <div
      id={drawerId}
      hidden={!lickBookOpen}
      className="absolute bottom-0 right-0 top-[60px] z-10 w-[220px] overflow-y-auto border-l border-jazz-slate bg-jazz-black"
    >
      <LickBook justQuoted={justQuoted?.lickId ?? null} />
    </div>
  );

  const pauseOverlay = paused && <PauseOverlay onResume={() => void controller.resume()} />;

  if (!fitScreen) {
    // The grey-box duel of game-duel, as it has always been drawn.
    return (
      <div className="relative flex min-h-full flex-1 flex-col" data-testid="duel-screen">
        <div
          className={`flex flex-1 flex-col ${paused ? 'opacity-50' : ''}`}
          inert={paused}
          data-testid="duel-board"
        >
          <TopBar compact={compact} left={compact ? compactChips : undefined} right={topBarRight} />

          <div className={`grid flex-1 ${compact ? '' : 'lg:grid-cols-[1fr_190px]'}`}>
            <div className="flex min-w-0 flex-col">
              {hudRow}
              {roundChips}
              <div className="relative px-4 py-2">{laneBoard}</div>
              <div className={compact ? 'h-[45dvh] px-2 pb-2' : 'px-4 pb-4'}>{touchPads}</div>
            </div>

            {!compact && (
              <LickBook
                justQuoted={justQuoted?.lickId ?? null}
                className="border-t border-jazz-slate lg:border-l lg:border-t-0"
              />
            )}
          </div>

          {drawer}
        </div>

        {pauseOverlay}
      </div>
    );
  }

  // In the stage (a note or a 3D scene): the board is exactly the screen's height, so nothing is
  // pushed past it. Over a scene the text sits on solid strips at the top, the lanes and pads on
  // a near-solid block at the bottom, and the free window between them shows the scene
  // (design.md section 4). On a phone held sideways the HUD joins the top bar to leave room.
  const bottomBlock = backdrop ? ' border-t border-jazz-slate bg-jazz-black/85' : '';
  return (
    <div className="relative flex h-dvh flex-col" data-testid="duel-screen" data-layout="stage">
      <div
        className={`flex min-h-0 flex-1 flex-col ${paused ? 'opacity-50' : ''}`}
        inert={paused}
        data-testid="duel-board"
      >
        <TopBar
          compact={compact}
          left={
            compact ? (
              <>
                {compactChips}
                {hudWho}
              </>
            ) : undefined
          }
          right={topBarRight}
        />

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {!compact && (
              <div
                className={backdrop ? `border-b pb-2 ${STRIP_CLASS}` : undefined}
                data-testid="duel-hud"
              >
                {hudRow}
                {roundChips}
              </div>
            )}
            {backdrop && (
              <div
                ref={stage?.setSceneWindow}
                aria-hidden="true"
                className="min-h-0 flex-1"
                data-testid="scene-window"
              />
            )}
            <div
              className={`relative px-4 ${compact ? 'py-1' : 'py-2'}${bottomBlock}`}
              data-testid="duel-lanes"
            >
              {laneBoard}
            </div>
            <div
              className={`${compact ? 'flex min-h-16 flex-1 flex-col px-2 pb-2' : 'px-4 pb-4'}${
                backdrop ? ' bg-jazz-black/85' : ''
              }`}
              data-testid="duel-pads"
            >
              {touchPads}
            </div>
          </div>

          {!compact && (
            <LickBook
              justQuoted={justQuoted?.lickId ?? null}
              className="w-[190px] shrink-0 overflow-y-auto border-l border-jazz-slate"
            />
          )}
        </div>

        {drawer}
      </div>

      {pauseOverlay}
    </div>
  );
}
