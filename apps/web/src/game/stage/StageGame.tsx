'use client';

import { useCallback, useEffect, useId, useRef, useState, type ComponentType } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { createGameAudio, unlockAudio, type AudioContextLike, type GameAudio } from '../audio';
import type { Character } from '../core/roster';
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
import type { ClubSceneProps } from './scenes/ClubScene';
import type { StreetSceneProps, StreetStart } from './scenes/StreetScene';
import type { WalkDirection } from './street/movement';
import { isWebGL2Supported } from './webgl';
import { useGameStore } from '@/stores/gameStore';

/**
 * Why the game runs the grey-box duel instead of the stage (design.md section 2): the assets are
 * missing or broken (AC-STAGE-001.2, 001.3), or this browser cannot draw WebGL2 (AC-STAGE-002.1,
 * and a context lost mid-way, decision 3).
 */
export type StageNote = 'missing' | 'noWebgl';

/** What `StageGame` needs of the 3D scene modules. */
export interface StreetSceneModule {
  /** The street. */
  readonly default: ComponentType<StreetSceneProps>;
  /** The club drawn behind the duel; without it the club is the duel alone. */
  readonly ClubScene?: ComponentType<ClubSceneProps>;
}

/**
 * Imports the 3D street and club on demand: three.js and the scenes reach the browser only on
 * `/game`, only with WebGL2, and only once the asset files have downloaded.
 */
async function loadStageScenes(): Promise<StreetSceneModule> {
  const [street, club] = await Promise.all([
    import('./scenes/StreetScene'),
    import('./scenes/ClubScene'),
  ]);
  return { default: street.default, ClubScene: club.default };
}

export interface StageGameProps {
  /** Loads the 3D scene modules; the street and the club by default. Tests pass a fake. */
  readonly loadScene?: () => Promise<StreetSceneModule>;
}

/** Where the player is: walking the street, or in the club, where the duel runs. */
type Place = 'street' | 'club';

interface LoadedStage {
  readonly files: StageAssetFiles;
  readonly Scene: ComponentType<StreetSceneProps>;
  readonly Club: ComponentType<ClubSceneProps> | null;
}

/**
 * The player's character in the stage (design.md): the club runs the duel as Sayo, so the
 * opponents follow REQ-DUEL-012 for Sayo (AC-STAGE-005.1).
 */
const PLAYER_CHARACTER: Character = 'sayo';

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

/**
 * The one-line note on why there is no 3D stage (design.md section 2): small, muted, on a thin
 * solid strip that `DuelGame` lays right under its top bar, so the page keeps its height.
 */
function StageNoteLine({ note }: { readonly note: StageNote }) {
  const t = useTranslations('game');
  return (
    <p
      role="status"
      data-testid="stage-note"
      className="border-b border-jazz-slate bg-jazz-dark px-4 py-1.5 font-mono text-[11px] leading-snug text-jazz-text-muted"
    >
      {t(NOTE_KEYS[note])}
    </p>
  );
}

interface FallbackDuelProps {
  readonly note: StageNote;
  /**
   * The audio the street's Play unlocked, or null before Play. With it the duel skips its own
   * Start and plays as the slice's player character (design decision 1, a context lost after
   * Play); without it the duel is the grey-box match of game-duel, Start included.
   */
  readonly audio: GameAudio | null;
}

/** The grey-box duel of `game-duel` with a one-line note on why (design.md section 2). */
function FallbackDuel({ note, audio }: FallbackDuelProps) {
  return (
    <DuelGame
      note={<StageNoteLine note={note} />}
      audio={audio}
      character={audio === null ? null : PLAYER_CHARACTER}
    />
  );
}

