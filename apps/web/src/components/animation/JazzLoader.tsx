'use client';

import { Component, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import styles from './JazzLoader.module.css';

// Fetch Three.js only for eligible visits; the controller and poster stay small.
const TurntableScene = dynamic(() => import('./TurntableScene'), { ssr: false });
const SESSION_KEY = 'jazz-loader-complete';
const MIN_EXIT_MS = 2850;
const HARD_EXIT_MS = 3600;
const SCENE_SHOW_MS = 2600;
const EXIT_MS = 420;
const copy = {
  en: {
    skip: 'Skip intro',
    caption: 'Swing · space · improvisation',
    session: 'Drop the needle',
    label: 'Jazzfolio opening animation',
  },
  vi: {
    skip: 'Bỏ qua',
    caption: 'Đu đưa · khoảng lặng · ngẫu hứng',
    session: 'Thả kim xuống',
    label: 'Hoạt cảnh mở đầu Jazzfolio',
  },
  ja: {
    skip: 'スキップ',
    caption: 'スウィング · 余白 · 即興',
    session: '針を落とす',
    label: 'Jazzfolio オープニング',
  },
};

class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function JazzLoader({ onComplete }: { onComplete: () => void }) {
  const pathname = usePathname();
  const locale = useLocale();
  const text = copy[locale as keyof typeof copy] ?? copy.en;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const startedAt = useRef(0);
  const preview = useRef<number | undefined>(undefined);
  const completed = useRef(false);
  const exiting = useRef(false);
  const shouldMarkSession = useRef(false);
  const [phase, setPhase] = useState<'checking' | 'playing' | 'leaving' | 'done'>('checking');
  const [mode, setMode] = useState<'3d' | 'static'>('static');
  const [ready, setReady] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | undefined>();
  // Keep an immediate cover in the server-rendered HTML. The pre-paint flag in
  // the locale layout hides it for ineligible visits before the browser paints.
  const visible = phase !== 'done';

  const complete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    clearTimeout(exitTimer.current);
    clearTimeout(finishTimer.current);
    if (shouldMarkSession.current) {
      try {
        sessionStorage.setItem(SESSION_KEY, 'true');
      } catch {
        // Storage is optional and must never block the landing page.
      }
      shouldMarkSession.current = false;
    }
    document.documentElement.dataset.jazzIntro = 'skip';
    delete document.documentElement.dataset.jazzIntroStartedAt;
    setPhase('done');
    onComplete();
  }, [onComplete]);
  const dismiss = useCallback(() => {
    clearTimeout(exitTimer.current);
    clearTimeout(finishTimer.current);
    complete();
  }, [complete]);
  const beginExit = useCallback(() => {
    if (completed.current || exiting.current) return;
    exiting.current = true;
    clearTimeout(exitTimer.current);
    clearTimeout(finishTimer.current);
    setPhase('leaving');
    finishTimer.current = setTimeout(complete, EXIT_MS);
  }, [complete]);
  const failScene = useCallback(() => {
    if (completed.current || exiting.current) return;
    setMode('static');
    setReady(false);
    if (preview.current !== undefined) return;

    const elapsed = performance.now() - startedAt.current;
    const holdFallback = Math.max(700, MIN_EXIT_MS - elapsed);
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(
      beginExit,
      Math.min(holdFallback, Math.max(0, HARD_EXIT_MS - elapsed)),
    );
  }, [beginExit]);

  useEffect(() => {
    exiting.current = false;
    setReady(false);
    const params = new URLSearchParams(window.location.search);
    const force = params.get('forceLoader') === 'true';
    const isHome = /^\/(?:en|vi|ja)?\/?$/.test(pathname);
    let alreadyPlayed = false;
    try {
      alreadyPlayed = sessionStorage.getItem(SESSION_KEY) === 'true';
    } catch {
      /* Storage is optional. */
    }
    if (!isHome || (alreadyPlayed && !force) || document.visibilityState === 'hidden') {
      complete();
      return;
    }
    document.documentElement.dataset.jazzIntro = 'play';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Development-only still poses allow review without lengthening real visits.
    const sample = process.env.NODE_ENV === 'development' ? params.get('introAt') : null;
    const frozenTime =
      sample !== null && Number.isFinite(Number(sample))
        ? Math.min(2.75, Math.max(0, Number(sample)))
        : undefined;
    const forceStatic =
      process.env.NODE_ENV === 'development' && params.get('introFallback') === 'true';
    const staticMode = reducedMotion.matches || forceStatic;
    const prepaintStartedAt = Number(document.documentElement.dataset.jazzIntroStartedAt);
    preview.current = frozenTime;
    setPreviewTime(frozenTime);
    setMode(staticMode ? 'static' : '3d');
    startedAt.current = Number.isFinite(prepaintStartedAt) ? prepaintStartedAt : performance.now();
    shouldMarkSession.current = true;
    setPhase('playing');

    // Starts before imports/textures: neither a slow network nor GPU can hold the page.
    const elapsedSinceCover = performance.now() - startedAt.current;
    const automaticExitDelay = staticMode
      ? Math.max(0, 650 - elapsedSinceCover)
      : Math.max(0, HARD_EXIT_MS - elapsedSinceCover);
    exitTimer.current =
      frozenTime === undefined
        ? setTimeout(staticMode ? complete : beginExit, automaticExitDelay)
        : undefined;
    const onVisibility = () => {
      if (frozenTime === undefined && document.visibilityState === 'hidden') dismiss();
    };
    const onMotionChange = () => {
      if (reducedMotion.matches) dismiss();
    };
    document.addEventListener('visibilitychange', onVisibility);
    reducedMotion.addEventListener('change', onMotionChange);
    return () => {
      clearTimeout(exitTimer.current);
      clearTimeout(finishTimer.current);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onMotionChange);
    };
  }, [pathname, complete, dismiss, beginExit]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!visible || !dialog) return;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // Native modal behavior contains keyboard focus while the page stays rendered.
    if (!dialog.open) dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [visible]);

  const onReady = useCallback(() => {
    if (completed.current || exiting.current) return;
    setReady(true);
    if (preview.current !== undefined) return;
    const elapsed = performance.now() - startedAt.current;
    const holdForScene = Math.max(SCENE_SHOW_MS, MIN_EXIT_MS - elapsed);
    const remainingBeforeHardExit = Math.max(0, HARD_EXIT_MS - elapsed);
    clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(beginExit, Math.min(holdForScene, remainingBeforeHardExit));
  }, [beginExit]);
  if (!visible) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-label={text.label}
      className={`${styles.intro} ${phase === 'leaving' ? styles.leaving : ''} ${mode === 'static' ? styles.static : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      data-testid="jazz-intro"
      data-scene={
        phase === 'checking' ? 'cover' : mode === 'static' ? 'static' : ready ? 'ready' : 'loading'
      }
    >
      <div className={styles.ambience} aria-hidden="true" />
      <div className={styles.swingLines} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <header className={styles.header}>
        <div className={styles.wordmark} aria-hidden="true">
          <span className={styles.mark}>
            <i />
            <i />
            <i />
            <i />
          </span>
          <span>
            JAZZFOLIO<span className={styles.edition}>STEREO · 33⅓</span>
          </span>
        </div>
        <button className={styles.skip} type="button" onClick={dismiss} autoFocus>
          {text.skip}
          <span aria-hidden="true">↗</span>
        </button>
      </header>
      <div className={styles.stage} aria-hidden="true">
        <div className={styles.floor} />
        <div className={`${styles.poster} ${ready && mode === '3d' ? styles.posterHidden : ''}`}>
          <div className={styles.posterOrbit}>
            <i />
            <i />
            <i />
          </div>
          <div className={styles.posterDeck}>
            <div className={styles.posterRecord}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/vinyl_record.webp"
                alt=""
                width="1024"
                height="1024"
                fetchPriority="high"
              />
              <span />
            </div>
            <div className={styles.posterArm}>
              <i />
            </div>
            <div className={styles.posterSwitch} />
            <div className={styles.posterBadge}>JAZZFOLIO</div>
          </div>
        </div>
        {mode === '3d' && (
          <div className={`${styles.canvas} ${ready ? styles.canvasReady : ''}`}>
            <SceneBoundary onError={failScene}>
              <TurntableScene
                previewTime={previewTime}
                onReady={onReady}
                onUnavailable={failScene}
              />
            </SceneBoundary>
          </div>
        )}
      </div>
      <div className={styles.caption}>
        <p className={styles.eyebrow}>
          SIDE A <span /> {text.session}
        </p>
        <p className={styles.title}>
          Jazzfolio<span>.</span>
        </p>
        <p className={styles.subtitle}>{text.caption}</p>
      </div>
      <div className={styles.footer} aria-hidden="true">
        <span>BLUE NOTE / OPEN FORM</span>
        <span className={styles.rule} />
        <span>33⅓ RPM</span>
      </div>
    </dialog>
  );
}
