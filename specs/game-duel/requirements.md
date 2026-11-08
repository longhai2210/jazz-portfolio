---
id: DUEL
title: Trận đấu Trading Fours (khối xám)
status: approved
version: 0.4
owner: longhai2210
---

# Trận đấu Trading Fours (khối xám)

## Goal
Người chơi đấu hai trận trading fours bằng khối xám ở `/[locale]/game`, để kiểm chứng phần vui nhất của Midnight Session trước khi có art: nghe câu của mình quay lại, và thấy trích lick là đáng làm. Chủ dự án bật trang bằng `isGameEnabled` trong CMS để mời người chơi thử.

Thiết kế gốc: `docs/game/midnight-session.md` (mục 3.1, 4.1, 6, 7, 11, 15, 17). Spec này làm trước `game-shell` vì độ vui là rủi ro lớn hơn; nó có route `/game` tối thiểu, và `game-shell` bọc lại sau.

## Scope
- In:
  - Lõi TypeScript thuần trong `apps/web/src/game/core`, không phụ thuộc three hay React: đồng hồ nhịp, hiệu chỉnh độ trễ, chấm nhịp, hướng giai điệu, lick và trích dẫn, câu gọi, chọn ô hay nhất, cảm nhạc, điểm và sao, độ khó và hỗ trợ, đội hình Bóng.
  - Âm thanh trong `apps/web/src/game/audio`: lập lịch theo `AudioContext.currentTime`, âm tổng hợp tạm cho trống, giọng của Bóng, 4 nốt của người chơi và tiếng của lick.
  - Màn chơi khối xám trong `apps/web/src/game/ui`, hình 2D đơn giản: hiệu chỉnh, chọn độ khó, hai trận liền nhau, sổ lick, màn kết quả, tạm dừng, nút về portfolio.
  - Route tối thiểu `apps/web/src/app/[locale]/game/` gồm `page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`, nằm ngoài `(portfolio)` nên không có máy nghe nhạc của site. Màn chơi nạp bằng `dynamic(..., { ssr: false })`.
  - Công tắc `isGameEnabled` từ database đến CMS, hợp đồng ở `specs/game-duel/api.md`.
  - Chữ giao diện qua next-intl, namespace `game`, đủ en, vi, ja.
- Out (non-goals):
  - Poster, tải trước, kiểm tra WebGL2, màn khởi động với tay trống, chọn nhân vật, save, cài đặt, tab Game trong Header: thuộc `game-shell`.
  - 3D, art, đi phố, sổ lick đầy đủ, người đi theo, màn jam, kỷ vật, mở khóa Late Set: các spec sau.
  - Luật chấm điểm riêng và kỹ năng đấu của từng nhân vật (thiết kế mục 4): làm sau khi trận cơ bản đã được chứng minh là vui.
  - Bộ sample nhạc cụ thật (trống, contrabass, sax) và bộ âm tiết scat: khối xám dùng âm tổng hợp. Chọn và kiểm license sau khi 5 người chơi thử xong; việc tải bộ sample cần chủ dự án đồng ý.
  - Trang `/game` không bao giờ được index và không vào sitemap; đây là ứng dụng, không phải nội dung cần tìm kiếm.
- Packages touched:
  - `packages/database`: cột `isGameEnabled` trong `SiteSettings`, migration, `prisma/seed.ts`.
  - `packages/shared`: `isGameEnabled` trong `FeatureSettingsDto` và `PublicSettingsDto` (`src/types/index.ts`).
  - `apps/api`: `settings/dto/update-feature-settings.dto.ts`, `settings/settings.service.ts`.
  - `apps/web`: `src/game/{core,audio,ui}`, route `app/[locale]/game`, `lib/portfolio-data.ts` (giá trị dự phòng), `components/admin/settings/ContentSettingsForm.tsx`, `i18n/messages/{en,vi,ja}.json`.
  - File dùng chung, gom vào một task nối làm cuối: `packages/database/prisma/schema.prisma`, ba file messages. PR của tính năng cập nhật bản đồ kiến trúc trong `CLAUDE.md` (route `/game`, module `src/game`).

