# Thiết kế: Lát cắt dọc Hồ Làng (phố, club, các trạng thái)

Feature: game-stage. Spec: `specs/game-stage/requirements.md`. Hợp đồng asset: `specs/game-stage/assets.md`. Gốc: `specs/game-duel/design.md` (token `jazz-*`, bố cục trận, trợ năng). Mục nào dưới đây không nhắc tới thì giữ nguyên như `game-duel`.

Tài liệu này không mô tả ngoại hình nhân vật. Nhân vật chỉ được gọi theo vai: "nhân vật người chơi" (code id `sayo`) và "Bóng". Ảnh mẫu G2 do Lead đưa chủ dự án xem riêng, nằm ngoài repo; không có mockup HTML trong repo cho task này (G2 duyệt theo tài liệu này cộng ảnh mẫu).

## Nguyên tắc

- Game vẫn chỉ có nền tối, nằm ngoài `(portfolio)`, không có header site hay trình phát nhạc. Mọi màn có thanh trên với nút **Về trang chủ** (`game.home.back`), cao tối thiểu 44 px.
- Chỉ dùng token: `jazz-black`, `jazz-dark`, `jazz-charcoal`, `jazz-slate`, `jazz-gold`, `jazz-amber`, `jazz-text`, `jazz-text-muted`; `font-heading` cho tiêu đề, `font-mono` cho số, `font-body` cho phần còn lại. Không thêm màu, cỡ chữ hay font mới. Nút chính `bg-jazz-gold text-jazz-black`, hover `jazz-amber`. Panel `bg-jazz-dark`, `border-jazz-slate`, `rounded-2xl`.
- Cảnh 3D là nền, mọi chữ và điều khiển là DOM đặt chồng lên. Không bao giờ để chữ nằm thẳng trên pixel 3D (độ tương phản không kiểm soát được): chữ luôn nằm trong panel đặc.
- Không dựa vào màu đơn lẻ: gợi ý cửa và nút có chữ lẫn biểu tượng; trạng thái nhấn có viền vàng.
- Mọi mục tương tác tối thiểu 44 x 44 px.
- Mọi chuỗi mới nằm dưới `game.stage.*` (bảng ở cuối). Chuỗi cũ của `game` (`home.back`, `start.play`, `rotate.hint`, `pause.*`, `lickBook.*`, `hud.*`, `error.*`) được tái dùng, không nhân đôi.

## Dùng lại

- Không có component chung của site phù hợp (game là module riêng, như `game-duel`). Tái dùng từ `apps/web/src/game/ui`: `TopBar`, `ScreenShell`, `LaneBoard`, `TouchPads`, `LickBook`, `PauseOverlay`, `CountIn`, màn Difficulty, Calibration, Result, Summary. Các màn này không đổi hành vi, chỉ được đặt chồng lên cảnh 3D (xem mục Club).
- Tái dùng vòng focus vàng toàn cục trong `globals.css`.
- Mới (gợi ý tách cho T-021 và T-022, không bắt buộc): `StageShell` (canvas nền + lớp DOM), `LoadingPanel`, `AssetNote`, `StreetControls` (vùng chạm + nút vào club), `DoorPrompt`, `LeaveClubButton`.
- Không dùng Framer Motion. Cảnh dùng Three.js nạp động chỉ trên `/game` (spec: First Load JS của trang portfolio không tăng).

## Luồng màn hình

1. `/game` mở, tải manifest và asset (màn Đang tải). Nếu thiếu asset hoặc không có WebGL2: trận khối xám của `game-duel` kèm một dòng ghi chú nhỏ.
2. Cổng bắt đầu (ở phố, xem Quyết định 1): nút **Chơi** mở khóa âm thanh bằng cú bấm (đồng hồ âm thanh cần cho tiếng vịt).
3. Phố: đi trái phải, vịt quạc theo nhịp, tới gần cửa thì hiện nút vào club.
4. Club: DuelGame chồng lên cảnh club. Màn thiết lập, đếm nhịp, trận, kết quả, tổng kết đều là panel đặc trên cảnh.
5. Rời club: quay ra phố, đứng trước cửa, đèn sáng nếu đã thắng ít nhất một trận.

