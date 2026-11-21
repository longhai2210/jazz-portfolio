import * as fc from 'fast-check';
import { stepTime, type BeatClock } from '@/game/core/clock';
import {
  barRole,
  createSession,
  DUEL_BARS,
  phaseAt,
  stepSession,
  type SessionPhase,
  type SessionState,
} from '@/game/core/session';
import type { Turn } from '@/game/core/types';
import { duelRoles, type DuelRoles } from './roles';

const T0 = 10;

function startedSession(): SessionState {
  const ready = createSession({ character: 'aki', difficulty: 'session', duel: 1, offsetMs: 0 });
  return stepSession(ready, { type: 'start', time: T0 }).state;
}

function clockOf(state: SessionState): BeatClock {
  if (state.clock === null) throw new Error('the session has not started');
  return state.clock;
}

/** Plays a whole duel bar by bar and returns, per bar, the phase on screen and its roles. */
function playThrough(): { bar: number; phase: SessionPhase; roles: DuelRoles }[] {
  let state = startedSession();
  const clock = clockOf(state);
  const bars = [];
  for (let bar = 0; bar < DUEL_BARS; bar += 1) {
    const middle = stepTime(clock, bar, 4);
    state = stepSession(state, { type: 'advance', time: middle }).state;
    const phase = phaseAt(state, middle);
    bars.push({ bar, phase, roles: duelRoles(phase) });
  }
  return bars;
}

const TURNS: readonly Turn[] = ['echo', 'answer', 'solo'];

describe('roles in the duel', () => {
  it("AC-STAGE-005.2: on every opponent's bar of a real duel, the Shadow plays and the player listens", () => {
    const opponentBars = playThrough().filter(({ bar }) => barRole(bar)?.kind === 'opponent');

    expect(opponentBars).toHaveLength(12);
    for (const { phase, roles } of opponentBars) {
      expect(phase.kind).toBe('opponent');
      expect(roles).toEqual({ player: 'listen', shadow: 'play', onBeat: true });
    }
  });

  it("AC-STAGE-005.2: on every player's bar of a real duel, the player plays and the Shadow listens", () => {
    const playerBars = playThrough().filter(({ bar }) => barRole(bar)?.kind === 'player');

    expect(playerBars).toHaveLength(12);
    for (const { phase, roles } of playerBars) {
      expect(phase.kind).toBe('player');
      expect(roles).toEqual({ player: 'play', shadow: 'listen', onBeat: true });
    }
  });

  it('AC-STAGE-005.2: for any turn and bar, exactly one side plays and it is the side whose bar it is', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<'opponent' | 'player'>('opponent', 'player'),
        fc.constantFrom(...TURNS),
        fc.integer({ min: 1, max: DUEL_BARS - 1 }),
        fc.integer({ min: 0, max: 3 }),
        (kind, turn, bar, index) => {
          const roles = duelRoles({ kind, turn, bar, index });
          const playing = (['player', 'shadow'] as const).filter((side) => roles[side] === 'play');

          expect(playing).toEqual([kind === 'player' ? 'player' : 'shadow']);
          expect(roles[kind === 'player' ? 'shadow' : 'player']).toBe('listen');
        },
      ),
    );
  });

  it('during the count-in both characters listen and bounce on the beat', () => {
    const [countIn] = playThrough();

    expect(countIn.phase.kind).toBe('countIn');
    expect(countIn.roles).toEqual({ player: 'listen', shadow: 'listen', onBeat: true });
  });

  it('with no music (no session, ready, paused or finished) both stand idle and do not bounce', () => {
    const idle = { player: 'idle', shadow: 'idle', onBeat: false };

    expect(duelRoles(null)).toEqual(idle);
    expect(duelRoles({ kind: 'ready' })).toEqual(idle);
    expect(duelRoles({ kind: 'paused', turn: 'answer' })).toEqual(idle);
    expect(duelRoles({ kind: 'finished' })).toEqual(idle);
  });
});
