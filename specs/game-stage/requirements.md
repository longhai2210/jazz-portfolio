---
id: STAGE
title: Lát cắt dọc Hồ Làng: một đoạn phố và một club 3D quanh trận đấu
status: verified
version: 0.1
owner: longhai2210
---

# Lát cắt dọc Hồ Làng: một đoạn phố và một club 3D quanh trận đấu

## Goal
Chủ dự án thấy được hình hài thật của Midnight Session: nhân vật 3D đi trên một đoạn phố Hồ Làng nhìn ngang, đàn vịt quạc theo nhịp, bước vào một club và đấu trading fours với Bóng trên sân khấu. Phần luật chơi dùng lại nguyên trận đấu của `game-duel`.

Thiết kế gốc: `docs/game/midnight-session.md` (mục 4.1, 5, 6, 12, 13). Spec này là một lát cắt dọc chen trước Giai đoạn 3, sau khi chủ dự án thấy bản khối xám của `game-duel` chưa có nhân vật hay cảnh.

## Scope
- In:
  - Phụ thuộc mới `@pixiv/three-vrm` 3.5.5 (đã chạy được với `three` 0.185.1 ở trang thử).
  - Trình tải asset theo manifest, với asset chỉ có trên máy (xem mục "Asset chỉ có trên máy"). Thiếu asset thì quay về trận khối xám của `game-duel`.
  - Kiểm tra WebGL2 (chuyển từ `game-explore`). Không có WebGL2 thì quay về trận khối xám.
  - Cảnh phố: đi trái phải, camera đi ngang, đàn vịt quạc đúng phách 2 và 4 qua bộ lập lịch âm thanh có sẵn, cửa club.
  - Cảnh club: sân khấu, đèn, bộ trống 3D với tay trống là hình 2D ngược sáng, nhân vật người chơi và Bóng đứng đối diện. Trận đấu `game-duel` hiện chồng lên cảnh.
  - Bóng trong lát cắt này dùng lại model của người chơi với bảng màu Bóng (mẫu của club 3 trong thiết kế). Thắng thì Bóng mờ dần.
  - Hoạt ảnh viết bằng code: đứng thở, đi, chơi nhạc, nhún theo phách.
  - Sau khi rời club, đoạn phố sáng đèn nếu đã thắng ít nhất một trận.
  - Dọn WebGL khi rời trang và dừng vẽ khi tab ẩn (chuyển từ `game-explore`).
  - Chữ giao diện mới qua next-intl, đủ en, vi, ja.
- Out (non-goals):
  - Nhặt lick ngoài phố, người đi theo, nhảy, va chạm ngoài biên đoạn phố.
  - Mocap (cần tải gói, để sau), model riêng cho Ren và Aki, nhạc thật, màn jam, kỷ vật.
  - `game-shell` (poster, chọn nhân vật, save, cài đặt).
  - Mức chất lượng tự động; lát cắt này đặt DPR tối đa cố định theo mục 13.
  - Đưa asset nhân vật lên repo hay lên site công khai.
- Packages touched:
  - `apps/web`: `package.json` và `pnpm-lock.yaml` (thêm `@pixiv/three-vrm`), `src/game/stage/**` (mới: trình tải, cảnh phố, cảnh club, nhân vật, hoạt ảnh, vịt), `src/game/ui/DuelGame.tsx` (nhận cảnh 3D làm nền), route `app/[locale]/game`, `i18n/messages/{en,vi,ja}.json`.
  - Gốc repo: `.gitignore` (thêm thư mục asset chỉ có trên máy).
  - Phần art (ngoài code, theo dõi riêng trong plan): dựng bằng script Blender chạy nền trong `.art-source`, xuất theo `specs/game-stage/assets.md`.

## Asset chỉ có trên máy
- Asset nằm ở `apps/web/public/game-assets/`, thư mục này được git bỏ qua. Manifest ở `/game-assets/manifest.json`.
- CI, bản checkout sạch và site đã deploy không có thư mục này, nên game phải chạy được ở chế độ khối xám khi thiếu asset.
- Spec, issue và commit không mô tả ngoại hình nhân vật. Nhân vật chỉ được gọi theo vai: "nhân vật người chơi", "Bóng".