## 1. Đang tải (REQ-STAGE-001, AC-STAGE-001.4)

- Panel giữa màn (`bg-jazz-dark`, `max-w-md`), trên nền `jazz-black` (chưa có cảnh). Tiêu đề `stage.loading.title`, thanh trên có Về trang chủ.
- Hai giai đoạn:
  - Đang đọc manifest (chưa biết tổng số byte): chỉ hiện chữ `stage.loading.checking`, không có thanh. Không bao giờ vẽ thanh giả hay thanh chạy vô hạn.
  - Đang tải file: thanh tiến độ thật, độ rộng = byte đã nhận / tổng `bytes` trong manifest. Bên dưới là chữ `stage.loading.bytes` với số MB (một chữ số thập phân, `font-mono`). Thanh `role="progressbar"`, `aria-valuemin=0`, `aria-valuemax=100`, `aria-valuenow` = phần trăm làm tròn, `aria-label` = `stage.loading.label`.
  - Nếu tổng byte trong manifest bằng 0 (file giữ chỗ), không vẽ thanh, chỉ hiện chữ `stage.loading.checking`.
- Không có nút hủy. Rời trang thì hủy các request đang chờ. Thanh không có hoạt họa chuyển, độ rộng chỉ đổi theo dữ liệu (đúng với giảm chuyển động).
- Trạng thái: đọc manifest; đang tải; hoàn tất (chuyển thẳng sang bước tiếp theo, không có màn "xong"); lỗi (chuyển sang khối xám, mục 2).

## 2. Thiếu asset, không có WebGL2: trận khối xám (AC-STAGE-001.2, 001.3, 002.1)

- Khi không có manifest, manifest sai (thiếu trường, sai `version`), một file lỗi, hoặc không tạo được context `webgl2`: chạy `DuelGame` y như `game-duel`, không có cảnh 3D, module 3D không nạp (trường hợp WebGL2).
- Ghi chú nhỏ (không chặn, không phải hộp thoại): một dòng chữ `font-mono` cỡ nhỏ, `text-jazz-text-muted`, trong thanh `bg-jazz-dark` mảnh ngay dưới thanh trên, `role="status"`. Hai biến thể:
  - Thiếu asset: `stage.note.missing`.
  - Không có WebGL2: `stage.note.noWebgl`.
- Ghi chú hiện trên Start, thiết lập và trận (nó sống cùng `DuelGame`), một dòng trên màn rộng; trên điện thoại được xuống tối đa hai dòng (không cắt bằng `truncate`, vì chữ là thông tin).
- Không có nút thử lại: tải lại trang là cách thử lại. Không có màn lỗi trắng.
- Trạng thái: một trong hai ghi chú, hoặc không có ghi chú (đủ asset).

## 3. Phố (REQ-STAGE-003, 004, 005.4)

Cảnh: nhìn ngang, camera đi ngang theo nhân vật, giới hạn bởi `cam_min`, `cam_max`; nhân vật đứng yên ở biên `walk_min`, `walk_max`. Canvas chiếm toàn màn, DOM chồng lên bằng `position: fixed`.

Bố cục desktop (16:9):

| Vùng | Nội dung |
|---|---|
| Trên | Thanh trên: Về trang chủ (trái). Không có chip BPM hay độ khó ngoài phố. |
| Giữa | Cảnh phố (không có DOM che; nhân vật nằm ở dải ngang giữa màn). |
| Dưới, giữa | Gợi ý điều khiển (`stage.street.controls`) trong chip `bg-jazz-dark/90`, `border-jazz-slate`, ẩn sau 6 giây đứng yên hoặc khi người chơi bắt đầu đi; hiện lại khi quay ra phố từ club. |
| Dưới, giữa, trên gợi ý | Nút vào club (xem dưới), chỉ hiện khi ở trong `DOOR_PROMPT_RADIUS`. |

