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

const BLOCKED = 'The browser did not start the sound. Press Try again to turn it on.';
const FAILED = 'Something went wrong while starting the match.';

let contexts: FakeAudioContext[] = [];
let restorePointerEvent: () => void = () => undefined;

/** Installs a recording fake `AudioContext`; `setup` runs on each new context, with its index. */
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

/** Contexts whose `resume()` behaves as given until the test changes it. */
function installAudioResuming(behaviour: ResumeBehaviour): void {
  installAudio((context) => {
    context.resumeBehaviour = behaviour;
  });
}

function context(index: number): FakeAudioContext {
  const found = contexts[index];
  if (found === undefined) throw new Error(`no AudioContext number ${index}`);
  return found;
}

/**
 * Lets the unlock and React settle, then waits one real macrotask: Node reports a promise
 * rejection nobody handled only between macrotasks, and Jest fails the running test with it.
 */
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
  jest.useFakeTimers();
  restorePointerEvent = installPointerEvent();
});

afterEach(() => {
  cleanup();
  useGameStore.getState().reset();
  navigations.length = 0;
  setFakeLocale('en');
  Reflect.deleteProperty(window, 'AudioContext');
  restorePointerEvent();
  jest.useRealTimers();
});

describe('DuelGame start failures', () => {
  it('AC-DUEL-013.12: when the browser blocks the sound, Start says so with Try again, and Try again starts the match', async () => {
    installAudioResuming('stay');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');

    expect(screen.getByRole('alert')).toHaveTextContent(BLOCKED);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();

    context(0).resumeBehaviour = 'run';
    await press('Try again');
    expect(contexts).toHaveLength(1);
    expect(context(0).calls).toEqual(['resume', 'resume']);
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-DUEL-013.12: when the resume is refused, Play can be pressed again and the sound is released on leaving', async () => {
    installAudioResuming('reject');
    const view = render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');
    expect(screen.getByRole('alert')).toHaveTextContent(BLOCKED);

    await press('Play');
    expect(contexts).toHaveLength(1);
    expect(context(0).calls).toEqual(['resume', 'resume']);
    expect(screen.getByRole('alert')).toHaveTextContent(BLOCKED);
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();

    view.unmount();
    expect(context(0).state).toBe('closed');
  });

  it('AC-DUEL-013.12: when the audio setup throws, Start shows the error, releases the context, and Try again starts the match', async () => {
    installAudio((created, index) => {
      if (index === 0) {
        created.createGain = () => {
          throw new Error('InvalidStateError');
        };
      }
    });
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Play');

    expect(screen.getByRole('alert')).toHaveTextContent(FAILED);
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(context(0).state).toBe('closed');

    await press('Try again');
    expect(contexts).toHaveLength(2);
    expect(context(1).state).toBe('running');
    expect(screen.getByTestId('duel-screen')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('AC-DUEL-013.12: when the match cannot be created (offset not finite), Start shows the error and every press retries with fresh audio', async () => {
    installAudio();
    render(<DuelGame difficulty="session" offsetMs={Number.NaN} />);
    await press('Play');

    expect(screen.getByRole('alert')).toHaveTextContent(FAILED);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
    expect(useGameStore.getState().screen).toBe('start');
    expect(useGameStore.getState().unlocking).toBe(false);
    // The audio built for the match is released, its scheduler with it: no repeating timer is left.
    expect(context(0).state).toBe('closed');
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(jest.getTimerCount()).toBe(0);

    await press('Play');
    expect(contexts).toHaveLength(2);
    expect(context(1).calls).toContain('resume');
    expect(context(1).state).toBe('closed');
    expect(screen.getByRole('alert')).toHaveTextContent(FAILED);
    expect(screen.getByRole('button', { name: 'Play' })).toBeEnabled();
  });

  it('AC-DUEL-013.12: shows the messages in the language in use', async () => {
    setFakeLocale('vi');
    installAudioResuming('stay');
    render(<DuelGame difficulty="session" offsetMs={0} />);
    await press('Chơi');

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Trình duyệt chưa bật âm thanh. Bấm Thử lại để bật.',
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeEnabled();
  });
});
