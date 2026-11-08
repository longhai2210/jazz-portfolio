/**
 * One duel as a pure state machine (design 6, 7, 11): a count-in bar, then the Echo, Answer and
 * Solo turns, each made of 4 bars of the opponent's call and 4 bars of the player's reply.
 *
 * The session never reads a clock. Every input carries a time in seconds on the audio clock
 * (`AudioContext.currentTime`), and `stepSession` returns the next state with the events the
 * caller acts on: schedule the count-in and the calls, play a lick sound, show a result. A state
 * is never changed in place. Times passed in should not go backwards.
 *
 * Bars are numbered on the duel clock (see `turnLayout`): bar 0 is the count-in, and turn i of
 * TURNS has the opponent's bars 1 + 8i to 4 + 8i and the player's bars 5 + 8i to 8 + 8i, 25 bars in
 * all. A resume moves the clock so that the bar before the current turn is the new count-in;
 * every bar keeps its number.
 */
import { pickBestBar, type BestBar } from './best-bar';
import { BARS_PER_CALL, opponentCall, TURNS } from './call';
import {
  correctedTime,
  createBeatClock,
  secondsPerBeat,
  secondsToMs,
  stepTime,
  timeToBeat,
  type BeatClock,
} from './clock';
import { BEATS_PER_BAR, BUTTONS, DIFFICULTIES, DUEL_BPM, GRID_STEPS } from './config';
import { LICKS } from './data/licks';
import { scoreDirection, type DirectionResult, type DirectionTurn } from './direction';
import { scoreFeel, type FeelResult } from './feel';
import { gradeDelta, hitWindows, judgeTaps, type JudgeContext } from './judge';
import { detectQuote, quoteBonus, type LickMatch } from './lick';
import { isCharacter, type Character } from './roster';
import {
  callTurnTiming,
  judgeGridTaps,
  scoreDuel,
  soloTurnTiming,
  type DuelScore,
  type GridTapJudgement,
} from './scoring';
import type {
  BarNote,
  CallBar,
  Difficulty,
  DuelNumber,
  Grade,
  JudgeResult,
  Lick,
  Tap,
  TargetNote,
  Turn,
} from './types';

/** Count-in bars before the first turn, and before a turn that restarts after a pause. */
export const COUNT_IN_BARS = 1;

/** Bars of one turn: the opponent's call, then the player's reply. */
export const BARS_PER_TURN = 2 * BARS_PER_CALL;

/** Bars of a duel played straight through: the count-in and the three turns (25). */
export const DUEL_BARS = COUNT_IN_BARS + TURNS.length * BARS_PER_TURN;

/** Where a turn sits on the duel clock. */
export interface TurnLayout {
  readonly turn: Turn;
  /** The opponent's call, in play order. Taps here never count. */
  readonly opponentBars: readonly number[];
  /** The player's reply, in play order. */
  readonly playerBars: readonly number[];
}

/** What a bar of the duel holds when the duel is played straight through. */
export type BarRole =
  | { readonly kind: 'countIn' }
  | {
      readonly kind: 'opponent' | 'player';
      readonly turn: Turn;
      /** Position of the bar in its 4-bar half of the turn, 0 to 3. */
      readonly index: number;
    };

export interface SessionOptions {
  /** The Shadow the player duels: its composed calls are played. */
  readonly character: Character;
  readonly difficulty: Difficulty;
  readonly duel: DuelNumber;
  /** Tempo in BPM; DUEL_BPM of the duel by default. */
  readonly bpm?: number;
  /** Calibration offset in ms, subtracted from every tap. */
  readonly offsetMs: number;
  /** The player accepted assistance: every window × ASSIST_MULT. False by default. */
  readonly assisted?: boolean;
  /**
   * The player's best Solo bar from the duel-1 win that unlocked this duel, or null. Read only for
   * the Solo call from duel 2 on (see `opponentCall`). Null by default.
   */
  readonly bestBar?: readonly BarNote[] | null;
  /** Licks that can be quoted, in learned order. The grey-box licks by default. */
  readonly licks?: readonly Lick[];
}

