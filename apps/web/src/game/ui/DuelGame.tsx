'use client';

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createGameAudio, unlockAudio, type AudioContextLike, type GameAudio } from '../audio';
import type { Character } from '../core/roster';
import type { StarCount } from '../core/scoring';
import type { DuelResult } from '../core/session';
import type { BarNote, Difficulty, DuelNumber } from '../core/types';
import {
  selectAssistOffer,
  selectCanAdvance,
  selectRunComplete,
  useGameStore,
  type GameScreen,
} from '@/stores/gameStore';
import CalibrationScreen from './screens/CalibrationScreen';
import DifficultyScreen from './screens/DifficultyScreen';
import { createDuelController, type DuelController } from './screens/duel-controller';
import DuelScreen from './screens/DuelScreen';
import ResultScreen from './screens/ResultScreen';
import StartScreen, { type StartProblem } from './screens/StartScreen';
import SummaryScreen from './screens/SummaryScreen';
import { LeaveGameContext, StageLayoutContext, type StageLayout } from './screens/ui';
import UnsupportedScreen from './screens/UnsupportedScreen';

/** What the game reports when a take ends (AC-DUEL-017.3), for the shell to save. */
export interface MatchEndReport {
  readonly duel: DuelNumber;
  readonly stars: StarCount;
  readonly won: boolean;
  /** The take's best Solo bar, or null when no bar qualifies (AC-DUEL-008.3). */
  readonly bestBar: readonly BarNote[] | null;
}

/**
 * Inputs of the game screen (REQ-DUEL-017), so `game-shell` can wrap it without changing it. Each
 * input is optional; a missing one (undefined or null) is asked for or defaulted:
 * - no `character`: Ren, so the Shadows are Aki, then Sayo (AC-DUEL-012.4);
 * - no `difficulty`: the difficulty screen (AC-DUEL-011.1);
 * - no `offsetMs`: the calibration step.
 * Audio is always unlocked by a press on Play (AC-DUEL-013.1): this screen's own Play, or, when
 * `audio` is passed, the Play press of the screen that unlocked it (the stage's street).
 *
 * The other inputs place the duel inside the 3D stage (game-stage); none of them changes the duel.
 */
export interface DuelGameProps {
  /** The character the player picked: it decides the Shadows (AC-DUEL-012.1 to 012.3). */
  readonly character?: Character | null;
  readonly difficulty?: Difficulty | null;
  /** Calibration offset in ms, used by both matches (AC-DUEL-002.3). */
  readonly offsetMs?: number | null;
  /** The match to start at; 1 by default (AC-DUEL-017.2). */
  readonly startDuel?: DuelNumber;
  /** With `startDuel` 2: the best Solo bar of the match-1 win, which opens the Shadow's Solo. */
  readonly bestBar?: readonly BarNote[] | null;
  /** Called once per take, when it ends (AC-DUEL-017.3). */
  readonly onMatchEnd?: (report: MatchEndReport) => void;
  /**
   * An audio a Play press elsewhere already unlocked (the stage's street, design decision 1). The
   * Start screen is skipped, never shown, so there are never two Play gates in a row; the game
   * opens on the steps after Play. The caller owns this audio: it is resumed on the first press
   * here (it may arrive suspended), cleared of what the duel queued when the game unmounts, and
   * never closed; Back to portfolio uses the caller's `LeaveGameContext`. Read once, on mount.
   */
  readonly audio?: GameAudio | null;
  /**
   * A scene drawn behind every screen (the 3D club, design.md section 4). The page background goes
   * transparent, and a `jazz-black/40` layer dims the scene behind the setup, result, summary and
   * pause screens, not during play.
   */
  readonly backdrop?: ReactNode;
  /**
   * A one-line notice (the stage's missing-assets or no-WebGL note, design.md section 2), in the
   * page flow right under the top bar of every screen. With a note or a backdrop the duel board
   * fits the screen, so the page never grows taller than it (`StageLayout` in `screens/ui.tsx`).
   */
  readonly note?: ReactNode;
  /**
   * One more action in the button row of the result and summary screens, and only there (the
   * stage's Leave the club, design.md section 4).
   */
  readonly endAction?: ReactNode;
}

/** Turns every transition off with reduced motion, the site's 0.5 s color change included. */
const REDUCED_MOTION_CSS =
  '@media (prefers-reduced-motion: reduce){[data-duel-game],[data-duel-game] *{transition:none!important;animation:none!important}}';

/** The screens that are a panel over the scene: the backdrop is dimmed behind them. */
const DIMMED_SCREENS: ReadonlySet<GameScreen> = new Set([
  'unsupported',
  'difficulty',
  'calibration',
  'result',
  'summary',
]);

function matchReport(result: DuelResult): MatchEndReport {
  return {
    duel: result.duel,
    stars: result.score.stars,
    won: result.score.won,
    bestBar: result.bestBar,
  };
}

