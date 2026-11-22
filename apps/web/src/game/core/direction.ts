/**
 * Melodic direction of the Echo and Answer turns (REQ-DUEL-005).
 *
 * The direction of a pair of notes is the sign of the difference of their button indices
 * (D = 0 lowest, K = 3 highest): up, down, or a repeat of the same button.
 */
import type { Button, NoteJudgement, Turn } from './types';

/** Turns scored on melodic direction: the Solo turn is free play and has none. */
export type DirectionTurn = Exclude<Turn, 'solo'>;

/** Sign of a step from one button to the next: 1 up, -1 down, 0 for a repeat. */
export type MelodicDirection = -1 | 0 | 1;

/** Verdict on one pair of adjacent target notes. */
export type PairVerdict = 'correct' | 'wrong' | 'uncounted';

export interface DirectionResult {
  /** One verdict per pair of adjacent target notes, in time order. */
  readonly pairs: readonly PairVerdict[];
  /** Pairs judged correct. */
  readonly correct: number;
  /** Pairs that count towards the score: every pair except those where the opponent repeats a button. */
  readonly counted: number;
  /** correct / counted, or 1 when no pair counts. */
  readonly score: number;
}

/** Direction of a step from button `from` to button `to`. */
export function melodicDirection(from: Button, to: Button): MelodicDirection {
  return Math.sign(to - from) as MelodicDirection;
}

/**
 * Judges one pair of adjacent target notes.
 *
 * - The opponent repeats a button: the pair does not count.
 * - Either note is unpaired (a Miss): the pair counts and is wrong.
 * - Echo: correct when the player's direction is the opponent's direction.
 * - Answer: correct when the player's direction is the opposite one; a repeat is wrong.
 */
export function judgePair(
  turn: DirectionTurn,
  first: NoteJudgement,
  second: NoteJudgement,
): PairVerdict {
  const opponent = melodicDirection(first.note.button, second.note.button);
  if (opponent === 0) return 'uncounted';
  if (first.tap === null || second.tap === null) return 'wrong';
  const player = melodicDirection(first.tap.button, second.tap.button);
  const wanted = turn === 'echo' ? opponent : -opponent;
  return player === wanted ? 'correct' : 'wrong';
}

/**
 * Direction score of an Echo or Answer turn: correct pairs / counted pairs, 1 when no pair counts.
 *
 * Contract: `notes` are the judgements of the turn's target notes (see `judgeTaps`). Each target
 * note's `button` is the opponent's call button at that position, and the player's button is the
 * paired tap's `button`. Pairs are adjacent notes in time order (bar, then step), across bar lines.
 */
export function scoreDirection(
  turn: DirectionTurn,
  notes: readonly NoteJudgement[],
): DirectionResult {
  const ordered = [...notes].sort((a, b) => a.note.bar - b.note.bar || a.note.step - b.note.step);
  const pairs: PairVerdict[] = [];
  for (let index = 1; index < ordered.length; index += 1) {
    pairs.push(judgePair(turn, ordered[index - 1], ordered[index]));
  }
  const correct = pairs.filter((verdict) => verdict === 'correct').length;
  const counted = pairs.filter((verdict) => verdict !== 'uncounted').length;
  return { pairs, correct, counted, score: counted === 0 ? 1 : correct / counted };
}
