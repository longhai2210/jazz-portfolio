# Design: Trận đấu Trading Fours (khối xám)

Feature: game-duel. Spec: `specs/game-duel/requirements.md`. Mockups: `specs/game-duel/mockups/` (open `duel.html`, `setup.html`, `results.html`, `pause.html`, `admin-toggle.html`; shared styles in `game.css`).

Mockups are static, in English, and copy token values from `apps/web/src/styles/globals.css` (`@theme`, dark palette). Mockup text is a stand-in; the real strings are in the i18n table below. Khối xám là hình 2D đơn giản, không dùng ảnh của bộ nhân vật cũ.

## Design principles

- The game is dark only. It lives outside `(portfolio)`, so there is no site header or music player. Every screen has a top bar with a "Back to portfolio" button (AC-DUEL-013.9).
- Tokens only (`jazz-*`, `font-heading` for titles, `font-mono` for numbers and labels, `font-body` otherwise). Primary buttons are `bg-jazz-gold` with `text-jazz-black`, hover `jazz-amber`. Panels use `bg-jazz-dark`, `border-jazz-slate`, `rounded-2xl`.
- Every interactive target is at least 44 x 44 px.
- Nothing relies on color alone: lanes differ by shape too, hit grades are words, selected difficulty has a border and `aria-checked`, off-beat lick dots are square.
- Lounge is playable with sound off: all target notes, beat lines and the playhead are drawn; countdowns show numbers and dots.

## Shared pieces and reuse

No existing shared component fits: the game is an isolated module (`apps/web/src/game/ui`) with its own plain-React components and Tailwind classes. Reused from the repo: the `jazz-*` tokens, the focus ring from `globals.css` (gold outline), and for the CMS the Blog toggle markup in `ContentSettingsForm.tsx`. Do not use Framer Motion or Three.js in this feature (grey-box, keeps the bundle small).

Suggested component split for T-009 and T-010 (not binding):
- `TopBar` (home button, chips, pause button), `ScreenShell` (centered panel with TopBar).
- `LaneBoard` (4 lanes, beat lines, playhead, markers, "Your phrase" label), `TouchPads` (4 zones), `LickBook` (3 licks with dot patterns), `Feedback` (grade text).
- Screens: `StartScreen`, `UnsupportedScreen`, `DifficultyScreen`, `CalibrationScreen`, `ResultScreen`, `SummaryScreen`, `PauseOverlay`, `CountIn`.

## Lane identity (AC-DUEL-013.11)

| Button | Position | Shape | Color token |
|---|---|---|---|
| K | top lane (highest note) | triangle, with a `jazz-text-muted` outline | `jazz-steel` fill |
| J | second | diamond | `jazz-text` |
| F | third | square (rounded) | `jazz-amber` |
| D | bottom lane (lowest note) | circle | `jazz-copper` |

The same shape appears on the lane key label, on the touch pad, and on every note marker. Filled marker = a note the opponent plays or a tap the player made. Hollow outline = a target the player must play. A hit target gets a `jazz-amber` ring. A missed target is dimmed to 35% and the grade word says "Miss".

## Screens and states

### 1. Start (`setup.html` frame 1)
- Content: title "Midnight Session", one line of instructions, **Play** button (its click calls the audio unlock, AC-DUEL-013.1). Top bar with Back to portfolio.
- States: normal; unlocking (Play disabled for the moment `resume()` is pending); audio unsupported (screen 2).
- Shown only when the shell passes no difficulty (AC-DUEL-011.1). When the shell passes difficulty and offset, audio is still unlocked by a Play press, but difficulty and calibration are skipped (AC-DUEL-017.1).

### 2. Unsupported (`setup.html` frame 2)
- Replaces the Start panel when there is no Web Audio (AC-DUEL-013.2). Heading, one sentence, "Back to portfolio" primary button. `role="alert"`. No blank screen.