function ResultView({ extraAction }: { readonly extraAction: ReactNode }) {
  const result = useGameStore((s) => s.campaign?.lastResult ?? null);
  const canAdvance = useGameStore(selectCanAdvance);
  const runComplete = useGameStore(selectRunComplete);
  const offerAssist = useGameStore(selectAssistOffer);
  const nextMatch = useGameStore((s) => s.nextMatch);
  const replayMatch = useGameStore((s) => s.replayMatch);
  const showSummary = useGameStore((s) => s.showSummary);
  const acceptAssist = useGameStore((s) => s.acceptAssist);
  const declineAssist = useGameStore((s) => s.declineAssist);
  if (result === null) return null;
  return (
    <ResultScreen
      result={result}
      canAdvance={canAdvance}
      runComplete={runComplete}
      offerAssist={offerAssist}
      onNext={nextMatch}
      onReplay={replayMatch}
      onSummary={showSummary}
      onAcceptAssist={acceptAssist}
      onDeclineAssist={declineAssist}
      extraAction={extraAction}
    />
  );
}

function SummaryView({ extraAction }: { readonly extraAction: ReactNode }) {
  const results = useGameStore((s) => s.campaign?.results ?? null);
  const restartRun = useGameStore((s) => s.restartRun);
  if (results === null) return null;
  return <SummaryScreen results={results} onRestart={restartRun} extraAction={extraAction} />;
}

/**
 * The grey-box duel (REQ-DUEL-013): Start, then the difficulty and calibration steps the inputs do
 * not cover, then two matches with their results and the summary. Client only: it owns the
 * `AudioContext`, which it closes when the player leaves or the screen unmounts (AC-DUEL-014.3),
 * unless the caller passed an unlocked `audio` in, which stays the caller's.
 */
