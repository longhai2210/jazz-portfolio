/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createCampaign, createDuelSession } from '../../core/campaign';
import type { DuelResult } from '../../core/session';
import SummaryScreen from './SummaryScreen';
import { BEST_BAR, DUCK_BAR, playTake } from './testing/duel-results';
import { setFakeLocale } from './testing/intl';
import { GameButton } from './ui';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./testing/link')>('./testing/link'),
);

/** Frog (0, 3, 5) on D, F and J. */
const FROG_BAR = [
  { step: 0, button: 0 },
  { step: 3, button: 1 },
  { step: 5, button: 2 },
] as const;

function wins(): { 1: DuelResult; 2: DuelResult } {
  const first = playTake(
    createDuelSession(createCampaign({ difficulty: 'session', offsetMs: 0 })),
    { win: true, soloBars: [BEST_BAR, DUCK_BAR, DUCK_BAR] },
  );
  const second = playTake(
    createDuelSession(
      createCampaign({ difficulty: 'session', offsetMs: 0, startDuel: 2, bestBar: first.bestBar }),
    ),
    { win: true, soloBars: [FROG_BAR, DUCK_BAR] },
  );
  return { 1: first, 2: second };
}

afterEach(() => {
  setFakeLocale('en');
});

describe('SummaryScreen', () => {
  it('AC-DUEL-013.7: sums up both matches and plays again from the start', () => {
    const results = wins();
    const onRestart = jest.fn();
    render(<SummaryScreen results={results} onRestart={onRestart} />);

    expect(screen.getByRole('heading', { name: 'Session complete' })).toBeInTheDocument();
    const first = within(screen.getByTestId('summary-match-1'));
    expect(first.getByText('Match 1 · Aki')).toBeInTheDocument();
    expect(first.getByRole('img', { name: `${results[1].score.stars} of 3 stars` })).toBeInTheDocument();
    expect(first.getByText(`${Math.round(results[1].score.total)} points`)).toBeInTheDocument();
    const second = within(screen.getByTestId('summary-match-2'));
    expect(second.getByText('Match 2 · Sayo')).toBeInTheDocument();

    // Every different lick quoted across both matches, once each.
    const tags = within(screen.getByTestId('quote-tags')).getAllByRole('listitem');
    expect(tags.map((tag) => tag.textContent)).toEqual(['Duck', 'Frog']);

    fireEvent.click(screen.getByRole('button', { name: 'Play again from the start' }));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-013.9: offers the way back to the portfolio home page in the language in use', () => {
    setFakeLocale('vi');
    render(<SummaryScreen results={wins()} onRestart={() => undefined} />);

    const links = screen.getAllByRole('link', { name: 'Về trang chủ' });
    expect(links.length).toBeGreaterThanOrEqual(1);
    for (const link of links) expect(link).toHaveAttribute('href', '/vi');
    expect(screen.getByRole('button', { name: 'Chơi lại từ đầu' })).toBeInTheDocument();
  });
});

describe('SummaryScreen in the 3D stage (game-stage design.md section 4)', () => {
  it('puts the extra action at the end of the button row, after the way home', () => {
    const onLeave = jest.fn();
    render(
      <SummaryScreen
        results={wins()}
        onRestart={() => undefined}
        extraAction={
          <GameButton variant="secondary" onClick={onLeave}>
            Leave the club
          </GameButton>
        }
      />,
    );
    const leave = screen.getByRole('button', { name: 'Leave the club' });
    const row = leave.parentElement;
    if (row === null) throw new Error('the action has no row');
    expect(within(row).getByRole('button', { name: 'Play again from the start' })).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: /Back to portfolio/ })).toBeInTheDocument();
    expect(row.lastElementChild).toBe(leave);
    fireEvent.click(leave);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('without it the row is the game-duel row', () => {
    render(<SummaryScreen results={wins()} onRestart={() => undefined} />);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'Play again from the start',
    ]);
  });
});
