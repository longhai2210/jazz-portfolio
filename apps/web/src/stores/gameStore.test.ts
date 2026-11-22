import type { CampaignOptions } from '@/game/core/campaign';
import { ASSIST_MULT } from '@/game/core/config';
import type { SessionState } from '@/game/core/session';
import { BEST_BAR, DUCK_BAR, playTake, type TakePlan } from '@/game/ui/screens/testing/duel-results';
import {
  selectAssistOffer,
  selectCanAdvance,
  selectRunComplete,
  useGameStore,
  type GameStore,
} from './gameStore';

function state(): GameStore {
  return useGameStore.getState();
}

function session(): SessionState {
  const current = state().session;
  if (current === null) throw new Error('no session in the store');
  return current;
}

/** Plays the take in the store to its end and records it, as the game loop does. */
function finishTake(plan: TakePlan = {}) {
  const result = playTake(session(), plan);
  state().finishMatch(result);
  return result;
}

const RUN: CampaignOptions = { player: 'ren', difficulty: 'session', offsetMs: 0 };

afterEach(() => {
  state().reset();
});

describe('gameStore', () => {
  it('starts at the Play button with Lounge selected and nothing played', () => {
    expect(state()).toMatchObject({
      screen: 'start',
      difficulty: 'lounge',
      campaign: null,
      session: null,
      assistDeclined: false,
    });
  });

  it('AC-DUEL-017.1: a run started with a character, difficulty and offset uses exactly those', () => {
    state().startRun({ player: 'aki', difficulty: 'lateSet', offsetMs: 75 });

    expect(state().screen).toBe('duel');
    expect(state().difficulty).toBe('lateSet');
    expect(state().campaign).toMatchObject({ player: 'aki', difficulty: 'lateSet', offsetMs: 75 });
    // Aki's club 1 Shadow is Sayo (AC-DUEL-012.1); the take is ready for its count-in.
    expect(session().config).toMatchObject({
      character: 'sayo',
      difficulty: 'lateSet',
      offsetMs: 75,
      duel: 1,
      bpm: 84,
      assisted: false,
    });
    expect(session().status).toBe('ready');
  });

  it('AC-DUEL-017.2: a run started at match 2 with a best bar opens the Shadow Solo with it', () => {
    state().startRun({ ...RUN, startDuel: 2, bestBar: BEST_BAR });

    expect(session().config).toMatchObject({ duel: 2, bpm: 96, character: 'sayo' });
    const [first, second, third, fourth] = session().calls.solo;
    expect(first).toEqual({ source: 'player', notes: BEST_BAR });
    expect(second).toEqual({
      source: 'player',
      notes: [
        { step: 0, button: 3 },
        { step: 2, button: 1 },
        { step: 5, button: 0 },
      ],
    });
    expect([third.source, fourth.source]).toEqual(['composed', 'composed']);
  });

  it('AC-DUEL-013.6: "Replay this take" starts the same match again from a fresh take', () => {
    state().startRun(RUN);
    state().showFeedback({ kind: 'extra' });
    finishTake();
    expect(state().screen).toBe('result');
    const finished = session();

    state().replayMatch();

    expect(state().screen).toBe('duel');
    expect(session()).not.toBe(finished);
    expect(session().status).toBe('ready');
    expect(session().config).toEqual(finished.config);
    expect(state().feedback).toBeNull();
  });

  it('AC-DUEL-013.7: a match 1 win leads to match 2; a loss offers only the replay', () => {
    state().startRun(RUN);
    finishTake();
    expect(selectCanAdvance(state())).toBe(false);
    state().nextMatch();
    expect(session().config.duel).toBe(1);

    state().replayMatch();
    finishTake({ win: true, soloBars: [BEST_BAR] });
    expect(selectCanAdvance(state())).toBe(true);
    expect(selectRunComplete(state())).toBe(false);
    state().showSummary();
    expect(state().screen).toBe('result');

    state().nextMatch();
    expect(state().screen).toBe('duel');
    expect(session().config).toMatchObject({ duel: 2, bpm: 96 });
    // The match-1 win's best bar opens the Shadow's Solo (AC-DUEL-007.2).
    expect(session().calls.solo[0]).toEqual({ source: 'player', notes: BEST_BAR });
  });

  it('AC-DUEL-013.7: the summary follows a match 2 win, and "Play again from the start" goes back to match 1', () => {
    state().startRun({ ...RUN, startDuel: 2, bestBar: BEST_BAR });
    finishTake();
    state().showSummary();
    expect(state().screen).toBe('result');

    state().replayMatch();
    finishTake({ win: true });
    expect(selectCanAdvance(state())).toBe(false);
    expect(selectRunComplete(state())).toBe(true);
    state().showSummary();
    expect(state().screen).toBe('summary');

    state().restartRun();
    expect(state().screen).toBe('duel');
    expect(session().config).toMatchObject({ duel: 1, difficulty: 'session', offsetMs: 0 });
    expect(state().campaign?.results).toEqual({});
  });

  it('AC-DUEL-011.3: wider windows are offered at the second loss in a row, and declining keeps the windows', () => {
    state().startRun(RUN);
    finishTake();
    expect(selectAssistOffer(state())).toBe(false);

    state().replayMatch();
    finishTake();
    expect(selectAssistOffer(state())).toBe(true);

    state().declineAssist();
    expect(selectAssistOffer(state())).toBe(false);
    state().replayMatch();
    expect(session().config.assisted).toBe(false);

    // A third loss in the same streak offers nothing again.
    finishTake();
    expect(selectAssistOffer(state())).toBe(false);
  });

  it('AC-DUEL-011.3: after "No thanks" the run offers nothing more, until it restarts', () => {
    state().startRun(RUN);
    finishTake();
    state().replayMatch();
    finishTake();
    state().declineAssist();

    state().replayMatch();
    finishTake({ win: true });
    state().nextMatch();
    finishTake();
    state().replayMatch();
    finishTake();
    expect(state().campaign?.lossStreak).toBe(2);
    expect(selectAssistOffer(state())).toBe(false);

    state().restartRun();
    expect(state().assistDeclined).toBe(false);
    finishTake();
    state().replayMatch();
    finishTake();
    expect(selectAssistOffer(state())).toBe(true);
  });

  it('AC-DUEL-011.4: once accepted, every later take is played with windows x1.15 and its result says so', () => {
    state().startRun(RUN);
    finishTake();
    state().replayMatch();
    const declined = finishTake();
    expect(declined.assisted).toBe(false);

    state().acceptAssist();
    expect(selectAssistOffer(state())).toBe(false);
    state().replayMatch();
    expect(session().config.assisted).toBe(true);
    const assisted = finishTake({ win: true, soloBars: [BEST_BAR, DUCK_BAR] });
    expect(assisted.assisted).toBe(true);
    expect(ASSIST_MULT).toBe(1.15);

    // The assistance lasts into match 2, and "Play again from the start" clears it.
    state().nextMatch();
    expect(session().config.assisted).toBe(true);
    state().restartRun();
    expect(session().config.assisted).toBe(false);
  });

  it('keeps the latest view, feedback and quote light, and clears them on reset', () => {
    state().startRun(RUN);
    state().setView({ kind: 'countIn', turn: 'echo', bar: 0, beat: 2 }, 2);
    state().setCountInResumed(true);
    state().lightQuote({ lickId: 'duck', bar: 21 });
    state().setLickBookOpen(true);
    expect(state()).toMatchObject({
      beat: 2,
      countInResumed: true,
      justQuoted: { lickId: 'duck', bar: 21 },
      lickBookOpen: true,
    });

    state().reset();
    expect(state()).toMatchObject({
      screen: 'start',
      phase: null,
      beat: null,
      justQuoted: null,
      lickBookOpen: false,
      campaign: null,
    });
  });
});
