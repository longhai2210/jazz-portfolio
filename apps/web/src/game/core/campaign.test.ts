import { composedCall, invertButton } from './call';
import {
  acceptAssist,
  advanceDuel,
  ASSIST_OFFER_LOSSES,
  canAdvance,
  createCampaign,
  createDuelSession,
  duelConfig,
  isComplete,
  recordResult,
  restartCampaign,
  shouldOfferAssist,
  type CampaignState,
} from './campaign';
import { stepTime, type BeatClock } from './clock';
import type { DirectionTurn } from './direction';
import { hitWindows } from './judge';
import {
  DUEL_BARS,
  stepSession,
  turnLayout,
  turnTargets,
  type DuelResult,
  type SessionInput,
  type SessionState,
} from './session';
import type { BarNote, Button } from './types';

const T0 = 4;

/** How a take is played: perfect with a best Solo bar, perfect without one, or silent (a loss). */
type Take = 'win' | 'winWithoutBestBar' | 'loss';

/** Solo taps: [Solo bar index, step, button]. Bar 0 has the 3 hits a best bar needs. */
const SOLO_WITH_BEST_BAR: readonly (readonly [number, number, Button])[] = [
  [0, 0, 0],
  [0, 2, 1],
  [0, 4, 2],
  [1, 1, 3],
  [1, 4, 1],
  [2, 0, 2],
  [2, 6, 0],
  [3, 2, 3],
  [3, 5, 1],
];

/** Two taps per Solo bar: still a win, but no bar can be the best bar. */
const SOLO_WITHOUT_BEST_BAR: readonly (readonly [number, number, Button])[] = [
  [0, 0, 0],
  [0, 4, 2],
  [1, 1, 3],
  [1, 4, 1],
  [2, 0, 2],
  [2, 6, 0],
  [3, 2, 3],
  [3, 5, 1],
];

function clockOf(state: SessionState): BeatClock {
  if (state.clock === null) throw new Error('not started');
  return state.clock;
}

function step(state: SessionState, input: SessionInput): SessionState {
  return stepSession(state, input).state;
}

/** A tap on step `step` of bar `bar`, late by exactly the session's calibration offset. */
function tapAt(state: SessionState, bar: number, at: number, button: Button): SessionInput {
  const time = stepTime(clockOf(state), bar, at) + state.config.offsetMs / 1000;
  return { type: 'tap', tap: { time, button } };
}

function callTaps(state: SessionState, turn: DirectionTurn): SessionInput[] {
  return turnTargets(state, turn).map((note) =>
    tapAt(state, note.bar, note.step, turn === 'echo' ? note.button : invertButton(note.button)),
  );
}

/** Starts the campaign's current duel and plays one take of it to the end. */
function playTake(campaign: CampaignState, take: Take): DuelResult {
  let state = step(createDuelSession(campaign), { type: 'start', time: T0 });
  const soloBars = turnLayout('solo').playerBars;
  const plan = take === 'win' ? SOLO_WITH_BEST_BAR : SOLO_WITHOUT_BEST_BAR;
  const inputs =
    take === 'loss'
      ? []
      : [
          ...callTaps(state, 'echo'),
          ...callTaps(state, 'answer'),
          ...plan.map(([index, at, button]) => tapAt(state, soloBars[index], at, button)),
        ];
  for (const input of inputs) state = step(state, input);
  state = step(state, { type: 'advance', time: stepTime(clockOf(state), DUEL_BARS, 0) + 1 });
  if (state.result === null) throw new Error('the duel has not finished');
  return state.result;
}

function play(campaign: CampaignState, take: Take): CampaignState {
  return recordResult(campaign, playTake(campaign, take));
}

function started(campaign: CampaignState): SessionState {
  return step(createDuelSession(campaign), { type: 'start', time: T0 });
}