### 3. Difficulty (`setup.html` frame 3)
- Three cards in a `radiogroup`: Lounge (selected by default), Session, Late Set. Each card shows name, one-line description, timing multiplier. Arrow keys move the choice; **Continue** confirms. On narrow screens the cards stack vertically.
- States: default (Lounge selected), another selected. No empty/error state.

### 4. Calibration (`setup.html` frames 4a to 4c)
- Eight clicks play. 8 dots show progress: first 2 dashed (practice, ignored), taps recorded fill the dot, current dot has a ring. A large **Tap** pad (any of D F J K, Space or a touch on the pad counts as a tap).
- Result accepted (at least 4 valid taps): "Delay set to {ms} ms", **Start match 1**, plus "Calibrate again".
- Too few valid taps (AC-DUEL-002.2): warning notice, offset 0, **Try again** (primary) and **Continue without it**.
- Loading: none (no network). Audio errors fall back to the Unsupported screen.

### 5. Duel board (`duel.html`)
Desktop layout (landscape, 16:9 target): top bar, HUD row, round tabs, lane board, 4 pads, lick book on the right (190 px).
- **Top bar:** Back to portfolio, difficulty chip, BPM chip, pause button.
- **HUD:** left, who is acting ("Sayo plays" or "Your turn") with a 40 px letter avatar (shadow opponents use the `jazz-indigo` dashed avatar) and "Match n of 2"; right, round name (Echo, Answer, Solo) with "Round n of 3".
- **Round tabs:** three chips, current one gold.
- **Lane board:** shows the current 4-bar phase (opponent then player). Header row "Bar 1 .. Bar 4" with the current bars in `jazz-amber`. 4 lanes, K on top. A thick line marks each bar start. A thin line marks each beat (every 2 grid steps) when beat lines are on. A gold playhead moves left to right. The player's phase has a `jazz-gold` track border; the opponent's phase is shown at 75% opacity.
- **"Your phrase" label (AC-DUEL-007.4):** a gold pill under the header row, placed over exactly the bars built from the player's own solo (bars 1 and 2 in match 2). Hidden in match 1 and when the fallback phrase is used. Text key `game.hud.yourPhrase` ("Câu của bạn" in vi).
- **Feedback:** one line over the board with the last grade (Perfect, Great, OK, Miss), "Extra tap" for a surplus tap, and "Quote: {lick}!" with a smaller sub-line. It is text only; with reduced motion it just changes (no shake, no flash, no pulse, AC-DUEL-013.10). Without reduced motion, a 150 ms fade-in is allowed, but no shake and no blink either.
- **Pads:** four buttons (D F J K) with shape glyph; pressed state has `jazz-gold` border and `jazz-blue` fill. Pointer-down counts, not click. Keyboard: key down once, `event.repeat` ignored (AC-DUEL-013.3).
- **Lick book (AC-DUEL-013.8):** three licks (Duck, Frog, Wind chime), each a row of 8 dots; filled dot = a position of the lick; square dots mark off-beat positions. A just-quoted lick gets `jazz-amber` border, `jazz-blue` fill and a star after its name; the star and label stay until the next bar, no pulsing.
- **Difficulty differences (AC-DUEL-011.2):**

| Mode | Beat lines | Target markers for the player | Markers while opponent plays |
|---|---|---|---|
| Lounge | on | hollow shapes (all targets) | filled |
| Session | on | hidden | filled |
| Late Set | off | hidden | hidden (audio only, AC-DUEL-011.2 and Decision 7) |

- **Phone (landscape, `duel.html` frame D, AC-DUEL-013.4):** lanes shrink to 26 px rows with shape-only key labels; the lower half of the screen is split into four full-height touch zones (D F J K from left to right); lick book is a drawer opened by a music-note button in the top bar (44 px), closed by default; Back to portfolio becomes an arrow with an `aria-label`. In portrait, show a full-screen hint "Turn your phone sideways to play" plus the Back to portfolio button; the match does not start in portrait. If the player rotates to portrait during a match, the game pauses.
- **Count-in:** the first bar of each match, and after resume, shows 4 beat dots and numbers 1 to 4 over the board, same visuals as screen 8.
- States: count-in; opponent plays; player plays; between rounds (round tab and banner change on the bar line, no rest bar: a duel is 25 bars per AC-DUEL-004.1); paused (screen 8). No empty/error state: all data is local.