/** The options of a session with every default filled in. */
export interface SessionConfig {
  readonly character: Character;
  readonly difficulty: Difficulty;
  readonly duel: DuelNumber;
  readonly bpm: number;
  readonly offsetMs: number;
  readonly assisted: boolean;
  readonly bestBar: readonly BarNote[] | null;
  readonly licks: readonly Lick[];
}

/** Result of an Echo or Answer turn. */
export interface CallTurnResult {
  readonly turn: DirectionTurn;
  /**
   * The target notes judged against the turn's taps. `extraTaps` holds only the unpaired taps on
   * the player's bars: a tap on the opponent's bars is never an extra tap.
   */
  readonly judge: JudgeResult;
  /** Timing score, 0 to 1 (see `callTurnTiming`). */
  readonly timing: number;
  readonly direction: DirectionResult;
}

/** Result of the Solo turn. */
export interface SoloTurnResult {
  readonly turn: 'solo';
  /** The taps placed on the player's Solo bars, each judged against its nearest grid step. */
  readonly taps: readonly GridTapJudgement[];
  /** Timing score, 0 to 1 (see `soloTurnTiming`). */
  readonly timing: number;
  readonly feel: FeelResult;
  /** The quoted bars, in bar order. One lick can be quoted in more than one bar. */
  readonly quotes: readonly LickMatch[];
  readonly bestBar: BestBar | null;
}

export interface TurnResults {
  readonly echo: CallTurnResult;
  readonly answer: CallTurnResult;
  readonly solo: SoloTurnResult;
}

export type TurnResult = TurnResults[Turn];

/** Result of a finished duel. */
export interface DuelResult {
  readonly duel: DuelNumber;
  /** The Shadow the player duelled. */
  readonly character: Character;
  readonly difficulty: Difficulty;
  readonly assisted: boolean;
  readonly turns: TurnResults;
  readonly score: DuelScore;
  /** Every quote of the Solo turn, in bar order. */
  readonly quotes: readonly LickMatch[];
  /** Notes of the best Solo bar, for the next duel's Solo call; null when no bar qualifies. */
  readonly bestBar: readonly BarNote[] | null;
}

/** An opponent call to schedule: bar i of `bars` plays as bar `firstBar + i` of the clock. */
export interface ScheduledCall {
  readonly turn: Turn;
  readonly firstBar: number;
  readonly bars: readonly CallBar[];
}

/**
 * Immediate feedback on a counted tap. Echo and Answer: the grade of the target note the tap
 * pairs with so far, or 'extra'; a later, closer tap can still take the note. Solo: the grade
 * against the nearest grid step.
 */
export type TapFeedback = Grade | 'extra';

export type SessionEvent =
  | {
      /** A count-in bar starts: at the start, and on every resume. */
      readonly type: 'countIn';
      /** The turn that follows the count-in. */
      readonly turn: Turn;
      /** The count-in bar on `clock`. */
      readonly bar: number;
      /** Start of the count-in bar (seconds). */
      readonly time: number;
      /** The clock every bar from now on is timed by: schedule the drums and calls on it. */
      readonly clock: BeatClock;
      readonly resumed: boolean;
      /** The calls still to play, from the turn that follows on, in play order. */
      readonly calls: readonly ScheduledCall[];
    }
  | {
      readonly type: 'tap';
      readonly tap: Tap;
      /** The tap counts for the current turn: false on the opponent's bars or a count-in. */
      readonly counted: boolean;
      /** Null when the tap is not counted, or counted on the edge of an opponent bar but unpaired. */
      readonly feedback: TapFeedback | null;
    }
  | {
      /** A Solo bar was recognised as a quote: play the lick's sound at `time`. */
      readonly type: 'lickSound';
      readonly lick: Lick;
      /** The quoted bar. */
      readonly bar: number;
      /** First beat of the bar after the quoted one, on the audio clock (seconds). */
      readonly time: number;
    }
  | { readonly type: 'turnEnd'; readonly result: TurnResult }
  | {
      readonly type: 'paused';
      /** The turn that restarts on resume. */
      readonly turn: Turn;
    }
  | { readonly type: 'end'; readonly result: DuelResult };

