'use client';

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createGameAudio, unlockAudio, type AudioContextLike, type GameAudio } from '../audio';
import DuelGame from '../ui/DuelGame';
import { usePrefersReducedMotion } from '../ui/lanes/use-prefers-reduced-motion';
import RotateHint from '../ui/screens/RotateHint';
import type { StartProblem } from '../ui/screens/StartScreen';
import UnsupportedScreen from '../ui/screens/UnsupportedScreen';
import { GameButton, LeaveGameContext, PanelText, PanelTitle, TopBar } from '../ui/screens/ui';
import { PORTRAIT_PHONE_QUERY, useMediaQuery } from '../ui/screens/use-media-query';
import { loadStageAssets, type AssetLoadProgress, type StageAssetFiles } from './assets';
import ControlsHint from './input/ControlsHint';
import DoorPrompt from './input/DoorPrompt';
import StreetControls from './input/StreetControls';
import { NO_SIDES, walkDirection, type HeldSides } from './input/street-keys';
import { useStreetKeys } from './input/use-street-keys';
import type { StreetSceneProps } from './scenes/StreetScene';
import type { WalkDirection } from './street/movement';
import { isWebGL2Supported } from './webgl';

/**
 * Why the game runs the grey-box duel instead of the stage (design.md section 2): the assets are
 * missing or broken (AC-STAGE-001.2, 001.3), or this browser cannot draw WebGL2 (AC-STAGE-002.1,
 * and a context lost mid-way, decision 3).
 */
export type StageNote = 'missing' | 'noWebgl';

/** What `StageGame` needs of the 3D street module. */
export interface StreetSceneModule {
  readonly default: ComponentType<StreetSceneProps>;
}

/**
 * Imports the 3D street on demand: three.js and the scene reach the browser only on `/game`, only
 * with WebGL2, and only once the asset files have downloaded.
 */
const loadStreetScene = (): Promise<StreetSceneModule> => import('./scenes/StreetScene');

export interface StageGameProps {
  /** Loads the 3D street module; `loadStreetScene` by default. Tests pass a fake. */
  readonly loadScene?: () => Promise<StreetSceneModule>;
}

/** Where the player is. T-022 adds the club scene; until then the club is the grey-box duel. */
type Place = 'street' | 'club';

interface LoadedStage {
  readonly files: StageAssetFiles;
  readonly Scene: ComponentType<StreetSceneProps>;
}

const NOTE_KEYS: Readonly<Record<StageNote, 'stage.note.missing' | 'stage.note.noWebgl'>> = {
  missing: 'stage.note.missing',
  noWebgl: 'stage.note.noWebgl',
};

/** A touch screen: the street draws the arrows of its touch zones and hides key labels. */
const COARSE_POINTER_QUERY = '(pointer: coarse)';

/** Turns every transition off with reduced motion (design.md section 5). */
const REDUCED_MOTION_CSS =
  '@media (prefers-reduced-motion: reduce){[data-stage-game],[data-stage-game] *{transition:none!important;animation:none!important}}';

/** Bytes per MB in the loading text. */
const BYTES_PER_MB = 1_000_000;

/** The grey-box duel of `game-duel` with a one-line note on why (design.md section 2). */
function FallbackDuel({ note }: { readonly note: StageNote }) {
  const t = useTranslations('game');
  return (
    <>
      <p
        role="status"
        data-testid="stage-note"
        className="border-b border-jazz-slate bg-jazz-dark px-4 py-1.5 font-mono text-[11px] leading-snug text-jazz-text-muted"
      >
        {t(NOTE_KEYS[note])}
      </p>
      <DuelGame />
    </>
  );
}

/**
 * The loading panel (design.md section 1, AC-STAGE-001.4). While the manifest is read, or when it
 * declares 0 bytes, there is only the checking line. While the files download, a bar shows the
 * bytes really received out of the manifest's total, with the same numbers in MB below it.
 */
