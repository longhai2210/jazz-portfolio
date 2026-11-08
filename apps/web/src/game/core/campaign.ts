/**
 * The grey-box run of two duels (design 4.1, 6.1, 7): club 1, then club 2 of Hồ Làng.
 *
 * A campaign is plain state, and every function returns a new one. It picks each duel's Shadow
 * from the roster of the player's character and its tempo from DUEL_BPM, keeps one calibration
 * offset for both duels, carries the best Solo bar of the duel-1 win into duel 2, and counts the
 * losses in a row so the result screen can offer assistance.
 */
import { DIFFICULTIES, DUEL_BPM } from './config';
import { buildRoster, type Character, type Roster } from './roster';
import {
  createSession,
  type DuelResult,
  type SessionConfig,
  type SessionState,
} from './session';
import type { BarNote, Difficulty, DuelNumber } from './types';

/** The character played when none is given: Ren, so the Shadows are Aki, then Sayo. */
export const DEFAULT_PLAYER: Character = 'ren';

/** The duels of the grey-box run, in play order. */
export const CAMPAIGN_DUELS: readonly DuelNumber[] = [1, 2];

/** Losses in a row on one duel after which assistance is offered, once per streak. */
export const ASSIST_OFFER_LOSSES = 2;

export interface CampaignOptions {
  /** The character the player picked; DEFAULT_PLAYER when none is given. */
  readonly player?: Character | null;
  readonly difficulty: Difficulty;
  /** Calibration offset in ms, used by both duels. */
  readonly offsetMs: number;
  /** The duel to start at; 1 by default. */
  readonly startDuel?: DuelNumber;
  /** When starting at duel 2: the best Solo bar of the duel-1 win, or null. Ignored for duel 1. */
  readonly bestBar?: readonly BarNote[] | null;
}

export interface CampaignState {
  readonly player: Character;
  readonly roster: Roster;
  readonly difficulty: Difficulty;
  /** Calibration offset in ms, the same for every duel of the run. */
  readonly offsetMs: number;
  /** The player accepted assistance; it lasts until the run restarts. */
  readonly assisted: boolean;
  /** The duel being played. */
  readonly duel: DuelNumber;
  /**
   * The best Solo bar of the latest duel-1 win, the one that unlocks duel 2; null when that win
   * had none. Duel 2's Solo call opens with it.
   */
  readonly bestBar: readonly BarNote[] | null;
  /** Losses in a row on the current duel; a win, a new duel and a restart set it back to 0. */
  readonly lossStreak: number;
  /** The latest result of each duel played. */
  readonly results: Readonly<Partial<Record<DuelNumber, DuelResult>>>;
  /** The latest result of the current duel, or null before its first take. */
  readonly lastResult: DuelResult | null;
}

/** A new run. Throws a RangeError on an unknown character, difficulty or duel, or a bad offset. */
export function createCampaign(options: CampaignOptions): CampaignState {
  const player = options.player ?? DEFAULT_PLAYER;
  const { difficulty, offsetMs } = options;
  const duel = options.startDuel ?? CAMPAIGN_DUELS[0];
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new RangeError(`unknown difficulty: ${String(difficulty)}`);
  }
  if (!Number.isFinite(offsetMs)) throw new RangeError(`offsetMs must be finite, got ${offsetMs}`);
  if (!CAMPAIGN_DUELS.includes(duel)) throw new RangeError(`unknown duel: ${String(duel)}`);
  return {
    player,
    roster: buildRoster(player),
    difficulty,
    offsetMs,
    assisted: false,
    duel,
    bestBar: duel === CAMPAIGN_DUELS[0] ? null : (options.bestBar ?? null),
    lossStreak: 0,
    results: {},
    lastResult: null,
  };
}

/** Settings of the current duel: its Shadow and tempo, the run's offset, assistance and best bar. */
export function duelConfig(campaign: CampaignState): Omit<SessionConfig, 'licks'> {
  const { duel } = campaign;
  return {
    character: campaign.roster[duel].character,
    difficulty: campaign.difficulty,
    duel,
    bpm: DUEL_BPM[duel],
    offsetMs: campaign.offsetMs,
    assisted: campaign.assisted,
    bestBar: duel === CAMPAIGN_DUELS[0] ? null : campaign.bestBar,
  };
}

/** A new session for the current duel (also for "Replay this take"). */
export function createDuelSession(campaign: CampaignState): SessionState {
  return createSession(duelConfig(campaign));
}

/**
 * Records the result of a take of the current duel. A win sets the loss streak to 0 and, on duel
 * 1, keeps its best Solo bar (null included) for duel 2; a loss adds 1 to the streak. Throws a
 * RangeError for a result of another duel.
 */
export function recordResult(campaign: CampaignState, result: DuelResult): CampaignState {
  if (result.duel !== campaign.duel) {
    throw new RangeError(`result of duel ${result.duel} recorded during duel ${campaign.duel}`);
  }
  const won = result.score.won;
  return {
    ...campaign,
    bestBar: won && result.duel === CAMPAIGN_DUELS[0] ? result.bestBar : campaign.bestBar,
    lossStreak: won ? 0 : campaign.lossStreak + 1,
    results: { ...campaign.results, [result.duel]: result },
    lastResult: result,
  };
}

/** True when the latest take won and a next duel exists ("On to match 2"). */
export function canAdvance(campaign: CampaignState): boolean {
  const next = CAMPAIGN_DUELS.indexOf(campaign.duel) + 1;
  return next < CAMPAIGN_DUELS.length && campaign.lastResult?.score.won === true;
}

/** Moves on to the next duel. Throws an Error when `canAdvance` is false. */
export function advanceDuel(campaign: CampaignState): CampaignState {
  if (!canAdvance(campaign)) throw new Error(`duel ${campaign.duel} has not been won yet`);
  return {
    ...campaign,
    duel: CAMPAIGN_DUELS[CAMPAIGN_DUELS.indexOf(campaign.duel) + 1],
    lossStreak: 0,
    lastResult: null,
  };
}

/** True when the latest take won the last duel: the run is complete. */
export function isComplete(campaign: CampaignState): boolean {
  const last = CAMPAIGN_DUELS[CAMPAIGN_DUELS.length - 1];
  return campaign.duel === last && campaign.lastResult?.score.won === true;
}

/**
 * True when the result screen offers assistance: the player has just lost ASSIST_OFFER_LOSSES
 * times in a row and has not accepted it yet. A further loss in the same streak offers nothing.
 */
export function shouldOfferAssist(campaign: CampaignState): boolean {
  return !campaign.assisted && campaign.lossStreak === ASSIST_OFFER_LOSSES;
}

/** The player accepted assistance: every later take of the run has wider windows. */
export function acceptAssist(campaign: CampaignState): CampaignState {
  return { ...campaign, assisted: true };
}

/** "Play again from the start": duel 1 again with the same character, difficulty and offset. */
export function restartCampaign(campaign: CampaignState): CampaignState {
  return createCampaign({
    player: campaign.player,
    difficulty: campaign.difficulty,
    offsetMs: campaign.offsetMs,
  });
}