## Giá trị khởi đầu

| Hằng số | Giá trị | Ghi chú |
|---|---|---|
| `STREET_WALK_SPEED` | 2,4 m/s | |
| `STREET_BPM` | 84 | Nhịp ngoài phố, khớp Hồ Làng |
| `DUCK_QUACK_BEATS` | 2 và 4 | Phách trong mỗi ô 4 phách |
| `DOOR_PROMPT_RADIUS` | 1,2 m | Tính từ tâm node `club_door` |
| `WALK_STRIDE` | 0,6 m mỗi bước | Nhịp bước = tốc độ / sải bước, để chân không trượt |
| `SHADOW_FADE_S` | 1,5 giây | Bóng mờ dần sau khi thắng |
| `MAX_DPR` | 1,5 máy tính, 1,25 điện thoại | Theo mục 13 |

## Requirements

### REQ-STAGE-001 Tải asset theo manifest và quay về khối xám khi thiếu
Source: thiết kế mục 11, 12.3; chủ dự án giữ asset nhân vật trên máy

- AC-STAGE-001.1 Given manifest hợp lệ và mọi file trong đó đều tải được, when vào game, then màn chơi dùng cảnh 3D.
- AC-STAGE-001.2 Given không có manifest hoặc một file trong đó trả lỗi, when vào game, then game chạy trận khối xám của `game-duel`, không lỗi trắng màn hình, và hiện một dòng ghi chú nhỏ rằng chưa có asset.
- AC-STAGE-001.3 Given manifest thiếu trường bắt buộc hoặc sai `version`, when đọc, then coi như thiếu asset theo AC-STAGE-001.2.
- AC-STAGE-001.4 Given đang tải asset, when chờ, then hiện trạng thái đang tải theo số byte thật, không có thanh tiến độ giả.

### REQ-STAGE-002 Kiểm tra WebGL2
Source: thiết kế mục 11 (chuyển từ `game-explore`)

- AC-STAGE-002.1 Given không tạo được context `webgl2`, when vào game, then game chạy trận khối xám và module 3D không được nạp.

### REQ-STAGE-003 Đi trên đoạn phố
Source: thiết kế mục 3.2, 5, 14

- AC-STAGE-003.1 Given đang ở phố, when giữ `A`/`D` hoặc phím mũi tên trái/phải, hoặc chạm giữ nửa trái/nửa phải của vùng điều khiển trên điện thoại, then nhân vật đi theo hướng đó với tốc độ `STREET_WALK_SPEED` và dừng khi thả.
- AC-STAGE-003.2 Given nhân vật chạm biên trái hoặc phải của đoạn phố (node `walk_min`, `walk_max`), when tiếp tục đi, then nhân vật đứng yên ở biên.
- AC-STAGE-003.3 Given nhân vật đứng trong `DOOR_PROMPT_RADIUS` của cửa club, when ở đó, then hiện gợi ý vào club; nhấn `E`, `Enter` hoặc chạm nút gợi ý thì vào club.
- AC-STAGE-003.4 Given nhân vật di chuyển, when camera đi theo, then camera bám theo trục ngang và không vượt `cam_min`, `cam_max`.

### REQ-STAGE-004 Đàn vịt theo nhịp
Source: thiết kế mục 5 (Hồ Làng và đàn vịt)

- AC-STAGE-004.1 Given đang ở phố, when nhạc nền chạy ở `STREET_BPM`, then tiếng vịt quạc được lập lịch đúng phách 2 và 4 của mỗi ô theo đồng hồ âm thanh.
- AC-STAGE-004.2 Given một tiếng quạc được lập lịch, when tới thời điểm đó, then vịt nhún đúng thời điểm ấy (hàm thuần tính độ nhún theo thời gian âm thanh).

### REQ-STAGE-005 Club và trận đấu
Source: thiết kế mục 4.1, 6