describe('campaign', () => {
  it('AC-DUEL-012.4: with no character given the player is Ren: duel 1 is Shadow Aki at 84 BPM, duel 2 Shadow Sayo at 96 BPM', () => {
    for (const player of [undefined, null]) {
      let campaign = createCampaign({ player, difficulty: 'lounge', offsetMs: 0 });
      expect(campaign.player).toBe('ren');
      expect(duelConfig(campaign)).toMatchObject({ duel: 1, character: 'aki', bpm: 84 });

      const duel1 = started(campaign);
      expect(clockOf(duel1).bpm).toBe(84);
      expect(duel1.calls.echo).toEqual(composedCall('aki', 'lounge', 'echo'));
      const result1 = playTake(campaign, 'win');
      expect(result1).toMatchObject({ duel: 1, character: 'aki' });

      campaign = advanceDuel(recordResult(campaign, result1));
      expect(duelConfig(campaign)).toMatchObject({ duel: 2, character: 'sayo', bpm: 96 });
      const duel2 = started(campaign);
      expect(clockOf(duel2).bpm).toBe(96);
      expect(duel2.calls.echo).toEqual(composedCall('sayo', 'lounge', 'echo'));
      expect(playTake(campaign, 'win')).toMatchObject({ duel: 2, character: 'sayo' });
    }
  });

  it('a picked character sets the Shadows of both duels from the roster', () => {
    const shadows = (player: 'aki' | 'sayo' | 'ren') => {
      const campaign = createCampaign({ player, difficulty: 'session', offsetMs: 0 });
      const duel2 = advanceDuel(play(campaign, 'win'));
      return [duelConfig(campaign).character, duelConfig(duel2).character];
    };
    expect(shadows('aki')).toEqual(['sayo', 'ren']);
    expect(shadows('sayo')).toEqual(['aki', 'ren']);
    expect(shadows('ren')).toEqual(['aki', 'sayo']);
  });

  it('AC-DUEL-002.3: both duels judge taps with the one calibration offset', () => {
    let campaign = createCampaign({ difficulty: 'session', offsetMs: 52 });
    const results: DuelResult[] = [];
    for (const duel of [1, 2] as const) {
      expect(duelConfig(campaign)).toMatchObject({ duel, offsetMs: 52 });
      expect(started(campaign).config.offsetMs).toBe(52);
      const result = playTake(campaign, 'win');
      results.push(result);
      campaign = recordResult(campaign, result);
      if (duel === 1) campaign = advanceDuel(campaign);
    }

    // Every tap came 52 ms after its note on the audio clock; with the offset removed it is on time.
    for (const result of results) {
      const notes = [...result.turns.echo.judge.notes, ...result.turns.answer.judge.notes];
      expect(notes.length).toBeGreaterThan(0);
      for (const judged of [...notes, ...result.turns.solo.taps]) {
        expect(judged.grade).toBe('perfect');
        expect(judged.deltaMs).toBeCloseTo(0, 6);
      }
    }
    expect(results.map((result) => result.duel)).toEqual([1, 2]);
  });

  it('keeps the best Solo bar of the duel-1 win for the Solo call of duel 2', () => {
    const won = play(createCampaign({ difficulty: 'session', offsetMs: 0 }), 'win');
    const bestBar: BarNote[] = [
      { step: 0, button: 0 },
      { step: 2, button: 1 },
      { step: 4, button: 2 },
    ];
    expect(won.bestBar).toEqual(bestBar);
    expect(duelConfig(won).bestBar).toBeNull();

    const duel2 = advanceDuel(won);
    expect(duelConfig(duel2).bestBar).toEqual(bestBar);
    const solo = createDuelSession(duel2).calls.solo;
    expect(solo[0]).toEqual({ notes: bestBar, source: 'player' });
    expect(solo[1].source).toBe('player');
    // A loss in duel 2 keeps it for the replay.
    expect(createDuelSession(play(duel2, 'loss')).calls.solo[0]).toEqual(solo[0]);
  });

  it('a loss keeps the best bar, and a later duel-1 win without one replaces it with none', () => {
    let campaign = play(createCampaign({ difficulty: 'session', offsetMs: 0 }), 'win');
    expect(campaign.bestBar).not.toBeNull();
    campaign = play(campaign, 'loss');
    expect(campaign.bestBar).not.toBeNull();
    expect(canAdvance(campaign)).toBe(false);

    campaign = play(campaign, 'winWithoutBestBar');
    expect(campaign.bestBar).toBeNull();
    const duel2 = advanceDuel(campaign);
    expect(createDuelSession(duel2).calls.solo).toEqual(composedCall('sayo', 'session', 'solo'));
  });

  it('counts losses in a row and offers assistance once, at the second loss', () => {
    let campaign = createCampaign({ difficulty: 'lounge', offsetMs: 0 });
    expect(ASSIST_OFFER_LOSSES).toBe(2);
    const streak: [number, boolean][] = [];
    for (const take of ['loss', 'loss', 'loss', 'win', 'loss', 'loss'] as const) {
      campaign = play(campaign, take);
      streak.push([campaign.lossStreak, shouldOfferAssist(campaign)]);
    }
    expect(streak).toEqual([
      [1, false],
      [2, true],
      [3, false],
      [0, false],
      [1, false],
      [2, true],
    ]);

    const assisted = acceptAssist(campaign);
    expect(shouldOfferAssist(assisted)).toBe(false);
    expect(duelConfig(assisted).assisted).toBe(true);
    const session = started(assisted);
    expect(session.config.assisted).toBe(true);
    expect(playTake(assisted, 'loss').assisted).toBe(true);
    expect(hitWindows(session.config.difficulty, session.config.assisted).ok).toBeGreaterThan(
      hitWindows('lounge', false).ok,
    );
  });

  it('only a win unlocks duel 2, and a duel-2 win completes the run', () => {
    let campaign = createCampaign({ difficulty: 'session', offsetMs: 0 });
    expect(canAdvance(campaign)).toBe(false);
    expect(() => advanceDuel(campaign)).toThrow();
    campaign = play(campaign, 'loss');
    expect(canAdvance(campaign)).toBe(false);
    campaign = play(campaign, 'win');
    expect(canAdvance(campaign)).toBe(true);
    expect(isComplete(campaign)).toBe(false);

    const duel1Result = campaign.lastResult;
    campaign = advanceDuel(campaign);
    expect(campaign).toMatchObject({ duel: 2, lossStreak: 0, lastResult: null });
    expect(campaign.results[1]).toBe(duel1Result);
    expect(() => recordResult(campaign, duel1Result as DuelResult)).toThrow(RangeError);

    campaign = play(campaign, 'loss');
    expect(isComplete(campaign)).toBe(false);
    campaign = play(campaign, 'win');
    expect(canAdvance(campaign)).toBe(false);
    expect(isComplete(campaign)).toBe(true);
    expect(campaign.results[2]?.score.won).toBe(true);
  });

  it('restarts at duel 1 with the same character, difficulty and offset, without assistance', () => {
    let campaign = createCampaign({ player: 'aki', difficulty: 'lateSet', offsetMs: 33 });
    campaign = acceptAssist(advanceDuel(play(campaign, 'win')));
    const again = restartCampaign(campaign);
    expect(again).toEqual(createCampaign({ player: 'aki', difficulty: 'lateSet', offsetMs: 33 }));
    expect(again).toMatchObject({ duel: 1, assisted: false, bestBar: null, lossStreak: 0 });
  });

  it('can start at duel 2 with a best bar from outside', () => {
    const bestBar: BarNote[] = [
      { step: 0, button: 0 },
      { step: 2, button: 2 },
      { step: 5, button: 3 },
    ];
    const campaign = createCampaign({ difficulty: 'session', offsetMs: 0, startDuel: 2, bestBar });
    expect(duelConfig(campaign)).toMatchObject({ duel: 2, character: 'sayo', bpm: 96, bestBar });
    expect(createDuelSession(campaign).calls.solo[0]).toEqual({ notes: bestBar, source: 'player' });

    const fromDuel1 = createCampaign({ difficulty: 'session', offsetMs: 0, bestBar });
    expect(fromDuel1.bestBar).toBeNull();
  });

  it('rejects an unknown character, difficulty or duel, and an offset that is not finite', () => {
    const options = { difficulty: 'session', offsetMs: 0 } as const;
    expect(() => createCampaign({ ...options, player: 'miles' as never })).toThrow(RangeError);
    expect(() => createCampaign({ ...options, difficulty: 'hard' as never })).toThrow(RangeError);
    expect(() => createCampaign({ ...options, startDuel: 3 as never })).toThrow(RangeError);
    expect(() => createCampaign({ ...options, offsetMs: Number.POSITIVE_INFINITY })).toThrow(
      RangeError,
    );
  });
});
