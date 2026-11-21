# Hợp đồng asset: lát cắt dọc Hồ Làng

Spec: `specs/game-stage/requirements.md`. Code dựng theo hợp đồng này với khối giữ chỗ (placeholder) khi chưa có asset thật, nên không phải chờ phần art.

## Vị trí và bảo mật
- Thư mục: `apps/web/public/game-assets/`, được git bỏ qua. Không commit, không deploy.
- Nguồn dựng: script Blender chạy nền trong `.art-source/` (chỉ có trên máy chủ dự án).
- Không mô tả ngoại hình nhân vật trong file này, issue hay commit.

## Manifest: `/game-assets/manifest.json`

```json
{
  "version": 1,
  "characters": {
    "player": {
      "vrm": "characters/player.vrm",
      "shadowPalette": "characters/player_shadow.png",
      "bytes": 0
    }
  },
  "stages": {
    "hoLangStreet": { "glb": "stages/ho-lang-street.glb", "bytes": 0 },
    "hoLangClub": { "glb": "stages/ho-lang-club.glb", "bytes": 0 }
  },
  "props": { "duck": { "glb": "props/duck.glb", "bytes": 0 } },
  "sprites": { "drummer": { "png": "sprites/drummer.png", "bytes": 0 } }
}
```

- Mọi đường dẫn là tương đối với `/game-assets/`.
- `bytes` là kích thước file thật, để tính tiến độ tải theo byte (AC-STAGE-001.4). Với `characters.player`, `bytes` là tổng của `vrm` và `shadowPalette`. `bytes` bằng 0 vẫn hợp lệ (file giữ chỗ); khi tổng bằng 0 thì không vẽ thanh tiến độ (design.md mục 1).
- Thiếu trường nào ở trên, hoặc `version` khác 1, thì coi là thiếu asset (AC-STAGE-001.3).

## Nhân vật: `characters/player.vrm`
- VRM 1.0 (`VRMC_vrm`, `VRMC_springBone`, `VRMC_materials_mtoon`), xuất bằng đường script tự ghi đã kiểm ở bản thử.
- Xương humanoid bắt buộc của VRM 1.0, cộng `leftUpperArm`... đủ hai tay, hai chân, `neck`, `head`.
- Biểu cảm: `blink`, `happy`, `aa`, cộng `grip` tùy chọn.
- Bảng màu: texture 64×64, mỗi màu một ô 8×8, kèm texture bóng cho `shadeMultiplyTexture`, lấy mẫu nearest.
- Bảng màu Bóng `characters/player_shadow.png`: cùng bố cục ô với bảng màu gốc, để đổi texture là ra Bóng (AC-STAGE-006.1).
- Ngân sách: ≤ 20.000 tam giác, ≤ 8 draw call, ≤ 5 MB.

## Phố: `stages/ho-lang-street.glb`
- Nhìn ngang, dài khoảng 40 m theo trục X, hai tầng sâu (mặt đường và mặt tiền), cảnh xa là các tấm phẳng trượt chậm.
- Node rỗng bắt buộc: `spawn`, `walk_min`, `walk_max`, `cam_min`, `cam_max`, `club_door`, `duck_path_0` đến `duck_path_4`.
- Đèn: các mesh tên `lamp_*` có vật liệu phát sáng, code bật hoặc tắt để "sáng đèn" (AC-STAGE-005.4).
- Ngân sách: ≤ 60.000 tam giác, ≤ 40 draw call, ≤ 8 MB.

## Club: `stages/ho-lang-club.glb`
- Sân khấu nhỏ, tường sau, đèn sân khấu, bộ trống.
- Node rỗng bắt buộc: `player_mark`, `rival_mark`, `drummer_mark`, `cam_duel`.
- Ngân sách: ≤ 40.000 tam giác, ≤ 30 draw call, ≤ 6 MB.

## Vịt: `props/duck.glb`
- Một con vịt, vẽ nhiều lần bằng instancing (tối đa 5 con).
- Ngân sách: ≤ 1.000 tam giác mỗi con.

## Tay trống: `sprites/drummer.png`
- Bóng ngược sáng 2D, nền trong suốt, vài khung hình đánh trống xếp ngang trong một ảnh.
- Kích thước ≤ 1 MB.