## Giá trị khởi đầu
Mọi số dưới đây là hằng số có tên trong một file cấu hình của `game/core`, chỉnh qua playtest mà không sửa logic. AC kiểm tra theo các giá trị này.

| Hằng số | Giá trị | Ghi chú |
|---|---|---|
| `GRID_STEPS` | 8 vị trí mỗi ô | Ô là 4 phách; vị trí lẻ nằm giữa hai phách |
| `DUEL_BPM` | 84 cho trận 1, 96 cho trận 2 | Tương ứng club 1 và 2 của Hồ Làng |
| `WINDOWS_MS` | Perfect 45, Great 90, OK 140 | Ở mức Session |
| `DIFFICULTY_MULT` | Lounge 1,4; Session 1,0; Late Set 0,8 | Nhân vào mọi cửa sổ |
| `SWING_RATIO` | 2/3 | Chỉ ở Late Set: vị trí lẻ rơi vào 2/3 phách |
| `ASSIST_MULT` | 1,15 | Sau 2 lần thua liên tiếp, nếu người chơi đồng ý |
| `HIT_POINTS` | Perfect 1; Great 0,7; OK 0,4; Miss 0 | |
| `EXTRA_TAP_PENALTY` | 0,25 điểm nốt mỗi lần gõ thừa | Chỉ ở Echo và Answer |
| `SCORE_WEIGHTS` | Nhịp 60, Hướng 25, Cảm nhạc 15 | |
| `QUOTE_BONUS` | 5 mỗi lick khác nhau, tối đa 2 lick | Cộng ngoài thang 100 |
| `STAR_THRESHOLDS` | 1 sao 40, 2 sao 65, 3 sao 85 | Từ 1 sao là thắng |
| `CALL_DENSITY` | Lounge 3–4 nốt mỗi ô, chỉ vị trí chẵn; Session 5–7 nốt mỗi ô; Late Set 5–7 nốt mỗi ô, có swing | Câu gọi soạn sẵn |
| `CALIBRATION_CLICKS` | 8, bỏ 2 lần gõ đầu | 2 lần gõ đầu tiên theo thời gian |
| `CALIBRATION_BPM` | 90 | Dưới 100 BPM để mỗi lần gõ được ghép với đúng click của nó, kể cả lần lệch +300 ms |
| `CALIBRATION_MAX_MS` | 250 | Lần gõ lệch hơn thì bỏ |
| `CALIBRATION_MIN_VALID` | 4 | |
| `BEST_BAR_MIN_HITS` | 3 lần gõ đạt OK trở lên | |
| `FEEL_SINGLE_BUTTON_MAX` | 60% | |

Nút: `D` = 0 (thấp nhất), `F` = 1, `J` = 2, `K` = 3 (cao nhất), phát 4 nốt tăng dần của thang blues. Hướng của một cặp nốt là dấu của hiệu chỉ số nút.

Lick cài sẵn trong khối xám, coi như đã học theo thứ tự này:

| Lick | Vị trí | Hình |
|---|---|---|
| Vịt | 2, 3, 6 | `. . x x . . x .` |
| Ếch | 0, 3, 5 | `x . . x . x . .` |
| Chuông gió | 1, 4, 6, 7 | `. x . . x . x x` |

## Requirements

### REQ-DUEL-001 Đồng hồ nhịp lấy theo đồng hồ âm thanh
Source: thiết kế mục 11, 12.1

- AC-DUEL-001.1 Given BPM 96 và trận bắt đầu ở `t0` trên `AudioContext.currentTime`, when quy đổi thời điểm `t0 + 2,5 s`, then kết quả là phách 4,0, tức đầu ô thứ hai.
- AC-DUEL-001.2 Given BPM 84 ở mức Session, when tính thời điểm của ô `b`, vị trí `s`, then kết quả là `t0 + (8b + s) × 60 / 84 / 2` giây.
- AC-DUEL-001.3 Given mức Late Set, when tính thời điểm của một vị trí lẻ, then nó nằm ở 2/3 độ dài phách tính từ phách trước, thay vì 1/2.
- AC-DUEL-001.4 Given một lần gõ ở thời điểm âm thanh `t` và offset hiệu chỉnh `o`, when chấm, then thời điểm dùng để chấm là `t − o`.

