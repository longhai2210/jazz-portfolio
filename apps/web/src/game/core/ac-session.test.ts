import { composedCall, invertButton, TURNS } from './call';
import {
  acceptAssist,
  advanceDuel,
  canAdvance,
  createCampaign,
  createDuelSession,
  duelConfig,
  recordResult,
  restartCampaign,
  shouldOfferAssist,
} from './campaign';
import { stepTime, type BeatClock } from './clock';
import { DIFFICULTIES } from './config';
import { CHARACTERS } from './roster';
import {
  barRole,
  COUNT_IN_BARS,
  createSession,
  DUEL_BARS,
  stepSession,
  turnLayout,
  turnTargets,
  type DuelResult,
  type SessionEvent,
  type SessionInput,
  type SessionState,
} from './session';
import type { Button, Turn } from './types';

const T0 = 10;

function run(state: SessionState, inputs: SessionInput[]) {
  let s = state;
  const events: SessionEvent[] = [];
  for (const input of inputs) {
    const step = stepSession(s, input);
    s = step.state;
    events.push(...step.events);
  }
  return { state: s, events };
}

const countInClock = (events: readonly SessionEvent[]): BeatClock => {
  const e = [...events].reverse().find((x) => x.type === 'countIn');
  if (!e || e.type !== 'countIn') throw new Error('no countIn event');
  return e.clock;
};

const tapAt = (clock: BeatClock, bar: number, step: number, button: Button, ms = 0): SessionInput => ({
  type: 'tap',
  tap: { time: stepTime(clock, bar, step) + ms / 1000, button },
});

const byTime = (a: SessionInput, b: SessionInput) =>
  a.type === 'tap' && b.type === 'tap' ? a.tap.time - b.tap.time : 0;

/** Perfect play of one turn on `clock`. Answer inverts the direction; Solo plays on-grid taps. */
function perfectTurn(state: SessionState, clock: BeatClock, turn: Turn): SessionInput[] {
  const inputs: SessionInput[] = [];
  const { playerBars } = turnLayout(turn);
  if (turn === 'solo') {
    const pattern: [number, number][] = [
      [0, 0],
      [2, 2],
      [5, 1],
      [7, 3],
    ];
    playerBars.forEach((bar, i) => {
      pattern.forEach(([step, b]) => inputs.push(tapAt(clock, bar, step, ((b + i) % 4) as Button)));
    });
  } else {
    for (const t of turnTargets(state, turn)) {
      inputs.push(tapAt(clock, t.bar, t.step, turn === 'answer' ? invertButton(t.button) : t.button));
    }
  }
  inputs.push({ type: 'advance', time: stepTime(clock, playerBars[3] + 1, 0) + 1 });
  return inputs;
}

function playDuel(options: Parameters<typeof createSession>[0]) {
  const started = run(createSession(options), [{ type: 'start', time: T0 }]);
  let state = started.state;
  const clock = countInClock(started.events);
  const all = [...started.events];
  for (const turn of TURNS) {
    const r = run(state, perfectTurn(state, clock, turn));
    state = r.state;
    all.push(...r.events);
  }
  return { state, events: all, clock };
}

function afterEchoAnswer(options = base) {
  const s0 = run(createSession(options), [{ type: 'start', time: T0 }]);
  const clock = countInClock(s0.events);
  let state = s0.state;
  for (const turn of ['echo', 'answer'] as const) state = run(state, perfectTurn(state, clock, turn)).state;
  return { state, clock };
}

function soloEnd(events: readonly SessionEvent[]) {
  const e = events.find((x) => x.type === 'turnEnd' && x.result.turn === 'solo');
  if (!e || e.type !== 'turnEnd' || e.result.turn !== 'solo') throw new Error('no solo end');
  return e.result;
}

function echoEnd(events: readonly SessionEvent[]) {
  const e = events.find((x) => x.type === 'turnEnd' && x.result.turn === 'echo');
  if (!e || e.type !== 'turnEnd' || e.result.turn !== 'echo') throw new Error('no echo end');
  return e.result;
}

const base = { character: 'aki', difficulty: 'session', duel: 1, offsetMs: 0 } as const;