- AC-STAGE-005.1 Given vào club, when bắt đầu, then `DuelGame` chạy với nhân vật người chơi là `sayo`, nên đội hình đối thủ theo đúng REQ-DUEL-012.
- AC-STAGE-005.2 Given đang trong trận, when là lượt của đối thủ, then Bóng ở trạng thái chơi nhạc và nhân vật người chơi ở trạng thái nghe; lượt của người chơi thì ngược lại (hàm thuần từ pha của phiên đấu ra trạng thái của hai nhân vật).
- AC-STAGE-005.3 Given thắng một trận, when hiện kết quả, then Bóng mờ dần trong `SHADOW_FADE_S` rồi biến mất.
- AC-STAGE-005.4 Given rời club sau màn kết quả hoặc tổng kết, when quay ra phố, then nhân vật đứng trước cửa club, và đoạn phố sáng đèn nếu đã thắng ít nhất một trận.

### REQ-STAGE-006 Bảng màu Bóng
Source: thiết kế mục 4.1, 12.3 (bảng màu)

- AC-STAGE-006.1 Given model người chơi đã tải, when tạo Bóng, then Bóng là bản clone của cùng model, dùng texture bảng màu Bóng trong manifest, không tải model lần hai.

### REQ-STAGE-007 Hoạt ảnh viết bằng code
Source: thiết kế mục 12.3, 14 (chuyển động tự nhiên)

- AC-STAGE-007.1 Given nhân vật đang đi với tốc độ v, when tính nhịp bước, then số bước mỗi giây bằng v / `WALK_STRIDE`, để chân không trượt.
- AC-STAGE-007.2 Given nhân vật đứng yên, when thời gian trôi, then hoạt ảnh thở và chớp mắt chạy; trong club, cả hai nhân vật nhún đúng phách.
- AC-STAGE-007.3 Given trạng thái chơi nhạc, when tính tư thế, then dùng tư thế chơi nhạc của nhân vật (hát với `sayo`), khác tư thế đứng nghe.

### REQ-STAGE-008 Dọn dẹp và tab ẩn
Source: thiết kế mục 11 (chuyển từ `game-explore`)

- AC-STAGE-008.1 Given rời `/game`, when màn game unmount, then vòng vẽ dừng, geometry, texture và VRM được `dispose`, và WebGL context được trả bằng `WEBGL_lose_context`.
- AC-STAGE-008.2 Given tab bị ẩn, when ở phố hoặc trong club, then vòng vẽ dừng; trận đấu tạm dừng như AC-DUEL-014.1.

### REQ-STAGE-009 Ngôn ngữ
Source: CLAUDE.md (chữ công khai qua next-intl)

- AC-STAGE-009.1 Given các khóa mới của lát cắt trong namespace `game`, when kiểm tra, then en, vi và ja đều có chuỗi không rỗng cho mọi khóa, và test bảng chữ của `game-duel` chấp nhận các khóa thuộc spec này.

## Đo, không phải AC
- Hình ảnh khớp các ảnh mẫu đã duyệt ở G2 (một khung club có lanes chồng lên, một khung phố có hồ, vịt và cửa club, cả khung điện thoại cầm ngang).
- FPS trên máy tính và điện thoại thật đạt mục 13.
- First Load JS của các trang portfolio không tăng: module 3D chỉ nạp động trên `/game`.
- Asset đạt ngân sách trong `specs/game-stage/assets.md`.

## Open questions
- none

## Change log
- 0.1 draft
- 0.1 approved by owner (G0), 2026-11-21, theo các lựa chọn Lead đề xuất: asset chỉ có trên máy, Bóng dùng lại model người chơi, chấp nhận khe hở ở khớp, hoạt ảnh bằng code, nhánh tách từ feature/game-duel.
- 0.1 implemented, 2026-11-22: T-017 đến T-023 gộp vào feature/game-stage, verify xanh, mọi AC có test (trace.md).
- 0.1 verified by owner (G6), 2026-11-22: chủ dự án chơi thử /vi/game với asset trên máy và duyệt lát cắt.
