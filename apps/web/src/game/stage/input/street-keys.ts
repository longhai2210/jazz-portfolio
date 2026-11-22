/**
 * Keyboard map of the street (design.md section 3, AC-STAGE-003.1, 003.3): hold A or the left
 * arrow to walk left, D or the right arrow to walk right; E or Enter enters the club by the door.
 *
 * Keys are matched by `code`, the physical key, as the duel's D F J K are, so they work with any
 * layout, with Caps Lock on and under a Vietnamese or Japanese input method. `key` is only read
 * when the browser reports no `code`.
 */
import type { WalkDirection } from '../street/movement';

/** A side of the street controls: a key or a touch zone. */
export type WalkSide = 'left' | 'right';

/** Which sides are held now, by one input (the keyboard or the touch zones). */
export interface HeldSides {
  readonly left: boolean;
  readonly right: boolean;
}

export const NO_SIDES: HeldSides = Object.freeze({ left: false, right: false });

const CODE_SIDES: Readonly<Record<string, WalkSide>> = {
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const KEY_SIDES: Readonly<Record<string, WalkSide>> = {
  a: 'left',
  arrowleft: 'left',
  d: 'right',
  arrowright: 'right',
};

const ENTER_CODES: ReadonlySet<string> = new Set(['KeyE', 'Enter', 'NumpadEnter']);
const ENTER_KEYS: ReadonlySet<string> = new Set(['e', 'enter']);

/** The fields of a keyboard event the map reads. */
export type KeyLike = Pick<KeyboardEvent, 'code' | 'key'>;

function hasCode(event: KeyLike): boolean {
  return Boolean(event.code) && event.code !== 'Unidentified';
}

/** The side a key walks to, or null when it is not A, D or a left or right arrow. */
export function walkSideForKey(event: KeyLike): WalkSide | null {
  if (hasCode(event)) return CODE_SIDES[event.code] ?? null;
  return KEY_SIDES[event.key.toLowerCase()] ?? null;
}

/** A name for the physical key, so a key-up finds the key-down it ends. */
export function keyId(event: KeyLike): string {
  return hasCode(event) ? event.code : event.key.toLowerCase();
}

/** Whether a key is E or Enter, the keys that enter the club. */
export function isEnterClubKey(event: KeyLike): boolean {
  if (hasCode(event)) return ENTER_CODES.has(event.code);
  return ENTER_KEYS.has(event.key.toLowerCase());
}

/**
 * The walk direction of every held input together. Left and right at once cancel out, whether
 * both keys, both touch zones or one of each: the character stands still rather than jump between
 * directions (design.md section 3).
 */
export function walkDirection(...inputs: readonly HeldSides[]): WalkDirection {
  const left = inputs.some((held) => held.left);
  const right = inputs.some((held) => held.right);
  if (left === right) return 0;
  return left ? -1 : 1;
}

/**
 * Whether the focused element acts on Enter itself (a button, a link, a form field). Enter there
 * is left to the browser, so pressing Enter on the focused Enter the club button enters once, not
 * twice, and Enter on Back to portfolio never enters the club.
 */
export function handlesEnterItself(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target.closest('button, a[href], input, select, textarea, summary, [role="button"]') !== null;
}