### REQ-DUEL-002 Hiệu chỉnh độ trễ
Source: thiết kế mục 11

- AC-DUEL-002.1 Given 8 tiếng click, when 6 lần gõ tính được (bỏ 2 lần đầu) lệch +40, +55, +60, +48, +52 và +300 ms, then offset là trung vị của các lần lệch không quá 250 ms, tức 52 ms.
- AC-DUEL-002.2 Given ít hơn 4 lần gõ hợp lệ, when kết thúc hiệu chỉnh, then offset bằng 0 và màn hình mời làm lại.
- AC-DUEL-002.3 Given đã hiệu chỉnh, when chơi hai trận, then cả hai trận dùng cùng offset đó.

### REQ-DUEL-003 Chấm nhịp từng nốt
Source: thiết kế mục 6.3, 7

- AC-DUEL-003.1 Given mức Session, when lần gõ lệch nốt mục tiêu 40 ms, then nốt được chấm Perfect.
- AC-DUEL-003.2 Given mức Session, when lần gõ lệch 100 ms, then nốt được chấm OK.
- AC-DUEL-003.3 Given mức Lounge, when lần gõ lệch 120 ms, then nốt được chấm Great, vì cửa sổ Great là 126 ms.
- AC-DUEL-003.4 Given độ lệch vượt cửa sổ OK của mức khó, when chấm, then nốt là Miss và trận vẫn chạy tiếp.
- AC-DUEL-003.5 Given hai lần gõ cùng nằm trong cửa sổ của một nốt, when ghép, then lần gõ gần hơn được ghép với nốt và lần kia là gõ thừa; mỗi lần gõ ghép với tối đa một nốt.
- AC-DUEL-003.6 Given người chơi đã nhận hỗ trợ, when chấm, then mọi cửa sổ được nhân thêm 1,15.
- AC-DUEL-003.7 Given lần gõ rơi vào 4 ô của đối thủ, when chấm, then nó không ảnh hưởng điểm.

### REQ-DUEL-004 Cấu trúc trận và câu gọi soạn sẵn
Source: thiết kế mục 6, 7

- AC-DUEL-004.1 Given một trận, when bắt đầu, then thứ tự là 1 ô đếm nhịp, rồi 3 lượt Echo, Answer, Solo; mỗi lượt gồm 4 ô của đối thủ và 4 ô của người chơi, tổng 25 ô.
- AC-DUEL-004.2 Given lượt Echo và Answer, when đối thủ chơi, then câu gọi là câu soạn sẵn của Bóng đó ở mức khó đang chọn.
- AC-DUEL-004.3 Given dữ liệu câu soạn sẵn của mọi Bóng và mọi mức, when kiểm tra, then mỗi ô có số nốt nằm trong khoảng `CALL_DENSITY` của mức đó, và câu ở mức Lounge chỉ dùng vị trí chẵn.

### REQ-DUEL-005 Hướng giai điệu
Source: thiết kế mục 6

- AC-DUEL-005.1 Given lượt Echo, when cả hai nốt mục tiêu của một cặp liền nhau đã được ghép và hướng của người chơi trùng hướng của đối thủ, then cặp đó đúng.
- AC-DUEL-005.2 Given lượt Answer, when cả hai nốt của cặp đã được ghép và hướng của người chơi ngược hướng của đối thủ, then cặp đó đúng; cùng hướng hoặc lặp nút là sai.
- AC-DUEL-005.3 Given cặp nốt của đối thủ lặp cùng một nút, when chấm, then cặp đó không được tính.
- AC-DUEL-005.4 Given một lượt Echo hoặc Answer, when tính điểm Hướng, then điểm là số cặp đúng chia số cặp được tính; không có cặp nào được tính thì điểm Hướng bằng 1.