function LoadingPanel({ progress }: { readonly progress: AssetLoadProgress | null }) {
  const t = useTranslations('game');
  const locale = useLocale();
  const titleId = useId();
  const showBar = progress !== null && progress.totalBytes > 0;
  const megabytes = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className="absolute inset-0 flex flex-col bg-jazz-black">
      <TopBar />
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <section
          aria-labelledby={titleId}
          aria-busy="true"
          className="flex w-full max-w-md flex-col items-center gap-3.5 rounded-2xl border border-jazz-slate bg-jazz-dark px-6 py-7 text-center"
        >
          <PanelTitle id={titleId}>{t('stage.loading.title')}</PanelTitle>
          {showBar ? (
            <>
              <div
                role="progressbar"
                aria-label={t('stage.loading.label')}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress.fraction * 100)}
                className="h-2 w-full overflow-hidden rounded-full bg-jazz-charcoal"
              >
                <div
                  className="h-full bg-jazz-gold"
                  style={{ width: `${progress.fraction * 100}%` }}
                />
              </div>
              <p className="font-mono text-[13px] text-jazz-text-muted">
                {t('stage.loading.bytes', {
                  loaded: megabytes.format(progress.loadedBytes / BYTES_PER_MB),
                  total: megabytes.format(progress.totalBytes / BYTES_PER_MB),
                })}
              </p>
            </>
          ) : (
            <PanelText>{t('stage.loading.checking')}</PanelText>
          )}
        </section>
      </main>
    </div>
  );
}

interface PlayGateProps {
  readonly unlocking: boolean;
  readonly problem: StartProblem | null;
  readonly onPlay: () => void;
}

/**
 * The Play gate on the street (design decision 1): the press unlocks the audio that the street
 * music and the duck quacks run on. After a failed start it says why, with Try again.
 */
function PlayGate({ unlocking, problem, onPlay }: PlayGateProps) {
  const t = useTranslations('game');
  const titleId = useId();
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-8 sm:items-center">
      <section
        aria-labelledby={titleId}
        className="pointer-events-auto flex w-full max-w-[560px] flex-col items-center gap-3.5 rounded-2xl border border-jazz-slate bg-jazz-dark px-6 py-7 text-center"
      >
        <PanelTitle id={titleId}>{t('title')}</PanelTitle>
        <PanelText>{t('stage.start.intro')}</PanelText>
        {problem !== null && (
          <div className="flex w-full flex-col items-center gap-2.5 rounded-xl border border-jazz-copper bg-jazz-charcoal px-3.5 py-3">
            <p role="alert" className="font-body text-[13px] text-jazz-amber">
              {t(problem === 'blocked' ? 'start.blocked' : 'start.error')}
            </p>
            <GameButton disabled={unlocking} aria-busy={unlocking} onClick={onPlay}>
              {t('start.retry')}
            </GameButton>
          </div>
        )}
        <GameButton variant="primary" disabled={unlocking} aria-busy={unlocking} onClick={onPlay}>
          {t('start.play')}
        </GameButton>
      </section>
    </main>
  );
}

interface StreetOverlayProps {
  /** Null until the Play gate unlocked the audio. */
  readonly audio: GameAudio | null;
  readonly unlocking: boolean;
  readonly problem: StartProblem | null;
  readonly onPlay: () => void;
  readonly paused: boolean;
  readonly nearDoor: boolean;
  readonly onEnterClub: () => void;
  readonly onTouch: (held: HeldSides) => void;
  readonly walked: boolean;
}

/**
 * The DOM over the street (design.md section 3): the top bar on a solid strip, the Play gate, and
 * after it the touch zones, the Enter the club button by the door and the controls hint.
 */