/** A small lamp, the picture beside the street-lights chip. */
function LampIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-jazz-gold">
      <path d="M8 1a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.1V11h4v-.7c0-.4.2-.8.6-1.1A4.5 4.5 0 0 0 8 1Zm-2 11h4v1.2c0 .4-.3.8-.8.8H6.8a.8.8 0 0 1-.8-.8V12Z" />
    </svg>
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
  /** At least one take was won: the street lamps are lit, and a chip says so (AC-STAGE-005.4). */
  readonly lightsOn: boolean;
}

/**
 * The DOM over the street (design.md section 3): the top bar on a solid strip, the lights chip
 * after a win, the Play gate, and after it the touch zones, the Enter the club button by the door
 * and the controls hint.
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
  lightsOn,
}: StreetOverlayProps) {
  const t = useTranslations('game');
  const coarse = useMediaQuery(COARSE_POINTER_QUERY);
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col">
      <div className="pointer-events-auto relative z-10 bg-jazz-dark/90">
        <TopBar />
      </div>
      {lightsOn && (
        <div className="flex justify-end px-4 pt-3">
          <p
            role="status"
            data-testid="street-lights-chip"
            className="inline-flex items-center gap-1.5 rounded-full border border-jazz-slate bg-jazz-dark/90 px-3 py-1.5 font-body text-[13px] text-jazz-text"
          >
            <LampIcon />
            {t('stage.street.lightsOn')}
          </p>
        </div>
      )}
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
 * In the club the duel runs as Sayo on the same audio, with no second Play (AC-STAGE-005.1,
 * design decision 1), over the 3D club, where the Shadow fades away after a win (AC-STAGE-005.3).
 * Leaving the club puts the player back on the street at the club door, with the lamps lit once a
 * take has been won (AC-STAGE-005.4).
 *
 * It owns the audio from the Play press on, pauses the street and its music while the tab is
 * hidden (AC-STAGE-008.2), and on unmount aborts the downloads, closes the audio and unmounts the
 * scene, which frees the WebGL resources (AC-STAGE-008.1).
 */