### REQ-DUEL-006 Lick và trích dẫn
Source: thiết kế mục 3.1, 6.2

- AC-DUEL-006.1 Given dữ liệu lick của khối xám, when kiểm tra, then mỗi lick có 3 đến 6 vị trí trên lưới 8, có ít nhất một vị trí lẻ, và không có hai lick trùng vị trí.
- AC-DUEL-006.2 Given lick Vịt (2, 3, 6) ở mức Session, when trong một ô của lượt Solo người chơi gõ ở 2, 3 và 6 trong cửa sổ Great và gõ thêm một lần ở 0, then ô đó là trích dẫn Vịt.
- AC-DUEL-006.3 Given như AC-DUEL-006.2 nhưng có hai lần gõ thừa, when chấm, then ô đó không là trích dẫn.
- AC-DUEL-006.4 Given lần gõ ở vị trí 3 chỉ đạt OK, when chấm, then ô đó không là trích dẫn Vịt.
- AC-DUEL-006.5 Given hai lick cùng khớp một ô, when chọn, then lấy lick có nhiều vị trí hơn; bằng nhau thì lấy lick có ít lần gõ thừa hơn; vẫn bằng thì lấy lick học trước.
- AC-DUEL-006.6 Given một trận có trích Vịt hai lần và Ếch một lần, when tính thưởng, then cộng 10 điểm; trích cả ba lick khác nhau cũng chỉ cộng 10.
- AC-DUEL-006.7 Given một ô được nhận là trích dẫn, when trích dẫn được nhận, then tiếng của lick được lập lịch ở phách đầu của ô kế tiếp.
- AC-DUEL-006.8 Given lượt Echo hoặc Answer, when người chơi gõ đúng hình một lick, then không tính là trích dẫn.

### REQ-DUEL-007 Câu mở lượt Solo dựng từ solo của người chơi
Source: thiết kế mục 6.1

- AC-DUEL-007.1 Given trận 1, when đối thủ chơi lượt Solo, then cả 4 ô là câu soạn sẵn.
- AC-DUEL-007.2 Given ô Solo hay nhất của lần thắng trận 1 (lần mở khóa trận 2) có vị trí 0, 2, 5 với nút D, J, K, when trận 2 đến lượt Solo của đối thủ, then ô 1 là vị trí 0, 2, 5 với D, J, K; ô 2 là vị trí 0, 2, 5 với K, F, D; ô 3 và 4 là câu soạn sẵn.
- AC-DUEL-007.3 Given lần thắng trận 1 không có ô Solo hay nhất, when trận 2 đến lượt Solo của đối thủ, then cả 4 ô là câu soạn sẵn.
- AC-DUEL-007.4 Given lượt Solo của đối thủ có ô dựng từ câu người chơi, when hiển thị, then làn nhịp hiện nhãn "Câu của bạn" trên đúng những ô đó.

### REQ-DUEL-008 Chọn ô hay nhất
Source: thiết kế mục 6.1, 6.4

- AC-DUEL-008.1 Given 4 ô Solo của người chơi, when chọn ô hay nhất, then chỉ xét ô có ít nhất 3 lần gõ đạt OK trở lên so với lưới, lấy ô có điểm Nhịp trung bình cao nhất, hòa thì lấy ô sớm hơn.
- AC-DUEL-008.2 Given một lần gõ lệch vị trí lưới gần nhất 30 ms, when đưa ô hay nhất vào câu của đối thủ, then lần gõ đó nằm đúng vào vị trí lưới gần nhất.
- AC-DUEL-008.3 Given không ô nào có đủ 3 lần gõ đạt OK, when chọn, then không có ô hay nhất.

### REQ-DUEL-009 Cảm nhạc ở lượt Solo
Source: thiết kế mục 6.3

