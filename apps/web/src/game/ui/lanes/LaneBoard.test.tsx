/**
 * @jest-environment jsdom
 */
import { act, render, screen } from '@testing-library/react';
import { createBeatClock } from '../../core/clock';
import type { BarNote, CallBar, CallBarSource, Difficulty } from '../../core/types';
import TouchPads from '../input/TouchPads';
import LaneBoard, { type LaneBoardProps } from './LaneBoard';
import { setFakeLocale } from './testing/intl';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);

/** One note on each button, so every lane has a marker. */
const ALL_BUTTONS: readonly BarNote[] = [
  { step: 0, button: 0 },
  { step: 2, button: 1 },
  { step: 4, button: 2 },
  { step: 6, button: 3 },
];

function callBar(source: CallBarSource, notes: readonly BarNote[] = ALL_BUTTONS): CallBar {
  return { source, notes };
}

function clockAt(difficulty: Difficulty) {
  // 120 BPM: a beat is 0.5 s and a bar 2 s.
  return createBeatClock({ t0: 0, bpm: 120, difficulty });
}

function renderBoard(props: Partial<LaneBoardProps> = {}) {
  const audio = { currentTime: 0 };
  const view = render(
    <LaneBoard audio={audio} clock={clockAt('session')} firstBar={0} side="opponent" {...props} />,
  );
  return { audio, ...view };
}

function lane(key: string): HTMLElement {
  return screen.getByTestId(`lane-track-${key}`);
}

afterEach(() => {
  setFakeLocale('en');
  jest.useRealTimers();
});

