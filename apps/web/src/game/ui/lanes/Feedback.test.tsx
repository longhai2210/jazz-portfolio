/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { createBeatClock } from '../../core/clock';
import LickBook from '../lick-book/LickBook';
import Feedback from './Feedback';
import LaneBoard from './LaneBoard';
import { stubReducedMotion } from './testing/match-media';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);

/** Any class that animates: Tailwind's animate-*, or a transition other than none. */
const MOTION_CLASS = /(^|\s)(motion-safe:)?(animate-|transition(?!-none)(-|\s|$))/;

function expectNoMotionClasses(root: Element) {
  for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
    expect(element.getAttribute('class') ?? '').not.toMatch(MOTION_CLASS);
  }
}

let restoreMatchMedia: (() => void) | null = null;

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = null;
});

describe('Feedback', () => {
  it('AC-DUEL-013.10: with reduced motion, Perfect and a quote change only the words and the lick shape: no shake, no flash', () => {
    restoreMatchMedia = stubReducedMotion(true);
    const clock = createBeatClock({ t0: 0, bpm: 96, difficulty: 'session' });
    const audio = { currentTime: 0 };
    const target = { note: { bar: 0, step: 0, button: 0 as const }, state: 'hit' as const };
    const { container, rerender } = render(
      <>
        <LaneBoard
          audio={audio}
          clock={clock}
          firstBar={0}
          side="player"
          targets={[target]}
          feedback={{ kind: 'grade', grade: 'perfect' }}
        />
        <LickBook justQuoted={null} />
      </>,
    );

    const feedback = screen.getByTestId('duel-feedback');
    expect(feedback).toHaveTextContent('Perfect');
    expect(feedback).toHaveAttribute('data-reduced-motion', 'true');
    expect(feedback.style.transition).toBe('none');
    expect(feedback.querySelector('p')?.style.transition).toBe('none');

    rerender(
      <>
        <LaneBoard
          audio={audio}
          clock={clock}
          firstBar={0}
          side="player"
          targets={[target]}
          feedback={{ kind: 'quote', lickId: 'duck' }}
        />
        <LickBook justQuoted="duck" />
      </>,
    );

    expect(feedback).toHaveTextContent('Quote: Duck!');
    expect(feedback).toHaveTextContent('Duck sounds on the next downbeat');
    expect(feedback.style.transition).toBe('none');

    // The lit lick changes its border, its fill, a star and a label, and nothing fades in.
    const duck = document.querySelector<HTMLElement>('[data-lick="duck"]');
    expect(duck).toHaveAttribute('data-lit', 'true');
    expect(duck?.style.transition).toBe('none');
    expect(duck).toHaveTextContent('★');
    expect(duck).toHaveTextContent('Just quoted');
    duck?.querySelectorAll<HTMLElement>('[data-step]').forEach((dot) => {
      expect(dot.style.transition).toBe('none');
    });

    // Markers and the playhead never transition, with or without the setting.
    document
      .querySelectorAll<HTMLElement>('[data-marker], [data-testid="playhead"]')
      .forEach((el) => {
        expect(el.style.transition).toBe('none');
      });
    expectNoMotionClasses(container);
  });

  it('AC-DUEL-013.10: without reduced motion the line still only changes its words, never animates', () => {
    restoreMatchMedia = stubReducedMotion(false);
    const { container, rerender } = render(
      <Feedback event={{ kind: 'grade', grade: 'perfect' }} />,
    );
    const feedback = screen.getByTestId('duel-feedback');
    expect(feedback).toHaveAttribute('data-reduced-motion', 'false');
    expect(feedback).toHaveTextContent('Perfect');

    rerender(<Feedback event={{ kind: 'quote', lickId: 'frog' }} />);
    expect(feedback).toHaveTextContent('Quote: Frog!');
    expectNoMotionClasses(container);
  });

  it('reads reduced motion as off when the browser has no matchMedia', () => {
    render(<Feedback event={{ kind: 'grade', grade: 'great' }} />);
    expect(screen.getByTestId('duel-feedback')).toHaveAttribute('data-reduced-motion', 'false');
    expect(screen.getByTestId('duel-feedback')).toHaveTextContent('Great');
  });

  it('shows every grade and an extra tap, but announces only quotes and misses', () => {
    const { rerender } = render(<Feedback event={{ kind: 'grade', grade: 'ok' }} />);
    const live = document.querySelector('[aria-live="polite"]');
    expect(screen.getByTestId('duel-feedback')).toHaveTextContent('OK');
    expect(live).toHaveTextContent('');

    rerender(<Feedback event={{ kind: 'extra' }} />);
    expect(screen.getByTestId('duel-feedback')).toHaveTextContent('Extra tap');
    expect(live).toHaveTextContent('');

    rerender(<Feedback event={{ kind: 'grade', grade: 'miss' }} />);
    expect(live).toHaveTextContent('Miss');

    rerender(<Feedback event={{ kind: 'quote', lickId: 'windChime' }} />);
    expect(live).toHaveTextContent('Quote: Wind chime! Wind chime sounds on the next downbeat');

    rerender(<Feedback event={null} />);
    expect(live).toHaveTextContent('');
  });
});