- AC-DUEL-009.1 Given lượt Solo, when các ô có gõ tạo ít nhất 3 hình vị trí khác nhau, then tiêu chí đa dạng nhịp được 1; đúng 2 hình được 0,5; còn lại được 0.
- AC-DUEL-009.2 Given lượt Solo có ít nhất một khoảng không gõ dài từ 2 vị trí lưới (1 phách) trở lên nằm giữa hai lần gõ, tức có ít nhất 2 vị trí trống liên tiếp giữa hai lần gõ (gõ ở 0 và 3 là có; gõ ở 0 và 2 là không), when chấm, then tiêu chí khoảng lặng được 1; không có thì được 0.
- AC-DUEL-009.3 Given một nút chiếm hơn 60% số lần gõ, không tính các ô là trích dẫn, when chấm, then tiêu chí không lặp một nút được 0; ngược lại được 1.
- AC-DUEL-009.4 Given lượt Solo có ít hơn 3 lần gõ, when chấm, then Cảm nhạc bằng 0; còn lại Cảm nhạc là trung bình của ba tiêu chí.

### REQ-DUEL-010 Điểm, sao, thắng thua
Source: thiết kế mục 6.3

- AC-DUEL-010.1 Given điểm nốt của một lượt Echo hoặc Answer, when tính điểm Nhịp của lượt, then điểm là (tổng điểm nốt − 0,25 × số lần gõ thừa) chia số nốt mục tiêu, không nhỏ hơn 0.
- AC-DUEL-010.2 Given lượt Solo, when tính điểm Nhịp, then mỗi lần gõ được chấm so với vị trí lưới gần nhất và điểm Nhịp là trung bình; không gõ lần nào thì bằng 0.
- AC-DUEL-010.3 Given điểm Nhịp của ba lượt, điểm Hướng của Echo và Answer, và Cảm nhạc của Solo, when tính tổng, then tổng = 60 × trung bình Nhịp + 25 × trung bình Hướng + 15 × Cảm nhạc + thưởng trích dẫn.
- AC-DUEL-010.4 Given tổng 39, 40, 65 và 85, when xếp sao, then lần lượt được 0, 1, 2 và 3 sao; từ 1 sao là thắng.
- AC-DUEL-010.5 Given mọi nốt Perfect, Hướng đúng hết, Cảm nhạc bằng 1 và không trích dẫn, when tính sao, then được 3 sao.

### REQ-DUEL-011 Độ khó và hỗ trợ
Source: thiết kế mục 7

- AC-DUEL-011.1 Given không có độ khó nào được truyền vào màn chơi, when bắt đầu, then hiện màn chọn độ khó có Lounge (chọn sẵn), Session và Late Set, chọn được cả ba.
- AC-DUEL-011.2 Given mức Lounge, when tới lượt người chơi, then làn nhịp hiện vị trí nốt mục tiêu; ở Session, vị trí nốt chỉ hiện khi đối thủ chơi và vạch phách luôn hiện; ở Late Set không hiện vị trí nốt hay vạch phách.
- AC-DUEL-011.3 Given thua 2 lần liên tiếp cùng một trận, when hiện kết quả lần thua thứ hai, then có đề nghị nới cửa sổ 15%; từ chối thì cửa sổ giữ nguyên.
- AC-DUEL-011.4 Given đã nhận hỗ trợ, when hiện kết quả, then có ghi chú là cửa sổ đã được nới.

### REQ-DUEL-012 Đội hình Bóng
Source: thiết kế mục 4.1, 17 (quyết định 12)

- AC-DUEL-012.1 Given người chơi chọn Aki, when lập đội hình, then Bóng club 1 là Sayo và Bóng club 2 là Ren.
- AC-DUEL-012.2 Given người chơi chọn Sayo, when lập đội hình, then club 1 là Aki và club 2 là Ren; chọn Ren thì club 1 là Aki và club 2 là Sayo.
- AC-DUEL-012.3 Given bất kỳ lựa chọn nào, when lập đội hình, then Bóng club 3 là chính nhân vật được chọn, có cờ dùng bảng màu Bóng.
- AC-DUEL-012.4 Given không có nhân vật nào được truyền vào màn chơi, when bắt đầu, then coi như chọn Ren: trận 1 là Bóng Aki ở 84 BPM, trận 2 là Bóng Sayo ở 96 BPM.

