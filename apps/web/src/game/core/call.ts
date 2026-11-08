/**
 * Opponent calls (design 6, 6.1). Echo and Answer always use the Shadow's composed call at the
 * chosen difficulty. The Solo turn of duel 1 does too; from duel 2 on, the Shadow opens its Solo
 * with the player's best Solo bar of the previous duel's win:
 * - bar 1 is that bar as played,
 * - bar 2 keeps its steps and inverts the melody (button i becomes 3 - i: D<->K, F<->J),
 * - bars 3 and 4 are bars 3 and 4 of the composed Solo call.
 * Without a best bar the whole composed Solo call is used.
 */
import { BUTTON_LABELS, BUTTONS, CALL_DENSITY, GRID_STEPS } from './config';
import { COMPOSED_CALLS, type BarPattern } from './data/calls';
import type { Character } from './roster';
import type { BarNote, Button, CallBar, Difficulty, DuelNumber, Turn } from './types';

/** Bars the opponent plays per turn. */
export const BARS_PER_CALL = 4;

/** The turns of a duel, in play order. */
export const TURNS: readonly Turn[] = ['echo', 'answer', 'solo'];

/** A rest in a bar pattern (see `data/calls.ts`). */
export const REST = '.';

export interface OpponentCallOptions {
  /** The Shadow playing the call. */
  readonly character: Character;
  readonly difficulty: Difficulty;
  readonly turn: Turn;
  readonly duel: DuelNumber;
  /**
   * The player's best Solo bar from the win of the previous duel (the one that unlocked this
   * duel), or null when that win had none. Read only for the Solo turn from duel 2 on.
   */
  readonly bestBar: readonly BarNote[] | null;
}

/**
 * Parses a bar pattern: one character per grid step, REST or a button label from BUTTON_LABELS.
 * Throws a RangeError on a pattern of the wrong length or with an unknown character.
 */
export function parseBarPattern(pattern: BarPattern): BarNote[] {
  if (pattern.length !== GRID_STEPS) {
    throw new RangeError(`bar pattern must have ${GRID_STEPS} steps, got "${pattern}"`);
  }
  const notes: BarNote[] = [];
  [...pattern].forEach((char, step) => {
    if (char === REST) return;
    const index = BUTTON_LABELS.indexOf(char);
    if (index < 0) {
      throw new RangeError(`unknown character "${char}" in bar pattern "${pattern}"`);
    }
    notes.push({ step, button: BUTTONS[index] });
  });
  return notes;
}

/**
 * The composed call of a Shadow for a turn at a difficulty: 4 bars, all `source: 'composed'`.
 * Throws a RangeError for a character, difficulty or turn that has no call.
 */
export function composedCall(character: Character, difficulty: Difficulty, turn: Turn): CallBar[] {
  const patterns = COMPOSED_CALLS[character]?.[difficulty]?.[turn];
  if (patterns === undefined) {
    throw new RangeError(`no composed call for ${character}, ${difficulty}, ${turn}`);
  }
  return patterns.map((pattern): CallBar => ({
    notes: parseBarPattern(pattern),
    source: 'composed',
  }));
}

/** Inverts the melodic direction of a button: D<->K, F<->J. */
export function invertButton(button: Button): Button {
  return BUTTONS[BUTTONS.length - 1 - button];
}

/** The call the opponent plays in a turn (see the file comment). Always returns new arrays. */
export function opponentCall(options: OpponentCallOptions): CallBar[] {
  const { character, difficulty, turn, duel, bestBar } = options;
  const composed = composedCall(character, difficulty, turn);
  if (turn !== 'solo' || duel === 1 || bestBar === null || bestBar.length === 0) return composed;

  const played = normaliseBar(bestBar);
  return [
    { notes: played, source: 'player' },
    {
      notes: played.map((note) => ({ step: note.step, button: invertButton(note.button) })),
      source: 'player',
    },
    composed[2],
    composed[3],
  ];
}

/**
 * Problems of a call against CALL_DENSITY of a difficulty; empty when the call is valid.
 * A valid call has BARS_PER_CALL bars; each bar has between `minNotes` and `maxNotes` notes, on
 * distinct steps in ascending order inside the grid, only even steps when `evenStepsOnly`, and
 * valid buttons.
 */
export function callProblems(
  bars: readonly (readonly BarNote[])[],
  difficulty: Difficulty,
): string[] {
  const density = CALL_DENSITY[difficulty];
  const problems: string[] = [];
  if (bars.length !== BARS_PER_CALL) {
    problems.push(`has ${bars.length} bars, expected ${BARS_PER_CALL}`);
  }
  bars.forEach((notes, index) => {
    const bar = `bar ${index + 1}`;
    if (notes.length < density.minNotes || notes.length > density.maxNotes) {
      problems.push(
        `${bar} has ${notes.length} notes, expected ${density.minNotes}-${density.maxNotes}`,
      );
    }
    notes.forEach((note, position) => {
      if (!isGridStep(note.step)) problems.push(`${bar} has step ${note.step} outside the grid`);
      if (density.evenStepsOnly && note.step % 2 !== 0) {
        problems.push(`${bar} has odd step ${note.step}`);
      }
      if (position > 0 && note.step <= notes[position - 1].step) {
        problems.push(`${bar} has step ${note.step} out of order or repeated`);
      }
      if (!BUTTONS.includes(note.button)) {
        problems.push(`${bar} has unknown button ${note.button}`);
      }
    });
  });
  return problems;
}

/** A copy of a bar in step order. Throws a RangeError on a step outside the grid or a bad button. */
function normaliseBar(notes: readonly BarNote[]): BarNote[] {
  for (const note of notes) {
    if (!isGridStep(note.step) || !BUTTONS.includes(note.button)) {
      throw new RangeError(`invalid note in best bar: step ${note.step}, button ${note.button}`);
    }
  }
  return [...notes]
    .sort((a, b) => a.step - b.step)
    .map((note) => ({ step: note.step, button: note.button }));
}

function isGridStep(step: number): boolean {
  return Number.isInteger(step) && step >= 0 && step < GRID_STEPS;
}