### 6. Result (`results.html` frames 1 to 4)
- Title: win "{name} is back in the band" where {name} is the opponent; loss "Not this take".
- Stars: three glyphs, filled or outline, `role="img"` with `aria-label` "{count} of 3 stars".
- Score rows: Rhythm, Direction, Feel (0 to 100 %, meter bars), a Quote bonus row only when the bonus is above 0 ("+5" or "+10"), and a total. The rows round to whole numbers.
- "Licks quoted": gold-outline tags, "Duck x2" when quoted twice. Empty state: "None this take."
- Buttons: win in match 1: **On to match 2** (primary) and **Replay this take**. Loss: only **Replay this take** (primary). Replay restarts that exact match.
- Second loss in a row on the same match (AC-DUEL-011.3): an inline notice above the buttons, "Want a little more room?" with **Widen windows** and **No thanks**. Declining hides the notice; windows stay the same. The offer is shown only once per streak.
- After the player accepts help (AC-DUEL-011.4): the result of every later match shows the note "Timing windows were widened by 15%." under the total.
- Match 2 win: **Replay this take** and **See summary** instead of "On to match 2". Match 2 loss: only Replay (see open question 2).

### 7. Summary (`results.html` frame 5)
- Title "Session complete". Two cards, one per match: opponent name, stars, points. "Licks quoted" tags with every different lick across both matches. Buttons: **Play again from the start** (primary) and **Back to portfolio**.
- The shell receives `onMatchEnd` for each match (AC-DUEL-017.3); nothing about that is visible.

### 8. Pause and count-in (`pause.html`)
- Opens on Esc, the pause button, or when the tab is hidden (AC-DUEL-014.1). The board is frozen at 50% opacity under a modal dialog (`role="dialog"`, `aria-modal`, focus moves to **Resume**, Tab stays inside). Esc while paused resumes, through the same 1-bar count-in as the **Resume** button, so keyboard players never need the mouse.
- Text: "Paused", and "When you resume there is one bar of count-in. This round restarts from the opponent's phrase and its score starts over." (AC-DUEL-014.2).
- Buttons: **Resume** (primary), **Back to portfolio** (closes the audio context and navigates, AC-DUEL-014.3).
- Count-in: big number 1 to 4 (`aria-live="assertive"`), 4 beat dots, caption "Round n of 3 · {round} restarts".

### 9. CMS Game toggle (`admin-toggle.html`)
- A new card in `apps/web/src/components/admin/settings/ContentSettingsForm.tsx` after the Comments card, same markup as the Blog card: heading "Enable Public Game", description, switch (`peer` checkbox, `isGameEnabled`).
- Off: amber note "Note: /[locale]/game returns 404 Not Found while the Game is disabled." On: a neutral info note, no warning.
- Independent of Blog: not disabled by the Blog switch. Saved with the existing **Save Settings** button; the payload includes `isGameEnabled` (AC-DUEL-015.7). Loading, error and success states reuse the form's existing ones. Admin text is plain English, no next-intl.

## Accessibility summary
- Keyboard: Tab order is top bar, then content, then primary action. D F J K play only during a match. All screens work with Tab, Enter and Space; the difficulty group uses arrow keys.
- Reduced motion: no shake, no flash, no pulsing, no blinking. Feedback is text and shape. The playhead still moves (it is the clock, not decoration). CSS `@media (prefers-reduced-motion: reduce)` disables all transitions in the game. The page transition in `globals.css` (0.5 s color change on `div`, `button` and others) does not apply to the playhead and markers; use `transition: none` on them.
- Focus: the global gold focus ring stays on.
- Screen readers: stars have an `aria-label`; the grade and quote line is `aria-live="polite"` but limited to quotes and misses so it does not read every tap; lanes are decorative (`aria-hidden`) except the pads, which have `aria-label` "Button D, lowest note" and so on.
- Contrast: all text uses `jazz-text`, `jazz-text-muted` and `jazz-gold` on `jazz-black`, `jazz-dark` or `jazz-charcoal`. `jazz-text-dim` is used only for decorative hints, never for something the player must read during play.