function StreetOverlay({
  audio,
  unlocking,
  problem,
  onPlay,
  paused,
  nearDoor,
  onEnterClub,
  onTouch,
  walked,
}: StreetOverlayProps) {
  const coarse = useMediaQuery(COARSE_POINTER_QUERY);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="pointer-events-auto relative z-10 bg-jazz-dark/90">
        <TopBar />
      </div>
      {audio === null ? (
        <PlayGate unlocking={unlocking} problem={problem} onPlay={onPlay} />
      ) : (
        <>
          <StreetControls onChange={onTouch} showArrows={coarse} disabled={paused} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 px-4 pb-6">
            <DoorPrompt near={nearDoor && !paused} onEnter={onEnterClub} showKeys={!coarse} />
            <ControlsHint walked={walked} />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The game of `/game` with the 3D stage (game-stage): it checks WebGL2, downloads the assets with
 * real byte progress, then opens the street, where Play unlocks the audio and the player walks to
 * the club door. Without WebGL2 or the assets it runs the grey-box duel of `game-duel`, with a
 * note on why (AC-STAGE-001.1, 001.2, 001.4, 002.1).
 *
 * It owns the audio from the Play press on, pauses the street and its music while the tab is
 * hidden (AC-STAGE-008.2), and on unmount aborts the downloads, closes the audio and unmounts the
 * scene, which frees the WebGL resources (AC-STAGE-008.1).
 */
export default function StageGame({ loadScene = loadStreetScene }: StageGameProps) {
  const t = useTranslations('game');
  const [note, setNote] = useState<StageNote | null>(null);
  const [progress, setProgress] = useState<AssetLoadProgress | null>(null);
  const [stage, setStage] = useState<LoadedStage | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [place, setPlace] = useState<Place>('street');

  const [audio, setAudio] = useState<GameAudio | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [startProblem, setStartProblem] = useState<StartProblem | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const audioRef = useRef<GameAudio | null>(null);
  const unlockingRef = useRef(false);
  /** A context the browser kept suspended: the next Play press retries it. */
  const blockedContext = useRef<AudioContextLike | null>(null);
  const mounted = useRef(false);

  const [nearDoor, setNearDoor] = useState(false);
  const [touch, setTouch] = useState<HeldSides>(NO_SIDES);
  const [walked, setWalked] = useState(false);
  const [hidden, setHidden] = useState(false);
  const portrait = useMediaQuery(PORTRAIT_PHONE_QUERY);
  const reducedMotion = usePrefersReducedMotion();
  const paused = hidden || portrait;

  // Unmounting releases the audio for good.
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (audioRef.current !== null) void audioRef.current.close();
      else blockedContext.current?.close().catch(() => undefined);
      audioRef.current = null;
      blockedContext.current = null;
    };
  }, []);

  // WebGL2 first: without it nothing is downloaded and the 3D module is never imported. Then the
  // assets, then the module. Leaving the page aborts the downloads, which is no reason to fall back.
  useEffect(() => {
    if (!isWebGL2Supported()) {
      setNote('noWebgl');
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      const result = await loadStageAssets({
        signal,
        onProgress: (next) => {
          if (!signal.aborted) setProgress(next);
        },
      });
      if (signal.aborted) return;
      if (!result.ok) {
        console.info(`Stage assets unavailable (${result.reason}): ${result.detail}`);
        setNote('missing');
        return;
      }
      let sceneModule: StreetSceneModule;
      try {
        sceneModule = await loadScene();
      } catch (error) {
        if (!signal.aborted) {
          console.info('The 3D street failed to load:', error);
          setNote('missing');
        }
        return;
      }
      if (!signal.aborted) setStage({ files: result.files, Scene: sceneModule.default });
    })();
    return () => controller.abort();
  }, [loadScene]);

  useEffect(() => {
    function update() {
      setHidden(document.visibilityState === 'hidden');
    }
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  // The street music stops with the drawing: a hidden tab or a phone held upright suspends the
  // audio clock, and showing the street again resumes it where it stopped.
  useEffect(() => {
    if (audio === null || place !== 'street') return;
    if (paused) void audio.suspend();
    else void audio.resume();
  }, [audio, paused, place]);

  const releaseAudio = useCallback(() => {
    const current = audioRef.current;
    audioRef.current = null;
    if (current !== null) void current.close();
    setAudio(null);
  }, []);

  const fallBack = useCallback(
    (next: StageNote) => {
      // The grey-box duel unlocks its own audio behind its own Play.
      releaseAudio();
      setNote(next);
    },
    [releaseAudio],
  );

  /** Back to portfolio: the page is about to go, so the audio is closed straight away. */
  const leave = useCallback(() => {
    const current = audioRef.current;
    audioRef.current = null;
    if (current !== null) void current.close();
  }, []);

  const markReady = useCallback(() => setSceneReady(true), []);

  const enterClub = useCallback(() => {
    // T-022 hands this audio on to the duel in the club; until then the street music just stops.
    void audioRef.current?.suspend();
    setNearDoor(false);
    // Back on the street the controls hint shows again (design.md section 3).
    setWalked(false);
    setPlace('club');
  }, []);

  const canWalk = audio !== null && sceneReady && place === 'street' && !paused;
  const keys = useStreetKeys({
    enabled: canWalk,
    canEnter: canWalk && nearDoor,
    onEnter: enterClub,
  });
  const direction: WalkDirection = canWalk ? walkDirection(keys, touch) : 0;
  const directionRef = useRef<WalkDirection>(0);
  useEffect(() => {
    directionRef.current = direction;
    if (direction !== 0) setWalked(true);
  }, [direction]);
  const getDirection = useCallback(() => directionRef.current, []);

  /** The Play and Try again press. Never rejects: every failure shows on the gate. */
  async function play() {
    if (unlockingRef.current || audioRef.current !== null) return;
    // Straight from the click, before any await, so the gesture unlocks audio.
    const unlocked = unlockAudio({ context: blockedContext.current });
    unlockingRef.current = true;
    setUnlocking(true);
    const result = await unlocked;
    unlockingRef.current = false;
    if (!mounted.current) {
      if (result.ok || result.reason === 'blocked') result.context.close().catch(() => undefined);
      return;
    }
    setUnlocking(false);
    if (!result.ok) {
      if (result.reason === 'unsupported') setUnsupported(true);
      else {
        blockedContext.current = result.context;
        setStartProblem('blocked');
      }
      return;
    }
    blockedContext.current = null;
    try {
      const created = createGameAudio(result.context);
      audioRef.current = created;
      setAudio(created);
      setStartProblem(null);
    } catch {
      result.context.close().catch(() => undefined);
      setStartProblem('error');
    }
  }

  if (note !== null) return <FallbackDuel note={note} />;
  if (place === 'club') return <DuelGame />;

  return (
    <LeaveGameContext.Provider value={leave}>
      <div
        data-stage-game=""
        data-place={place}
        className="fixed inset-0 overflow-hidden bg-jazz-black font-body text-jazz-text"
      >
        <style>{REDUCED_MOTION_CSS}</style>
        {unsupported ? (
          <UnsupportedScreen />
        ) : (
          <>
            {stage !== null && (
              <stage.Scene
                files={stage.files}
                audio={audio}
                getDirection={getDirection}
                paused={paused}
                reducedMotion={reducedMotion}
                label={t('stage.scene.street')}
                onReady={markReady}
                onFallback={fallBack}
                onNearDoorChange={setNearDoor}
              />
            )}
            {sceneReady ? (
              <StreetOverlay
                audio={audio}
                unlocking={unlocking}
                problem={startProblem}
                onPlay={() => void play()}
                paused={paused}
                nearDoor={nearDoor}
                onEnterClub={enterClub}
                onTouch={setTouch}
                walked={walked}
              />
            ) : (
              <LoadingPanel progress={progress} />
            )}
            {sceneReady && portrait && (
              <div className="absolute inset-0 z-20 bg-jazz-black">
                <RotateHint />
              </div>
            )}
          </>
        )}
      </div>
    </LeaveGameContext.Provider>
  );
}
