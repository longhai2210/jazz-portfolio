/**
 * Keyboard map of the 4 buttons (AC-DUEL-013.3): D, F, J, K, lowest to highest.
 *
 * Keys are matched by `code`, the physical key, so the home-row keys work with any layout, with
 * Caps Lock on, and while a Vietnamese or Japanese input method is active. `key` is only used
 * when the browser reports no `code` (some virtual keyboards).
 */
import type { Button } from '../../core/types';

export const KEY_CODE_BUTTONS: Readonly<Record<string, Button>> = {
  KeyD: 0,
  KeyF: 1,
  KeyJ: 2,
  KeyK: 3,
};

const KEY_BUTTONS: Readonly<Record<string, Button>> = { d: 0, f: 1, j: 2, k: 3 };

/** The fields of a keyboard event the map reads. */
export type KeyLike = Pick<KeyboardEvent, 'code' | 'key'>;

/** The button of a key, or null when the key is not one of D, F, J, K. */
export function buttonForKey(event: KeyLike): Button | null {
  if (event.code && event.code !== 'Unidentified') return KEY_CODE_BUTTONS[event.code] ?? null;
  return KEY_BUTTONS[event.key.toLowerCase()] ?? null;
}

/** The fields of a keyboard event that decide whether the game owns it. */
export type KeyEventLike = Pick<
  KeyboardEvent,
  'repeat' | 'isComposing' | 'ctrlKey' | 'metaKey' | 'altKey'
> & { readonly target: EventTarget | null };

/**
 * Whether the game owns a key event of D, F, J or K: not a shortcut with Ctrl, Meta or Alt (so
 * Ctrl+F still finds), not part of an input method composition, not typed into a field.
 */
export function isGameKeyEvent(event: KeyEventLike): boolean {
  if (event.isComposing) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return !isEditable(event.target);
}

/**
 * Whether a key-down is a tap: a first press the game owns. A held key repeats key-down events
 * with `repeat` set; those are no taps.
 */
export function isTapKeyDown(event: KeyEventLike): boolean {
  return !event.repeat && isGameKeyEvent(event);
}

function isEditable(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