export default function StageGame({ loadScene = loadStageScenes }: StageGameProps) {
  const t = useTranslations('game');
  const [note, setNote] = useState<StageNote | null>(null);
  const [progress, setProgress] = useState<AssetLoadProgress | null>(null);
  const [stage, setStage] = useState<LoadedStage | null>(null);
  const [sceneReady, setSceneReady] = useState(false);
  const [place, setPlace] = useState<Place>('street');
  /** Where the street opens: at `spawn` first, at the club door after the club. */
  const [streetStart, setStreetStart] = useState<StreetStart>('spawn');
  /** A take was won in this visit: the street lamps are lit from then on. */
  const [wonOnce, setWonOnce] = useState(false);
  /** The club scene could not be drawn: the duel goes on without it, with this note. */
  const [clubNote, setClubNote] = useState<StageNote | null>(null);

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
      if (!signal.aborted) {
        setStage({
          files: result.files,
          Scene: sceneModule.default,
          Club: sceneModule.ClubScene ?? null,
        });
      }
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
  // audio clock, and showing the street again resumes it where it stopped. Once the street has
  // fallen back to the grey-box duel, the duel runs the clock.
  const onStreet = place === 'street' && note === null;
  useEffect(() => {
    if (audio === null || !onStreet) return;
    if (paused) void audio.suspend();
    else void audio.resume();
  }, [audio, paused, onStreet]);

  // The grey-box duel without an unlocked audio unlocks its own behind its own Play: a context the
  // browser kept suspended on the street is let go first, so only one is ever alive.
  const fallenBackWithoutAudio = note !== null && !unlocking && audio === null;
  useEffect(() => {
    if (!fallenBackWithoutAudio) return;
    blockedContext.current?.close().catch(() => undefined);
    blockedContext.current = null;
  }, [fallenBackWithoutAudio]);

  /**
   * The street cannot go on: a file did not parse (only before Play, while the street is built) or
   * the WebGL context was lost (design decision 3). Before Play the grey-box duel unlocks its own
   * audio behind its own Play; after it, the duel takes the unlocked audio on, with no second Play.
   */
  const fallBack = useCallback((next: StageNote) => setNote(next), []);

  /** Back to portfolio: the page is about to go, so the audio is closed straight away. */
  const leave = useCallback(() => {
    const current = audioRef.current;
    audioRef.current = null;
    if (current !== null) void current.close();
  }, []);

  const markReady = useCallback(() => setSceneReady(true), []);

  const enterClub = useCallback(() => {
    // The street music stops: its scene drops what it queued, and the clock waits until the first
    // press in the club, where the duel takes this same audio on (design decision 1).
    void audioRef.current?.suspend();
    setNearDoor(false);
    // Back on the street the controls hint shows again (design.md section 3).
    setWalked(false);
    setClubNote(null);
    setPlace('club');
  }, []);

  /** Leave the club (AC-STAGE-005.4): back on the street, standing at the club door. */
  const leaveClub = useCallback(() => {
    setStreetStart('door');
    setPlace('street');
  }, []);

  // The Shadow is beaten while a won take's result, or the summary after the last win, is up. Replay
  // and match 2 put a new take on screen, and the Shadow back.
  const shadowBeaten = useGameStore(
    (s) =>
      s.screen === 'summary' ||
      (s.screen === 'result' && s.campaign?.lastResult?.score.won === true),
  );
  const inClub = place === 'club';
  useEffect(() => {
    if (inClub && shadowBeaten) setWonOnce(true);
  }, [inClub, shadowBeaten]);

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

  if (note !== null) {
    // A fallback while the street's Play is still unlocking waits for that unlock, so the duel
    // takes its audio on instead of making a second AudioContext behind its own Play.
    if (unlocking) {
      return (
        <div
          aria-busy="true"
          data-testid="stage-waiting"
          className="fixed inset-0 bg-jazz-black"
        />
      );
    }
    return (
      <LeaveGameContext.Provider value={leave}>
        <FallbackDuel note={note} audio={audio} />
      </LeaveGameContext.Provider>
    );
  }

  if (inClub) {
    // The same DuelGame stays mounted when the scene drops out (a lost context, decision 3): only
    // its backdrop goes and the note comes, so the take goes on.
    const Club = clubNote === null ? (stage?.Club ?? null) : null;
    const backdrop =
      Club === null || stage === null ? null : (
        <Club
          files={stage.files}
          audio={audio}
          paused={paused}
          reducedMotion={reducedMotion}
          shadowFaded={shadowBeaten}
          label={t('stage.scene.club')}
          onFallback={setClubNote}
        />
      );
    return (
      <LeaveGameContext.Provider value={leave}>
        <DuelGame
          character={PLAYER_CHARACTER}
          audio={audio}
          backdrop={backdrop}
          note={clubNote === null ? null : <StageNoteLine note={clubNote} />}
          endAction={
            // Only with the scene: without WebGL there is no street to go back to.
            backdrop === null ? null : (
              <GameButton variant="secondary" onClick={leaveClub}>
                {t('stage.club.leave')}
              </GameButton>
            )
          }
        />
        <p aria-live="polite" className="sr-only" data-testid="shadow-fading">
          {backdrop !== null && shadowBeaten ? t('stage.club.shadowFading') : ''}
        </p>
      </LeaveGameContext.Provider>
    );
  }

  const rotateHint = sceneReady && portrait;
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
            {/* Under the rotate hint the street is out of the Tab order and the accessibility tree. */}
            <div className="absolute inset-0" inert={rotateHint} data-testid="street-layer">
              {stage !== null && (
                <stage.Scene
                  files={stage.files}
                  audio={audio}
                  getDirection={getDirection}
                  paused={paused}
                  reducedMotion={reducedMotion}
                  lightsOn={wonOnce}
                  startAt={streetStart}
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
                  lightsOn={wonOnce}
                />
              ) : (
                <LoadingPanel progress={progress} />
              )}
            </div>
            {rotateHint && (
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
