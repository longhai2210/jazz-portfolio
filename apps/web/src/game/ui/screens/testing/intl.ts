/**
 * Fake `game` messages for tests of the whole game screen, copied from the i18n table of
 * `specs/game-duel/design.md` (en and vi columns, every key). The real keys reach
 * `messages/*.json` only in T-012, and next-intl ships as ES modules Jest does not load, so tests
 * replace `next-intl` with `nextIntlMock`:
 *
 *   jest.mock('next-intl', () =>
 *     jest.requireActual<typeof import('./screens/testing/intl')>('./screens/testing/intl')
 *       .nextIntlMock,
 *   );
 *
 * It covers the keys of `lanes/testing/intl.ts` too, since the lane board, pads and lick book
 * render inside the game screen. A key missing here, or a `{x}` without its value, throws.
 * `useLocale` returns the locale set with `setFakeLocale`. Test-only.
 */

export type FakeLocale = 'en' | 'vi';

type Messages = Readonly<Record<string, string>>;

const GAME_MESSAGES: Readonly<Record<FakeLocale, Messages>> = {
  en: {
    title: 'Midnight Session',
    'home.back': 'Back to portfolio',
    'start.intro':
      'Trade fours with a shadow of the band. Listen, answer, then play your own solo. Use D F J K or tap the four zones.',
    'start.play': 'Play',
    'unsupported.title': 'This browser cannot play the game',
    'unsupported.body':
      'The game needs Web Audio, which this browser does not offer. Try a recent version of Chrome, Firefox, Safari or Edge.',
    'rotate.hint': 'Turn your phone sideways to play',
    'difficulty.title': 'Choose your difficulty',
    'difficulty.lounge.name': 'Lounge',
    'difficulty.lounge.desc':
      'Wide timing. Every target note is shown. Easy to play with the sound off.',
    'difficulty.session.name': 'Session',
    'difficulty.session.desc':
      'Normal timing. Beat lines stay on, targets show only while the opponent plays.',
    'difficulty.lateSet.name': 'Late Set',
    'difficulty.lateSet.desc':
      'Tight timing, swung rhythm. No targets and no beat lines: use your ears.',
    'difficulty.timing': 'Timing x{mult}',
    'difficulty.continue': 'Continue',
    'calibration.title': 'Tap along to the click',
    'calibration.body':
      'Tap the pad with each click. This measures the delay of your screen and headphones.',
    'calibration.tap': 'Tap',
    'calibration.progress': '{count} of {total}',
    'calibration.done': 'Delay set to {ms} ms',
    'calibration.doneBody': 'Both matches use this value.',
    'calibration.startMatch': 'Start match 1',
    'calibration.again': 'Calibrate again',
    'calibration.failTitle': 'We could not measure the delay',
    'calibration.failBody': 'Too few taps landed close to the clicks. Delay is set to 0 ms.',
    'calibration.retry': 'Try again',
    'calibration.skip': 'Continue without it',
    'hud.match': 'Match {n} of 2',
    'hud.round': 'Round {n} of 3',
    'hud.bar': 'Bar {n}',
    'hud.opponentPlays': '{name} plays',
    'hud.yourTurn': 'Your turn',
    'hud.yourPhrase': 'Your phrase',
    'hud.bpm': '{bpm} BPM',
    'hud.countIn': 'Count-in',
    'round.echo': 'Echo',
    'round.answer': 'Answer',
    'round.solo': 'Solo',
    'round.restart': 'Round {n} of 3 · {round} restarts',
    'pause.button': 'Pause',
    'pause.title': 'Paused',
    'pause.body':
      "When you resume there is one bar of count-in. This round restarts from the opponent's phrase and its score starts over.",
    'pause.resume': 'Resume',
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
    'lickBook.open': 'Open lick book',
    'lickBook.close': 'Close lick book',
    'lickBook.note': 'Round squares mark off-beat positions. Positions 1 to 8 read left to right.',
    'lickBook.justQuoted': 'Just quoted',
    'lick.duck': 'Duck',
    'lick.frog': 'Frog',
    'lick.windChime': 'Wind chime',
    'result.winTitle': '{name} is back in the band',
    'result.loseTitle': 'Not this take',
    'result.stars': '{count} of 3 stars',
    'result.rhythm': 'Rhythm',
    'result.direction': 'Direction',
    'result.feel': 'Feel',
    'result.quoteBonus': 'Quote bonus',
    'result.total': 'Total',
    'result.quotesTitle': 'Licks quoted',
    'result.quotesNone': 'None this take.',
    'result.quoteCount': '{lick} x{count}',
    'result.next': 'On to match 2',
    'result.replay': 'Replay this take',
    'result.summary': 'See summary',
    'assist.title': 'Want a little more room?',
    'assist.body':
      'Widen the timing windows by 15% for the rest of this run. The result screen will say so.',
    'assist.accept': 'Widen windows',
    'assist.decline': 'No thanks',
    'assist.note': 'Timing windows were widened by 15%.',
    'summary.title': 'Session complete',
    'summary.match': 'Match {n} · {name}',
    'summary.points': '{points} points',
    'summary.again': 'Play again from the start',
  },
  vi: {
    title: 'Midnight Session',
    'home.back': 'Về trang chủ',
    'start.intro':
      'Đấu trading fours với một bóng của ban nhạc. Nghe, đáp lại, rồi chơi solo của riêng bạn. Dùng phím D F J K hoặc chạm vào bốn vùng.',
    'start.play': 'Chơi',
    'unsupported.title': 'Trình duyệt này không chơi được game',
    'unsupported.body':
      'Game cần Web Audio mà trình duyệt này không có. Hãy thử bản mới của Chrome, Firefox, Safari hoặc Edge.',
    'rotate.hint': 'Xoay ngang điện thoại để chơi',
    'difficulty.title': 'Chọn độ khó',
    'difficulty.lounge.name': 'Lounge',
    'difficulty.lounge.desc': 'Cửa sổ nhịp rộng. Hiện mọi nốt cần gõ. Dễ chơi cả khi tắt tiếng.',
    'difficulty.session.name': 'Session',
    'difficulty.session.desc':
      'Cửa sổ nhịp chuẩn. Vạch phách luôn hiện, vị trí nốt chỉ hiện khi đối thủ chơi.',
    'difficulty.lateSet.name': 'Late Set',
    'difficulty.lateSet.desc':
      'Cửa sổ nhịp hẹp, nhịp swing. Không hiện vị trí nốt hay vạch phách: hãy nghe bằng tai.',
    'difficulty.timing': 'Cửa sổ nhịp x{mult}',
    'difficulty.continue': 'Tiếp tục',
    'calibration.title': 'Gõ theo tiếng click',
    'calibration.body':
      'Gõ vào ô theo mỗi tiếng click. Việc này đo độ trễ của màn hình và tai nghe.',
    'calibration.tap': 'Gõ',
    'calibration.progress': '{count} trên {total}',
    'calibration.done': 'Độ trễ được đặt là {ms} ms',
    'calibration.doneBody': 'Cả hai trận dùng giá trị này.',
    'calibration.startMatch': 'Bắt đầu trận 1',
    'calibration.again': 'Hiệu chỉnh lại',
    'calibration.failTitle': 'Chưa đo được độ trễ',
    'calibration.failBody': 'Có quá ít lần gõ gần tiếng click. Độ trễ được đặt là 0 ms.',
    'calibration.retry': 'Thử lại',
    'calibration.skip': 'Tiếp tục không hiệu chỉnh',
    'hud.match': 'Trận {n} trên 2',
    'hud.round': 'Lượt {n} trên 3',
    'hud.bar': 'Ô {n}',
    'hud.opponentPlays': '{name} chơi',
    'hud.yourTurn': 'Đến lượt bạn',
    'hud.yourPhrase': 'Câu của bạn',
    'hud.bpm': '{bpm} BPM',
    'hud.countIn': 'Đếm nhịp',
    'round.echo': 'Echo (lặp lại)',
    'round.answer': 'Answer (đáp ngược)',
    'round.solo': 'Solo',
    'round.restart': 'Lượt {n} trên 3 · {round} chơi lại',
    'pause.button': 'Tạm dừng',
    'pause.title': 'Đang tạm dừng',
    'pause.body':
      'Khi tiếp tục sẽ có một ô đếm nhịp. Lượt này chơi lại từ câu của đối thủ và điểm của lượt được tính lại từ đầu.',
    'pause.resume': 'Tiếp tục',
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
    'lickBook.open': 'Mở sổ lick',
    'lickBook.close': 'Đóng sổ lick',
    'lickBook.note': 'Ô vuông bo tròn đánh dấu vị trí lẻ. Vị trí 1 đến 8 đọc từ trái sang phải.',
    'lickBook.justQuoted': 'Vừa trích',
    'lick.duck': 'Vịt',
    'lick.frog': 'Ếch',
    'lick.windChime': 'Chuông gió',
    'result.winTitle': '{name} đã trở lại ban nhạc',
    'result.loseTitle': 'Take này chưa được',
    'result.stars': '{count} trên 3 sao',
    'result.rhythm': 'Nhịp',
    'result.direction': 'Hướng',
    'result.feel': 'Cảm nhạc',
    'result.quoteBonus': 'Thưởng trích dẫn',
    'result.total': 'Tổng',
    'result.quotesTitle': 'Lick đã trích',
    'result.quotesNone': 'Take này chưa trích lick nào.',
    'result.quoteCount': '{lick} x{count}',
    'result.next': 'Sang trận 2',
    'result.replay': 'Chơi lại take này',
    'result.summary': 'Xem tổng kết',
    'assist.title': 'Muốn có thêm chút khoảng trống không?',
    'assist.body':
      'Nới cửa sổ nhịp thêm 15% cho phần còn lại của lần chơi này. Màn kết quả sẽ ghi chú điều đó.',
    'assist.accept': 'Nới cửa sổ nhịp',
    'assist.decline': 'Không, cảm ơn',
    'assist.note': 'Cửa sổ nhịp đã được nới 15%.',
    'summary.title': 'Hoàn thành phiên',
    'summary.match': 'Trận {n} · {name}',
    'summary.points': '{points} điểm',
    'summary.again': 'Chơi lại từ đầu',
  },
};

let locale: FakeLocale = 'en';

/** Switches the fake messages and `useLocale`; reset with `setFakeLocale('en')` after the test. */
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

/** Stand-in for the `next-intl` module: fake `game` messages and the fake locale. */
export const nextIntlMock = {
  useTranslations:
    (namespace: string) =>
    (key: string, values?: Values): string =>
      translate(namespace, key, values),
  useLocale: (): FakeLocale => locale,
};