describe('LaneBoard', () => {
  it('AC-DUEL-007.4: shows "Câu của bạn" over exactly the bars of the opponent Solo built from the player phrase', () => {
    setFakeLocale('vi');
    renderBoard({
      side: 'opponent',
      call: [callBar('player'), callBar('player'), callBar('composed'), callBar('composed')],
    });

    const labels = screen.getAllByText('Câu của bạn');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveAttribute('data-bars', '1 2');
    expect(screen.getByTestId('phrase-row')).toContainElement(labels[0]);
  });

  it('AC-DUEL-007.4: shows no label when every bar is composed, or on the player side', () => {
    const { rerender, audio } = renderBoard({
      side: 'opponent',
      call: [callBar('composed'), callBar('composed'), callBar('composed'), callBar('composed')],
    });
    expect(screen.queryByText('Your phrase')).not.toBeInTheDocument();

    rerender(
      <LaneBoard
        audio={audio}
        clock={clockAt('session')}
        firstBar={4}
        side="player"
        call={[callBar('player'), callBar('player'), callBar('composed'), callBar('composed')]}
      />,
    );
    expect(screen.queryByText('Your phrase')).not.toBeInTheDocument();
  });

  it('AC-DUEL-007.4: labels each separate run of player bars, at every difficulty', () => {
    renderBoard({
      clock: clockAt('lateSet'),
      call: [callBar('composed'), callBar('player'), callBar('composed'), callBar('player')],
    });
    const labels = screen.getAllByText('Your phrase');
    expect(labels.map((label) => label.getAttribute('data-bars'))).toEqual(['2', '4']);
  });

  it('AC-DUEL-013.11: the 4 lanes differ in shape and color, and the lane shape is the same on key, marker and pad', () => {
    renderBoard({
      clock: clockAt('lounge'),
      side: 'opponent',
      call: [callBar('composed'), callBar('composed'), callBar('composed'), callBar('composed')],
    });
    render(<TouchPads clock={{ currentTime: 0 }} onTap={() => undefined} />);

    const lanes = Array.from(document.querySelectorAll<HTMLElement>('[data-lane]'));
    expect(lanes.map((element) => element.dataset.lane)).toEqual(['K', 'J', 'F', 'D']);

    const keyGlyphs = lanes.map((element) => {
      const key = element.dataset.lane ?? '';
      const glyph = screen.getByTestId(`lane-key-${key}`).querySelector('svg');
      if (!glyph) throw new Error(`lane ${key} has no key glyph`);
      return {
        key,
        shape: glyph.dataset.shape,
        color: glyph.dataset.color,
        paint: glyph.innerHTML,
      };
    });
    expect(new Set(keyGlyphs.map((glyph) => glyph.shape)).size).toBe(4);
    expect(new Set(keyGlyphs.map((glyph) => glyph.color)).size).toBe(4);
    expect(new Set(keyGlyphs.map((glyph) => glyph.paint)).size).toBe(4);

    for (const { key, shape, color } of keyGlyphs) {
      const markers = lane(key).querySelectorAll('[data-marker] svg');
      expect(markers.length).toBeGreaterThan(0);
      markers.forEach((marker) => {
        expect(marker).toHaveAttribute('data-shape', shape);
        expect(marker).toHaveAttribute('data-color', color);
      });

      const pad = document.querySelector(`[data-testid="touch-pads"] [data-button="${key}"] svg`);
      expect(pad).toHaveAttribute('data-shape', shape);
      expect(pad).toHaveAttribute('data-color', color);
    }
  });

  it('redraws the playhead from the audio clock on every animation frame', () => {
    jest.useFakeTimers();
    // Phase of bars 1 to 4 starts at 2 s and lasts 8 s.
    const { audio, unmount } = renderBoard({ firstBar: 1, side: 'player' });
    const playhead = screen.getByTestId('playhead');
    expect(playhead.style.left).toBe('0%');
    expect(document.querySelector('[data-current="true"]')).toBeNull();

    audio.currentTime = 4;
    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(playhead.style.left).toBe('25%');
    expect(screen.getByText('Bar 2')).toHaveAttribute('data-current', 'true');

    audio.currentTime = 9;
    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(playhead.style.left).toBe('87.5%');
    expect(screen.getByText('Bar 4')).toHaveAttribute('data-current', 'true');
    expect(screen.getByText('Bar 2')).toHaveAttribute('data-current', 'false');

    audio.currentTime = 12;
    act(() => {
      jest.advanceTimersByTime(20);
    });
    expect(playhead.style.left).toBe('100%');

    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('places markers on the beat they sound on, so the playhead crosses them on time', () => {
    renderBoard({
      clock: clockAt('lounge'),
      firstBar: 2,
      side: 'opponent',
      call: [
        callBar('composed', [{ step: 4, button: 2 }]),
        callBar('composed', [{ step: 1, button: 0 }]),
      ],
    });
    const diamond = lane('J').querySelector<HTMLElement>('[data-marker="call"]');
    const circle = lane('D').querySelector<HTMLElement>('[data-marker="call"]');
    // Bar 2 step 4 is beat 2 of 16; bar 3 step 1 is beat 4.5 of 16.
    expect(diamond?.style.left).toBe('12.5%');
    expect(circle?.style.left).toBe(`${(4.5 / 16) * 100}%`);
  });

  it('Lounge: the player side shows hollow targets, an amber ring when hit and a dimmed marker when missed', () => {
    renderBoard({
      clock: clockAt('lounge'),
      firstBar: 4,
      side: 'player',
      targets: [
        { note: { bar: 4, step: 0, button: 1 }, state: 'hit' },
        { note: { bar: 4, step: 4, button: 1 }, state: 'miss' },
        { note: { bar: 5, step: 0, button: 3 }, state: 'pending' },
      ],
    });
    const targets = lane('F').querySelectorAll<HTMLElement>('[data-marker="target"]');
    expect(targets).toHaveLength(2);
    expect(targets[0]).toHaveAttribute('data-state', 'hit');
    expect(targets[0].className).toContain('ring-jazz-amber');
    expect(targets[1]).toHaveAttribute('data-state', 'miss');
    expect(targets[1].className).toContain('opacity-35');
    expect(targets[0].querySelector('svg')).toHaveAttribute('data-variant', 'hollow');
    expect(lane('K').querySelector('[data-marker="target"]')).toHaveAttribute(
      'data-state',
      'pending',
    );
    expect(lane('F').className).toContain('border-jazz-gold');
  });

  it('Session: the player side has beat lines but no target markers; the opponent side shows its notes', () => {
    const targets = [{ note: { bar: 0, step: 0, button: 0 as const }, state: 'pending' as const }];
    const { rerender, audio } = renderBoard({ side: 'player', targets });
    expect(document.querySelectorAll('[data-marker]')).toHaveLength(0);
    expect(lane('D').querySelectorAll('[data-line="beat"]')).toHaveLength(12);

    rerender(
      <LaneBoard
        audio={audio}
        clock={clockAt('session')}
        firstBar={0}
        side="opponent"
        call={[callBar('composed')]}
      />,
    );
    expect(document.querySelectorAll('[data-marker="call"]')).toHaveLength(4);
    expect(lane('D').className).toContain('opacity-75');
  });

  it('Late Set: no note markers and no beat lines on either side, but bar lines and the player taps stay', () => {
    const clock = clockAt('lateSet');
    const { rerender, audio } = renderBoard({
      clock,
      side: 'opponent',
      call: [callBar('player'), callBar('player'), callBar('composed'), callBar('composed')],
    });
    expect(document.querySelectorAll('[data-marker]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-line="beat"]')).toHaveLength(0);
    expect(lane('K').querySelectorAll('[data-line="bar"]')).toHaveLength(3);

    rerender(
      <LaneBoard
        audio={audio}
        clock={clock}
        firstBar={0}
        side="player"
        targets={[{ note: { bar: 0, step: 1, button: 2 }, state: 'pending' }]}
        // 52 ms late on the raw clock, 52 ms offset: drawn on bar 0 step 2 (beat 1).
        taps={[{ time: 0.5 + 0.052, button: 2 }]}
        offsetMs={52}
      />,
    );
    expect(document.querySelectorAll('[data-marker="target"]')).toHaveLength(0);
    const tap = lane('J').querySelector<HTMLElement>('[data-marker="tap"]');
    expect(parseFloat(tap?.style.left ?? '')).toBeCloseTo(6.25, 9);
    expect(tap?.querySelector('svg')).toHaveAttribute('data-variant', 'filled');
  });

  it('draws only the taps that fall on the 4 bars on screen', () => {
    renderBoard({
      firstBar: 1,
      side: 'player',
      taps: [
        { time: 1, button: 0 },
        { time: 2.01, button: 0 },
        { time: 9.99, button: 0 },
        { time: 10.5, button: 0 },
      ],
    });
    expect(lane('D').querySelectorAll('[data-marker="tap"]')).toHaveLength(2);
  });

  it('compact layout keeps the shapes but drops the key letters and the bar header', () => {
    renderBoard({ compact: true });
    expect(screen.queryByText('Bar 1')).not.toBeInTheDocument();
    expect(screen.getByTestId('lane-key-K').textContent).toBe('');
    expect(screen.getByTestId('lane-key-K').querySelector('svg')).toHaveAttribute(
      'data-shape',
      'triangle',
    );
  });
});
