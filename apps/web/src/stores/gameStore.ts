/**
 * UI state of the duel screen (`game/ui/DuelGame.tsx`): which screen is up, the two-duel run, the
 * duel being played and the few things the board shows between bars.
 *
 * The game loop reads and writes this store outside React (`useGameStore.getState()`), every
 * frame, so a component must select only the fields it draws: the session object changes on every
 * frame, its `calls`, `config`, `clock` and `taps` only when they really change.
 *
 * Nothing is persisted: a new visit starts at the Play button, which unlocks audio. `reset()` puts
 * everything back; DuelGame calls it when it unmounts.
 */
import { create } from 'zustand';
import {
  acceptAssist,
  advanceDuel,
  canAdvance,
  createCampaign,
  createDuelSession,
  isComplete,
  recordResult,
  restartCampaign,
  shouldOfferAssist,
  type CampaignOptions,
  type CampaignState,
} from '@/game/core/campaign';
import type { LickId } from '@/game/core/data/licks';
import type { DuelResult, SessionPhase, SessionState } from '@/game/core/session';
import type { Difficulty } from '@/game/core/types';
import type { FeedbackEvent } from '@/game/ui/lanes/Feedback';

/** The screens of the game, in the order a first visit meets them. */
export type GameScreen =
  | 'start'
  | 'unsupported'
  | 'difficulty'
  | 'calibration'
  | 'duel'
  | 'result'
  | 'summary';

/** A lick just quoted in Solo bar `bar`: lit in the lick book until bar `bar + 1` is over. */
export interface QuoteLight {
  readonly lickId: LickId;
  readonly bar: number;
}

export interface GameState {
  readonly screen: GameScreen;
  /** The Play button is waiting for the audio unlock. */
  readonly unlocking: boolean;
  /** The difficulty picked on the difficulty screen, or passed in; Lounge until then. */
  readonly difficulty: Difficulty;
  /** The run, from its first duel; null before it starts. */
  readonly campaign: CampaignState | null;
  /** The take being played or just finished; null before the run starts. */
  readonly session: SessionState | null;
  /** What the board shows; the loop writes it only when it changes. */
  readonly phase: SessionPhase | null;
  /** Whole beat on the session clock, so the board redraws once a beat; null before the start. */
  readonly beat: number | null;
  /** The count-in on screen follows a resume (its caption says the round restarts). */
  readonly countInResumed: boolean;
  /** The line of text over the lanes. */
  readonly feedback: FeedbackEvent | null;
  readonly justQuoted: QuoteLight | null;
  /** The player said "No thanks" to wider windows: no offer again until the run restarts. */
  readonly assistDeclined: boolean;
  /** Phone layout: the lick book drawer is open. */
  readonly lickBookOpen: boolean;
}

export interface GameActions {
  /** Back to the start screen, with nothing played. */
  reset(): void;
  setScreen(screen: GameScreen): void;
  setUnlocking(unlocking: boolean): void;
  chooseDifficulty(difficulty: Difficulty): void;
  /** Starts a run at its first duel (duel 2 when the options say so) and shows the duel. */
  startRun(options: CampaignOptions): void;
  /** The loop's next session state. */
  setSession(session: SessionState): void;
  setView(phase: SessionPhase | null, beat: number | null): void;
  setCountInResumed(resumed: boolean): void;
  showFeedback(feedback: FeedbackEvent | null): void;
  lightQuote(light: QuoteLight | null): void;
  /** Records the take that just ended in the run and shows its result. */
  finishMatch(result: DuelResult): void;
  /** "Widen windows": every later take of the run is assisted. */
  acceptAssist(): void;
  /** "No thanks": the windows stay as they are and the offer goes away. */
  declineAssist(): void;
  /** "Replay this take": the same duel again, from the count-in. */
  replayMatch(): void;
  /** "On to match 2". Does nothing unless the latest take won a duel with a next one. */
  nextMatch(): void;
  /** "See summary". Does nothing until the run is complete. */
  showSummary(): void;
  /** "Play again from the start": duel 1, same character, difficulty and offset, no assistance. */
  restartRun(): void;
  setLickBookOpen(open: boolean): void;
}

export type GameStore = GameState & GameActions;

const INITIAL_STATE: GameState = {
  screen: 'start',
  unlocking: false,
  difficulty: 'lounge',
  campaign: null,
  session: null,
  phase: null,
  beat: null,
  countInResumed: false,
  feedback: null,
  justQuoted: null,
  assistDeclined: false,
  lickBookOpen: false,
};

/** A fresh take on the duel screen: nothing from the previous take is left on the board. */
function takeState(campaign: CampaignState) {
  return {
    campaign,
    session: createDuelSession(campaign),
    screen: 'duel' as const,
    phase: null,
    beat: null,
    countInResumed: false,
    feedback: null,
    justQuoted: null,
  };
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ...INITIAL_STATE,

  reset: () => set(INITIAL_STATE),

  setScreen: (screen) => set({ screen }),

  setUnlocking: (unlocking) => set({ unlocking }),

  chooseDifficulty: (difficulty) => set({ difficulty }),

  startRun: (options) => {
    const campaign = createCampaign(options);
    set({ ...takeState(campaign), difficulty: campaign.difficulty, assistDeclined: false });
  },

  setSession: (session) => set({ session }),

  setView: (phase, beat) => set({ phase, beat }),

  setCountInResumed: (countInResumed) => set({ countInResumed }),

  showFeedback: (feedback) => set({ feedback }),

  lightQuote: (justQuoted) => set({ justQuoted }),

  finishMatch: (result) => {
    const { campaign } = get();
    if (campaign === null) return;
    set({ campaign: recordResult(campaign, result), screen: 'result', justQuoted: null });
  },

  acceptAssist: () => {
    const { campaign } = get();
    if (campaign === null) return;
    set({ campaign: acceptAssist(campaign) });
  },

  declineAssist: () => set({ assistDeclined: true }),

  replayMatch: () => {
    const { campaign } = get();
    if (campaign === null) return;
    set(takeState(campaign));
  },

  nextMatch: () => {
    const { campaign } = get();
    if (campaign === null || !canAdvance(campaign)) return;
    set(takeState(advanceDuel(campaign)));
  },

  showSummary: () => {
    const { campaign } = get();
    if (campaign === null || !isComplete(campaign)) return;
    set({ screen: 'summary' });
  },

  restartRun: () => {
    const { campaign } = get();
    if (campaign === null) return;
    set({ ...takeState(restartCampaign(campaign)), assistDeclined: false });
  },

  setLickBookOpen: (lickBookOpen) => set({ lickBookOpen }),
}));

/**
 * The result screen offers wider windows: the latest take was the second loss in a row on this
 * duel, the player has not accepted assistance, and has not declined it during this run.
 */
export function selectAssistOffer(state: GameState): boolean {
  return (
    state.screen === 'result' &&
    state.campaign !== null &&
    !state.assistDeclined &&
    shouldOfferAssist(state.campaign)
  );
}

/** The latest take won a duel that has a next one ("On to match 2"). */
export function selectCanAdvance(state: GameState): boolean {
  return state.campaign !== null && canAdvance(state.campaign);
}

/** The latest take won the last duel ("See summary"). */
export function selectRunComplete(state: GameState): boolean {
  return state.campaign !== null && isComplete(state.campaign);
}
