# Hợp đồng dữ liệu: công tắc isGameEnabled

Spec: `specs/game-duel/requirements.md`, REQ-DUEL-015. Công tắc đi theo đúng đường của `isBlogEnabled` hiện có. Game chưa có route API nào, nên không dùng `FeatureFlagGuard`; khi game có API (ví dụ bảng xếp hạng) thì thêm `@RequireFeature`.

## Database: `packages/database/prisma/schema.prisma`

Model `SiteSettings`, thêm cột:

```prisma
isGameEnabled Boolean @default(false) @map("is_game_enabled")
```

- Commit migration sinh ra bởi `pnpm --filter @jazz-portfolio/database db:migrate`.
- `prisma/seed.ts`: thêm `isGameEnabled: false` cạnh `isBlogEnabled: false`.

## Kiểu dùng chung: `packages/shared/src/types/index.ts`

| Kiểu | Trường thêm | Ghi chú |
|---|---|---|
| `FeatureSettingsDto` | `isGameEnabled: boolean` | `UpdateFeatureSettingsDto` (kiểu) tự có trường này qua `Partial<Omit<...>>` |
| `PublicSettingsDto` | `isGameEnabled: boolean` | Web đọc trường này để quyết định trang `/game` |

## API: `apps/api/src/settings`

| Endpoint | Đổi gì | Quyền |
|---|---|---|
| `GET /api/settings/public` (`ApiRoutes.settings.public()`) | Phản hồi thêm `isGameEnabled` | Công khai |
| `GET /api/settings/admin/features` (`ApiRoutes.settings.adminFeatures()`) | Phản hồi thêm `isGameEnabled` | `JwtAuthGuard` |
| `PUT /api/settings/admin/features` | Nhận thêm `isGameEnabled` | `JwtAuthGuard` |

Không thêm đường dẫn mới vào `ApiRoutes`.

### PUT /api/settings/admin/features

Request, mọi trường đều tùy chọn:

| Trường | Kiểu | Kiểm tra |
|---|---|---|
| `isGameEnabled` | `boolean` | `@IsOptional() @IsBoolean()` trong `dto/update-feature-settings.dto.ts` |

Phản hồi: `FeatureSettingsDto` đầy đủ, có `isGameEnabled`.

| Trường hợp | Mã | Kết quả |
|---|---|---|
| `isGameEnabled` là boolean | 200 | Lưu giá trị, gọi `revalidationService.purge(['settings'])` như hiện tại |
| Không có `isGameEnabled` | 200 | Giữ giá trị cũ |
| `isGameEnabled` không phải boolean | 400 | Không lưu gì |
| Chưa đăng nhập | 401 | Như các route admin hiện có |

### Chỗ cần sửa trong `settings.service.ts`

Service dựng dữ liệu theo từng trường, nên phải thêm `isGameEnabled` vào mọi chỗ đang liệt kê `isBlogEnabled`:
- interface `CachedSiteSettings`, khối `select` trong `getCachedSettings`, và giá trị mặc định khi khởi tạo dòng cài đặt;
- đối tượng `data` trong `updateFeatureSettings`;
- đối tượng trả về của `updateFeatureSettings` và `getFeatureSettings`;
- đối tượng trả về của `getPublicSettings`.

## Web: `apps/web`

| File | Đổi gì |
|---|---|
| `src/lib/portfolio-data.ts` | Giá trị dự phòng của `getPublicSettings` có `isGameEnabled: false`, để game ẩn khi API lỗi |
| `src/app/[locale]/game/page.tsx` | Gọi `getPublicSettings()`; `isGameEnabled` là `false` thì gọi `notFound()`. Metadata `robots: { index: false, follow: false }` |
| `src/components/admin/settings/ContentSettingsForm.tsx` | Thêm công tắc Game, gửi `isGameEnabled` qua hook admin hiện có |
| `src/app/sitemap.ts` | Không đổi: `/game` không bao giờ vào sitemap |
