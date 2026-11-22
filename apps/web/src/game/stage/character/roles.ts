/**
 * Who plays and who listens in the club (game-stage AC-STAGE-005.2): a pure function from the
 * phase of the duel session, the `phase` that `stores/gameStore.ts` holds, to the action of the
 * player's character and of the Shadow.
 *
 * During the opponent's bars the Shadow plays and the player listens; during the player's bars it
 * is the other way round. Outside the turns:
 * - the count-in: both listen to the count, bouncing on the beat;
 * - before the start, paused, finished or no session: both stand idle, with no beat to bounce to.
 */
import type { SessionPhase } from '@/game/core/session';
import type { CharacterAction } from './animation';

/** The actions a character takes on the club stage. */
export type StageAction = Extract<CharacterAction, 'idle' | 'listen' | 'play'>;

export interface DuelRoles {
  readonly player: StageAction;
  readonly shadow: StageAction;
  /**
   * The band is playing, so both characters bounce on the beat: the scene passes the beat of the
   * session clock to `characterPose` only while this is true.
   */
  readonly onBeat: boolean;
}

const SHADOW_PLAYS: DuelRoles = Object.freeze({ player: 'listen', shadow: 'play', onBeat: true });
const PLAYER_PLAYS: DuelRoles = Object.freeze({ player: 'play', shadow: 'listen', onBeat: true });
const BOTH_LISTEN: DuelRoles = Object.freeze({ player: 'listen', shadow: 'listen', onBeat: true });
const BOTH_IDLE: DuelRoles = Object.freeze({ player: 'idle', shadow: 'idle', onBeat: false });

/** The actions of the two characters during `phase`; null (no session yet) is the same as ready. */
export function duelRoles(phase: SessionPhase | null): DuelRoles {
  if (phase === null) return BOTH_IDLE;
  switch (phase.kind) {
    case 'opponent':
      return SHADOW_PLAYS;
    case 'player':
      return PLAYER_PLAYS;
    case 'countIn':
      return BOTH_LISTEN;
    case 'ready':
    case 'paused':
    case 'finished':
      return BOTH_IDLE;
  }
}