export type SessionStatus = 'ready' | 'playing' | 'paused' | 'finished';

export interface SessionState {
  readonly config: SessionConfig;
  /** The opponent's call for each turn. */
  readonly calls: Readonly<Record<Turn, readonly CallBar[]>>;
  readonly status: SessionStatus;
  /** Clock of the bars being played; null before the start. A resume replaces it. */
  readonly clock: BeatClock | null;
  /** The bar of the latest count-in: 0 at the start, the bar before the current turn after a resume. */
  readonly countInBar: number;
  /** Index in TURNS of the turn being played; TURNS.length once the duel is finished. */
  readonly turnIndex: number;
  /** The latest time seen by an advance, tap or pause. */
  readonly now: number;
  /** Taps counted for the current turn, in arrival order. */
  readonly taps: readonly Tap[];
  /** Solo bars of the current turn already checked for a quote (0 to 4). */
  readonly closedBars: number;
  /** Quotes of the current Solo turn so far. */
  readonly quotes: readonly LickMatch[];
  /** Results of the finished turns. */
  readonly turns: Partial<TurnResults>;
  readonly result: DuelResult | null;
}

export type SessionInput =
  /** Starts the count-in at `time`. */
  | { readonly type: 'start'; readonly time: number }
  /** Moves the session to `time`: closes bars and finishes turns whose taps are all in. */
  | { readonly type: 'advance'; readonly time: number }
  /** A tap, after moving the session to its time. */
  | { readonly type: 'tap'; readonly tap: Tap }
  /** Pauses at `time`; the current turn's taps are dropped. */
  | { readonly type: 'pause'; readonly time: number }
  /** Resumes: a count-in bar starts at `time`, then the current turn again from the opponent's call. */
  | { readonly type: 'resume'; readonly time: number };

export interface SessionStep {
  readonly state: SessionState;
  readonly events: readonly SessionEvent[];
}

type Draft = { -readonly [K in keyof SessionState]: SessionState[K] };

/** The bars of a turn on the duel clock. */
export function turnLayout(turn: Turn): TurnLayout {
  const index = TURNS.indexOf(turn);
  if (index < 0) throw new RangeError(`unknown turn: ${String(turn)}`);
  const first = COUNT_IN_BARS + index * BARS_PER_TURN;
  const bars = (from: number): number[] =>
    Array.from({ length: BARS_PER_CALL }, (_, offset) => from + offset);
  return { turn, opponentBars: bars(first), playerBars: bars(first + BARS_PER_CALL) };
}

/** What bar `bar` holds when the duel is played straight through; null outside the duel. */
export function barRole(bar: number): BarRole | null {
  if (!Number.isInteger(bar) || bar < 0 || bar >= DUEL_BARS) return null;
  if (bar < COUNT_IN_BARS) return { kind: 'countIn' };
  const inDuel = bar - COUNT_IN_BARS;
  const turn = TURNS[Math.floor(inDuel / BARS_PER_TURN)];
  const inTurn = inDuel % BARS_PER_TURN;
  return inTurn < BARS_PER_CALL
    ? { kind: 'opponent', turn, index: inTurn }
    : { kind: 'player', turn, index: inTurn - BARS_PER_CALL };
}

/**
 * The notes the player is judged against in an Echo or Answer turn: the opponent's call moved
 * onto the player's bars. Each note keeps the opponent's button; the direction score compares it
 * with the button of the paired tap.
 */
export function turnTargets(state: Pick<SessionState, 'calls'>, turn: DirectionTurn): TargetNote[] {
  const { playerBars } = turnLayout(turn);
  return state.calls[turn].flatMap((callBar, index) =>
    callBar.notes.map((note) => ({ bar: playerBars[index], step: note.step, button: note.button })),
  );
}

/** The turn being played, or null once the duel is finished. */
export function currentTurn(state: Pick<SessionState, 'turnIndex'>): Turn | null {
  return TURNS[state.turnIndex] ?? null;
}

