import * as en from './messages/en.json';
import * as vi from './messages/vi.json';
import * as ja from './messages/ja.json';

/**
 * The `game` namespace is nested JSON: next-intl reads `difficulty.lounge.name` as a path. These
 * helpers turn it into `{ 'difficulty.lounge.name': value }`, so every key is checked, not a sample.
 */
type FlatMessages = Readonly<Record<string, unknown>>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function flatten(node: unknown, prefix = ''): FlatMessages {
  if (!isRecord(node)) return { [prefix]: node };
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    Object.assign(out, flatten(value, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

function isFilled(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** The `{name}` variables of a message, sorted, so two languages can be compared. */
function placeholders(message: string): readonly string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

const enGame = flatten(en.game);
const enKeys = Object.keys(enGame);
const others = { vi: flatten(vi.game), ja: flatten(ja.game) } as const;
const allGame = { en: enGame, ...others } as const;

/**
 * The `stage.*` keys of the i18n table in `specs/game-stage/design.md`, relative to the `game`
 * namespace. They sit beside the `game-duel` keys, which the tests above already cover.
 */
const STAGE_KEYS = [
  'stage.loading.title',
  'stage.loading.checking',
  'stage.loading.bytes',
  'stage.loading.label',
  'stage.note.missing',
  'stage.note.noWebgl',
  'stage.scene.street',
  'stage.scene.club',
  'stage.start.intro',
  'stage.street.controls',
  'stage.street.enterClub',
  'stage.street.enterClubKeys',
  'stage.street.doorNear',
  'stage.street.lightsOn',
  'stage.club.leave',
  'stage.club.shadowFading',
] as const;

const LOCALES = ['en', 'vi', 'ja'] as const;

describe('i18n game namespace coverage', () => {
  it('AC-DUEL-016.1: en.json has a game namespace with a non-empty string for every key', () => {
    expect(enKeys.length).toBeGreaterThan(0);
    expect(enKeys.filter((key) => !isFilled(enGame[key]))).toEqual([]);
  });

  it.each(['vi', 'ja'] as const)(
    'AC-DUEL-016.1: %s.json has a non-empty string for every game key in en.json',
    (locale) => {
      const messages = others[locale];
      expect(enKeys.filter((key) => !isFilled(messages[key]))).toEqual([]);
    },
  );

  it.each(['vi', 'ja'] as const)(
    'AC-DUEL-016.1: %s.json has no game key that en.json lacks',
    (locale) => {
      expect(Object.keys(others[locale]).filter((key) => !(key in enGame))).toEqual([]);
    },
  );

  it.each(['vi', 'ja'] as const)(
    'AC-DUEL-016.1: %s.json keeps every {variable} of the en.json game message',
    (locale) => {
      const messages = others[locale];
      const differing = enKeys.filter((key) => {
        const source = enGame[key];
        const translated = messages[key];
        if (!isFilled(source) || !isFilled(translated)) return false;
        return placeholders(source).join() !== placeholders(translated).join();
      });
      expect(differing).toEqual([]);
    },
  );
});

describe('i18n game.stage keys', () => {
  it.each(LOCALES)(
    'AC-STAGE-009.1: %s.json has a non-empty string for every game.stage key of the design table',
    (locale) => {
      const messages = allGame[locale];
      expect(STAGE_KEYS.filter((key) => !isFilled(messages[key]))).toEqual([]);
    },
  );

  it.each(LOCALES)(
    'AC-STAGE-009.1: %s.json has no game.stage key beyond the design table',
    (locale) => {
      const stageKeys = Object.keys(allGame[locale]).filter((key) => key.startsWith('stage.'));
      expect([...stageKeys].sort()).toEqual([...STAGE_KEYS].sort());
    },
  );

  it.each(LOCALES)(
    'AC-STAGE-009.1: %s.json keeps {loaded} and {total} in game.stage.loading.bytes',
    (locale) => {
      const message = allGame[locale]['stage.loading.bytes'];
      expect(isFilled(message) ? placeholders(message) : []).toEqual(['loaded', 'total']);
    },
  );
});
