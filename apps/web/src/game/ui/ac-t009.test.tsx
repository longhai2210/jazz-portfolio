/**
 * @jest-environment jsdom
 *
 * Tester's tests for T-009 (AC-DUEL-007.4, 013.3, 013.4, 013.8, 013.10, 013.11), written from the
 * spec. next-intl is mocked here: t(key, params) returns the key, plus the params when given.
 */
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import LaneBoard from './lanes/LaneBoard';
import Feedback from './lanes/Feedback';
import TouchPads from './input/TouchPads';
import LickBook from './lick-book/LickBook';
import { useKeyboardTaps } from './input/use-keyboard-taps';
import { createBeatClock } from '../core/clock';
import type { CallBar, Difficulty, Tap } from '../core/types';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}|${JSON.stringify(params)}` : key,
}));

const audio = { currentTime: 0.3 };
const clockOf = (difficulty: Difficulty) => createBeatClock({ t0: 0, bpm: 120, difficulty });
const note = (step: number, button: 0 | 1 | 2 | 3) => ({ step, button });
const bar = (source: CallBar['source'], ...notes: ReturnType<typeof note>[]): CallBar => ({
  source,
  notes,
});

function mockMotion(reduce: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

beforeEach(() => {
  mockMotion(false);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

function phrase() {
  return screen.queryAllByText('hud.yourPhrase');
}

describe('AC-DUEL-007.4: "Your phrase" label', () => {
  const call = [
    bar('player', note(0, 0)),
    bar('player', note(2, 1)),
    bar('composed', note(0, 2)),
    bar('composed', note(4, 3)),
  ];
  it('AC-DUEL-007.4: shows one label over exactly the player-built bars', () => {
    render(<LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="opponent" call={call} />);
    const labels = phrase();
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveAttribute('data-bars', '1 2');
  });
  it('AC-DUEL-007.4: no label when all bars are composed (fallback / match 1)', () => {
    const composed = call.map((b) => ({ ...b, source: 'composed' as const }));
    render(<LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="opponent" call={composed} />);
    expect(phrase()).toHaveLength(0);
  });
  it('AC-DUEL-007.4: separate runs get a label each; non-adjacent bars 1 and 3', () => {
    const split = [call[0], call[2], call[1], call[3]];
    render(<LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="opponent" call={split} />);
    expect(phrase().map((el) => el.getAttribute('data-bars'))).toEqual(['1', '3']);
  });
  it('AC-DUEL-007.4: no label on the player turn', () => {
    render(<LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="player" call={call} />);
    expect(phrase()).toHaveLength(0);
  });
  it('AC-DUEL-007.4: label still shows in Late Set (it is not a note marker)', () => {
    render(<LaneBoard audio={audio} clock={clockOf('lateSet')} firstBar={0} side="opponent" call={call} />);
    expect(phrase()).toHaveLength(1);
  });
  it('AC-DUEL-007.4: empty call does not crash', () => {
    render(<LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="opponent" call={[]} />);
    expect(phrase()).toHaveLength(0);
  });
});

describe('lane guides per difficulty (spec 0.4: Late Set has no markers in either turn)', () => {
  const call = [bar('composed', note(0, 0), note(4, 2)), bar('composed'), bar('composed'), bar('composed')];
  const targets = [
    { note: { bar: 0, step: 0, button: 1 as const }, state: 'pending' as const },
    { note: { bar: 1, step: 4, button: 3 as const }, state: 'hit' as const },
  ];
  const markers = (c: HTMLElement) => c.querySelectorAll('[data-marker]');
  const lines = (c: HTMLElement) => c.querySelectorAll('[data-line="beat"]');

  it.each(['lounge', 'session'] as const)('%s: opponent turn shows call markers and beat lines', (d) => {
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf(d)} firstBar={0} side="opponent" call={call} />,
    );
    expect(markers(container).length).toBe(2);
    expect(lines(container).length).toBeGreaterThan(0);
  });
  it('lounge: player turn shows hollow targets', () => {
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="player" targets={targets} />,
    );
    expect(container.querySelectorAll('[data-marker="target"]').length).toBe(2);
  });
  it('session: player turn hides targets but keeps beat lines', () => {
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf('session')} firstBar={0} side="player" targets={targets} />,
    );
    expect(container.querySelectorAll('[data-marker="target"]').length).toBe(0);
    expect(lines(container).length).toBeGreaterThan(0);
  });
  it.each(['opponent', 'player'] as const)('lateSet: %s turn shows no note markers and no beat lines', (side) => {
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf('lateSet')} firstBar={0} side={side} call={call} targets={targets} />,
    );
    expect(markers(container).length).toBe(0);
    expect(lines(container).length).toBe(0);
  });
  it("lateSet: the player's own taps are still drawn", () => {
    const taps: Tap[] = [{ time: 0.5, button: 2 }];
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf('lateSet')} firstBar={0} side="player" taps={taps} />,
    );
    expect(container.querySelectorAll('[data-marker="tap"]').length).toBe(1);
  });
  it('bar lines always show, even in Late Set', () => {
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf('lateSet')} firstBar={0} side="player" />,
    );
    expect(container.querySelectorAll('[data-line="bar"]').length).toBeGreaterThan(0);
  });
});

describe('AC-DUEL-013.11: four lanes differ in shape and color', () => {
  it('AC-DUEL-013.11: K top to D bottom, 4 distinct shapes and 4 distinct colors', () => {
    const { container } = render(
      <LaneBoard audio={audio} clock={clockOf('lounge')} firstBar={0} side="player" />,
    );
    const lanes = [...container.querySelectorAll('[data-lane]')];
    expect(lanes.map((l) => l.getAttribute('data-lane'))).toEqual(['K', 'J', 'F', 'D']);
    const svgs = lanes.map((l) => l.querySelector('svg') as SVGElement);
    const shapes = svgs.map((s) => s.getAttribute('data-shape'));
    const colors = svgs.map((s) => s.getAttribute('data-color'));
    expect(new Set(shapes).size).toBe(4);
    expect(new Set(colors).size).toBe(4);
  });
  it('AC-DUEL-013.11: markers use their lane shape', () => {
    const { container } = render(
      <LaneBoard
        audio={audio}
        clock={clockOf('lounge')}
        firstBar={0}
        side="opponent"
        call={[bar('composed', note(0, 3), note(2, 0)), bar('composed'), bar('composed'), bar('composed')]}
      />,
    );
    const shapeIn = (key: string) =>
      container.querySelector(`[data-lane="${key}"] [data-marker] svg`)?.getAttribute('data-shape');
    expect(shapeIn('K')).toBe('triangle');
    expect(shapeIn('D')).toBe('circle');
  });
  it('AC-DUEL-013.11: pads show the same four distinct shapes', () => {
    const { container } = render(<TouchPads clock={audio} onTap={() => undefined} />);
    const shapes = [...container.querySelectorAll('button svg')].map((s) => s.getAttribute('data-shape'));
    expect(new Set(shapes).size).toBe(4);
  });
});

describe('AC-DUEL-013.4: touch pads', () => {
  beforeAll(() => {
    if (!('PointerEvent' in window)) {
      class PE extends MouseEvent {
        pointerId = 1;
        pointerType = 'touch';
      }
      Object.defineProperty(window, 'PointerEvent', { configurable: true, writable: true, value: PE });
    }
  });
  const pads = () => screen.getAllByRole('button');

  it('AC-DUEL-013.4: four pads in order D F J K, each tap fires onTap with its button', () => {
    const onTap = jest.fn();
    render(<TouchPads clock={audio} onTap={onTap} />);
    expect(pads()).toHaveLength(4);
    pads().forEach((p) => fireEvent.pointerDown(p, { button: 0 }));
    expect(onTap.mock.calls.map((c) => (c[0] as Tap).button)).toEqual([0, 1, 2, 3]);
    expect((onTap.mock.calls[0][0] as Tap).time).toBeCloseTo(0.3, 1);
  });
  it('AC-DUEL-013.4: pad has an accessible name and fires on pointer down, not click', () => {
    const onTap = jest.fn();
    render(<TouchPads clock={audio} onTap={onTap} />);
    expect(screen.getByRole('button', { name: 'pad.k' })).toBeInTheDocument();
    fireEvent.click(pads()[0]);
    expect(onTap).not.toHaveBeenCalled();
    fireEvent.pointerDown(pads()[0], { button: 0 });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
  it('AC-DUEL-013.4: two quick taps on one pad are two taps', () => {
    const onTap = jest.fn();
    render(<TouchPads clock={audio} onTap={onTap} />);
    for (let i = 0; i < 2; i++) {
      fireEvent.pointerDown(pads()[1], { button: 0 });
      fireEvent.pointerUp(pads()[1], { button: 0 });
    }
    expect(onTap).toHaveBeenCalledTimes(2);
  });
  it('AC-DUEL-013.4: right mouse button is no tap; disabled pads do nothing', () => {
    const onTap = jest.fn();
    const { rerender } = render(<TouchPads clock={audio} onTap={onTap} />);
    fireEvent.pointerDown(pads()[0], { button: 2 });
    expect(onTap).not.toHaveBeenCalled();
    rerender(<TouchPads clock={audio} onTap={onTap} disabled />);
    fireEvent.pointerDown(pads()[0], { button: 0 });
    expect(onTap).not.toHaveBeenCalled();
  });
  it('AC-DUEL-013.4: a pad shows pressed while held and clears on release', () => {
    render(<TouchPads clock={audio} onTap={() => undefined} />);
    fireEvent.pointerDown(pads()[2], { button: 0 });
    expect(pads()[2]).toHaveAttribute('data-pressed', 'true');
    fireEvent.pointerUp(pads()[2]);
    expect(pads()[2]).toHaveAttribute('data-pressed', 'false');
  });
});

describe('AC-DUEL-013.3: keyboard taps', () => {
  const setup = (enabled = true) => {
    const onTap = jest.fn();
    const hook = renderHook(({ en }) => useKeyboardTaps({ clock: audio, onTap, enabled: en }), {
      initialProps: { en: enabled },
    });
    return { onTap, ...hook };
  };
  const press = (
    code: string,
    key: string,
    init: KeyboardEventInit = {},
    target: Element | Window = window,
  ) =>
    act(() => {
      fireEvent.keyDown(target, { code, key, ...init });
    });

  it('AC-DUEL-013.3: D F J K each make one tap of the matching button', () => {
    const { onTap } = setup();
    press('KeyD', 'd');
    press('KeyF', 'f');
    press('KeyJ', 'j');
    press('KeyK', 'k');
    expect(onTap.mock.calls.map((c) => (c[0] as Tap).button)).toEqual([0, 1, 2, 3]);
  });
  it('AC-DUEL-013.3: key repeat adds no tap', () => {
    const { onTap } = setup();
    press('KeyD', 'd');
    press('KeyD', 'd', { repeat: true });
    press('KeyD', 'd', { repeat: true });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
  it('AC-DUEL-013.3: after release a new press is a new tap', () => {
    const { onTap } = setup();
    press('KeyJ', 'j');
    act(() => {
      fireEvent.keyUp(window, { code: 'KeyJ', key: 'j' });
    });
    press('KeyJ', 'j');
    expect(onTap).toHaveBeenCalledTimes(2);
  });
  it('AC-DUEL-013.3: uppercase key still taps; other keys and Ctrl+F do not', () => {
    const { onTap } = setup();
    press('KeyF', 'F');
    expect(onTap).toHaveBeenCalledTimes(1);
    press('KeyA', 'a');
    press('Space', ' ');
    press('KeyF', 'f', { ctrlKey: true });
    expect(onTap).toHaveBeenCalledTimes(1);
  });
  it('AC-DUEL-013.3: typing in an input is no tap', () => {
    const { onTap } = setup();
    const input = document.createElement('input');
    document.body.appendChild(input);
    press('KeyD', 'd', {}, input);
    input.remove();
    expect(onTap).not.toHaveBeenCalled();
  });
  it('AC-DUEL-013.3: nothing happens when disabled, and listeners are removed on unmount', () => {
    const off = setup(false);
    press('KeyD', 'd');
    expect(off.onTap).not.toHaveBeenCalled();
    const on = setup(true);
    on.unmount();
    press('KeyD', 'd');
    expect(on.onTap).not.toHaveBeenCalled();
  });
  it('AC-DUEL-013.3: reports held buttons and clears them on release', () => {
    const { result } = setup();
    press('KeyK', 'k');
    expect(result.current).toEqual([3]);
    act(() => {
      fireEvent.keyUp(window, { code: 'KeyK', key: 'k' });
    });
    expect(result.current).toEqual([]);
  });
});

describe('AC-DUEL-013.8: lick book', () => {
  it('AC-DUEL-013.8: three licks, each a row of 8 dots with the right filled positions', () => {
    const { container } = render(<LickBook />);
    const rows = container.querySelectorAll('[data-lick]');
    expect([...rows].map((r) => r.getAttribute('data-lick'))).toEqual(['duck', 'frog', 'windChime']);
    const on = (id: string) =>
      [...container.querySelectorAll(`[data-lick="${id}"] [data-step]`)]
        .filter((d) => d.getAttribute('data-on') === 'true')
        .map((d) => Number(d.getAttribute('data-step')));
    rows.forEach((r) => expect(r.querySelectorAll('[data-step]')).toHaveLength(8));
    expect(on('duck')).toEqual([2, 3, 6]);
    expect(on('frog')).toEqual([0, 3, 5]);
    expect(on('windChime')).toEqual([1, 4, 6, 7]);
  });
  it('AC-DUEL-013.8: off-beat (odd) positions are marked, on-beat are not', () => {
    const { container } = render(<LickBook />);
    container.querySelectorAll('[data-step]').forEach((d) => {
      expect(d.getAttribute('data-offbeat')).toBe(String(Number(d.getAttribute('data-step')) % 2 === 1));
    });
  });
  it('AC-DUEL-013.8: nothing is lit by default', () => {
    const { container } = render(<LickBook />);
    expect(container.querySelectorAll('[data-lit="true"]')).toHaveLength(0);
    expect(screen.queryByText('lickBook.justQuoted')).toBeNull();
  });
  it.each(['duck', 'frog', 'windChime'] as const)('AC-DUEL-013.8: %s lights up alone when just quoted', (id) => {
    const { container } = render(<LickBook justQuoted={id} />);
    const lit = container.querySelectorAll('[data-lit="true"]');
    expect(lit).toHaveLength(1);
    expect(lit[0].getAttribute('data-lick')).toBe(id);
    expect(screen.getByText('lickBook.justQuoted')).toBeInTheDocument();
  });
  it('AC-DUEL-013.8: clearing justQuoted unlights it', () => {
    const { container, rerender } = render(<LickBook justQuoted="frog" />);
    rerender(<LickBook justQuoted={null} />);
    expect(container.querySelectorAll('[data-lit="true"]')).toHaveLength(0);
  });
});

describe('AC-DUEL-013.10: reduced motion', () => {
  const MOTION = /animate|pulse|shake|blink|flash|bounce|ping|spin/;
  const motionClasses = (root: Element) =>
    [root, ...root.querySelectorAll('*')].flatMap((el) =>
      (el.getAttribute('class') ?? '').split(/\s+/).filter((c) => MOTION.test(c)),
    );
  const ui = (): ReactNode => (
    <>
      <LaneBoard
        audio={audio}
        clock={clockOf('lounge')}
        firstBar={0}
        side="player"
        targets={[{ note: { bar: 0, step: 0, button: 0 }, state: 'hit' }]}
        feedback={{ kind: 'grade', grade: 'perfect' }}
      />
      <LickBook justQuoted="duck" />
      <Feedback event={{ kind: 'quote', lickId: 'duck' }} />
      <TouchPads clock={audio} onTap={() => undefined} />
    </>
  );
  it.each([true, false])('AC-DUEL-013.10: no motion classes on Perfect / quote feedback (reduce=%s)', (reduce) => {
    mockMotion(reduce);
    const { container } = render(<>{ui()}</>);
    expect(motionClasses(container)).toEqual([]);
  });
  it('AC-DUEL-013.10: with reduced motion, feedback/lick/markers carry transition none', () => {
    mockMotion(true);
    const { container } = render(<>{ui()}</>);
    screen.getAllByTestId('duel-feedback').forEach((f) => {
      expect(f).toHaveAttribute('data-reduced-motion', 'true');
      expect((f as HTMLElement).style.transition).toBe('none');
    });
    expect((container.querySelector('[data-lit="true"]') as HTMLElement).style.transition).toBe('none');
    container
      .querySelectorAll('[data-marker]')
      .forEach((m) => expect((m as HTMLElement).style.transition).toBe('none'));
  });
  it('AC-DUEL-013.10: feedback is text only: grade words change the text', () => {
    mockMotion(true);
    const { rerender } = render(<Feedback event={{ kind: 'grade', grade: 'perfect' }} />);
    expect(screen.getByText('feedback.perfect')).toBeInTheDocument();
    rerender(<Feedback event={{ kind: 'grade', grade: 'miss' }} />);
    expect(screen.getAllByText('feedback.miss').length).toBeGreaterThan(0);
    rerender(<Feedback event={{ kind: 'extra' }} />);
    expect(screen.getByText('feedback.extra')).toBeInTheDocument();
    rerender(<Feedback event={null} />);
    expect(screen.queryByText('feedback.perfect')).toBeNull();
  });
  it('AC-DUEL-013.10: only quotes and misses are announced to screen readers', () => {
    const live = () => document.querySelector('[aria-live="polite"]')?.textContent;
    const { rerender } = render(<Feedback event={{ kind: 'grade', grade: 'perfect' }} />);
    expect(live()).toBe('');
    rerender(<Feedback event={{ kind: 'grade', grade: 'miss' }} />);
    expect(live()).toContain('feedback.miss');
    rerender(<Feedback event={{ kind: 'quote', lickId: 'frog' }} />);
    expect(live()).toContain('feedback.quote');
  });
});

describe('playhead', () => {
  it('follows the audio clock via requestAnimationFrame and cancels on unmount', () => {
    let cb: FrameRequestCallback = () => undefined;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => {
      cb = f;
      return 7;
    });
    const cancel = jest.spyOn(window, 'cancelAnimationFrame');
    const a = { currentTime: 0 };
    const { unmount } = render(<LaneBoard audio={a} clock={clockOf('lounge')} firstBar={0} side="player" />);
    const head = screen.getByTestId('playhead');
    const x0 = parseFloat(head.style.left);
    a.currentTime = 4; // 120 bpm: bar 2 s, phase 8 s -> halfway
    act(() => cb(0));
    expect(parseFloat(head.style.left)).toBeGreaterThan(x0);
    expect(parseFloat(head.style.left)).toBeCloseTo(50, 0);
    a.currentTime = 100;
    act(() => cb(0));
    expect(parseFloat(head.style.left)).toBeLessThanOrEqual(100);
    unmount();
    expect(cancel).toHaveBeenCalled();
  });
});
