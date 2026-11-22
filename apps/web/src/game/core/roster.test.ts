import { buildRoster, CHARACTERS, isCharacter, type Character } from './roster';

describe('roster of Shadows', () => {
  it('AC-DUEL-012.1: picking Aki puts Sayo at club 1 and Ren at club 2', () => {
    const roster = buildRoster('aki');

    expect(roster[1]).toMatchObject({ club: 1, character: 'sayo' });
    expect(roster[2]).toMatchObject({ club: 2, character: 'ren' });
  });

  it('AC-DUEL-012.2: picking Sayo gives Aki then Ren; picking Ren gives Aki then Sayo', () => {
    const sayo = buildRoster('sayo');
    expect(sayo[1]).toMatchObject({ club: 1, character: 'aki' });
    expect(sayo[2]).toMatchObject({ club: 2, character: 'ren' });

    const ren = buildRoster('ren');
    expect(ren[1]).toMatchObject({ club: 1, character: 'aki' });
    expect(ren[2]).toMatchObject({ club: 2, character: 'sayo' });
  });

  it('AC-DUEL-012.3: for every pick, club 3 is the picked character with the Shadow palette flag', () => {
    for (const player of CHARACTERS) {
      const roster = buildRoster(player);

      expect(roster[3]).toEqual({ club: 3, character: player, shadowPalette: true });
      // Clubs 1 and 2 never repeat the player's character, nor each other.
      expect([roster[1].character, roster[2].character]).not.toContain(player);
      expect(roster[1].character).not.toBe(roster[2].character);
    }
  });

  it('every Shadow is drawn with the Shadow palette until beaten (design 4.1)', () => {
    for (const player of CHARACTERS) {
      const roster = buildRoster(player);
      expect([roster[1], roster[2], roster[3]].every((shadow) => shadow.shadowPalette)).toBe(true);
    }
  });

  it('rejects an unknown character and keeps the roster immutable', () => {
    expect(isCharacter('ren')).toBe(true);
    expect(isCharacter('drummer')).toBe(false);
    expect(isCharacter(undefined)).toBe(false);
    expect(() => buildRoster('drummer' as Character)).toThrow(RangeError);

    const roster = buildRoster('aki');
    expect(Object.isFrozen(roster)).toBe(true);
    expect(Object.isFrozen(roster[1])).toBe(true);
  });
});