describe('AC-DUEL-004 structure of a duel', () => {
  it('AC-DUEL-004.1: 25 bars: 1 count-in, then 3 turns of 4 opponent + 4 player bars, no rest bars', () => {
    expect(COUNT_IN_BARS).toBe(1);
    expect(DUEL_BARS).toBe(25);
    expect(turnLayout('echo')).toMatchObject({ opponentBars: [1, 2, 3, 4], playerBars: [5, 6, 7, 8] });
    expect(turnLayout('answer')).toMatchObject({ opponentBars: [9, 10, 11, 12], playerBars: [13, 14, 15, 16] });
    expect(turnLayout('solo')).toMatchObject({ opponentBars: [17, 18, 19, 20], playerBars: [21, 22, 23, 24] });
    expect(barRole(0)).toEqual({ kind: 'countIn' });
    expect(barRole(24)).toEqual({ kind: 'player', turn: 'solo', index: 3 });
    expect(barRole(25)).toBeNull();
    expect(barRole(-1)).toBeNull();
    const roles = Array.from({ length: 25 }, (_, b) => barRole(b));
    expect(roles.every((r) => r !== null)).toBe(true);
    expect(roles.filter((r) => r?.kind === 'opponent')).toHaveLength(12);
    expect(roles.filter((r) => r?.kind === 'player')).toHaveLength(12);
  });

  it('AC-DUEL-004.1: a played duel starts with a count-in and ends turns echo, answer, solo then end', () => {
    const { events, state } = playDuel(base);
    const first = events[0];
    expect(first.type).toBe('countIn');
    if (first.type === 'countIn') {
      expect(first.bar).toBe(0);
      expect(first.resumed).toBe(false);
      expect(first.time).toBe(T0);
    }
    const turnEnds = events.flatMap((e) => (e.type === 'turnEnd' ? [e.result.turn] : []));
    expect(turnEnds).toEqual(['echo', 'answer', 'solo']);
    expect(events[events.length - 1].type).toBe('end');
    expect(state.status).toBe('finished');
    expect(state.result).not.toBeNull();
  });

  it('AC-DUEL-004.1: the duel does not end before the last player bar closes', () => {
    const s0 = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s0.events);
    const r = run(s0.state, [{ type: 'advance', time: stepTime(clock, 24, 7) }]);
    expect(r.state.status).toBe('playing');
    expect(r.events.some((e) => e.type === 'end')).toBe(false);
  });

  it.each(CHARACTERS.flatMap((c) => DIFFICULTIES.map((d) => [c, d] as const)))(
    'AC-DUEL-004.2: echo and answer calls are the composed calls of %s at %s',
    (character, difficulty) => {
      const s = createSession({ ...base, character, difficulty });
      expect(s.calls.echo).toEqual(composedCall(character, difficulty, 'echo'));
      expect(s.calls.answer).toEqual(composedCall(character, difficulty, 'answer'));
      expect(s.calls.echo).toHaveLength(4);
    },
  );

  it('AC-DUEL-004.2: the countIn event carries the calls to schedule from the first turn', () => {
    const { events } = run(createSession(base), [{ type: 'start', time: T0 }]);
    const e = events[0];
    if (e.type !== 'countIn') throw new Error('expected countIn');
    expect(e.calls.map((c) => c.turn)).toEqual(['echo', 'answer', 'solo']);
    expect(e.calls.map((c) => c.firstBar)).toEqual([1, 9, 17]);
    expect(e.calls[0].bars).toEqual(composedCall('aki', 'session', 'echo'));
  });
});