### REQ-DUEL-013 Màn chơi khối xám
Source: thiết kế mục 6, 14, 15 (Giai đoạn 2)

- AC-DUEL-013.1 Given hàm mở khóa âm thanh được gọi trong một sự kiện bấm của người chơi (ở khối xám là nút Chơi), when hàm chạy, then `AudioContext` được tạo hoặc `resume()` ngay trong sự kiện đó và ở trạng thái `running`.
- AC-DUEL-013.2 Given trình duyệt không có Web Audio, when gọi hàm mở khóa âm thanh, then hiện thông báo không chơi được kèm nút về portfolio, không lỗi trắng màn hình.
- AC-DUEL-013.3 Given đang trong trận, when nhấn `D`, `F`, `J` hoặc `K`, then mỗi lần nhấn là một lần gõ của nút tương ứng; giữ phím, tức sự kiện lặp phím, không tạo thêm lần gõ.
- AC-DUEL-013.4 Given màn hình cảm ứng, when chạm vào một trong 4 vùng chạm, then đó là một lần gõ của nút tương ứng.
- AC-DUEL-013.5 Given mỗi lần gõ, when gõ, then nốt của nút đó phát ngay, không chờ phách.
- AC-DUEL-013.6 Given trận kết thúc, when hiện kết quả, then màn kết quả có số sao, điểm Nhịp, Hướng, Cảm nhạc, các lick đã trích, và nút "Chơi lại take này" bắt đầu lại đúng trận đó.
- AC-DUEL-013.7 Given thắng trận 1, when hiện kết quả, then có nút sang trận 2; thua thì chỉ có nút chơi lại. Sau trận 2 là màn tổng kết cả hai trận với nút chơi lại từ đầu.
- AC-DUEL-013.8 Given sổ lick, when hiện, then có 3 lick cài sẵn với hình nhịp dạng chấm, và lick vừa được trích sáng lên.
- AC-DUEL-013.9 Given bất kỳ màn nào của game, when hiện, then luôn có nút về trang chủ portfolio đúng ngôn ngữ đang dùng.
- AC-DUEL-013.10 Given `prefers-reduced-motion` đang bật, when có phản hồi Perfect hoặc trích dẫn, then không có rung hay nhấp nháy, chỉ đổi chữ và hình.
- AC-DUEL-013.11 Given làn nhịp, when hiện, then 4 làn khác nhau cả về hình dạng lẫn màu.

### REQ-DUEL-014 Tạm dừng
Source: thiết kế mục 11

- AC-DUEL-014.1 Given đang trong trận, when tab bị ẩn, bấm nút tạm dừng hoặc nhấn `Esc`, then trận dừng và `AudioContext.suspend()` được gọi.
- AC-DUEL-014.2 Given đang tạm dừng, when tiếp tục, then có 1 ô đếm nhịp rồi lượt hiện tại chơi lại từ câu của đối thủ, và điểm của lượt đó được tính lại từ đầu.
- AC-DUEL-014.3 Given đang tạm dừng, when chọn về portfolio, then trang rời đi và `AudioContext.close()` được gọi.

### REQ-DUEL-015 Công tắc isGameEnabled
Source: thiết kế mục 17 (quyết định 6); hợp đồng ở `specs/game-duel/api.md`

- AC-DUEL-015.1 Given admin gửi `PUT /settings/admin/features` với `isGameEnabled: true`, when đọc `GET /settings/public`, then nhận `isGameEnabled: true`, và tag `settings` đã được làm mới.
- AC-DUEL-015.2 Given admin gửi `isGameEnabled: "yes"`, when API xử lý, then trả 400 và giá trị không đổi.
- AC-DUEL-015.3 Given một lần cập nhật không có trường `isGameEnabled`, when lưu, then giá trị cũ giữ nguyên.
- AC-DUEL-015.4 Given `getPublicSettings` không gọi được API, when trả giá trị dự phòng, then `isGameEnabled` là `false`.
- AC-DUEL-015.5 Given `isGameEnabled` tắt, when mở `/{locale}/game`, then trang trả 404.
- AC-DUEL-015.6 Given `isGameEnabled` bật, when render `/{locale}/game`, then metadata `robots` là noindex, nofollow, và `sitemap.xml` không có `/game`.
- AC-DUEL-015.7 Given màn Content Settings trong CMS, when bật công tắc Game và lưu, then payload gửi đi có `isGameEnabled: true`.

