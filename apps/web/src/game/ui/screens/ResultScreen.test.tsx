/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { createCampaign, createDuelSession, type CampaignOptions } from '../../core/campaign';
import type { DuelResult } from '../../core/session';
import ResultScreen, { type ResultScreenProps } from './ResultScreen';
import { BEST_BAR, DUCK_BAR, playTake, type TakePlan } from './testing/duel-results';
import { setFakeLocale } from './testing/intl';
import { GameButton } from './ui';

jest.mock(
  'next-intl',
  () => jest.requireActual<typeof import('./testing/intl')>('./testing/intl').nextIntlMock,
);
jest.mock('next/link', () =>
  jest.requireActual<typeof import('./testing/link')>('./testing/link'),
);

/** A real take of match `duel` against the Shadows of Ren (Aki, then Sayo). */
function take(plan: TakePlan, options: Partial<CampaignOptions> = {}, assisted = false): DuelResult {
  let campaign = createCampaign({ difficulty: 'session', offsetMs: 0, ...options });
  if (assisted) campaign = { ...campaign, assisted: true };
  return playTake(createDuelSession(campaign), plan);
}

function renderResult(result: DuelResult, props: Partial<ResultScreenProps> = {}) {
  const handlers = {
    onNext: jest.fn(),
    onReplay: jest.fn(),
    onSummary: jest.fn(),
    onAcceptAssist: jest.fn(),
    onDeclineAssist: jest.fn(),
  };
  render(
    <ResultScreen
      result={result}
      canAdvance={false}
      runComplete={false}
      offerAssist={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

function actionNames(): string[] {
  return screen.getAllByRole('button').map((button) => button.textContent ?? '');
}

afterEach(() => {
  setFakeLocale('en');
});

describe('ResultScreen', () => {
  it('AC-DUEL-013.6: shows the stars, Rhythm, Direction and Feel, the quoted licks, and replays that take', () => {
    // Echo and Answer on time, then Solo bar 1 the best bar and bars 2 and 3 quoting Duck.
    const result = take({ win: true, soloBars: [BEST_BAR, DUCK_BAR, DUCK_BAR] });
    expect(result.quotes.map((quote) => quote.lick.id)).toEqual(['duck', 'duck']);
    const { onReplay } = renderResult(result, { canAdvance: true });

    expect(screen.getByRole('heading', { name: 'Aki is back in the band' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: `${result.score.stars} of 3 stars` })).toBeInTheDocument();
    const rows = screen.getAllByTestId('score-row').map((row) => row.textContent);
    expect(rows).toEqual([
      `Rhythm${Math.round(result.score.timing * 100)}%`,
      'Direction100%',
      `Feel${Math.round(result.score.feel * 100)}%`,
      'Quote bonus+5',
    ]);
    expect(screen.getByTestId('result-total')).toHaveTextContent(String(Math.round(result.score.total)));
    const tags = within(screen.getByTestId('quote-tags'));
    expect(tags.getByRole('heading', { name: 'Licks quoted' })).toBeInTheDocument();
    expect(tags.getAllByRole('listitem').map((tag) => tag.textContent)).toEqual(['Duck x2']);

    fireEvent.click(screen.getByRole('button', { name: 'Replay this take' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-013.6: a take with no quote says so and has no quote bonus row', () => {
    const result = take({});
    renderResult(result);

    expect(screen.getByRole('heading', { name: 'Not this take' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '0 of 3 stars' })).toBeInTheDocument();
    expect(screen.getAllByTestId('score-row')).toHaveLength(3);
    expect(screen.queryByText('Quote bonus')).not.toBeInTheDocument();
    expect(screen.getByText('None this take.')).toBeInTheDocument();
  });

  it('AC-DUEL-013.7: a match 1 win offers match 2 and the replay; a loss only the replay', () => {
    const { onNext } = renderResult(take({ win: true }), { canAdvance: true });
    expect(actionNames()).toEqual(['On to match 2', 'Replay this take']);
    fireEvent.click(screen.getByRole('button', { name: 'On to match 2' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-013.7: a loss, in match 1 or 2, offers only "Replay this take"', () => {
    renderResult(take({}));
    expect(actionNames()).toEqual(['Replay this take']);
  });

  it('AC-DUEL-013.7: a match 2 win offers the summary instead of match 2', () => {
    const result = take({ win: true }, { startDuel: 2, bestBar: BEST_BAR });
    const { onSummary } = renderResult(result, { runComplete: true });

    expect(screen.getByRole('heading', { name: 'Sayo is back in the band' })).toBeInTheDocument();
    expect(actionNames()).toEqual(['See summary', 'Replay this take']);
    fireEvent.click(screen.getByRole('button', { name: 'See summary' }));
    expect(onSummary).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-011.3: offers 15% wider windows inline, with "Widen windows" and "No thanks"', () => {
    const { onAcceptAssist, onDeclineAssist, onReplay } = renderResult(take({}), {
      offerAssist: true,
    });

    const offer = screen.getByRole('group', { name: 'Want a little more room?' });
    expect(offer).toHaveTextContent('Widen the timing windows by 15% for the rest of this run.');
    fireEvent.click(within(offer).getByRole('button', { name: 'No thanks' }));
    expect(onDeclineAssist).toHaveBeenCalledTimes(1);
    fireEvent.click(within(offer).getByRole('button', { name: 'Widen windows' }));
    expect(onAcceptAssist).toHaveBeenCalledTimes(1);
    // Replay stays reachable next to the offer.
    fireEvent.click(screen.getByRole('button', { name: 'Replay this take' }));
    expect(onReplay).toHaveBeenCalledTimes(1);
  });

  it('AC-DUEL-011.3: shows no offer when the screen is not told to', () => {
    renderResult(take({}));
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.queryByText('Want a little more room?')).not.toBeInTheDocument();
  });

  it('AC-DUEL-011.4: a take played with wider windows carries the note under the total', () => {
    renderResult(take({ win: true }, {}, true), { canAdvance: true });
    expect(screen.getByRole('note')).toHaveTextContent('Timing windows were widened by 15%.');
  });

  it('AC-DUEL-011.4: a take played without them has no note', () => {
    renderResult(take({ win: true }), { canAdvance: true });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });

  it('AC-DUEL-013.9: has the way back to the portfolio home page in the language in use', () => {
    setFakeLocale('vi');
    renderResult(take({}));
    const home = screen.getByRole('link', { name: 'Về trang chủ' });
    expect(home).toHaveAttribute('href', '/vi');
    expect(screen.getByRole('heading', { name: 'Take này chưa được' })).toBeInTheDocument();
  });
});

describe('ResultScreen in the 3D stage (game-stage design.md section 4)', () => {
  it('puts the extra action at the end of the button row, as a secondary button', () => {
    const onLeave = jest.fn();
    renderResult(take({ win: true }), {
      canAdvance: true,
      extraAction: (
        <GameButton variant="secondary" onClick={onLeave}>
          Leave the club
        </GameButton>
      ),
    });
    expect(actionNames()).toEqual(['On to match 2', 'Replay this take', 'Leave the club']);
    const leave = screen.getByRole('button', { name: 'Leave the club' });
    expect(leave.parentElement).toContainElement(
      screen.getByRole('button', { name: 'Replay this take' }),
    );
    expect(leave).toHaveClass('border-jazz-slate', 'text-jazz-text');
    fireEvent.click(leave);
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('without it the row is the game-duel row', () => {
    renderResult(take({}), { extraAction: undefined });
    expect(actionNames()).toEqual(['Replay this take']);
  });
});