describe('AC-DUEL-003.7 taps on the opponent bars', () => {
  it('AC-DUEL-003.7: a tap on an opponent bar is not counted and has no feedback', () => {
    const s = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s.events);
    const r = run(s.state, [tapAt(clock, 2, 3, 1), tapAt(clock, 0, 4, 2)]);
    const taps = r.events.filter((e) => e.type === 'tap');
    expect(taps).toHaveLength(2);
    for (const t of taps) {
      if (t.type === 'tap') expect([t.counted, t.feedback]).toEqual([false, null]);
    }
    expect(r.state.taps).toHaveLength(0);
  });

  it('AC-DUEL-003.7: opponent-bar taps do not change the score', () => {
    const clean = playDuel(base);
    const started = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(started.events);
    let state = started.state;
    for (const turn of TURNS) {
      const noise = turnLayout(turn).opponentBars.flatMap((bar) => [
        tapAt(clock, bar, 1, 0),
        tapAt(clock, bar, 5, 3),
      ]);
      state = run(state, [...noise, ...perfectTurn(state, clock, turn)]).state;
    }
    expect(state.result?.score).toEqual(clean.state.result?.score);
    expect(state.result?.turns.echo.judge.extraTaps).toHaveLength(0);
    expect(state.result?.turns.answer.judge.extraTaps).toHaveLength(0);
  });

  it('AC-DUEL-003.7: a tap before the first note, near the opponent bars, still pairs when inside OK; a stray one is not an extra tap', () => {
    const s = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s.events);
    const targets = turnTargets(s.state, 'echo');
    const first = targets[0];
    const early = { time: stepTime(clock, first.bar, first.step) - 0.1, button: first.button };
    const rest = targets.slice(1).map((n) => tapAt(clock, n.bar, n.step, n.button));
    const r = run(s.state, [
      tapAt(clock, 3, 2, 1),
      { type: 'tap', tap: early },
      ...rest,
      { type: 'advance', time: stepTime(clock, 9, 0) + 1 },
    ]);
    const end = echoEnd(r.events);
    expect(end.judge.notes[0].grade).toBe('ok');
    expect(end.judge.notes[0].tap).toEqual(early);
    expect(end.judge.extraTaps).toEqual([]);
  });

  it('AC-DUEL-003.7: a tap after the last note, near the next opponent bar, still pairs when inside OK; a stray one is not an extra tap', () => {
    const s = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s.events);
    const targets = turnTargets(s.state, 'echo');
    const last = targets[targets.length - 1];
    const late = { time: stepTime(clock, last.bar, last.step) + 0.12, button: last.button };
    const body = targets.slice(0, -1).map((n) => tapAt(clock, n.bar, n.step, n.button));
    const r = run(s.state, [
      ...body,
      { type: 'tap', tap: late },
      tapAt(clock, 9, 4, 2),
      { type: 'advance', time: stepTime(clock, 9, 0) + 1 },
    ]);
    const end = echoEnd(r.events);
    expect(end.judge.notes[targets.length - 1].grade).toBe('ok');
    expect(end.judge.extraTaps).toEqual([]);
  });

  it('AC-DUEL-003.7: an unpaired tap on the player bars is an extra tap and lowers the timing', () => {
    const s = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s.events);
    const targets = turnTargets(s.state, 'echo');
    const n = targets[0];
    const inputs = [
      ...perfectTurn(s.state, clock, 'echo').slice(0, -1),
      tapAt(clock, n.bar, n.step, ((n.button + 1) % 4) as Button, 60),
    ].sort(byTime);
    inputs.push({ type: 'advance', time: stepTime(clock, 9, 0) + 1 });
    const end = echoEnd(run(s.state, inputs).events);
    expect(end.judge.extraTaps).toHaveLength(1);
    expect(end.timing).toBeLessThan(1);
  });

  it('AC-DUEL-003.7: Solo taps outside the 4 Solo bars are dropped from the Solo score', () => {
    const { state, clock } = afterEchoAnswer();
    const solo = perfectTurn(state, clock, 'solo');
    const plain = soloEnd(run(state, solo).events);

    const before = soloEnd(
      run(state, [tapAt(clock, 20, 7, 1), tapAt(clock, 20, 3, 2), ...solo]).events,
    );
    expect(before.taps).toHaveLength(plain.taps.length);
    expect(before.timing).toBe(plain.timing);
    expect(before.feel).toEqual(plain.feel);

    const after = soloEnd(
      run(state, [...solo.slice(0, -1), tapAt(clock, 24, 7, 2, 300), solo[solo.length - 1]]).events,
    );
    expect(after.taps).toHaveLength(plain.taps.length);
    expect(after.timing).toBe(plain.timing);
    expect(after.feel).toEqual(plain.feel);
  });
});

