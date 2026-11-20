# Plan: Trận đấu Trading Fours (khối xám)

Feature branch: `feature/game-duel` (from `master`)

| Task | Covers (ACs) | Stack (package) | Files it may touch | Depends on | Lane |
|---|---|---|---|---|---|
| T-001 (#3) Công tắc isGameEnabled: database, shared, API, dự phòng web | AC-DUEL-015.1, 015.2, 015.3, 015.4 | apps/api, packages/database, packages/shared, apps/web | `packages/database/prisma/{schema.prisma,seed.ts,migrations/*_add_game_enabled/}`, `packages/shared/src/types/index.ts`, `apps/api/src/settings/{dto/update-feature-settings.dto.ts,settings.service.ts,**/*.spec.ts}`, `apps/api/src/common/feature-flag/feature-flag.guard.spec.ts`, `apps/web/src/lib/portfolio-data{,.test}.ts` | none | A |
| T-002 (#4) Thiết kế màn chơi khối xám và công tắc CMS | none (designer, G2) | specs/game-duel | `specs/game-duel/design.md`, `specs/game-duel/mockups/**` | none | B |
| T-003 (#5) Lõi: hằng số, kiểu, đồng hồ, hiệu chỉnh, chấm nhịp | AC-DUEL-001.1–001.4, 002.1, 002.2, 003.1–003.6 | apps/web | `apps/web/src/game/core/{config,types,clock,calibration,judge}.ts` và test | none | C |
| T-004 (#6) Lõi: lick, câu gọi, ô hay nhất, đội hình | AC-DUEL-004.3, 006.1–006.6, 007.1–007.3, 008.1–008.3, 012.1–012.3 | apps/web | `apps/web/src/game/core/{lick,call,best-bar,roster}.ts`, `core/data/{licks,calls}.ts` và test | T-003 | D |
| T-005 (#7) Lõi: hướng, cảm nhạc, điểm và sao, độ khó | AC-DUEL-005.1–005.4, 009.1–009.4, 010.1–010.5, 011.2 | apps/web | `apps/web/src/game/core/{direction,feel,scoring,difficulty}.ts` và test | T-003 | E |
| T-006 (#8) Lõi: phiên đấu và chuỗi hai trận | AC-DUEL-002.3, 003.7, 004.1, 004.2, 006.7, 006.8, 012.4, 014.2 | apps/web | `apps/web/src/game/core/{session,campaign}.ts` và test | T-003, T-004, T-005 | C |
| T-007 (#9) Âm thanh: mở khóa, lập lịch, âm tổng hợp | AC-DUEL-013.1, 013.2, 013.5 | apps/web | `apps/web/src/game/audio/**` | T-003 | F |
| T-008 (#10) Công tắc Game trong ContentSettingsForm | AC-DUEL-015.7 | apps/web | `apps/web/src/components/admin/settings/ContentSettingsForm{.tsx,.test.tsx}` | T-001, T-002 (G2) | A |
| T-009 (#11) Giao diện: làn nhịp, nhập liệu, sổ lick | AC-DUEL-007.4, 013.3, 013.4, 013.8, 013.10, 013.11 | apps/web | `apps/web/src/game/ui/{lanes,input,lick-book}/**` | T-002 (G2), T-005, T-007 | B |
| T-010 (#12) Giao diện: DuelGame và các màn phụ | AC-DUEL-011.1, 011.3, 011.4, 013.6, 013.7, 013.9, 014.1, 014.3, 017.1–017.3 | apps/web | `apps/web/src/game/ui/{DuelGame.tsx,DuelGame.test.tsx,screens/**}`, `apps/web/src/stores/gameStore{,.test}.ts` | T-002 (G2), T-006, T-007, T-009 | B |
| T-011 (#13) Route /game: bật tắt, noindex, loading, error | AC-DUEL-015.5, 015.6 | apps/web | `apps/web/src/app/[locale]/game/{page,page.test,layout,loading,error}.tsx`, `apps/web/src/app/sitemap.test.ts` | T-001, T-010 | B |
| T-013 (#15) Sửa lỗi: báo lỗi khi bắt đầu trận thất bại | AC-DUEL-013.12 | apps/web | `apps/web/src/game/ui/{DuelGame.tsx,DuelGame.start.test.tsx}`, `screens/{StartScreen.tsx,testing/intl.ts}` | none | B |
| T-014 (#16) Sửa lỗi: tab ẩn khi đang tiếp tục trận | AC-DUEL-014.1 (sửa lỗi) | apps/web | `apps/web/src/game/ui/screens/duel-controller{.ts,.test.ts}` | none | G |
| T-015 (#17) Sửa lỗi: mở nút về portfolio sang tab mới | AC-DUEL-013.13 | apps/web | `apps/web/src/game/ui/screens/ui{.tsx,.test.tsx}` | none | H |
| T-012 (#14) Nối file dùng chung: messages và CLAUDE.md | AC-DUEL-016.1 | apps/web | `apps/web/src/i18n/messages/{en,vi,ja}.json`, `apps/web/src/i18n/game-messages.test.ts`, `CLAUDE.md` | T-001 đến T-011, T-013 đến T-015 | W |

Order along the data contract: schema and migrations, then shared packages, then backend, then frontend.
One task owns each shared package change; tasks that consume it depend on it.
Hot files (listed in CLAUDE.md) belong to one wiring task, scheduled last.
Tasks in the same lane run one after another; different lanes run in parallel and never share a file.

## Ghi chú

- **G1:** 78/78 AC, mỗi AC nằm đúng một task (đã kiểm bằng cách đối chiếu dòng Covers của 12 task với danh sách AC trong spec).
- **Ngoại lệ về file dùng chung:** `schema.prisma` thuộc T-001 chứ không thuộc task nối. File này là gốc của hợp đồng dữ liệu, mọi task API và web đọc cột mới đều cần nó trước. T-001 là task duy nhất của plan chạm vào nó. Các file dùng chung còn lại (ba file messages) và `CLAUDE.md` thuộc T-012, làm cuối.
- **T-001 gồm cả dòng dự phòng trong `portfolio-data.ts`:** thêm trường bắt buộc vào `PublicSettingsDto` sẽ làm type-check của web hỏng nếu giá trị dự phòng chưa có `isGameEnabled`. Vì vậy dòng đó đi cùng task để verify toàn repo (G3) vẫn xanh.
- **Chữ giao diện:** T-009 đến T-011 dùng khóa next-intl theo bảng chữ trong `design.md`. T-008 là giao diện admin nên dùng chữ tiếng Anh cố định, không qua next-intl. Khóa chỉ vào `messages/*.json` ở T-012, nên test của các task đó dùng messages giả.
- **G2:** T-008, T-009, T-010 chỉ bắt đầu sau khi chủ dự án duyệt `design.md` của T-002.
- **Song song ngay từ đầu:** T-001, T-002, T-003. Sau T-003 thì T-004, T-005, T-007 chạy song song.
- **Task sửa lỗi (spec 0.5, 2026-11-20):** T-013 đến T-015 đến từ review T-010, mở theo quy trình `fix`. T-014 sửa một AC đã thuộc T-010, nên AC-DUEL-014.1 được phủ bởi hai task: T-010 làm tính năng, T-014 sửa lỗi. T-012 làm sau cả ba.