/** The judge context of a started session. Throws before the start. */
export function sessionJudgeContext(
  state: Pick<SessionState, 'clock' | 'config'>,
): JudgeContext {
  if (state.clock === null) throw new Error('the session has not started');
  return { clock: state.clock, offsetMs: state.config.offsetMs, assisted: state.config.assisted };
}

/** A new session, ready to start. Throws a RangeError on an invalid option. */
export function createSession(options: SessionOptions): SessionState {
  const { character, difficulty, duel, offsetMs } = options;
  if (!isCharacter(character)) throw new RangeError(`unknown character: ${String(character)}`);
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new RangeError(`unknown difficulty: ${String(difficulty)}`);
  }
  if (duel !== 1 && duel !== 2) throw new RangeError(`unknown duel: ${String(duel)}`);
  const bpm = options.bpm ?? DUEL_BPM[duel];
  if (!Number.isFinite(bpm) || bpm <= 0) throw new RangeError(`bpm must be positive, got ${bpm}`);
  if (!Number.isFinite(offsetMs)) throw new RangeError(`offsetMs must be finite, got ${offsetMs}`);

  const bestBar = options.bestBar ?? null;
  const callOf = (turn: Turn): CallBar[] =>
    opponentCall({ character, difficulty, turn, duel, bestBar });
  return {
    config: {
      character,
      difficulty,
      duel,
      bpm,
      offsetMs,
      assisted: options.assisted ?? false,
      bestBar,
      licks: options.licks ?? LICKS,
    },
    calls: { echo: callOf('echo'), answer: callOf('answer'), solo: callOf('solo') },
    status: 'ready',
    clock: null,
    countInBar: 0,
    turnIndex: 0,
    now: Number.NEGATIVE_INFINITY,
    taps: [],
    closedBars: 0,
    quotes: [],
    turns: {},
    result: null,
  };
}

/**
 * Applies one input and returns the next state with the events it caused, in time order.
 * An input that does not fit the status (a tap before the start, a resume while playing) changes
 * nothing. Throws a RangeError on a time that is not a finite number.
 */
export function stepSession(state: SessionState, input: SessionInput): SessionStep {
  const draft: Draft = { ...state };
  const events: SessionEvent[] = [];
  switch (input.type) {
    case 'start':
      start(draft, checkTime(input.time), events);
      break;
    case 'advance':
      if (draft.status === 'playing') advanceTo(draft, checkTime(input.time), events);
      break;
    case 'tap':
      addTap(draft, checkTap(input.tap), events);
      break;
    case 'pause':
      pause(draft, checkTime(input.time), events);
      break;
    case 'resume':
      resume(draft, checkTime(input.time), events);
      break;
  }
  return { state: draft, events };
}

/** What is on screen at `time`. */
export type SessionPhase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'paused'; readonly turn: Turn }
  | { readonly kind: 'finished' }
  | {
      readonly kind: 'countIn';
      /** The turn that follows the count-in. */
      readonly turn: Turn;
      readonly bar: number;
      /** Beat of the count-in bar, 0 to 3; negative before the count-in starts. */
      readonly beat: number;
    }
  | {
      readonly kind: 'opponent' | 'player';
      readonly turn: Turn;
      readonly bar: number;
      /** Position of the bar in its 4-bar half of the turn, 0 to 3. */
      readonly index: number;
    };

/**
 * The phase of the session at audio-clock time `time`. While playing, a bar up to the latest
 * count-in is the count-in, and a later bar follows the straight-through layout of `barRole`;
 * a time past the last bar reads as the last bar until the duel finishes.
 */
export function phaseAt(state: SessionState, time: number): SessionPhase {
  if (state.status === 'finished') return { kind: 'finished' };
  const turn = currentTurn(state);
  if (state.status === 'ready' || state.clock === null || turn === null) return { kind: 'ready' };
  if (state.status === 'paused') return { kind: 'paused', turn };

  const beat = timeToBeat(state.clock, time);
  const bar = Math.min(Math.floor(beat / BEATS_PER_BAR), DUEL_BARS - 1);
  const role = barRole(bar);
  if (bar <= state.countInBar || role === null || role.kind === 'countIn') {
    return {
      kind: 'countIn',
      turn,
      bar: state.countInBar,
      beat: Math.floor(beat - state.countInBar * BEATS_PER_BAR),
    };
  }
  return { kind: role.kind, turn: role.turn, bar, index: role.index };
}