describe('AC-DUEL-006 quotes in the session', () => {
  const duckBar = (clock: BeatClock, bar: number): SessionInput[] =>
    [0, 2, 3, 6].map((step) => tapAt(clock, bar, step, 1));

  it('AC-DUEL-006.7: a Duck quote in Solo bar 21 schedules its sound at the first beat of bar 22', () => {
    const { state, clock } = afterEchoAnswer();
    const r = run(state, [
      ...duckBar(clock, 21),
      { type: 'advance', time: stepTime(clock, 22, 0) + 0.5 },
      { type: 'advance', time: stepTime(clock, 25, 0) + 1 },
    ]);
    const sounds = r.events.filter((e) => e.type === 'lickSound');
    expect(sounds).toHaveLength(1);
    const snd = sounds[0];
    if (snd.type !== 'lickSound') throw new Error('unreachable');
    expect(snd.lick.id).toBe('duck');
    expect(snd.bar).toBe(21);
    expect(snd.time).toBeCloseTo(stepTime(clock, 22, 0), 6);
    const end = r.events.find((e) => e.type === 'end');
    if (!end || end.type !== 'end') throw new Error('no end');
    expect(end.result.quotes.map((q) => [q.lick.id, q.bar])).toEqual([['duck', 21]]);
  });

  it('AC-DUEL-006.7: a Solo bar that is not a quote schedules no lick sound', () => {
    const { state, clock } = afterEchoAnswer();
    const r = run(state, perfectTurn(state, clock, 'solo'));
    expect(r.events.some((e) => e.type === 'lickSound')).toBe(false);
  });

  it.each(['echo', 'answer'] as const)(
    'AC-DUEL-006.8: playing the exact Duck shape in %s is not a quote',
    (turn) => {
      const s0 = run(createSession(base), [{ type: 'start', time: T0 }]);
      const clock = countInClock(s0.events);
      let state = s0.state;
      if (turn === 'answer') state = run(state, perfectTurn(state, clock, 'echo')).state;
      const bar = turnLayout(turn).playerBars[0];
      const r = run(state, [...duckBar(clock, bar), { type: 'advance', time: stepTime(clock, bar + 4, 0) + 1 }]);
      expect(r.events.some((e) => e.type === 'lickSound')).toBe(false);
      expect(r.state.quotes).toEqual([]);
    },
  );

  it('AC-DUEL-006.8: a full duel with Duck shapes in Echo and Answer has no quotes and no bonus', () => {
    const s0 = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s0.events);
    let state = s0.state;
    const all: SessionEvent[] = [];
    for (const turn of TURNS) {
      const inputs =
        turn === 'solo'
          ? perfectTurn(state, clock, turn)
          : [...duckBar(clock, turnLayout(turn).playerBars[0]), ...perfectTurn(state, clock, turn)].sort(byTime);
      const r = run(state, inputs);
      state = r.state;
      all.push(...r.events);
    }
    expect(all.some((e) => e.type === 'lickSound')).toBe(false);
    expect(state.result?.quotes).toEqual([]);
  });
});

describe('AC-DUEL-014.2 pause and resume', () => {
  it('AC-DUEL-014.2: pausing drops the turn taps, resuming counts in and replays the turn from the call', () => {
    const s0 = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s0.events);
    const dirty = run(s0.state, [
      tapAt(clock, 5, 1, 3, 20),
      { type: 'pause', time: stepTime(clock, 5, 4) },
    ]);
    expect(dirty.state.status).toBe('paused');
    expect(dirty.events.find((e) => e.type === 'paused')).toMatchObject({ turn: 'echo' });
    expect(dirty.state.taps).toEqual([]);

    const ignored = run(dirty.state, [{ type: 'tap', tap: { time: 50, button: 0 } }]);
    expect(ignored.state.taps).toEqual([]);

    const resumed = run(dirty.state, [{ type: 'resume', time: 100 }]);
    const ev = resumed.events[0];
    if (ev.type !== 'countIn') throw new Error('expected countIn');
    expect(ev.resumed).toBe(true);
    expect(ev.turn).toBe('echo');
    expect(ev.bar).toBe(0);
    expect(ev.time).toBe(100);
    expect(ev.calls[0].turn).toBe('echo');
    expect(resumed.state.status).toBe('playing');

    const r = run(resumed.state, perfectTurn(resumed.state, ev.clock, 'echo'));
    const end = echoEnd(r.events);
    expect(end.judge.extraTaps).toEqual([]);
    expect(end.timing).toBe(1);
  });

  it('AC-DUEL-014.2: pausing in the Answer turn keeps the Echo result and counts in before Answer', () => {
    const s0 = run(createSession(base), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s0.events);
    const echo = run(s0.state, perfectTurn(s0.state, clock, 'echo'));
    const echoResult = echo.state.turns.echo;
    expect(echoResult).toBeDefined();
    const p = run(echo.state, [{ type: 'pause', time: stepTime(clock, 14, 0) }]);
    expect(p.events.find((e) => e.type === 'paused')).toMatchObject({ turn: 'answer' });
    const r = run(p.state, [{ type: 'resume', time: 200 }]);
    const ev = r.events[0];
    if (ev.type !== 'countIn') throw new Error('expected countIn');
    expect(ev.turn).toBe('answer');
    expect(ev.bar).toBe(8);
    expect(ev.calls.map((c) => c.turn)).toEqual(['answer', 'solo']);
    expect(r.state.turns.echo).toEqual(echoResult);
    let state = r.state;
    for (const turn of ['answer', 'solo'] as const) state = run(state, perfectTurn(state, ev.clock, turn)).state;
    expect(state.status).toBe('finished');
    expect(state.result?.turns.echo).toEqual(echoResult);
  });

  it('AC-DUEL-014.2: pause and resume do nothing in the wrong status', () => {
    const s = createSession(base);
    expect(run(s, [{ type: 'pause', time: 1 }]).state.status).toBe('ready');
    const started = run(s, [{ type: 'start', time: T0 }]).state;
    expect(run(started, [{ type: 'resume', time: 20 }]).events).toEqual([]);
  });
});