## i18n table (namespace `game`, T-012 puts these in en, vi and ja)

`{x}` marks a variable. Names Aki, Sayo, Ren are not translated. Keys are written relative to the `game` namespace.

| Key | en | vi | ja |
|---|---|---|---|
| title | Midnight Session | Midnight Session | Midnight Session |
| home.back | Back to portfolio | Về trang chủ | ポートフォリオに戻る |
| start.intro | Trade fours with a shadow of the band. Listen, answer, then play your own solo. Use D F J K or tap the four zones. | Đấu trading fours với một bóng của ban nhạc. Nghe, đáp lại, rồi chơi solo của riêng bạn. Dùng phím D F J K hoặc chạm vào bốn vùng. | バンドの影とフォーズを交換しましょう。聞いて、応えて、最後は自分のソロを演奏します。D F J K キーか、4つのエリアをタップして操作します。 |
| start.play | Play | Chơi | プレイ |
| unsupported.title | This browser cannot play the game | Trình duyệt này không chơi được game | このブラウザではゲームを遊べません |
| unsupported.body | The game needs Web Audio, which this browser does not offer. Try a recent version of Chrome, Firefox, Safari or Edge. | Game cần Web Audio mà trình duyệt này không có. Hãy thử bản mới của Chrome, Firefox, Safari hoặc Edge. | このゲームには Web Audio が必要ですが、このブラウザは対応していません。Chrome、Firefox、Safari、Edge の最新版をお試しください。 |
| rotate.hint | Turn your phone sideways to play | Xoay ngang điện thoại để chơi | 横向きにしてプレイしてください |
| difficulty.title | Choose your difficulty | Chọn độ khó | 難易度を選んでください |
| difficulty.lounge.name | Lounge | Lounge | ラウンジ |
| difficulty.lounge.desc | Wide timing. Every target note is shown. Easy to play with the sound off. | Cửa sổ nhịp rộng. Hiện mọi nốt cần gõ. Dễ chơi cả khi tắt tiếng. | 判定が広めです。すべてのターゲットが表示され、音を消しても遊べます。 |
| difficulty.session.name | Session | Session | セッション |
| difficulty.session.desc | Normal timing. Beat lines stay on, targets show only while the opponent plays. | Cửa sổ nhịp chuẩn. Vạch phách luôn hiện, vị trí nốt chỉ hiện khi đối thủ chơi. | 標準の判定です。拍の線は常に表示され、ターゲットは相手の演奏中だけ表示されます。 |
| difficulty.lateSet.name | Late Set | Late Set | レイトセット |
| difficulty.lateSet.desc | Tight timing, swung rhythm. No targets and no beat lines: use your ears. | Cửa sổ nhịp hẹp, nhịp swing. Không hiện vị trí nốt hay vạch phách: hãy nghe bằng tai. | 判定が厳しく、スウィングのリズムです。ターゲットも拍の線もありません。耳を頼りに演奏しましょう。 |
| difficulty.timing | Timing x{mult} | Cửa sổ nhịp x{mult} | 判定 x{mult} |
| difficulty.continue | Continue | Tiếp tục | 続ける |
| calibration.title | Tap along to the click | Gõ theo tiếng click | クリック音に合わせてタップ |
| calibration.body | Tap the pad with each click. This measures the delay of your screen and headphones. | Gõ vào ô theo mỗi tiếng click. Việc này đo độ trễ của màn hình và tai nghe. | クリックごとにパッドをタップしてください。画面とヘッドホンの遅延を測定します。 |
| calibration.tap | Tap | Gõ | タップ |
| calibration.progress | {count} of {total} | {count} trên {total} | {count} / {total} |
| calibration.done | Delay set to {ms} ms | Độ trễ được đặt là {ms} ms | 遅延を {ms} ms に設定しました |
| calibration.doneBody | Both matches use this value. | Cả hai trận dùng giá trị này. | 2つの試合で同じ値を使います。 |
| calibration.startMatch | Start match 1 | Bắt đầu trận 1 | 試合1を始める |
| calibration.again | Calibrate again | Hiệu chỉnh lại | もう一度測定する |
| calibration.failTitle | We could not measure the delay | Chưa đo được độ trễ | 遅延を測定できませんでした |
| calibration.failBody | Too few taps landed close to the clicks. Delay is set to 0 ms. | Có quá ít lần gõ gần tiếng click. Độ trễ được đặt là 0 ms. | クリックに近いタップが少なすぎました。遅延は 0 ms に設定されます。 |
| calibration.retry | Try again | Thử lại | もう一度試す |
| calibration.skip | Continue without it | Tiếp tục không hiệu chỉnh | 測定せずに続ける |
| hud.match | Match {n} of 2 | Trận {n} trên 2 | 試合 {n} / 2 |
| hud.round | Round {n} of 3 | Lượt {n} trên 3 | ラウンド {n} / 3 |
| hud.bar | Bar {n} | Ô {n} | {n}小節目 |
| hud.opponentPlays | {name} plays | {name} chơi | {name} の演奏 |
| hud.yourTurn | Your turn | Đến lượt bạn | あなたの番 |
| hud.yourPhrase | Your phrase | Câu của bạn | あなたのフレーズ |
| hud.bpm | {bpm} BPM | {bpm} BPM | {bpm} BPM |
| hud.countIn | Count-in | Đếm nhịp | カウントイン |
| round.echo | Echo | Echo (lặp lại) | エコー |
| round.answer | Answer | Answer (đáp ngược) | アンサー |
| round.solo | Solo | Solo | ソロ |
| round.restart | Round {n} of 3 · {round} restarts | Lượt {n} trên 3 · {round} chơi lại | ラウンド {n} / 3 · {round} をやり直し |
| pause.button | Pause | Tạm dừng | 一時停止 |
| pause.title | Paused | Đang tạm dừng | 一時停止中 |
| pause.body | When you resume there is one bar of count-in. This round restarts from the opponent's phrase and its score starts over. | Khi tiếp tục sẽ có một ô đếm nhịp. Lượt này chơi lại từ câu của đối thủ và điểm của lượt được tính lại từ đầu. | 再開すると1小節のカウントインがあります。このラウンドは相手のフレーズから再スタートし、スコアは最初から数え直されます。 |
| pause.resume | Resume | Tiếp tục | 再開 |
| pad.d | Button D, lowest note | Nút D, nốt thấp nhất | ボタン D、最も低い音 |
| pad.f | Button F, second note | Nút F, nốt thứ hai | ボタン F、2番目の音 |
| pad.j | Button J, third note | Nút J, nốt thứ ba | ボタン J、3番目の音 |
| pad.k | Button K, highest note | Nút K, nốt cao nhất | ボタン K、最も高い音 |
| feedback.perfect | Perfect | Hoàn hảo | パーフェクト |
| feedback.great | Great | Tốt | グレート |
| feedback.ok | OK | Tạm được | OK |
| feedback.miss | Miss | Trượt | ミス |
| feedback.extra | Extra tap | Gõ thừa | 余分なタップ |
| feedback.quote | Quote: {lick}! | Trích dẫn: {lick}! | 引用: {lick}! |
| feedback.quoteSub | {lick} sounds on the next downbeat | {lick} vang lên ở phách đầu ô kế tiếp | {lick} は次の小節の頭で鳴ります |
| lickBook.title | Lick book | Sổ lick | リックブック |
| lickBook.open | Open lick book | Mở sổ lick | リックブックを開く |
| lickBook.close | Close lick book | Đóng sổ lick | リックブックを閉じる |
| lickBook.note | Round squares mark off-beat positions. Positions 1 to 8 read left to right. | Ô vuông bo tròn đánh dấu vị trí lẻ. Vị trí 1 đến 8 đọc từ trái sang phải. | 角丸の四角は裏拍の位置です。位置1〜8は左から右へ読みます。 |
| lickBook.justQuoted | Just quoted | Vừa trích | 今引用した |
| lick.duck | Duck | Vịt | アヒル |
| lick.frog | Frog | Ếch | カエル |
| lick.windChime | Wind chime | Chuông gió | 風鈴 |
| result.winTitle | {name} is back in the band | {name} đã trở lại ban nhạc | {name} がバンドに戻ってきた |
| result.loseTitle | Not this take | Take này chưa được | このテイクはここまで |
| result.stars | {count} of 3 stars | {count} trên 3 sao | 3つ星中 {count} |
| result.rhythm | Rhythm | Nhịp | リズム |
| result.direction | Direction | Hướng | 方向 |
| result.feel | Feel | Cảm nhạc | フィーリング |
| result.quoteBonus | Quote bonus | Thưởng trích dẫn | 引用ボーナス |
| result.total | Total | Tổng | 合計 |
| result.quotesTitle | Licks quoted | Lick đã trích | 引用したリック |
| result.quotesNone | None this take. | Take này chưa trích lick nào. | このテイクでは引用なし。 |
| result.quoteCount | {lick} x{count} | {lick} x{count} | {lick} x{count} |
| result.next | On to match 2 | Sang trận 2 | 試合2へ |
| result.replay | Replay this take | Chơi lại take này | このテイクをやり直す |
| result.summary | See summary | Xem tổng kết | まとめを見る |
| assist.title | Want a little more room? | Muốn có thêm chút khoảng trống không? | もう少し余裕がほしいですか? |
| assist.body | Widen the timing windows by 15% for the rest of this run. The result screen will say so. | Nới cửa sổ nhịp thêm 15% cho phần còn lại của lần chơi này. Màn kết quả sẽ ghi chú điều đó. | この後のプレイで判定を15%広げます。結果画面にもその旨が表示されます。 |
| assist.accept | Widen windows | Nới cửa sổ nhịp | 判定を広げる |
| assist.decline | No thanks | Không, cảm ơn | いいえ |
| assist.note | Timing windows were widened by 15%. | Cửa sổ nhịp đã được nới 15%. | 判定が15%広がりました。 |
| summary.title | Session complete | Hoàn thành phiên | セッション完了 |
| summary.match | Match {n} · {name} | Trận {n} · {name} | 試合 {n} · {name} |
| summary.points | {points} points | {points} điểm | {points} 点 |
| summary.again | Play again from the start | Chơi lại từ đầu | 最初からもう一度 |

The duel round `hud.bar` is also used for the header row and the label "Bar n of 4" in the phone top bar (`hud.bar` with the " of 4" kept out of the string; show "Bar 2" in the compact bar). Admin strings are not in this table (admin has no next-intl).

## Decisions (G2, approved by the owner on 2026-11-08)

The designer's open questions were settled at G2:

1. **Lane colors.** No new color for now; shape is the first cue. If playtest shows lanes being confused, add an accent token (for example a teal) with the owner's approval.
2. **Match 2 loss and summary.** The summary appears only after a match 2 win. A match 2 loss shows a result with Replay only, as in match 1.
3. **Pause during the count-in bar.** Resume restarts the count-in.
4. **Portrait phones.** Starting a match in portrait is blocked with a rotate hint, and rotating mid-match pauses. The key `rotate.hint` is kept.
5. **Assist lifetime.** The widened windows last for the rest of the run, until Play again from start.
6. **Esc while paused.** Esc resumes, through the same 1-bar count-in as the Resume button.
7. **Late Set guide.** No faint guide; Late Set stays audio-only as in AC-DUEL-011.2.