### Điều khiển bàn phím (AC-STAGE-003.1, 003.3)
- Giữ `A` hoặc mũi tên trái: đi trái. Giữ `D` hoặc mũi tên phải: đi phải. Thả thì dừng. Giữ cả hai hướng cùng lúc thì đứng yên (hai lực triệt nhau), không nhảy hướng.
- `E` hoặc `Enter`: vào club khi đang ở gần cửa; ngoài vùng cửa thì phím này không làm gì. `event.repeat` bị bỏ qua (một lần nhấn, một lần vào).
- Phím được nghe ở `window`; bỏ qua khi đích là ô nhập hay khi có phím bổ trợ Ctrl, Alt, Meta. Mất focus cửa sổ (`blur`) hoặc tab ẩn thì coi như thả hết phím (tránh đi mãi).
- Nhấn `Enter` khi nút vào club đang được focus chỉ kích hoạt đúng một lần (không nhân đôi giữa phím toàn cục và nút).

### Điều khiển cảm ứng (AC-STAGE-003.1)
- Vùng điều khiển: dải đáy rộng toàn chiều ngang, cao 40% chiều cao màn, chia đúng nửa trái và nửa phải. Mỗi nửa là một vùng chạm lớn: chạm giữ nửa trái đi trái, nửa phải đi phải; thả hoặc `pointercancel` thì dừng. Dùng `setPointerCapture` để ngón kéo ra ngoài nửa vẫn giữ hướng cũ cho tới khi thả.
- Hai nửa có biểu tượng mũi tên lớn, mờ (`text-jazz-text-muted`, 50%) ở giữa mỗi nửa, nền trong suốt; khi đang giữ, nửa đó có viền trên `jazz-gold` và nền `jazz-dark/60`. Không có dấu hiệu chỉ bằng màu: biểu tượng mũi tên là hình.
- Hai ngón cùng lúc ở hai nửa: đứng yên (giống giữ cả hai phím).
- Vùng này `aria-hidden` (người dùng bàn phím và trình đọc màn hình có `A` `D` và mũi tên, mục Trợ năng bên dưới). Chỉ có thật trên thiết bị cảm ứng (`pointer: coarse`); trên máy tính có chuột, vùng này vẫn nhận chuột nhấn giữ nhưng không vẽ biểu tượng mũi tên.
- Trên điện thoại cầm dọc: dùng lại `game.rotate.hint` toàn màn kèm nút Về trang chủ (như `game-duel`); không đi được ở dọc.

### Gợi ý cửa club và nút vào club (AC-STAGE-003.3)
- Ngoài vùng cửa: không có gợi ý nào ngoài cảnh. Cửa club có biển đèn trong cảnh 3D làm điểm nhận biết, nhưng không có nội dung DOM.
- Trong `DOOR_PROMPT_RADIUS` (1,2 m): nút **Vào club** (`stage.street.enterClub`) xuất hiện phía trên vùng điều khiển, giữa màn, nút chính `bg-jazz-gold text-jazz-black`, cao 48 px, rộng tối thiểu 160 px. Kèm nhãn phím `E / Enter` (`font-mono`, trong nút, chỉ hiện khi không phải thiết bị cảm ứng). Có biểu tượng cánh cửa (hình, `aria-hidden`).
- Rời vùng thì nút biến mất ngay (không có chuyển động; với chuyển động thường, được phép mờ vào 150 ms, không trượt).
- Nút nằm ngoài hai nửa vùng chạm (nó là phần tử riêng, `pointer-events: auto`, đè lên vùng điều khiển), nên chạm nút không tính là đi.
- `role="status"` `aria-live="polite"` thông báo `stage.street.doorNear` một lần khi bước vào vùng cửa.

### Sau khi rời club (AC-STAGE-005.4)
- Nhân vật đứng ngay trước cửa, trong vùng cửa, nên nút **Vào club** đã hiện sẵn.
- Đã thắng ít nhất một trận (trong phiên này): đèn `lamp_*` sáng, kèm chip nhỏ `stage.street.lightsOn` (biểu tượng đèn và chữ, trong chip `bg-jazz-dark/90`, góc trên phải dưới thanh trên), `role="status"`. Chưa thắng: đèn tắt, không có chip.
- Không có thông báo âm thanh riêng; vịt tiếp tục quạc.