describe('AC-DUEL-012.4 / 002.3 campaign', () => {
  it('AC-DUEL-012.4: no character means Ren: duel 1 is Shadow Aki at 84, duel 2 Sayo at 96', () => {
    for (const player of [undefined, null]) {
      const c = createCampaign({ player, difficulty: 'lounge', offsetMs: 0 });
      expect(c.player).toBe('ren');
      expect(duelConfig(c)).toMatchObject({ character: 'aki', bpm: 84, duel: 1 });
      expect(duelConfig({ ...c, duel: 2 })).toMatchObject({ character: 'sayo', bpm: 96, duel: 2 });
      expect(createDuelSession(c).config).toMatchObject({ character: 'aki', bpm: 84 });
    }
  });

  it('AC-DUEL-012.4: other characters give their own Shadows', () => {
    const aki = createCampaign({ player: 'aki', difficulty: 'lounge', offsetMs: 0 });
    expect(duelConfig(aki).character).toBe('sayo');
    expect(duelConfig({ ...aki, duel: 2 }).character).toBe('ren');
    const sayo = createCampaign({ player: 'sayo', difficulty: 'lounge', offsetMs: 0 });
    expect(duelConfig(sayo).character).toBe('aki');
    expect(duelConfig({ ...sayo, duel: 2 }).character).toBe('ren');
  });

  it('AC-DUEL-002.3: both duels use the same calibration offset', () => {
    const c1 = createCampaign({ difficulty: 'session', offsetMs: 52 });
    const win = playDuel(duelConfig(c1)).state.result as DuelResult;
    expect(win.score.won).toBe(true);
    const c2 = advanceDuel(recordResult(c1, win));
    expect(c2.duel).toBe(2);
    expect(duelConfig(c1).offsetMs).toBe(52);
    expect(duelConfig(c2).offsetMs).toBe(52);
    expect(createDuelSession(c1).config.offsetMs).toBe(52);
    expect(createDuelSession(c2).config.offsetMs).toBe(52);
    expect(duelConfig(c2)).toMatchObject({ character: 'sayo', bpm: 96, difficulty: 'session' });
    expect(duelConfig(restartCampaign(c2)).offsetMs).toBe(52);
  });

  it('AC-DUEL-002.3: the session removes the offset from every tap', () => {
    const s = run(createSession({ ...base, offsetMs: 50 }), [{ type: 'start', time: T0 }]);
    const clock = countInClock(s.events);
    const n = turnTargets(s.state, 'echo')[0];
    const r = run(s.state, [tapAt(clock, n.bar, n.step, n.button, 50)]);
    expect(r.events.find((e) => e.type === 'tap')).toMatchObject({ counted: true, feedback: 'perfect' });
  });

  it('AC-DUEL-002.3: a non-finite offset is rejected', () => {
    expect(() => createCampaign({ difficulty: 'session', offsetMs: Number.NaN })).toThrow(RangeError);
  });

  it('campaign: a loss does not advance, two losses offer assist once, accepting widens windows', () => {
    let c = createCampaign({ difficulty: 'session', offsetMs: 0 });
    const win = playDuel(duelConfig(c)).state.result as DuelResult;
    const lost = { ...win, score: { ...win.score, won: false, stars: 0 } } as DuelResult;
    c = recordResult(c, lost);
    expect(canAdvance(c)).toBe(false);
    expect(shouldOfferAssist(c)).toBe(false);
    c = recordResult(c, lost);
    expect(shouldOfferAssist(c)).toBe(true);
    c = acceptAssist(c);
    expect(shouldOfferAssist(c)).toBe(false);
    expect(createDuelSession(c).config.assisted).toBe(true);
  });
});