### REQ-DUEL-016 Ngôn ngữ
Source: CLAUDE.md (chữ công khai qua next-intl)

- AC-DUEL-016.1 Given namespace `game` trong `en.json`, when kiểm tra, then `vi.json` và `ja.json` có chuỗi không rỗng cho mọi khóa của namespace đó.

### REQ-DUEL-017 Đầu vào và đầu ra của màn chơi
Source: thiết kế mục 15; để `game-shell` bọc lại mà không sửa màn chơi

- AC-DUEL-017.1 Given màn chơi được truyền nhân vật, độ khó và offset, when bắt đầu, then dùng đúng các giá trị đó và bỏ qua màn chọn độ khó lẫn bước hiệu chỉnh.
- AC-DUEL-017.2 Given màn chơi được truyền trận bắt đầu là trận 2 kèm ô Solo hay nhất của trận 1, when bắt đầu, then vào thẳng trận 2 và câu mở lượt Solo của đối thủ dựng từ ô đó như AC-DUEL-007.2.
- AC-DUEL-017.3 Given một trận kết thúc, when hiện kết quả, then màn chơi báo ra ngoài số trận, số sao, thắng hay thua, và ô Solo hay nhất của lần chơi đó, để bên ngoài lưu lại.

## Đo, không phải AC
Các mục sau là điều kiện qua Giai đoạn 2 hoặc số đo, không có test tự động:
- 5 người chơi thử chơi hai trận: hầu hết tự hiểu cách chơi, muốn chơi lại, nhận ra câu của mình ở trận 2, và thấy trích dẫn là đáng làm.
- First Load JS của các trang portfolio không tăng, so bằng script `analyze` của `apps/web` trước và sau.
- Độ trễ cảm nhận trên 1 máy tính và 1 điện thoại, có và không có tai nghe Bluetooth.

## Open questions
- none

## Change log
- 0.1 draft
- 0.1 approved by owner (G0), 2026-11-07. Câu hỏi về bộ sample được chốt theo đề xuất (để sau playtest) và chuyển vào Out.
- 0.2 làm rõ, không đổi AC: thêm hằng số `CALIBRATION_BPM` = 90 và ghi rõ "2 lần gõ đầu" là theo thời gian. Lần gõ nằm ngoài mọi cửa sổ OK là gõ thừa, theo AC-DUEL-003.5. Task bị ảnh hưởng: T-003.
- 0.3 làm rõ AC-DUEL-009.2: khoảng lặng là ít nhất 2 vị trí trống liên tiếp giữa hai lần gõ, kèm ví dụ, để gõ đều từng phách không được tính là có khoảng lặng. Ở Lounge, làn nhịp hiện vạch phách ở cả hai lượt và vị trí nốt cả khi đối thủ chơi (AC-DUEL-011.2 không cấm). Task bị ảnh hưởng: T-005.
- 0.4 làm rõ, không đổi AC:
  - AC-DUEL-005.1: cặp có nốt mục tiêu chưa được ghép vẫn được tính và là sai; chỉ cặp đối thủ lặp nút mới không được tính (AC-DUEL-005.3).
  - Lượt Solo: một lần gõ được đưa về lưới mà rơi ra ngoài 4 ô Solo của người chơi (trước ô đầu hoặc sau vị trí 7 của ô cuối) thì bỏ khỏi mọi điểm của lượt Solo, theo AC-DUEL-003.7.
  - Bảng độ khó trong design.md: ở Late Set, khi đối thủ chơi cũng không hiện vị trí nốt, khớp AC-DUEL-011.2.
  - Task bị ảnh hưởng: T-006 (lọc lần gõ ngoài ô Solo), T-009 (làn nhịp Late Set).
