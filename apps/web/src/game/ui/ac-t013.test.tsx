/**
 * @jest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  createFakeAudioScope,
  type FakeAudioContext,
  type ResumeBehaviour,
} from '../audio/testing/fake-audio-context';
import { useGameStore } from '@/stores/gameStore';
import DuelGame from './DuelGame';
import { installPointerEvent } from './lanes/testing/pointer-event';
import { setFakeLocale } from './screens/testing/intl';
import { navigations } from './screens/testing/link';

jest.mock(
  'next-intl',
  () =>
    jest.requireActual<typeof import('./screens/testing/intl')>('./screens/testing/intl')
      .nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./screens/testing/link')>('./screens/testing/link'),
);

const MESSAGES = {
  en: {
    play: 'Play',
    retry: 'Try again',
    blocked: 'The browser did not start the sound. Press Try again to turn it on.',
    error: 'Something went wrong while starting the match.',
  },
  vi: {
    play: 'Chơi',
    retry: 'Thử lại',
    blocked: 'Trình duyệt chưa bật âm thanh. Bấm Thử lại để bật.',
    error: 'Có lỗi khi bắt đầu trận.',
  },
} as const;

let contexts: FakeAudioContext[] = [];
let restorePointerEvent: () => void = () => undefined;
const unhandled: unknown[] = [];
const onUnhandled = (reason: unknown): void => {
  unhandled.push(reason);
};

function installAudio(setup?: (context: FakeAudioContext, index: number) => void): void {
  let created = 0;
  const fake = createFakeAudioScope({
    setup: (context) => {
      setup?.(context, created);
      created += 1;
    },
  });
  contexts = fake.contexts;
  Object.defineProperty(window, 'AudioContext', {
    configurable: true,
    writable: true,
    value: fake.scope.AudioContext,
  });
}

function resuming(behaviour: ResumeBehaviour): void {
  installAudio((c) => {
    c.resumeBehaviour = behaviour;
  });
}

function ctx(i: number): FakeAudioContext {
  const c = contexts[i];
  if (c === undefined) throw new Error(`no context ${i}`);
  return c;
}

/** Settles React and promises, then one real macrotask so Node can report unhandled rejections. */
async function settle(): Promise<void> {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
  const timers = jest.requireActual<typeof import('timers')>('timers');
  await new Promise<void>((resolve) => timers.setImmediate(resolve));
}

async function press(name: string): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name }));
  await settle();
}

beforeEach(() => {
  unhandled.length = 0;
  process.on('unhandledRejection', onUnhandled);
  jest.useFakeTimers();
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
  cleanup();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'AudioContext');
  restorePointerEvent();
  jest.useRealTimers();
});

describe('T-013 start failures', () => {
  it('AC-DUEL-013.12: blocked unlock shows the blocked message and a Try again button, Play stays pressable', async () => {
    resuming('stay');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.en.blocked);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(screen.queryByTestId('duel-screen')).not.toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  it('AC-DUEL-013.12: the unlock (resume) runs synchronously inside the click, on every press', async () => {
    resuming('stay');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(contexts).toHaveLength(1);
    expect(ctx(0).calls).toContain('resume');
    await settle();
    const before = ctx(0).calls.filter((c) => c === 'resume').length;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(ctx(0).calls.filter((c) => c === 'resume').length).toBe(before + 1);
    await settle();
  });

  it('AC-DUEL-013.12: after a blocked unlock, Try again with the browser now allowing starts the match', async () => {
    resuming('stay');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');
    ctx(0).resumeBehaviour = 'run';
    await press('Try again');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  it('AC-DUEL-013.12: a rejected resume shows the message, no unhandled rejection, and Play again works', async () => {
    resuming('reject');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await press('Play');
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(unhandled).toEqual([]);
  });

  it('AC-DUEL-013.12: a start that throws shows the error, Play and Try again are pressable, and the next press starts the match', async () => {
    installAudio((c, i) => {
      if (i === 0) {
        c.createGain = () => {
          throw new Error('boom');
        };
      }
    });
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');
    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.en.error);
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(useGameStore.getState().screen).toBe('start');
    expect(useGameStore.getState().unlocking).toBe(false);
    await press('Play');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(unhandled).toEqual([]);
  });

  it('AC-DUEL-013.12: repeated failing presses never leave the button stuck or leak timers', async () => {
    installAudio();
    render(<DuelGame difficulty="session" offsetMs={Number.NaN} />);
    for (let i = 0; i < 3; i++) {
      await press('Play');
      expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES.en.error);
      expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    }
    // Pending one-shot timers (e.g. the unlock timeout) may fire; none may be left repeating.
    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    expect(jest.getTimerCount()).toBe(0);
    expect(unhandled).toEqual([]);
  });

  it('AC-DUEL-013.12: a successful start shows no alert', async () => {
    resuming('run');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await press('Play');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each(['vi'] as const)(
    'AC-DUEL-013.12: blocked message and Try again are translated (%s)',
    async (locale) => {
      setFakeLocale(locale);
      resuming('stay');
      render(<DuelGame difficulty="session" offsetMs={0} />);
      await press(MESSAGES[locale].play);
      expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES[locale].blocked);
      expect(screen.getByRole('button', { name: MESSAGES[locale].retry })).toBeEnabled();
    },
  );

  it.each(['vi'] as const)(
    'AC-DUEL-013.12: start error message is translated (%s)',
    async (locale) => {
      setFakeLocale(locale);
      installAudio();
      render(<DuelGame difficulty="session" offsetMs={Number.NaN} />);
      await press(MESSAGES[locale].play);
      expect(screen.getByRole('alert')).toHaveTextContent(MESSAGES[locale].error);
    },
  );
});