export default function DuelGame({
  character = null,
  difficulty = null,
  offsetMs = null,
  startDuel = 1,
  bestBar = null,
  onMatchEnd,
  audio: givenAudio = null,
  backdrop = null,
  note = null,
  endAction = null,
}: DuelGameProps) {
  const screen = useGameStore((s) => s.screen);
  const unlocking = useGameStore((s) => s.unlocking);
  const chosenDifficulty = useGameStore((s) => s.difficulty);
  const chooseDifficulty = useGameStore((s) => s.chooseDifficulty);
  const sessionPaused = useGameStore((s) => s.session?.status === 'paused');

  /** The caller's unlocked audio, read once: with it there is no Start screen. */
  const [unlocked] = useState<GameAudio | null>(givenAudio);
  const ownsAudio = unlocked === null;
  const [audio, setAudio] = useState<GameAudio | null>(unlocked);
  /** Why the last Play press did not start the match, shown on the start screen. */
  const [startProblem, setStartProblem] = useState<StartProblem | null>(null);
  const audioRef = useRef<GameAudio | null>(unlocked);
  /** A context the browser kept suspended: the next Play press retries it. */
  const blockedContext = useRef<AudioContextLike | null>(null);
  const mounted = useRef(false);
  const onMatchEndRef = useRef(onMatchEnd);
  useEffect(() => {
    onMatchEndRef.current = onMatchEnd;
  });
  const callerLeave = useContext(LeaveGameContext);

  // The layout the screens take in the stage: null (the grey-box duel as in game-duel) unless the
  // stage passed a scene or a note.
  const hasBackdrop = backdrop !== null;
  const [sceneWindow, setSceneWindow] = useState<HTMLElement | null>(null);
  const stageLayout = useMemo<StageLayout | null>(
    () =>
      hasBackdrop || note !== null
        ? { backdrop: hasBackdrop, note, sceneWindow, setSceneWindow }
        : null,
    [hasBackdrop, note, sceneWindow],
  );

  // Leaving or unmounting releases the audio for good, and the next visit starts at Play. An audio
  // the caller passed in stays open for the caller; only what the duel queued on it is dropped.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (unlocked !== null) unlocked.clearScheduled();
      else if (audioRef.current !== null) void audioRef.current.close();
      else blockedContext.current?.close().catch(() => undefined);
      useGameStore.getState().reset();
    };
  }, [unlocked]);

  const leave = useCallback(() => {
    if (!ownsAudio) callerLeave();
    else if (audioRef.current !== null) void audioRef.current.close();
  }, [ownsAudio, callerLeave]);

  const controller = useMemo<DuelController | null>(
    () =>
      audio === null
        ? null
        : createDuelController({
            audio,
            onEnd: (result) => onMatchEndRef.current?.(matchReport(result)),
          }),
    [audio],
  );

  function startRun(runDifficulty: Difficulty, runOffsetMs: number) {
    useGameStore.getState().startRun({
      player: character,
      difficulty: runDifficulty,
      offsetMs: runOffsetMs,
      startDuel,
      bestBar,
    });
  }

  /**
   * The caller's audio may arrive suspended (the stage stops its street music on the way in): it
   * is woken before the calibration or the match times anything on its clock.
   */
  function wakeAudio() {
    if (unlocked !== null && unlocked.context.state !== 'running') void unlocked.resume();
  }

  /** After Play: the steps the inputs leave open, then the first match (AC-DUEL-017.1). */
  function afterUnlock() {
    if (difficulty === null) {
      useGameStore.getState().setScreen('difficulty');
      return;
    }
    chooseDifficulty(difficulty);
    wakeAudio();
    if (offsetMs === null) useGameStore.getState().setScreen('calibration');
    else startRun(difficulty, offsetMs);
  }

  function afterDifficulty() {
    // Inside the Continue press, so the browser lets the audio resume.
    wakeAudio();
    if (offsetMs === null) useGameStore.getState().setScreen('calibration');
    else startRun(chosenDifficulty, offsetMs);
  }

  // An audio passed in was unlocked by a Play press elsewhere: straight to the steps after Play.
  const afterUnlockRef = useRef(afterUnlock);
  useEffect(() => {
    afterUnlockRef.current = afterUnlock;
  });
  useEffect(() => {
    if (unlocked !== null && useGameStore.getState().screen === 'start') afterUnlockRef.current();
  }, [unlocked]);

  /**
   * A start that threw (AC-DUEL-013.12): releases the audio made for it, so no timer keeps
   * running and the next press unlocks afresh, then shows the error on the start screen.
   */
  function failStart(unlockedContext: AudioContextLike | null) {
    const created = audioRef.current;
    audioRef.current = null;
    if (created !== null) void created.close();
    else unlockedContext?.close().catch(() => undefined);
    if (!mounted.current) return;
    setAudio(null);
    useGameStore.getState().setUnlocking(false);
    useGameStore.getState().setScreen('start');
    setStartProblem('error');
  }

  /** The Play and Try again click. It never rejects: every failure shows on the start screen. */
  async function play() {
    if (useGameStore.getState().unlocking || audioRef.current !== null) return;
    let unlockedContext: AudioContextLike | null = null;
    try {
      // Straight from the click, before any await, so the gesture unlocks audio (AC-DUEL-013.1).
      const unlocked = unlockAudio({ context: blockedContext.current });
      useGameStore.getState().setUnlocking(true);
      const result = await unlocked;
      if (!mounted.current) {
        if (result.ok || result.reason === 'blocked') result.context.close().catch(() => undefined);
        return;
      }
      useGameStore.getState().setUnlocking(false);
      if (!result.ok) {
        if (result.reason === 'unsupported') {
          useGameStore.getState().setScreen('unsupported');
        } else {
          blockedContext.current = result.context;
          setStartProblem('blocked');
        }
        return;
      }
      unlockedContext = result.context;
      blockedContext.current = null;
      const created = createGameAudio(result.context);
      audioRef.current = created;
      setAudio(created);
      afterUnlock();
      setStartProblem(null);
    } catch {
      failStart(unlockedContext);
    }
  }

  let content = null;
  switch (screen) {
    case 'start':
      // With an unlocked audio passed in there is no Start screen, not even for one frame.
      content =
        unlocked !== null ? null : (
          <StartScreen unlocking={unlocking} problem={startProblem} onPlay={() => void play()} />
        );
      break;
    case 'unsupported':
      content = <UnsupportedScreen />;
      break;
    case 'difficulty':
      content = (
        <DifficultyScreen
          selected={chosenDifficulty}
          onSelect={chooseDifficulty}
          onContinue={afterDifficulty}
        />
      );
      break;
    case 'calibration':
      content =
        audio === null ? null : (
          <CalibrationScreen
            audio={audio}
            onDone={(measured) => startRun(chosenDifficulty, measured)}
          />
        );
      break;
    case 'duel':
      content =
        audio === null || controller === null ? null : (
          <DuelScreen audio={audio} controller={controller} />
        );
      break;
    case 'result':
      content = <ResultView extraAction={endAction} />;
      break;
    case 'summary':
      content = <SummaryView extraAction={endAction} />;
      break;
  }

  const dimmed =
    hasBackdrop && (DIMMED_SCREENS.has(screen) || (screen === 'duel' && sessionPaused));

  return (
    <LeaveGameContext.Provider value={leave}>
      <StageLayoutContext.Provider value={stageLayout}>
        <div
          data-duel-game=""
          data-screen={screen}
          data-backdrop={hasBackdrop ? '' : undefined}
          className={
            hasBackdrop
              ? 'relative isolate flex min-h-dvh flex-col font-body text-jazz-text'
              : 'relative flex min-h-dvh flex-col bg-jazz-black font-body text-jazz-text'
          }
        >
          <style>{REDUCED_MOTION_CSS}</style>
          {hasBackdrop && (
            <div className="fixed inset-0 -z-10 bg-jazz-black" data-testid="duel-backdrop">
              {backdrop}
              {dimmed && (
                <div
                  aria-hidden="true"
                  data-testid="duel-backdrop-dim"
                  className="absolute inset-0 bg-jazz-black/40"
                />
              )}
            </div>
          )}
          {content}
        </div>
      </StageLayoutContext.Provider>
    </LeaveGameContext.Provider>
  );
}