function checkTime(time: number): number {
  if (!Number.isFinite(time)) throw new RangeError(`time must be a finite number, got ${time}`);
  return time;
}

function checkTap(tap: Tap): Tap {
  checkTime(tap.time);
  if (!BUTTONS.includes(tap.button)) throw new RangeError(`unknown button: ${tap.button}`);
  return tap;
}

function barDuration(bpm: number): number {
  return BEATS_PER_BAR * secondsPerBeat(bpm);
}

/** The bar playing at raw audio-clock time `time`. */
function barAt(clock: BeatClock, time: number): number {
  return Math.floor(timeToBeat(clock, time) / BEATS_PER_BAR);
}

/** Bar of the grid step nearest to a tap, after the offset (the Solo turn's grid). */
function gridBar(tap: Tap, context: JudgeContext): number {
  return judgeGridTaps([tap], context)[0].bar;
}

/**
 * The latest raw tap time that still lands on bar `bar`: halfway between its last grid step and
 * the next bar's first step (a tie goes to the earlier step), plus the offset.
 */
function barCloseTime(context: JudgeContext, bar: number): number {
  const last = stepTime(context.clock, bar, GRID_STEPS - 1);
  const next = stepTime(context.clock, bar + 1, 0);
  return (last + next) / 2 + context.offsetMs / 1000;
}

/** True when the corrected tap lies inside the OK window of one of the notes. */
function inNoteWindow(tap: Tap, notes: readonly TargetNote[], context: JudgeContext): boolean {
  const windows = hitWindows(context.clock.difficulty, context.assisted);
  const time = correctedTime(tap.time, context.offsetMs);
  return notes.some(
    (note) =>
      gradeDelta(secondsToMs(time - stepTime(context.clock, note.bar, note.step)), windows) !==
      'miss',
  );
}

/**
 * When every tap of a turn is in. Solo: once its last bar closes. Echo and Answer: also not
 * before the OK window of the last target note has passed, as a tap for that note can land on the
 * opponent's next bar.
 */
function turnEndTime(draft: Draft, context: JudgeContext, turn: Turn): number {
  const { playerBars } = turnLayout(turn);
  const close = barCloseTime(context, playerBars[playerBars.length - 1]);
  if (turn === 'solo') return close;
  const okSeconds = hitWindows(context.clock.difficulty, context.assisted).ok / 1000;
  const lastNote = Math.max(
    ...turnTargets(draft, turn).map((note) => stepTime(context.clock, note.bar, note.step)),
  );
  return Math.max(close, lastNote + okSeconds + context.offsetMs / 1000);
}

function countInEvent(draft: Draft, clock: BeatClock, resumed: boolean): SessionEvent {
  const turn = TURNS[draft.turnIndex];
  return {
    type: 'countIn',
    turn,
    bar: draft.countInBar,
    time: stepTime(clock, draft.countInBar, 0),
    clock,
    resumed,
    calls: TURNS.slice(draft.turnIndex).map((next) => ({
      turn: next,
      firstBar: turnLayout(next).opponentBars[0],
      bars: draft.calls[next],
    })),
  };
}

function start(draft: Draft, time: number, events: SessionEvent[]): void {
  if (draft.status !== 'ready') return;
  const { bpm, difficulty } = draft.config;
  const clock = createBeatClock({ t0: time, bpm, difficulty });
  draft.clock = clock;
  draft.countInBar = 0;
  draft.status = 'playing';
  events.push(countInEvent(draft, clock, false));
}

