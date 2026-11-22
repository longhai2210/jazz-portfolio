/**
 * @jest-environment jsdom
 */
// The duel screens inside the 3D stage (game-stage design.md sections 2 and 4, decision 7): over a
// scene, the text sits on solid strips at the top, the lanes and pads on a near-solid block at the
// bottom, and a free window between them shows the scene, the window the club camera frames both
// characters into (scenes/ClubScene.test.tsx proves the camera half). With a note, the note
// follows the top bar in the page flow, and on a phone held sideways the board fits the screen.
// Without the stage props, the screens are the game-duel screens.
import { act, cleanup, render, screen } from '@testing-library/react';
import { createGameAudio, type GameAudio } from '../../audio';
import { createManualTimer, FakeAudioContext } from '../../audio/testing/fake-audio-context';
import { createDuelSession } from '../../core/campaign';
import { useGameStore } from '@/stores/gameStore';
import DuelGame, { type DuelGameProps } from '../DuelGame';
import { installPointerEvent } from '../lanes/testing/pointer-event';
import { playTake } from './testing/duel-results';
import { setFakeLocale } from './testing/intl';
import { navigations } from './testing/link';
import { useStageLayout } from './ui';
import { COMPACT_QUERY, PORTRAIT_PHONE_QUERY } from './use-media-query';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./testing/link')>('./testing/link'),
);

let restorePointerEvent: () => void = () => undefined;

beforeEach(() => {
  jest.useFakeTimers();
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  cleanup();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'matchMedia');
  restorePointerEvent();
  jest.useRealTimers();
});

/** A phone held sideways: only the compact query of the duel matches. */
function holdPhoneSideways(): void {
  stubMedia(COMPACT_QUERY);
}

/** A phone held upright: only the portrait query of the duel matches. */
function holdPhoneUpright(): void {
  stubMedia(PORTRAIT_PHONE_QUERY);
}

/** A `matchMedia` where only `matching` matches. */
function stubMedia(matching: string): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: query === matching,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

function runningAudio(): GameAudio {
  const context = new FakeAudioContext();
  context.state = 'running';
  return createGameAudio(context, { timer: createManualTimer() });
}

/** What the scene behind the board was handed: the window it frames the characters into. */
let seenWindow: HTMLElement | null = null;

/** A stand-in for the 3D club: it reads the stage layout as the real scene does. */
function SceneProbe() {
  seenWindow = useStageLayout()?.sceneWindow ?? null;
  return <div data-testid="scene" />;
}

async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}

/** The duel board of a take, on an audio already unlocked. */
async function renderBoard(props: DuelGameProps): Promise<void> {
  render(<DuelGame audio={runningAudio()} difficulty="session" offsetMs={0} {...props} />);
  await settle();
  expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
}

function byTestId(id: string): HTMLElement {
  return screen.getByTestId(id);
}

/** `first` comes before `second` in the page. */
function expectBefore(first: Element, second: Element): void {
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

/** The page of the duel; fails the test when it is not on screen. */
function duelPage(): HTMLElement {
  const found = document.querySelector<HTMLElement>('[data-duel-game]');
  if (found === null) throw new Error('DuelGame is not on screen');
  return found;
}

function header(): HTMLElement {
  const found = byTestId('duel-board').querySelector('header');
  if (found === null) throw new Error('the board has no top bar');
  return found;
}

/** The outline chips (round tabs, difficulty, BPM): not the count-in dots, which carry no text. */
const CHIP_OFF = 'span[data-on="false"].uppercase';

/** A background that keeps text readable: a token at 85% or more, never a see-through one. */
const SOLID_BACKGROUND = /(^|\s)bg-jazz-(dark|black|charcoal|slate|indigo|blue|gold)(\/(85|90))?(\s|$)/;

/**
 * Every visible text inside `root` has an ancestor with a solid background before it reaches the
 * page of the duel, which is see-through over the scene. Text read only by screen readers is left
 * out: it is never drawn.
 */
function expectNoTextOnTheScene(root: HTMLElement): void {
  const page = document.querySelector('[data-duel-game]');
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let checked = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    const parent = node.parentElement;
    if (text === '' || parent === null) continue;
    if (parent.closest('.sr-only, style') !== null) continue;
    let solid: Element | null = null;
    for (let at: Element | null = parent; at !== null && at !== page; at = at.parentElement) {
      if (SOLID_BACKGROUND.test(at.getAttribute('class') ?? '')) {
        solid = at;
        break;
      }
    }
    if (solid === null) throw new Error(`"${text}" sits directly on the scene`);
    checked += 1;
  }
  expect(checked).toBeGreaterThan(0);
}

