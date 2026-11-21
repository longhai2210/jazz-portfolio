# Plan: Lát cắt dọc Hồ Làng

Feature branch: `feature/game-stage` (from `feature/game-duel`)

| Task | Covers (ACs) | Stack (package) | Files it may touch | Depends on | Lane |
|---|---|---|---|---|---|
| T-017 (#19) Thiết kế màn phố, club và các trạng thái | none (designer, G2) | specs/game-stage | `specs/game-stage/design.md` | none | B |
| T-018 (#20) Phụ thuộc three-vrm, manifest, trình tải theo byte, kiểm WebGL2 | AC-STAGE-001.3, 001.4 | apps/web | `apps/web/package.json`, `pnpm-lock.yaml`, `apps/web/src/game/stage/assets/**`, `apps/web/src/game/stage/webgl{,.test}.ts` | none | A |
| T-019 (#21) Logic phố: đi, biên, cửa club, camera, lịch vịt quạc | AC-STAGE-003.2, 003.3, 003.4, 004.1, 004.2 | apps/web | `apps/web/src/game/stage/street/**` | none | C |
| T-020 (#22) Nhân vật: hoạt ảnh bằng code, vai theo pha, tạo Bóng | AC-STAGE-005.2, 006.1, 007.1, 007.2, 007.3 | apps/web | `apps/web/src/game/stage/character/**` | T-018 | A |
| T-021 (#23) StageGame, cảnh phố, điều khiển, dọn dẹp, route /game | AC-STAGE-001.1, 001.2, 002.1, 003.1, 008.1, 008.2; phần nối cảnh của 001.4, 003.3, 003.4, 004.1 | apps/web | `apps/web/src/game/stage/{StageGame.tsx,StageGame.test.tsx,scenes/StreetScene.tsx,input/**,testing/**}`, `apps/web/src/app/[locale]/game/{page,page.test}.tsx` | T-017 (G2), T-018, T-019, T-020 | D |
| T-022 (#24) Cảnh club, nền 3D cho DuelGame, Bóng mờ, quay ra phố | AC-STAGE-005.1, 005.3, 005.4 | apps/web | `apps/web/src/game/stage/{scenes/ClubScene.tsx,scenes/ClubScene.test.tsx,StageGame.tsx,StageGame.club.test.tsx}`, `apps/web/src/game/ui/{DuelGame.tsx,DuelGame.backdrop.test.tsx}` | T-021 | D |
| T-023 (#25) Nối file dùng chung: messages game.stage và CLAUDE.md | AC-STAGE-009.1 | apps/web | `apps/web/src/i18n/messages/{en,vi,ja}.json`, `apps/web/src/i18n/game-messages.test.ts`, `CLAUDE.md` | T-017 đến T-022 | W |

Order along the data contract: schema and migrations, then shared packages, then backend, then frontend.
One task owns each shared package change; tasks that consume it depend on it.
Hot files (listed in CLAUDE.md) belong to one wiring task, scheduled last.
Tasks in the same lane run one after another; different lanes run in parallel and never share a file.

## Ghi chú

- **G1:** 22/22 AC, mỗi AC nằm đúng một task (đã kiểm bằng cách đối chiếu dòng Covers của 7 task với danh sách AC trong spec).
- **AC chia hai nửa (sau review T-018, T-019):** AC-STAGE-001.4, 003.3, 003.4, 004.1 có nửa logic thuần ở T-018, T-019 và nửa nối vào cảnh ở T-021: màn Đang tải hiện byte thật từ `onProgress`, phím `E`/`Enter` và nút vào club, camera sau khi làm mượt vẫn kẹp trong `cam_min`..`cam_max` (bám cứng khi giảm chuyển động), cảnh gọi `scheduleDuckQuacks`. Test của T-021 cho các nửa này đặt tên theo đúng ID AC.
- **Không đụng API hay database:** lát cắt chỉ ở `apps/web`. Công tắc `isGameEnabled` của `game-duel` vẫn giữ `/game`.
- **Phụ thuộc mới:** T-018 là task duy nhất sửa `apps/web/package.json` và `pnpm-lock.yaml`. T-020 cần `@pixiv/three-vrm` nên làm sau T-018, cùng lane A.
- **Asset chỉ có trên máy:** CI và bản checkout sạch không có `apps/web/public/game-assets/`. Mọi test dùng manifest và file giả; cảnh 3D không chạy trong Jest, nên AC kiểm trên logic thuần hoặc DOM, còn phần hình ảnh đo ở G6 trên máy chủ dự án.
- **Phần art (ngoài code):** dựng bằng script Blender chạy nền trong `.art-source`, xuất theo `specs/game-stage/assets.md`. Không có issue, không commit. Ảnh mẫu G2 nằm ngoài repo, Lead đưa chủ dự án xem cùng `design.md` của T-017.
- **G2:** T-021 và T-022 chỉ bắt đầu sau khi chủ dự án duyệt `design.md` và ảnh mẫu.
- **Chữ giao diện:** T-021 và T-022 dùng khóa `game.stage.*` theo bảng chữ trong `design.md`, test dùng messages giả. Khóa chỉ vào `messages/*.json` ở T-023. Test của tester ở T-012 (`game-messages.ac.test.ts`) do tester của T-023 sửa cho chấp nhận bảng chữ của spec này.
- **`DuelGame.tsx`:** T-022 thêm tùy chọn nền; không truyền thì hành vi y như cũ, mọi test của `game-duel` phải còn qua.
- **Song song ngay từ đầu:** T-017, T-018, T-019. Sau T-018 thì T-020. T-021, T-022, T-023 nối tiếp nhau.