### Vịt (REQ-STAGE-004)
- Đàn vịt trên đường `duck_path_0` đến `duck_path_4`, quạc ở phách 2 và 4 ở 84 BPM; mỗi tiếng quạc là một cú nhún của cả đàn cùng lúc, cùng thời điểm với âm thanh (một giá trị nhún chung cho mọi con, từ hàm thuần của AC-STAGE-004.2). Không có DOM nào cho vịt; tắt tiếng thì chỉ còn cú nhún (xem Giảm chuyển động).

### Trạng thái của phố
Bình thường (đứng); đang đi; sát biên (đứng yên, không hiệu ứng thêm); ở gần cửa; tab ẩn (vẽ dừng, nhạc dừng theo bộ lập lịch); sau trận (đứng trước cửa, đèn tắt hoặc sáng); không có trạng thái rỗng hay lỗi riêng (dữ liệu đã tải xong ở bước 1).

## 4. Club (REQ-STAGE-005, 006)

Cảnh club là nền, `DuelGame` là lớp DOM chồng lên. Cảnh cố định, camera đứng ở `cam_duel`; nhân vật người chơi ở `player_mark`, Bóng ở `rival_mark`, tay trống ở `drummer_mark`.

### Vùng an toàn cho cảnh
Camera được dựng để cả hai nhân vật nằm trong "vùng thấy được" mà DOM không che, nên có thể dùng `camera.setViewOffset` hoặc đặt khung để nhân vật nằm lọt vùng này (T-022 chỉnh theo mắt ở G6):

| Màn | Vùng thấy được (so với màn) |
|---|---|
| Desktop 16:9 | Ngang: từ mép trái tới mép trái của sổ lick (rộng 190 px nhường cho sổ). Dọc: từ dưới HUD tới trên bảng lanes. Mục tiêu khoảng 12% đến 52% chiều cao, trái đến 82% chiều ngang. |
| Điện thoại cầm ngang | Dọc: từ dưới thanh trên 44 px tới trên dải lane 26 px x 4 cộng hàng tiêu đề, khoảng 12% đến 46% chiều cao. Ngang: toàn chiều ngang trừ ngăn kéo sổ lick khi mở. |

Các tay trống và đèn nền có thể bị che một phần, nhưng nhân vật người chơi, Bóng và bảng điểm không được chồng nhau.

### Độ tương phản khi có nền
- Panel của `game-duel` (bảng lanes, HUD, tab lượt, feedback, sổ lick, màn kết quả, thiết lập) đổi từ `bg-jazz-dark` sang `bg-jazz-dark/90` khi có cảnh 3D, kèm `border-jazz-slate`. Không dùng nền trong suốt hơn 90%, để chữ `jazz-text` và vạch phách đạt tương phản như trên nền đặc.
- Bảng lanes: nền `bg-jazz-black/85`, viền trên 1 px `jazz-slate`. Marker rỗng và đặc giữ nguyên hình, vì hình chồng trên nền gần đặc vẫn đọc được.
- Dòng feedback (Perfect, Great, OK, Miss) nằm trong chip đặc `bg-jazz-dark/90`, không thả chữ thẳng trên cảnh.
- Pad cảm ứng: nền đặc như cũ.
- Cảnh phía sau chỉ được làm tối lên cho cân tương phản bằng một lớp phủ `bg-jazz-black/40` toàn màn đặt giữa canvas và DOM khi có màn chắn (thiết lập, kết quả, tổng kết, tạm dừng); trong trận không dùng lớp phủ này để giữ cảnh rõ.