describe('the duel board over a 3D scene (design.md section 4)', () => {
  it('on a computer: solid top bar and HUD strip, then the scene window, then lanes and pads at the bottom, beside the lick book', async () => {
    await renderBoard({ backdrop: <SceneProbe /> });

    const board = byTestId('duel-screen');
    // Exactly the screen's height, so the lanes sit at the bottom of the screen.
    expect(board).toHaveClass('h-dvh');
    expect(board).toHaveAttribute('data-layout', 'stage');

    const hud = byTestId('duel-hud');
    const sceneWindow = byTestId('scene-window');
    const lanes = byTestId('duel-lanes');
    const pads = byTestId('duel-pads');
    expectBefore(header(), hud);
    expectBefore(hud, sceneWindow);
    expectBefore(sceneWindow, lanes);
    expectBefore(lanes, pads);

    expect(header()).toHaveClass('bg-jazz-dark/90', 'border-jazz-slate');
    expect(hud).toHaveClass('bg-jazz-dark/90', 'border-jazz-slate', 'border-b');
    expect(hud).toContainElement(byTestId('hud-who'));
    // The free band: it takes whatever height is left, and holds nothing.
    expect(sceneWindow).toHaveClass('flex-1', 'min-h-0');
    expect(sceneWindow).toHaveAttribute('aria-hidden', 'true');
    expect(sceneWindow).toBeEmptyDOMElement();
    expect(lanes).toHaveClass('bg-jazz-black/85', 'border-t', 'border-jazz-slate');
    expect(lanes).toContainElement(byTestId('lane-board'));
    expect(pads).toHaveClass('bg-jazz-black/85');
    expect(pads).toContainElement(byTestId('touch-pads'));
    // The lick book is a solid column on the right, beside the window, never over it.
    const lickBook = byTestId('lick-book');
    expect(lickBook).toHaveClass('w-[190px]', 'bg-jazz-black');
    expect(lickBook.parentElement).toBe(sceneWindow.parentElement?.parentElement);
  });

  it('hands the scene window to the scene behind the board, which frames the characters into it (decision 7)', async () => {
    seenWindow = null;
    await renderBoard({ backdrop: <SceneProbe /> });
    expect(seenWindow).toBe(byTestId('scene-window'));
  });

  it('on a phone held sideways: the HUD joins the solid top bar, and the scene window and the pads share the room above and below the lanes', async () => {
    holdPhoneSideways();
    await renderBoard({ backdrop: <SceneProbe /> });

    expect(byTestId('duel-screen')).toHaveClass('h-dvh');
    expect(header()).toHaveClass('bg-jazz-dark/90');
    expect(header()).toContainElement(byTestId('hud-who'));
    expect(screen.queryByTestId('duel-hud')).not.toBeInTheDocument();
    const sceneWindow = byTestId('scene-window');
    expectBefore(header(), sceneWindow);
    expectBefore(sceneWindow, byTestId('duel-lanes'));
    expectBefore(byTestId('duel-lanes'), byTestId('duel-pads'));
    expect(sceneWindow).toHaveClass('flex-1', 'min-h-0');
    // The pads stay on screen: they flex with the window but never below a 64 px row.
    expect(byTestId('duel-pads')).toHaveClass('flex-1', 'min-h-16');
  });

  it('no text sits directly on the scene, on the board, on the setup panels or on the result', async () => {
    await renderBoard({ backdrop: <SceneProbe /> });
    expectNoTextOnTheScene(byTestId('duel-screen'));
    cleanup();
    useGameStore.getState().reset();

    holdPhoneSideways();
    await renderBoard({ backdrop: <SceneProbe /> });
    expectNoTextOnTheScene(byTestId('duel-screen'));
    const campaign = useGameStore.getState().campaign;
    if (campaign === null) throw new Error('no run');
    act(() => useGameStore.getState().finishMatch(playTake(createDuelSession(campaign), { win: true })));
    expectNoTextOnTheScene(duelPage());
    cleanup();
    useGameStore.getState().reset();

    render(<DuelGame audio={runningAudio()} backdrop={<SceneProbe />} />);
    await settle();
    expect(screen.getByRole('heading', { name: 'Choose your difficulty' })).toBeInTheDocument();
    expectNoTextOnTheScene(duelPage());
  });

  it('a phone held upright gets the rotate hint on a solid page over the scene, never on the scene', async () => {
    holdPhoneUpright();
    render(
      <DuelGame
        audio={runningAudio()}
        difficulty="session"
        offsetMs={0}
        backdrop={<SceneProbe />}
        note={<p>No stage here.</p>}
      />,
    );
    await settle();

    const hint = byTestId('rotate-hint');
    expect(screen.getByRole('status')).toHaveTextContent('Turn your phone sideways to play');
    const cover = byTestId('rotate-cover');
    expect(cover).toContainElement(hint);
    expect(cover).toHaveClass('fixed', 'inset-0', 'bg-jazz-black');
    expectNoTextOnTheScene(duelPage());
  });

  it('without a scene the rotate hint is the game-duel hint, with no cover', async () => {
    holdPhoneUpright();
    render(<DuelGame audio={runningAudio()} difficulty="session" offsetMs={0} />);
    await settle();
    expect(byTestId('rotate-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('rotate-cover')).not.toBeInTheDocument();
  });

  it('panels are 90% solid over the scene and outline chips get a solid fill; without a scene both are as in game-duel', async () => {
    render(<DuelGame audio={runningAudio()} backdrop={<SceneProbe />} />);
    await settle();
    const panel = screen.getByRole('heading', { name: 'Choose your difficulty' }).closest('section');
    expect(panel).toHaveClass('bg-jazz-dark/90');
    cleanup();
    useGameStore.getState().reset();

    await renderBoard({ backdrop: <SceneProbe /> });
    expect(byTestId('duel-board').querySelectorAll(CHIP_OFF).length).toBeGreaterThan(0);
    for (const chip of byTestId('duel-board').querySelectorAll(CHIP_OFF)) {
      expect(chip).toHaveClass('bg-jazz-dark');
    }
    cleanup();
    useGameStore.getState().reset();

    render(<DuelGame />);
    expect(screen.getByRole('heading', { name: 'Midnight Session' }).closest('section')).toHaveClass(
      'bg-jazz-dark',
    );
    cleanup();
    useGameStore.getState().reset();
    await renderBoard({});
    expect(byTestId('duel-board').querySelectorAll(CHIP_OFF).length).toBeGreaterThan(0);
    for (const chip of byTestId('duel-board').querySelectorAll(CHIP_OFF)) {
      expect(chip).not.toHaveClass('bg-jazz-dark');
    }
  });
});

describe('the duel board with a stage note and no scene (design.md section 2)', () => {
  it('on a phone held sideways the board fits the screen: the note follows the top bar and the pads take the rest', async () => {
    holdPhoneSideways();
    await renderBoard({ note: <p data-testid="note">No stage here.</p> });

    expect(byTestId('duel-screen')).toHaveClass('h-dvh');
    const note = byTestId('duel-note');
    expect(note.previousElementSibling).toBe(header());
    expect(note).toContainElement(byTestId('note'));
    expectBefore(note, byTestId('duel-lanes'));
    // The HUD rides in the top bar, so the note costs the pads room, never the page height.
    expect(header()).toContainElement(byTestId('hud-who'));
    expect(screen.queryByTestId('scene-window')).not.toBeInTheDocument();
    expect(byTestId('duel-pads')).toHaveClass('flex-1', 'min-h-16');
    // No scene: no see-through strips.
    expect(header()).not.toHaveClass('bg-jazz-dark/90');
  });

  it('on a computer the board is the game-duel board, with the note under its top bar', async () => {
    await renderBoard({ note: <p data-testid="note">No stage here.</p> });
    expect(byTestId('duel-screen')).not.toHaveAttribute('data-layout');
    expect(byTestId('duel-note').previousElementSibling).toBe(header());
    expectBefore(byTestId('duel-note'), byTestId('hud-who'));
  });
});

describe('the duel board without the stage props', () => {
  it.each([
    ['a computer', false],
    ['a phone held sideways', true],
  ])('on %s it is the game-duel board, unchanged', async (_name, sideways) => {
    if (sideways) holdPhoneSideways();
    await renderBoard({});
    const board = byTestId('duel-screen');
    expect(board).toHaveClass('relative', 'flex', 'min-h-full', 'flex-1', 'flex-col');
    expect(board).not.toHaveAttribute('data-layout');
    expect(header()).toHaveClass(
      'flex items-center justify-between gap-3 border-b border-jazz-slate px-4 py-2.5 text-[13px]',
      { exact: true },
    );
    expect(screen.queryByTestId('scene-window')).not.toBeInTheDocument();
    expect(screen.queryByTestId('duel-note')).not.toBeInTheDocument();
    expect(header()).not.toContainElement(byTestId('hud-who'));
  });
});
