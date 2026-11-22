/**
 * Composed opponent calls: one 4-bar call per Shadow, difficulty and turn.
 *
 * A bar is written as 8 characters, one per grid step: `.` is a rest and `D`, `F`, `J`, `K` play
 * that button (D lowest, K highest). Even steps are on the beat, odd steps between two beats; at
 * Late Set the clock swings the odd steps, so the data stays straight.
 *
 * Density follows CALL_DENSITY: Lounge 3-4 notes on the beat only, Session and Late Set 5-7 notes.
 * Style follows design section 4.1:
 * - Aki: steady, mostly single beats, a walking-bass line that moves step by step.
 * - Sayo: a clear rise and fall, with runs of notes on neighbouring steps.
 * - Ren: long phrases, many eighth notes and syncopation (notes starting between beats).
 * Late Set leans harder on the offbeats than Session. Echo and Answer calls avoid repeating one
 * button on neighbouring notes, so most of their note pairs have a direction to follow or invert.
 */
import type { Character } from '../roster';
import type { Difficulty, Turn } from '../types';

/** One bar as text, one character per grid step (see the file comment). */
export type BarPattern = string;

/** A composed call: the opponent's 4 bars, in play order. */
export type CallPatterns = readonly [BarPattern, BarPattern, BarPattern, BarPattern];

export type ComposedCalls = Readonly<
  Record<Character, Readonly<Record<Difficulty, Readonly<Record<Turn, CallPatterns>>>>>
>;

export const COMPOSED_CALLS: ComposedCalls = {
  aki: {
    lounge: {
      echo: ['D.F.J.K.', 'J.F.D...', 'F.J.K...', 'J.F.D.F.'],
      answer: ['F.J.K.J.', 'F.D.F.J.', 'K.J...F.', 'D...F.J.'],
      solo: ['D.F.J.K.', 'J.F.J.K.', 'K.J.F...', 'D...J.D.'],
    },
    session: {
      echo: ['D.F.J.KJ', 'F.D.F.JK', 'J.F.DFJ.', 'K.J.F.DF'],
      answer: ['D.J.F.JK', 'J.F.K.FD', 'F.D.FJK.', 'J.FJK.F.'],
      solo: ['D.F.J.KJ', 'F.J.K.JF', 'D.FJK.JF', 'J.F.D.FD'],
    },
    lateSet: {
      echo: ['D.FJK.JF', 'K.J.FDF.', 'D.F.JKJ.', '.DF.J.KJ'],
      answer: ['F.JK.JF.', 'K.JF.D.F', 'D.FJ.KJ.', 'F.JD.F.J'],
      solo: ['D.FJK.JK', 'K.JF.DFJ', '.FJ.K.JF', 'D.F.JD.F'],
    },
  },
  sayo: {
    lounge: {
      echo: ['D.F.J.K.', 'J.F.D...', 'F.J.K.J.', '..K.F.D.'],
      answer: ['D.J.K.F.', 'K.F.D...', '..F.J.K.', 'J.K.J.F.'],
      solo: ['D.F.J.K.', 'K...J.F.', 'D.J.K.J.', 'J.F.D...'],
    },
    session: {
      echo: ['DFJK.J..', '..KJFD.F', 'D.FJK.J.', 'K.JFD.F.'],
      answer: ['FJK.J.F.', 'D..FJK.J', 'KJF.D.F.', '..DFJKJ.'],
      solo: ['DFJK.JF.', 'D.FJKJF.', 'KJF.FJK.', '..FJK.JF'],
    },
    lateSet: {
      echo: ['.DFJK.J.', 'KJ.FD.F.', '.JFD.FJK', 'D.FJ.K.J'],
      answer: ['.KJF.D.F', 'DF.JK.JF', 'KJF.D.FJ', '.DFJ.KJ.'],
      solo: ['DFJK.JFD', '.FJKJF.D', 'KJ.FJK.J', '.DFJ.K.F'],
    },
  },
  ren: {
    lounge: {
      echo: ['D.J.F.K.', 'F.K.J.D.', '..F.K.J.', 'D.K.F...'],
      answer: ['F.K.D.J.', '..D.K.F.', 'K.D.J.F.', 'D...K.F.'],
      solo: ['D.J.K.F.', 'F.K.J.D.', '..D.J.K.', 'K.J...D.'],
    },
    session: {
      echo: ['D.FJ.KJF', '.KJ.FDF.', 'DF.JK.JK', '.JK.F.DF'],
      answer: ['.DF.JKJ.', 'KJ.F.DFJ', 'D.FJK.FD', '.KJF.J.D'],
      solo: ['DFJ.KJFJ', '.KJF.DFK', 'JK.FJ.KD', '.FJ.KJFD'],
    },
    lateSet: {
      echo: ['.DFJ.KJF', 'KJ.FD.JK', '.FJ.KJ.D', 'F.DJ.KFJ'],
      answer: ['.KJ.FD.F', 'DF.JKF.J', '.KJK.FDF', 'KJF.D.JK'],
      solo: ['.DFJKJ.F', 'KJ.FJKJ.', '.FD.JKJF', 'DFJ.K.JD'],
    },
  },
};
