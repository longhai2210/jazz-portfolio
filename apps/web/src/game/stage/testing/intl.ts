/**
 * Fake `game` messages for stage tests: the `stage.*` keys of the i18n table in
 * `specs/game-stage/design.md` (en and vi columns), on top of every `game-duel` key from
 * `ui/screens/testing/intl.ts`, since the stage renders the duel's screens too. The real `stage.*`
 * keys reach `messages/*.json` only in T-023. Use it as the duel's fake is used:
 *
 *   jest.mock('next-intl', () =>
 *     jest.requireActual<typeof import('../testing/intl')>('../testing/intl').nextIntlMock,
 *   );
 *
 * A key missing here, or a `{x}` without its value, throws. Test-only.
 */
import {
  nextIntlMock as duelIntlMock,
  setFakeLocale,
  translate as translateDuel,
  type FakeLocale,
} from '../../ui/screens/testing/intl';

export { setFakeLocale, type FakeLocale };

type Messages = Readonly<Record<string, string>>;

const STAGE_MESSAGES: Readonly<Record<FakeLocale, Messages>> = {
  en: {
    'stage.loading.title': 'Loading the street and the club',
    'stage.loading.checking': 'Checking the stage files...',
    'stage.loading.bytes': '{loaded} MB of {total} MB',
    'stage.loading.label': 'Loading progress',
    'stage.note.missing':
      'The stage art is not available here, so this is the plain grey-box match.',
    'stage.note.noWebgl':
      'This browser cannot draw the 3D stage, so this is the plain grey-box match.',
    'stage.scene.street': 'The street scene',
    'stage.scene.club': 'The club scene',
    'stage.start.intro':
      'Walk down the street to the club door, then trade fours with a shadow on stage.',
    'stage.street.controls':
      'Walk: A and D or the arrow keys. Touch the left or right half of the screen.',
    'stage.street.enterClub': 'Enter the club',
    'stage.street.enterClubKeys': 'E or Enter',
    'stage.street.doorNear': 'You are at the club door.',
    'stage.street.lightsOn': 'The street lights are on',
    'stage.club.leave': 'Leave the club',
    'stage.club.shadowFading': 'The shadow fades away.',
  },
  vi: {
    'stage.loading.title': 'Đang tải phố và club',
    'stage.loading.checking': 'Đang kiểm tra tệp sân khấu...',
    'stage.loading.bytes': '{loaded} MB trên {total} MB',
    'stage.loading.label': 'Tiến độ tải',
    'stage.note.missing':
      'Chưa có hình ảnh sân khấu ở đây, nên đây là trận khối xám đơn giản.',
    'stage.note.noWebgl':
      'Trình duyệt này không vẽ được sân khấu 3D, nên đây là trận khối xám đơn giản.',
    'stage.scene.street': 'Cảnh phố',
    'stage.scene.club': 'Cảnh club',
    'stage.start.intro':
      'Đi dọc phố tới cửa club, rồi đấu trading fours với một bóng trên sân khấu.',
    'stage.street.controls':
      'Đi: phím A và D hoặc mũi tên. Trên điện thoại, chạm nửa trái hoặc nửa phải màn hình.',
    'stage.street.enterClub': 'Vào club',
    'stage.street.enterClubKeys': 'E hoặc Enter',
    'stage.street.doorNear': 'Bạn đang ở cửa club.',
    'stage.street.lightsOn': 'Đèn phố đã sáng',
    'stage.club.leave': 'Rời club',
    'stage.club.shadowFading': 'Bóng mờ dần rồi biến mất.',
  },
};

type Values = Readonly<Record<string, string | number>>;

export function translate(namespace: string, key: string, values: Values = {}): string {
  if (namespace !== 'game' || !key.startsWith('stage.')) return translateDuel(namespace, key, values);
  const message = STAGE_MESSAGES[duelIntlMock.useLocale()][key];
  if (message === undefined) throw new Error(`game.${key} is not in the game-stage i18n table`);
  return message.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`game.${key} needs a value for {${name}}`);
    return String(value);
  });
}

/** Stand-in for the `next-intl` module: fake `game` messages, stage keys included. */
export const nextIntlMock = {
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Values): string =>
      translate(namespace, key, values),
  useLocale: duelIntlMock.useLocale,
};