### Điện thoại cầm ngang
- Giữ nguyên bố cục `game-duel` frame D: lanes 26 px, nửa dưới là bốn vùng chạm D F J K, sổ lick thành ngăn kéo mở bằng nút nốt nhạc 44 px, Về trang chủ thành nút mũi tên có `aria-label`.
- Cảnh 3D chiếm phần giữa còn lại giữa thanh trên và dải lanes (khoảng 34% chiều cao). Nhân vật nhỏ nhưng không bị cắt; tay trống có thể bị che. Chấp nhận, vì thông tin chơi nằm ở lanes.
- Dọc: chặn bằng `rotate.hint`, trận không bắt đầu. Xoay dọc giữa trận thì tạm dừng (như `game-duel`).
- DPR tối đa 1,25 (điện thoại), 1,5 (máy tính) theo spec.

### Hai nhân vật theo pha (AC-STAGE-005.2, 007)
- Lượt đối thủ: Bóng ở tư thế chơi nhạc, nhân vật người chơi ở tư thế nghe. Lượt người chơi: ngược lại. Đếm nhịp và giữa các lượt: cả hai đứng nghe nhún theo phách. Cả hai nhún đúng phách trong club.
- Không có chữ nào treo trên đầu nhân vật. Ai đang chơi vẫn đọc từ HUD (`hud.opponentPlays`, `hud.yourTurn`).

### Bóng mờ dần khi thắng (AC-STAGE-005.3)
- Ở màn kết quả thắng: Bóng mờ dần trong 1,5 giây (`SHADOW_FADE_S`) rồi biến mất khỏi cảnh. Panel kết quả hiện ngay, không chờ hết mờ.
- Thông báo cho trình đọc màn hình: `stage.club.shadowFading` (`aria-live="polite"`, ẩn khỏi mắt, `sr-only`).
- Thua: Bóng không mờ, đứng nguyên.
- Phát lại trận (Replay) và Sang trận 2: Bóng trở lại đầy đủ độ đậm.

### Rời club (AC-STAGE-005.4)
- Ở màn kết quả và màn tổng kết (và chỉ ở hai màn đó), thêm nút phụ **Rời club** (`stage.club.leave`), đặt cạnh các nút hiện có, kiểu nút phụ (`border-jazz-slate`, `text-jazz-text`), không phải nút chính. Bấm thì quay ra phố (mục 3, sau khi rời club). Về trang chủ vẫn có ở thanh trên.
- Trong trận và đếm nhịp, không có Rời club (đã có Về trang chủ và tạm dừng).
- Chỉ có khi `DuelGame` có nền 3D; ở trận khối xám thì không có nút này, vì không có phố để ra.

### Trạng thái của club
Thiết lập (Difficulty, Calibration, panel đặc trên cảnh); đếm nhịp; lượt đối thủ; lượt người chơi; giữa các lượt; tạm dừng (tab ẩn cũng vào đây, vẽ dừng); kết quả thắng (Bóng mờ); kết quả thua; tổng kết; không có trạng thái rỗng hay lỗi riêng.

## 5. Giảm chuyển động (`prefers-reduced-motion: reduce`)

Theo `game-duel`: không rung, không nháy, không nhấp nháy, không chuyển động trang trí.

| Thành phần | Chuyển động thường | Giảm chuyển động |
|---|---|---|
| Rung camera (nếu có, ví dụ ở cú quạc hoặc phách mạnh) | Rung rất nhẹ được phép | Tắt hẳn |
| Camera đi theo ở phố | Bám có làm mượt | Bám cứng (không trễ, không giật), vẫn trong `cam_min`..`cam_max` |
| Vịt nhún theo tiếng quạc | Nhún đúng thời điểm quạc | Đứng yên; tiếng quạc vẫn có. Hàm thuần của AC-STAGE-004.2 vẫn được tính nhưng biên độ gửi cho cảnh bằng 0 |
| Nhún theo phách của hai nhân vật ở club | Có | Tắt (đứng nghe hoặc tư thế chơi giữ nguyên, không nhún) |
| Thở, chớp mắt khi đứng | Có | Tắt thở; chớp mắt giữ (rất nhỏ, không phải chuyển động toàn thân) |
| Chu kỳ bước khi đi | Có (đó là phản hồi trực tiếp cho thao tác của người chơi) | Có, nhịp bước vẫn theo `v / WALK_STRIDE` |
| Bóng mờ dần 1,5 giây | Mờ | Vẫn mờ trong cùng thời lượng (chỉ đổi độ trong suốt, không chuyển động, không nháy); xem Quyết định 2 |
| Vẽ chuyển DOM (nút vào club, chip) | Mờ vào 150 ms | Xuất hiện ngay, `transition: none` |