/** Moves the session to `time`: closes Solo bars and finishes every turn whose taps are all in. */
function advanceTo(draft: Draft, time: number, events: SessionEvent[]): void {
  draft.now = Math.max(draft.now, time);
  while (draft.status === 'playing') {
    const turn = TURNS[draft.turnIndex];
    const context = sessionJudgeContext(draft);
    if (turn === 'solo') closeSoloBars(draft, context, events, false);
    if (draft.now <= turnEndTime(draft, context, turn)) return;
    finishTurn(draft, context, events);
  }
}

/**
 * Checks the Solo bars for quotes in bar order: each bar once it has closed, or every remaining
 * bar when `force`. A quote schedules the lick's sound on the first beat of the next bar.
 */
function closeSoloBars(
  draft: Draft,
  context: JudgeContext,
  events: SessionEvent[],
  force: boolean,
): void {
  const { playerBars } = turnLayout('solo');
  while (draft.closedBars < playerBars.length) {
    const bar = playerBars[draft.closedBars];
    if (!force && draft.now <= barCloseTime(context, bar)) return;
    const match = detectQuote(draft.taps, bar, context, draft.config.licks);
    if (match !== null) {
      draft.quotes = [...draft.quotes, match];
      events.push({
        type: 'lickSound',
        lick: match.lick,
        bar,
        time: stepTime(context.clock, bar + 1, 0),
      });
    }
    draft.closedBars += 1;
  }
}

/** Scores the current turn with the taps it has, then moves on to the next turn or the result. */
function finishTurn(draft: Draft, context: JudgeContext, events: SessionEvent[]): void {
  const turn = TURNS[draft.turnIndex];
  let result: TurnResult;
  if (turn === 'solo') {
    closeSoloBars(draft, context, events, true);
    result = soloResult(draft, context);
  } else {
    result = callResult(draft, context, turn);
  }
  draft.turns = withTurn(draft.turns, result);
  events.push({ type: 'turnEnd', result });
  draft.taps = [];
  draft.quotes = [];
  draft.closedBars = 0;
  draft.turnIndex += 1;
  if (draft.turnIndex < TURNS.length) return;

  const duel = duelResult(draft);
  draft.result = duel;
  draft.status = 'finished';
  events.push({ type: 'end', result: duel });
}

function callResult(draft: Draft, context: JudgeContext, turn: DirectionTurn): CallTurnResult {
  const { playerBars } = turnLayout(turn);
  const judged = judgeTaps(turnTargets(draft, turn), draft.taps, context);
  const judge: JudgeResult = {
    notes: judged.notes,
    extraTaps: judged.extraTaps.filter((tap) => playerBars.includes(gridBar(tap, context))),
  };
  return {
    turn,
    judge,
    timing: callTurnTiming(judge),
    direction: scoreDirection(turn, judge.notes),
  };
}

function soloResult(draft: Draft, context: JudgeContext): SoloTurnResult {
  const { playerBars } = turnLayout('solo');
  // Only taps placed on the player's Solo bars count (spec 0.4, AC-DUEL-003.7).
  const taps = judgeGridTaps(draft.taps, context).filter((judged) =>
    playerBars.includes(judged.bar),
  );
  const quotes = draft.quotes;
  const feel = scoreFeel({
    taps: taps.map(({ bar, step, button }) => ({ bar, step, button })),
    quoteBars: quotes.map((quote) => quote.bar),
  });
  return {
    turn: 'solo',
    taps,
    timing: soloTurnTiming(taps),
    feel,
    quotes,
    bestBar: pickBestBar(
      taps.map((judged) => judged.tap),
      playerBars,
      context,
    ),
  };
}

function withTurn(turns: Partial<TurnResults>, result: TurnResult): Partial<TurnResults> {
  switch (result.turn) {
    case 'echo':
      return { ...turns, echo: result };
    case 'answer':
      return { ...turns, answer: result };
    case 'solo':
      return { ...turns, solo: result };
  }
}

