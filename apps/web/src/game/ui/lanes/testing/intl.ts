/**
 * Fake `game` messages for component tests, copied from the i18n table of
 * `specs/game-duel/design.md`. The real keys reach `messages/*.json` only in T-012, and next-intl
 * ships as ES modules Jest does not load, so tests replace `next-intl` with `nextIntlMock`:
 *
 *   jest.mock('next-intl', () =>
 *     jest.requireActual<typeof import('../lanes/testing/intl')>('../lanes/testing/intl').nextIntlMock,
 *   );
 *
 * A key missing here, or a `{x}` without its value, throws, so a test fails on a key that is not
 * in the design table. Test-only: production code never imports this file.
 */

export type FakeLocale = 'en' | 'vi';

type Messages = Readonly<Record<string, string>>;

const GAME_MESSAGES: Readonly<Record<FakeLocale, Messages>> = {
  en: {
    'hud.bar': 'Bar {n}',
    'hud.yourPhrase': 'Your phrase',
    'pad.d': 'Button D, lowest note',
    'pad.f': 'Button F, second note',
    'pad.j': 'Button J, third note',
    'pad.k': 'Button K, highest note',
    'feedback.perfect': 'Perfect',
    'feedback.great': 'Great',
    'feedback.ok': 'OK',
    'feedback.miss': 'Miss',
    'feedback.extra': 'Extra tap',
    'feedback.quote': 'Quote: {lick}!',
    'feedback.quoteSub': '{lick} sounds on the next downbeat',
    'lickBook.title': 'Lick book',
    'lickBook.note': 'Round squares mark off-beat positions. Positions 1 to 8 read left to right.',
    'lickBook.justQuoted': 'Just quoted',
    'lick.duck': 'Duck',
    'lick.frog': 'Frog',
    'lick.windChime': 'Wind chime',
  },
  vi: {
    'hud.bar': 'Ô {n}',
    'hud.yourPhrase': 'Câu của bạn',
    'pad.d': 'Nút D, nốt thấp nhất',
    'pad.f': 'Nút F, nốt thứ hai',
    'pad.j': 'Nút J, nốt thứ ba',
    'pad.k': 'Nút K, nốt cao nhất',
    'feedback.perfect': 'Hoàn hảo',
    'feedback.great': 'Tốt',
    'feedback.ok': 'Tạm được',
    'feedback.miss': 'Trượt',
    'feedback.extra': 'Gõ thừa',
    'feedback.quote': 'Trích dẫn: {lick}!',
    'feedback.quoteSub': '{lick} vang lên ở phách đầu ô kế tiếp',
    'lickBook.title': 'Sổ lick',
    'lickBook.note': 'Ô vuông bo tròn đánh dấu vị trí lẻ. Vị trí 1 đến 8 đọc từ trái sang phải.',
    'lickBook.justQuoted': 'Vừa trích',
    'lick.duck': 'Vịt',
    'lick.frog': 'Ếch',
    'lick.windChime': 'Chuông gió',
  },
};

let locale: FakeLocale = 'en';

/** Switches the fake messages; reset with `setFakeLocale('en')` after the test. */
export function setFakeLocale(next: FakeLocale): void {
  locale = next;
}

type Values = Readonly<Record<string, string | number>>;

export function translate(namespace: string, key: string, values: Values = {}): string {
  if (namespace !== 'game') throw new Error(`no fake messages for namespace "${namespace}"`);
  const message = GAME_MESSAGES[locale][key];
  if (message === undefined) throw new Error(`game.${key} is not in the design.md i18n table`);
  return message.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`game.${key} needs a value for {${name}}`);
    return String(value);
  });
}

/** Stand-in for the `next-intl` module: `useTranslations` reads the fake messages above. */
export const nextIntlMock = {
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Values): string =>
      translate(namespace, key, values),
};