Cờ này đọc từ `matchMedia` một lần khi vào và nghe `change`. CSS `@media (prefers-reduced-motion: reduce)` chặn mọi `transition` của lớp DOM trong game.

## Trợ năng

- Thứ tự Tab ngoài phố: Về trang chủ, rồi nút Vào club (chỉ khi có trong DOM). Trong club: như `game-duel`, cộng nút Rời club ở màn kết quả và tổng kết.
- Canvas: `role="img"` với `aria-label` `stage.scene.street` hoặc `stage.scene.club`, không focus được. Nội dung nghe nhìn quan trọng đều có DOM song song (nút, chip trạng thái).
- Phố hoạt động đầy đủ bằng bàn phím; nút Vào club có thể bấm bằng Space hoặc Enter khi đang focus; phím `E` hoạt động toàn cục.
- Thông báo `aria-live="polite"`: cửa gần, đèn sáng, Bóng mờ dần, ghi chú thiếu asset. Không thông báo bước chân hay tiếng vịt.
- Đang tải: `role="progressbar"` có `aria-label`; `aria-busy="true"` trên panel.
- Tương phản: chữ chỉ dùng `jazz-text`, `jazz-text-muted`, `jazz-gold` trên `jazz-black` hoặc `jazz-dark` đặc (tối thiểu 90% độ đặc). `jazz-text-dim` chỉ cho gợi ý trang trí, không bao giờ cho thứ người chơi phải đọc.
- Không dựa vào âm thanh: tắt tiếng vẫn chơi được; vịt chỉ là trang trí, cửa và nút có chữ.

## Bảng chữ (namespace `game`, các khóa dưới `stage.*`, T-023 đưa vào en, vi, ja)

`{x}` là biến. Tên khóa viết tương đối với namespace `game`. Tái dùng không thêm: `home.back`, `start.play`, `rotate.hint`, `pause.*`, `lickBook.*`, `hud.*`, `error.*`.

| Khóa | en | vi | ja |
|---|---|---|---|
| stage.loading.title | Loading the street and the club | Đang tải phố và club | 通りとクラブを読み込み中 |
| stage.loading.checking | Checking the stage files... | Đang kiểm tra tệp sân khấu... | ステージのファイルを確認中... |
| stage.loading.bytes | {loaded} MB of {total} MB | {loaded} MB trên {total} MB | {total} MB 中 {loaded} MB |
| stage.loading.label | Loading progress | Tiến độ tải | 読み込みの進行状況 |
| stage.note.missing | The stage art is not available here, so this is the plain grey-box match. | Chưa có hình ảnh sân khấu ở đây, nên đây là trận khối xám đơn giản. | ここではステージの画像が見つからないため、シンプルなグレーボックス版で遊びます。 |
| stage.note.noWebgl | This browser cannot draw the 3D stage, so this is the plain grey-box match. | Trình duyệt này không vẽ được sân khấu 3D, nên đây là trận khối xám đơn giản. | このブラウザでは3Dステージを描画できないため、シンプルなグレーボックス版で遊びます。 |
| stage.scene.street | The street scene | Cảnh phố | 通りのシーン |
| stage.scene.club | The club scene | Cảnh club | クラブのシーン |
| stage.start.intro | Walk down the street to the club door, then trade fours with a shadow on stage. | Đi dọc phố tới cửa club, rồi đấu trading fours với một bóng trên sân khấu. | 通りを歩いてクラブの扉へ向かい、ステージ上の影とフォーズを交換しましょう。 |
| stage.street.controls | Walk: A and D or the arrow keys. Touch the left or right half of the screen. | Đi: phím A và D hoặc mũi tên. Trên điện thoại, chạm nửa trái hoặc nửa phải màn hình. | 移動: A / D キーか矢印キー。スマートフォンでは画面の左半分か右半分をタッチ。 |
| stage.street.enterClub | Enter the club | Vào club | クラブに入る |
| stage.street.enterClubKeys | E or Enter | E hoặc Enter | E または Enter |
| stage.street.doorNear | You are at the club door. | Bạn đang ở cửa club. | クラブの扉の前にいます。 |
| stage.street.lightsOn | The street lights are on | Đèn phố đã sáng | 街灯がともりました |
| stage.club.leave | Leave the club | Rời club | クラブを出る |
| stage.club.shadowFading | The shadow fades away. | Bóng mờ dần rồi biến mất. | 影が薄れて消えていきます。 |