function duelResult(draft: Draft): DuelResult {
  const { echo, answer, solo } = draft.turns;
  if (echo === undefined || answer === undefined || solo === undefined) {
    throw new Error('a duel result needs the results of all three turns');
  }
  const { duel, character, difficulty, assisted } = draft.config;
  const score = scoreDuel({
    timing: { echo: echo.timing, answer: answer.timing, solo: solo.timing },
    direction: { echo: echo.direction.score, answer: answer.direction.score },
    feel: solo.feel.score,
    quoteBonus: quoteBonus(solo.quotes),
  });
  return {
    duel,
    character,
    difficulty,
    assisted,
    turns: { echo, answer, solo },
    score,
    quotes: solo.quotes,
    bestBar: solo.bestBar?.notes ?? null,
  };
}

/**
 * Counts a tap for the current turn, or not.
 * - Solo: the tap counts when its nearest grid step lies on one of the player's bars that is still
 *   open; a tap placed on an opponent bar or outside the 4 Solo bars never counts.
 * - Echo and Answer: the tap counts when its nearest grid step lies on one of the player's bars, or
 *   when it is inside the OK window of a target note, so a tap a little early for the first note
 *   or late for the last one still pairs. Of the taps placed on an opponent bar, only those that
 *   pair with a note change the score; the others are not extra taps.
 */
function addTap(draft: Draft, tap: Tap, events: SessionEvent[]): void {
  if (draft.status !== 'playing') return;
  advanceTo(draft, tap.time, events);
  if (draft.status !== 'playing') return;
  const turn = TURNS[draft.turnIndex];
  const context = sessionJudgeContext(draft);
  const { playerBars } = turnLayout(turn);

  if (turn === 'solo') {
    const [judged] = judgeGridTaps([tap], context);
    const counted = playerBars.indexOf(judged.bar) >= draft.closedBars;
    if (counted) draft.taps = [...draft.taps, tap];
    events.push({ type: 'tap', tap, counted, feedback: counted ? judged.grade : null });
    return;
  }

  const targets = turnTargets(draft, turn);
  const onPlayerBar = playerBars.includes(gridBar(tap, context));
  if (!onPlayerBar && !inNoteWindow(tap, targets, context)) {
    events.push({ type: 'tap', tap, counted: false, feedback: null });
    return;
  }
  draft.taps = [...draft.taps, tap];
  const paired = judgeTaps(targets, draft.taps, context).notes.find((judged) => judged.tap === tap);
  const feedback: TapFeedback | null = paired ? paired.grade : onPlayerBar ? 'extra' : null;
  events.push({ type: 'tap', tap, counted: true, feedback });
}

/**
 * Pauses at `time`. The session first moves to `time`; a turn whose last player bar has already
 * gone by is scored with the taps it has, so the turn that restarts is the one on screen (a
 * count-in belongs to the turn after it). The current turn's taps and quotes are dropped.
 */
function pause(draft: Draft, time: number, events: SessionEvent[]): void {
  if (draft.status !== 'playing') return;
  advanceTo(draft, time, events);
  while (draft.status === 'playing') {
    const context = sessionJudgeContext(draft);
    const { playerBars } = turnLayout(TURNS[draft.turnIndex]);
    if (barAt(context.clock, draft.now) <= playerBars[playerBars.length - 1]) break;
    finishTurn(draft, context, events);
  }
  if (draft.status !== 'playing') return;
  draft.status = 'paused';
  draft.taps = [];
  draft.quotes = [];
  draft.closedBars = 0;
  events.push({ type: 'paused', turn: TURNS[draft.turnIndex] });
}

/**
 * Resumes: a new clock puts the count-in bar (the bar before the current turn) at `time`, then the
 * turn plays again from the opponent's call and is scored from scratch. Finished turns keep their
 * results.
 */
function resume(draft: Draft, time: number, events: SessionEvent[]): void {
  if (draft.status !== 'paused') return;
  const { bpm, difficulty } = draft.config;
  const countInBar = turnLayout(TURNS[draft.turnIndex]).opponentBars[0] - COUNT_IN_BARS;
  const clock = createBeatClock({ t0: time - countInBar * barDuration(bpm), bpm, difficulty });
  draft.clock = clock;
  draft.countInBar = countInBar;
  draft.status = 'playing';
  events.push(countInEvent(draft, clock, true));
}
