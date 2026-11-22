/**
 * Roster of Shadows (Bóng Lạc Điệu), design section 4.1: the opponent of each club follows from
 * the character the player picks. Clubs 1 and 2 hold the two characters the player did not pick,
 * easier opponent first; club 3 holds the Shadow of the player's own character.
 */

/** A playable musician, and so also a Shadow. */
export type Character = 'aki' | 'sayo' | 'ren';

/** The characters in opponent order, easier first: Aki (rhythm), Sayo (vocal), Ren (lead). */
export const CHARACTERS: readonly Character[] = ['aki', 'sayo', 'ren'];

/** A club of the stage. Club 1 is duel 1 and club 2 is duel 2 of the grey box. */
export type Club = 1 | 2 | 3;

/** The opponent of one club. */
export interface Shadow {
  readonly club: Club;
  /** Whose model, style and composed calls the Shadow uses. */
  readonly character: Character;
  /**
   * Draw the model with the Shadow palette (dark tones and a bright rim) instead of its own colours.
   * Every Shadow is drawn this way until it is beaten (design 4.1); at club 3 it is what tells the
   * Shadow apart from the player, who uses the same model.
   */
  readonly shadowPalette: boolean;
}

/** The Shadow of each club, keyed by club. */
export type Roster = Readonly<Record<Club, Shadow>>;

export function isCharacter(value: unknown): value is Character {
  return typeof value === 'string' && (CHARACTERS as readonly string[]).includes(value);
}

/** Builds the roster for the character the player picked. */
export function buildRoster(player: Character): Roster {
  if (!isCharacter(player)) {
    throw new RangeError(`unknown character: ${String(player)}`);
  }
  const [first, second] = CHARACTERS.filter((character) => character !== player);
  return Object.freeze({
    1: Object.freeze({ club: 1, character: first, shadowPalette: true }),
    2: Object.freeze({ club: 2, character: second, shadowPalette: true }),
    3: Object.freeze({ club: 3, character: player, shadowPalette: true }),
  });
}