Ghi chú:
- "Bóng" ở tiếng Việt, "shadow" ở tiếng Anh, "影" ở tiếng Nhật, nhất quán với `start.intro` của `game-duel`.
- `stage.loading.bytes`: `{loaded}` và `{total}` đã làm tròn một chữ số thập phân, truyền vào dạng chuỗi đã định dạng theo locale.
- `stage.street.enterClubKeys` chỉ là nhãn phím phụ trong nút (không đọc thêm lần nữa bởi trình đọc màn hình: bọc `aria-hidden`; tên nút đã rõ).

## Quyết định (G2, chủ dự án duyệt ngày 2026-11-21)

Các câu hỏi mở của bản nháp, Lead chốt theo đề xuất của designer; chủ dự án duyệt cùng tài liệu và bốn ảnh mẫu (phố đèn tắt, phố đèn sáng, club máy tính, club điện thoại cầm ngang) ở G2, kèm hai chỉnh sửa khung hình ở mục 7 và 8.

1. **Cổng bắt đầu và mở khóa âm thanh.** Sau khi tải xong, một panel nhỏ ở phố với nút **Chơi** (`start.play` kèm `stage.start.intro`) mở khóa âm thanh; T-021 làm cổng này. Khi vào club, `DuelGame` dùng lại cùng ngữ cảnh âm thanh và bỏ màn Start của nó, bắt đầu từ màn Difficulty; T-022 thêm prop cho việc này, không truyền thì `DuelGame` giữ màn Start như `game-duel`. Không bao giờ có hai cổng "Chơi" liên tiếp.
2. **Bóng mờ dần khi giảm chuyển động.** Giữ mờ 1,5 giây (chỉ là độ trong suốt, không có chuyển động).
3. **Mất context WebGL giữa chừng** (`webglcontextlost`, ngoài AC). Giữ nguyên trận (DOM vẫn chạy được), ẩn nền 3D, hiện ghi chú `stage.note.noWebgl` thay vì màn lỗi. Không thêm khóa.
4. **Ngưỡng ẩn gợi ý điều khiển** (6 giây) và độ cao vùng chạm (40% màn) là giá trị khởi đầu, chỉnh theo mắt ở G6 mà không đổi AC.
5. **Tên đối thủ ở HUD** (`hud.opponentPlays {name}`): giữ nguyên như `game-duel`, tên lấy từ đội hình đối thủ theo REQ-DUEL-012. Lát cắt không đổi chữ hay tên ở HUD.
6. **Không thiếu token nào** cho các màn trên. Độ trong suốt dùng hậu tố `/90`, `/85`, `/60`, `/40` trên token có sẵn, không thêm màu mới.
7. **Khung club trên điện thoại.** Ở ảnh mẫu, làn nhịp che nửa dưới hai nhân vật. T-022 đặt lại camera cho điện thoại cầm ngang để cả hai nhân vật nằm trọn trong vùng thấy được (mục 4), chấp nhận nhân vật nhỏ hơn.
8. **Khung phố.** Ảnh mẫu chụp cả đoạn phố nên nhân vật nhỏ. Camera trong game đặt gần hơn để nhân vật đủ lớn, và cửa club vẫn vào khung khi nhân vật đứng trong vùng cửa. T-021 làm; mức gần chỉnh theo mắt ở G6.
