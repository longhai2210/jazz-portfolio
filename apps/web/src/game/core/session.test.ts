import { composedCall, invertButton, TURNS } from './call';
import { stepTime, type BeatClock } from './clock';
import { DIFFICULTIES } from './config';
import type { DirectionTurn } from './direction';
import { detectQuote } from './lick';
import { CHARACTERS } from './roster';
import { judgeGridTaps } from './scoring';
import {
  barRole,
  createSession,
  DUEL_BARS,
  phaseAt,
  sessionJudgeContext,
  stepSession,
  turnLayout,
  turnTargets,
  type SessionEvent,
  type SessionInput,
  type SessionOptions,
  type SessionPhase,
  type SessionState,
} from './session';
import type { Button, Tap } from './types';

const T0 = 10;

/** The player's Solo bars, as `turnLayout` gives them. */
const SOLO_BARS = turnLayout('solo').playerBars;

/**
 * A Solo without any lick: [Solo bar index, step, button]. Four different rhythms, rests, no
 * button over 60%, and only the first bar has the 3 hits a best bar needs.
 */
const SOLO_PLAN: readonly (readonly [number, number, Button])[] = [
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

function newSession(options: Partial<SessionOptions> = {}): SessionState {
  return createSession({
    character: 'aki',
    difficulty: 'session',
    duel: 1,
    offsetMs: 0,
    ...options,
  });
}

interface Run {
  readonly state: SessionState;
  readonly events: SessionEvent[];
}

/** Applies the inputs in the order given and collects every event. */
function run(state: SessionState, inputs: readonly SessionInput[]): Run {
  let current = state;
  const events: SessionEvent[] = [];
  for (const input of inputs) {
    const step = stepSession(current, input);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

/** A session started at `t0`. */
function started(options: Partial<SessionOptions> = {}, t0 = T0): SessionState {
  return run(newSession(options), [{ type: 'start', time: t0 }]).state;
}

function clockOf(state: SessionState): BeatClock {
  if (state.clock === null) throw new Error('not started');
  return state.clock;
}

/** A tap `deltaMs` away from step `step` of bar `bar` once the offset is removed. */
function tapAt(
  state: SessionState,
  bar: number,
  step: number,
  button: Button = 0,
  deltaMs = 0,
): SessionInput {
  const time = stepTime(clockOf(state), bar, step) + (state.config.offsetMs + deltaMs) / 1000;
  return { type: 'tap', tap: { time, button } };
}

function advance(time: number): SessionInput {
  return { type: 'advance', time };
}

/** An advance past the last bar of the duel. */
function afterDuel(state: SessionState): SessionInput {
  return advance(stepTime(clockOf(state), DUEL_BARS, 0) + 1);
}

/** Taps every target note on time: Echo copies the opponent's buttons, Answer inverts them. */
function callTaps(state: SessionState, turn: DirectionTurn): SessionInput[] {
  return turnTargets(state, turn).map((note) =>
    tapAt(state, note.bar, note.step, turn === 'echo' ? note.button : invertButton(note.button)),
  );
}

function soloTaps(state: SessionState, plan = SOLO_PLAN): SessionInput[] {
  return plan.map(([index, step, button]) => tapAt(state, SOLO_BARS[index], step, button));
}

function inputTime(input: SessionInput): number {
  return input.type === 'tap' ? input.tap.time : input.time;
}

function tapOf(input: SessionInput): Tap {
  if (input.type !== 'tap') throw new Error(`not a tap: ${input.type}`);
  return input.tap;
}

/** The inputs of every list, in time order. */
function inOrder(...lists: readonly (readonly SessionInput[])[]): SessionInput[] {
  return lists.flat().sort((a, b) => inputTime(a) - inputTime(b));
}

/** A whole duel: perfect Echo and Answer, then `solo`, then the end. */
function playDuel(state: SessionState, extra: readonly SessionInput[] = [], solo = soloTaps(state)): Run {
  const inputs = inOrder(callTaps(state, 'echo'), callTaps(state, 'answer'), solo, extra);
  return run(state, [...inputs, afterDuel(state)]);
}

function eventsOfType<T extends SessionEvent['type']>(
  events: readonly SessionEvent[],
  type: T,
): Extract<SessionEvent, { type: T }>[] {
  return events.filter((event): event is Extract<SessionEvent, { type: T }> => event.type === type);
}

function resultOf(state: SessionState) {
  if (state.result === null) throw new Error('the duel has not finished');
  return state.result;
}

function phaseName(phase: SessionPhase): string {
  return phase.kind === 'opponent' || phase.kind === 'player'
    ? `${phase.turn}:${phase.kind}`
    : phase.kind;
}

describe('duel layout', () => {
  it('AC-DUEL-004.1: a duel is 1 count-in bar, then Echo, Answer and Solo, each 4 opponent bars and 4 player bars, 25 bars in all', () => {
    expect(DUEL_BARS).toBe(25);
    expect(TURNS).toEqual(['echo', 'answer', 'solo']);
    expect(turnLayout('echo')).toEqual({
      turn: 'echo',
      opponentBars: [1, 2, 3, 4],
      playerBars: [5, 6, 7, 8],
    });
    expect(turnLayout('answer')).toEqual({
      turn: 'answer',
      opponentBars: [9, 10, 11, 12],
      playerBars: [13, 14, 15, 16],
    });
    expect(turnLayout('solo')).toEqual({
      turn: 'solo',
      opponentBars: [17, 18, 19, 20],
      playerBars: [21, 22, 23, 24],
    });

    const roles = Array.from({ length: DUEL_BARS }, (_, bar) => {
      const role = barRole(bar);
      return role === null || role.kind === 'countIn' ? String(role?.kind) : `${role.turn}:${role.kind}`;
    });
    const half = (turn: string, side: string) => Array<string>(4).fill(`${turn}:${side}`);
    expect(roles).toEqual([
      'countIn',
      ...TURNS.flatMap((turn) => [...half(turn, 'opponent'), ...half(turn, 'player')]),
    ]);
    expect(barRole(-1)).toBeNull();
    expect(barRole(DUEL_BARS)).toBeNull();
  });

  it('AC-DUEL-004.1: played straight through, the phases follow that order and the duel ends after the 25th bar', () => {
    let state = started();
    const clock = clockOf(state);
    const phases: string[] = [];
    const events: SessionEvent[] = [];
    for (let bar = 0; bar <= DUEL_BARS; bar += 1) {
      const middle = stepTime(clock, bar, 4);
      const step = stepSession(state, advance(middle));
      state = step.state;
      events.push(...step.events);
      phases.push(phaseName(phaseAt(state, middle)));
      if (bar < DUEL_BARS) expect(state.status).toBe('playing');
    }

    const half = (turn: string, side: string) => Array<string>(4).fill(`${turn}:${side}`);
    expect(phases).toEqual([
      'countIn',
      ...half('echo', 'opponent'),
      ...half('echo', 'player'),
      ...half('answer', 'opponent'),
      ...half('answer', 'player'),
      ...half('solo', 'opponent'),
      ...half('solo', 'player'),
      'finished',
    ]);
    expect(eventsOfType(events, 'turnEnd').map((event) => event.result.turn)).toEqual([
      'echo',
      'answer',
      'solo',
    ]);
    expect(eventsOfType(events, 'end')).toHaveLength(1);
    expect(events[events.length - 1].type).toBe('end');
    expect(state.status).toBe('finished');
  });

  it('AC-DUEL-004.1: the start emits one count-in on bar 0 with the three calls at bars 1, 9 and 17', () => {
    const { state, events } = run(newSession(), [{ type: 'start', time: T0 }]);
    expect(events).toEqual([
      {
        type: 'countIn',
        turn: 'echo',
        bar: 0,
        time: T0,
        clock: state.clock,
        resumed: false,
        calls: [
          { turn: 'echo', firstBar: 1, bars: state.calls.echo },
          { turn: 'answer', firstBar: 9, bars: state.calls.answer },
          { turn: 'solo', firstBar: 17, bars: state.calls.solo },
        ],
      },
    ]);
    expect(phaseAt(state, T0 + 0.01)).toEqual({ kind: 'countIn', turn: 'echo', bar: 0, beat: 0 });
  });
});

describe('opponent calls', () => {
  it("AC-DUEL-004.2: Echo and Answer play the Shadow's composed call at the chosen difficulty", () => {
    const bestBar = [{ step: 0, button: 0 as Button }, { step: 2, button: 2 as Button }];
    for (const character of CHARACTERS) {
      for (const difficulty of DIFFICULTIES) {
        for (const duel of [1, 2] as const) {
          const state = newSession({ character, difficulty, duel, bestBar });
          expect(state.calls.echo).toEqual(composedCall(character, difficulty, 'echo'));
          expect(state.calls.answer).toEqual(composedCall(character, difficulty, 'answer'));
        }
      }
    }
  });

  it("AC-DUEL-004.2: the player is judged in the player's bars against that call, with the opponent's buttons", () => {
    const state = started({ character: 'sayo', difficulty: 'lateSet' });
    const answer = composedCall('sayo', 'lateSet', 'answer');
    expect(turnTargets(state, 'answer')).toEqual(
      answer.flatMap((bar, index) =>
        bar.notes.map((note) => ({ bar: 13 + index, step: note.step, button: note.button })),
      ),
    );

    const result = resultOf(playDuel(state).state);
    for (const turn of ['echo', 'answer'] as const) {
      const { judge, timing, direction } = result.turns[turn];
      expect(judge.notes.map((judged) => judged.note)).toEqual(turnTargets(state, turn));
      expect(judge.notes.every((judged) => judged.grade === 'perfect')).toBe(true);
      expect(timing).toBe(1);
      expect(direction.score).toBe(1);
    }
    expect(result.score.stars).toBe(3);
  });
});

describe("taps on the opponent's bars", () => {
  it('AC-DUEL-003.7: Echo and Answer taps on the count-in or the opponent bars change no score, not even as extra taps', () => {
    const state = started();
    const noise = [
      tapAt(state, 0, 2, 3),
      tapAt(state, 1, 0, 0),
      tapAt(state, 2, 3, 1),
      tapAt(state, 3, 5, 2),
      tapAt(state, 4, 3, 3),
      tapAt(state, 9, 1, 0),
      tapAt(state, 10, 6, 3),
      tapAt(state, 12, 2, 1),
    ];
    const clean = playDuel(state);
    const noisy = playDuel(state, noise);

    const cleanResult = resultOf(clean.state);
    const noisyResult = resultOf(noisy.state);
    expect(noisyResult.turns.echo).toEqual(cleanResult.turns.echo);
    expect(noisyResult.turns.answer).toEqual(cleanResult.turns.answer);
    expect(noisyResult.score).toEqual(cleanResult.score);
    expect(noisyResult.turns.echo.judge.extraTaps).toEqual([]);
    expect(noisyResult.turns.answer.judge.extraTaps).toEqual([]);
    expect(noisyResult.turns.echo.timing).toBe(1);

    const noiseTaps = new Set(noise.map(tapOf));
    const noiseEvents = eventsOfType(noisy.events, 'tap').filter((event) => noiseTaps.has(event.tap));
    expect(noiseEvents).toHaveLength(noise.length);
    expect(noiseEvents.every((event) => !event.counted && event.feedback === null)).toBe(true);
  });

  it('an unpaired tap on a player bar is still an extra tap', () => {
    const state = started();
    // Aki's Session Echo, bar 2 is 'F.D.F.JK': step 1 has no note, and is 357 ms from its neighbours.
    const result = resultOf(playDuel(state, [tapAt(state, 6, 1, 0)]).state);
    expect(result.turns.echo.judge.extraTaps).toHaveLength(1);
    expect(result.turns.echo.timing).toBeLessThan(1);
  });

  it('AC-DUEL-003.7: Solo taps on the opponent bars, or placed on the grid before the first Solo bar, are left out of every Solo score', () => {
    const state = started();
    const noise = [
      // Vịt (2, 3, 6) on the opponent's bar 18: no quote either.
      tapAt(state, 18, 2, 0),
      tapAt(state, 18, 3, 0),
      tapAt(state, 18, 6, 0),
      tapAt(state, 17, 0, 3),
      tapAt(state, 19, 5, 3),
      // 10 ms late on the last step of bar 20: its nearest grid step is still on bar 20.
      tapAt(state, 20, 7, 3, 10),
    ];
    const clean = playDuel(state);
    const noisy = playDuel(state, noise);

    const cleanSolo = resultOf(clean.state).turns.solo;
    const noisySolo = resultOf(noisy.state).turns.solo;
    expect(noisySolo).toEqual(cleanSolo);
    expect(noisySolo.taps.every((judged) => SOLO_BARS.includes(judged.bar))).toBe(true);
    const noiseTaps = new Set(noise.map(tapOf));
    const noiseEvents = eventsOfType(noisy.events, 'tap').filter((event) => noiseTaps.has(event.tap));
    expect(noiseEvents).toHaveLength(noise.length);
    expect(noiseEvents.every((event) => !event.counted && event.feedback === null)).toBe(true);
    expect(eventsOfType(noisy.events, 'lickSound')).toEqual([]);
    expect(resultOf(noisy.state).score).toEqual(resultOf(clean.state).score);
  });

  it('AC-DUEL-003.7: a Solo tap a little early for the first Solo bar is placed on that bar and counts', () => {
    const state = started();
    const early = tapAt(state, SOLO_BARS[0], 0, 0, -30);
    const solo = [early, ...soloTaps(state).slice(1)];
    const { state: end, events } = playDuel(state, [], solo);

    const event = eventsOfType(events, 'tap').find((tapEvent) => tapEvent.tap === tapOf(early));
    expect(event).toMatchObject({ counted: true, feedback: 'perfect' });
    const first = resultOf(end).turns.solo.taps[0];
    expect(first).toMatchObject({ bar: SOLO_BARS[0], step: 0, grade: 'perfect' });
    expect(first.deltaMs).toBeCloseTo(-30, 6);
  });

  it("AC-DUEL-003.7: a tap meant for the first or last note of the player's bars pairs with it even when it lands on an opponent bar", () => {
    // Late Set at 96 BPM: the swung step 7 is 208 ms before the next bar, so a tap 108 ms off
    // either side of that gap is nearer the opponent's bar, yet inside the 112 ms OK window.
    const state = started({ difficulty: 'lateSet', bpm: 96 });
    const targets = turnTargets(state, 'echo');
    const first = targets[0];
    const last = targets[targets.length - 1];
    expect(first).toMatchObject({ bar: 5, step: 0 });
    expect(last).toMatchObject({ bar: 8, step: 7 });

    const early = tapAt(state, first.bar, first.step, first.button, -108);
    const late = tapAt(state, last.bar, last.step, last.button, 108);
    const context = sessionJudgeContext(state);
    expect(judgeGridTaps([tapOf(early), tapOf(late)], context).map((judged) => judged.bar)).toEqual([
      4, 9,
    ]);

    const middle = callTaps(state, 'echo').slice(1, -1);
    const { state: end, events } = run(state, [early, ...middle, late, afterDuel(state)]);
    const notes = resultOf(end).turns.echo.judge.notes;
    expect(notes[0]).toMatchObject({ grade: 'ok' });
    expect(notes[0].deltaMs).toBeCloseTo(-108, 6);
    expect(notes[notes.length - 1]).toMatchObject({ grade: 'ok' });
    expect(notes[notes.length - 1].deltaMs).toBeCloseTo(108, 6);
    expect(eventsOfType(events, 'tap').every((event) => event.counted)).toBe(true);
  });

  it('AC-DUEL-003.7: a tap on an opponent bar that loses its note to a closer tap is not an extra tap', () => {
    const state = started({ difficulty: 'lateSet', bpm: 96 });
    const [first] = turnTargets(state, 'echo');
    const early = tapAt(state, first.bar, first.step, first.button, -108);
    const result = resultOf(playDuel(state, [early]).state);
    expect(result.turns.echo.judge.extraTaps).toEqual([]);
    expect(result.turns.echo.timing).toBe(1);
  });
});

describe('quotes', () => {
  it('AC-DUEL-006.7: a quoted Solo bar schedules the lick sound on the first beat of the next bar', () => {
    const state = started({ offsetMs: 30 });
    const clock = clockOf(state);
    const [bar] = SOLO_BARS;
    const duck = [tapAt(state, bar, 2, 0), tapAt(state, bar, 3, 1), tapAt(state, bar, 6, 2)];

    const open = run(state, [...duck, advance(stepTime(clock, bar, 7))]);
    expect(eventsOfType(open.events, 'lickSound')).toEqual([]);

    const nextBar = stepTime(clock, bar + 1, 0);
    const closed = run(open.state, [advance(nextBar - 0.12)]);
    const sounds = eventsOfType(closed.events, 'lickSound');
    expect(sounds).toHaveLength(1);
    // The sound sits on the beat of the clock, and is known before it: the offset only moves taps.
    expect(sounds[0]).toMatchObject({ bar, time: nextBar });
    expect(sounds[0].lick.id).toBe('duck');

    const result = resultOf(run(closed.state, [afterDuel(state)]).state);
    expect(result.quotes.map((quote) => [quote.lick.id, quote.bar])).toEqual([['duck', bar]]);
    expect(result.score.quoteBonus).toBe(5);
  });

  it('AC-DUEL-006.7: a quote in the last Solo bar schedules its sound on the bar after the duel, before the end', () => {
    const state = started();
    const bar = SOLO_BARS[SOLO_BARS.length - 1];
    const frog = [tapAt(state, bar, 0, 0), tapAt(state, bar, 3, 2), tapAt(state, bar, 5, 3)];
    const { events } = run(state, [...frog, afterDuel(state)]);

    const types = events.filter((event) => event.type !== 'tap').map((event) => event.type);
    expect(types.slice(-3)).toEqual(['lickSound', 'turnEnd', 'end']);
    const [sound] = eventsOfType(events, 'lickSound');
    expect(sound).toMatchObject({ bar, time: stepTime(clockOf(state), DUEL_BARS, 0) });
    expect(sound.lick.id).toBe('frog');
  });

  it('AC-DUEL-006.8: playing the rhythm of a lick in Echo or Answer is no quote', () => {
    const state = started();
    const shape = (bar: number) => [2, 3, 6].map((step) => tapAt(state, bar, step, 0));
    const echoBar = turnLayout('echo').playerBars[0];
    const answerBar = turnLayout('answer').playerBars[1];
    const lickTaps = [...shape(echoBar), ...shape(answerBar)];

    // The same taps would quote Vịt in a Solo bar.
    const taps = lickTaps.map(tapOf);
    const context = sessionJudgeContext(state);
    expect(detectQuote(taps, echoBar, context)?.lick.id).toBe('duck');
    expect(detectQuote(taps, answerBar, context)?.lick.id).toBe('duck');

    const { state: end, events } = run(state, [...lickTaps, afterDuel(state)]);
    expect(eventsOfType(events, 'lickSound')).toEqual([]);
    const result = resultOf(end);
    expect(result.quotes).toEqual([]);
    expect(result.turns.solo.quotes).toEqual([]);
    expect(result.score.quoteBonus).toBe(0);
  });
});

describe('pause and resume', () => {
  it("AC-DUEL-014.2: after a pause, one count-in bar plays, then the current turn starts again from the opponent's call", () => {
    const state = started();
    const pauseAt = stepTime(clockOf(state), 10, 4);
    const paused = run(state, [...callTaps(state, 'echo'), { type: 'pause', time: pauseAt }]);
    expect(eventsOfType(paused.events, 'paused')).toEqual([{ type: 'paused', turn: 'answer' }]);
    expect(paused.state.status).toBe('paused');
    expect(phaseAt(paused.state, pauseAt + 5)).toEqual({ kind: 'paused', turn: 'answer' });

    const resumeAt = pauseAt + 42;
    const resumed = run(paused.state, [{ type: 'resume', time: resumeAt }]);
    const clock = clockOf(resumed.state);
    expect(resumed.events).toHaveLength(1);
    const [countIn] = eventsOfType(resumed.events, 'countIn');
    expect(countIn).toMatchObject({ turn: 'answer', bar: 8, resumed: true, clock });
    expect(countIn.time).toBeCloseTo(resumeAt, 9);
    expect(countIn.calls).toEqual([
      { turn: 'answer', firstBar: 9, bars: state.calls.answer },
      { turn: 'solo', firstBar: 17, bars: state.calls.solo },
    ]);

    expect(phaseAt(resumed.state, resumeAt + 0.01)).toEqual({
      kind: 'countIn',
      turn: 'answer',
      bar: 8,
      beat: 0,
    });
    expect(phaseAt(resumed.state, stepTime(clock, 8, 6) + 0.01)).toMatchObject({
      kind: 'countIn',
      beat: 3,
    });
    expect(phaseAt(resumed.state, stepTime(clock, 9, 0) + 0.01)).toEqual({
      kind: 'opponent',
      turn: 'answer',
      bar: 9,
      index: 0,
    });
    expect(phaseAt(resumed.state, stepTime(clock, 13, 0) + 0.01)).toEqual({
      kind: 'player',
      turn: 'answer',
      bar: 13,
      index: 0,
    });
  });

  it('AC-DUEL-014.2: the restarted turn is scored from scratch and the finished turns keep their scores', () => {
    const state = started();
    const echo = run(state, [...callTaps(state, 'echo')]);
    const sloppy = [
      tapAt(state, 13, 0, 0, 120),
      tapAt(state, 13, 1, 0),
      tapAt(state, 13, 3, 0),
      tapAt(state, 14, 2, 0, -100),
      tapAt(state, 14, 5, 0),
    ];
    const paused = run(echo.state, [...sloppy, { type: 'pause', time: stepTime(clockOf(state), 14, 6) }]);
    const echoResult = paused.state.turns.echo;
    expect(echoResult?.timing).toBe(1);
    expect(paused.state.taps).toEqual([]);

    const resumed = run(paused.state, [{ type: 'resume', time: inputTime(sloppy[4]) + 7 }]);
    const again = resumed.state;
    const { state: end, events } = run(again, [
      ...inOrder(callTaps(again, 'answer'), soloTaps(again)),
      afterDuel(again),
    ]);
    const result = resultOf(end);
    // Answer ends once, after the restart.
    const turnEnds = eventsOfType([...paused.events, ...events], 'turnEnd');
    expect(turnEnds.map((event) => event.result.turn)).toEqual(['echo', 'answer', 'solo']);
    expect(result.turns.echo).toBe(echoResult);
    expect(result.turns.answer.timing).toBe(1);
    expect(result.turns.answer.direction.score).toBe(1);
    expect(result.turns.answer.judge.extraTaps).toEqual([]);
    expect(result.score.stars).toBe(3);
  });

  it('AC-DUEL-014.2: pausing in the Solo turn after a quote drops that quote, and the Solo starts over', () => {
    const state = started();
    const clock = clockOf(state);
    const [bar] = SOLO_BARS;
    const duck = [tapAt(state, bar, 2, 0), tapAt(state, bar, 3, 1), tapAt(state, bar, 6, 2)];
    const pauseAt = stepTime(clock, bar + 1, 4);
    const paused = run(state, [
      ...inOrder(callTaps(state, 'echo'), callTaps(state, 'answer'), duck),
      { type: 'pause', time: pauseAt },
    ]);
    expect(eventsOfType(paused.events, 'lickSound')).toHaveLength(1);
    expect(eventsOfType(paused.events, 'paused')).toEqual([{ type: 'paused', turn: 'solo' }]);
    expect(paused.state.quotes).toEqual([]);

    const resumed = run(paused.state, [{ type: 'resume', time: pauseAt + 3 }]);
    expect(eventsOfType(resumed.events, 'countIn')[0]).toMatchObject({ turn: 'solo', bar: 16 });
    const again = resumed.state;
    const { state: end, events } = run(again, [...soloTaps(again), afterDuel(again)]);

    const result = resultOf(end);
    expect(eventsOfType(events, 'lickSound')).toEqual([]);
    expect(result.quotes).toEqual([]);
    expect(result.score.quoteBonus).toBe(0);
    expect(result.turns.solo.taps).toHaveLength(SOLO_PLAN.length);
    expect(result.turns.solo.timing).toBe(1);
    expect(result.turns.solo.feel.score).toBe(1);
  });

  it('AC-DUEL-014.2: pausing during the count-in restarts the count-in', () => {
    const state = started();
    const paused = run(state, [{ type: 'pause', time: T0 + 1 }]);
    expect(eventsOfType(paused.events, 'paused')).toEqual([{ type: 'paused', turn: 'echo' }]);

    const resumeAt = T0 + 20;
    const resumed = run(paused.state, [{ type: 'resume', time: resumeAt }]);
    expect(eventsOfType(resumed.events, 'countIn')[0]).toMatchObject({
      turn: 'echo',
      bar: 0,
      time: resumeAt,
      resumed: true,
    });
    expect(phaseAt(resumed.state, resumeAt + 0.01)).toEqual({
      kind: 'countIn',
      turn: 'echo',
      bar: 0,
      beat: 0,
    });
    expect(clockOf(resumed.state).t0).toBe(resumeAt);
  });

  it('pausing once the last player bar of a turn has gone by scores that turn and restarts the next one', () => {
    // With a 200 ms offset, a late tap on the last Echo note can still come in during bar 9.
    const state = started({ difficulty: 'lateSet', bpm: 96, offsetMs: 200 });
    const pauseAt = stepTime(clockOf(state), 9, 0) + 0.05;
    const { state: paused, events } = run(state, [
      ...callTaps(state, 'echo'),
      { type: 'pause', time: pauseAt },
    ]);
    expect(events.filter((event) => event.type !== 'tap').map((event) => event.type)).toEqual([
      'turnEnd',
      'paused',
    ]);
    expect(paused.turns.echo?.timing).toBe(1);
    expect(eventsOfType(events, 'paused')).toEqual([{ type: 'paused', turn: 'answer' }]);
  });

  it('ignores taps while paused, a second pause, and a resume or start while playing', () => {
    const state = started();
    const paused = run(state, [{ type: 'pause', time: T0 + 1 }]).state;
    expect(run(paused, [tapAt(state, 5, 0), { type: 'pause', time: T0 + 2 }]).events).toEqual([]);
    expect(run(paused, [advance(T0 + 60)]).state.status).toBe('paused');

    expect(run(state, [{ type: 'resume', time: T0 + 1 }]).events).toEqual([]);
    expect(run(state, [{ type: 'start', time: T0 + 1 }]).events).toEqual([]);
    expect(run(newSession(), [tapAt(state, 5, 0), advance(T0 + 5)]).events).toEqual([]);
  });
});

describe('session', () => {
  it('a perfect duel scores every turn 1 and keeps the best Solo bar', () => {
    const state = started();
    const result = resultOf(playDuel(state).state);
    expect(result.turns.solo.timing).toBe(1);
    expect(result.turns.solo.feel.score).toBe(1);
    expect(result.score).toMatchObject({ total: 100, stars: 3, won: true, quoteBonus: 0 });
    expect(result.bestBar).toEqual([
      { step: 0, button: 0 },
      { step: 2, button: 1 },
      { step: 4, button: 2 },
    ]);
    expect(result).toMatchObject({ duel: 1, character: 'aki', difficulty: 'session', assisted: false });
  });

  it('a silent duel is a loss with no best bar', () => {
    const state = started();
    const result = resultOf(run(state, [afterDuel(state)]).state);
    expect(result.score).toMatchObject({ total: 0, stars: 0, won: false });
    expect(result.bestBar).toBeNull();
  });

  it('gives each counted tap a feedback: its grade so far, or extra', () => {
    const state = started();
    const [first] = turnTargets(state, 'echo');
    const { events } = run(state, [
      tapAt(state, first.bar, first.step, first.button, 60),
      tapAt(state, 6, 1, 0),
      tapAt(state, SOLO_BARS[0], 3, 0, -100),
    ]);
    expect(eventsOfType(events, 'tap').map((event) => event.feedback)).toEqual([
      'great',
      'extra',
      'ok',
    ]);
  });

  it('rejects an unknown character, difficulty or duel, a bad tempo or offset, and times that are not finite', () => {
    expect(() => newSession({ character: 'miles' as never })).toThrow(RangeError);
    expect(() => newSession({ difficulty: 'hard' as never })).toThrow(RangeError);
    expect(() => newSession({ duel: 3 as never })).toThrow(RangeError);
    expect(() => newSession({ bpm: 0 })).toThrow(RangeError);
    expect(() => newSession({ offsetMs: Number.NaN })).toThrow(RangeError);
    expect(() => stepSession(newSession(), { type: 'start', time: Number.NaN })).toThrow(RangeError);
    expect(() =>
      stepSession(started(), { type: 'tap', tap: { time: T0 + 1, button: 4 as never } }),
    ).toThrow(RangeError);
  });

  it('uses the tempo of the duel by default', () => {
    expect(clockOf(started({ duel: 1 })).bpm).toBe(84);
    expect(clockOf(started({ duel: 2 })).bpm).toBe(96);
  });
});
