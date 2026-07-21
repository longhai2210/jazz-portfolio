# Implementation Plan: Contact Form with Email Integration

## Overview

Implement an interactive contact form on the jazz portfolio with email notifications (Resend/Nodemailer), PostgreSQL persistence via Prisma, and an admin inbox CMS page. Work proceeds in this order: database schema → shared types → API backend (contact module + mail module) → frontend form → admin inbox → i18n → security hardening.

## Tasks

- [ ] 1. Database schema and migration
  - [x] 1.1 Add `ContactSubmission` Prisma model to `packages/database/prisma/schema.prisma`
    - Define all fields: `id` (UUID), `senderName` VarChar(100), `senderEmail` VarChar(254), `subject` VarChar(200), `messageBody` VarChar(5000), `isRead` Boolean default false, `createdAt`, `updatedAt`
    - Use `@@map("contact_submissions")` and snake_case `@map` annotations on every field
    - _Requirements: 5.1_
  - [x] 1.2 Generate and run the Prisma migration
    - Run `pnpm --filter @jazz-portfolio/database db:migrate` to generate migration SQL
    - Verify generated migration file creates `contact_submissions` table with correct column types and constraints
    - _Requirements: 5.1_

- [x] 2. Shared types
  - [x] 2.1 Add `ContactSubmissionDto` and `CreateContactSubmissionResponseDto` to `packages/shared/src/types/index.ts`
    - Export `ContactSubmissionDto` with fields: `id`, `senderName`, `senderEmail`, `subject`, `messageBody`, `isRead`, `createdAt`, `updatedAt` (all strings/boolean)
    - Export `CreateContactSubmissionResponseDto` with fields: `id`, `createdAt` (ISO 8601 string), `emailDelivered` (boolean)
    - _Requirements: 3.5, 3.6, 5.1_

- [ ] 3. Mail module (NestJS)
  - [x] 3.1 Create `MailProvider` interface and `MailSendOptions` type in `apps/api/src/mail/interfaces/mail-provider.interface.ts`
    - Define `MailSendOptions`: `{ to, from, subject, text, html }`
    - Define `MailProvider` interface with `send(options: MailSendOptions): Promise<void>`
    - _Requirements: 4.2_
  - [x] 3.2 Implement `ResendProvider` in `apps/api/src/mail/providers/resend.provider.ts`
    - Install `resend` package in `apps/api`
    - Inject `ConfigService`; read `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_TO` from env
    - Implement `MailProvider.send()` using the Resend SDK
    - _Requirements: 4.1, 4.2_
  - [x] 3.3 Implement `NodemailerProvider` in `apps/api/src/mail/providers/nodemailer.provider.ts`
    - Install `nodemailer` and `@types/nodemailer` in `apps/api`
    - Inject `ConfigService`; read `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` from env
    - Implement `MailProvider.send()` using a Nodemailer transporter
    - _Requirements: 4.1, 4.2_
  - [x] 3.4 Implement `MailService` in `apps/api/src/mail/mail.service.ts`
    - Inject the active `MailProvider` (selected by `MAIL_PROVIDER` env var: `resend` | `smtp`)
    - Implement `sendContactNotification(submission: ContactSubmission): Promise<void>`
    - Build plain-text and HTML email bodies containing `senderName`, `senderEmail`, `subject`, `messageBody`, and `createdAt` as ISO 8601 UTC
    - Retry up to 3 times on transient errors (ECONNREFUSED, provider 5xx/429) with `await sleep(5000)` between attempts; throw `MailDeliveryException` after exhaustion
    - Throw `MailDeliveryException` immediately on permanent errors (4xx excluding 429)
    - On startup, if `MAIL_TO`, `MAIL_FROM`, or required provider credentials are missing, set an `isConfigured = false` flag and log a startup error via NestJS `Logger`
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [-]* 3.5 Write property test for `MailService` retry behavior (P13)
    - **Property 13: Mail retry exhausts before throwing**
    - Mock the provider `send` to throw a transient error; assert `send` is called exactly 4 times (1 + 3 retries) and `MailDeliveryException` is thrown
    - Mock the provider `send` to throw a permanent error; assert `send` is called exactly once
    - Use fast-check to vary the transient/permanent error type
    - **Validates: Requirements 4.4, 4.5**
    - _Test file: `apps/api/src/mail/mail.service.pbt.spec.ts`_
  - [ ]* 3.6 Write property test for notification email content (P12)
    - **Property 12: Notification email contains all submission fields**
    - Use fast-check to generate arbitrary `senderName`, `senderEmail`, `subject`, `messageBody`, `createdAt` strings
    - Assert both text and HTML bodies of the sent email contain each field value
    - **Validates: Requirements 4.1**
    - _Test file: `apps/api/src/mail/mail.service.pbt.spec.ts`_
  - [-] 3.7 Create `MailModule` in `apps/api/src/mail/mail.module.ts`
    - Use a factory provider to instantiate `ResendProvider` or `NodemailerProvider` based on `MAIL_PROVIDER` env var
    - Export `MailService` for use in `ContactModule`
    - _Requirements: 4.2_

- [ ] 4. Contact module — backend
  - [x] 4.1 Create `CreateContactSubmissionDto` in `apps/api/src/contact/dto/create-contact-submission.dto.ts`
    - Fields: `name` (string, required, max 100), `email` (email, max 254), `subject` (string, required, max 200), `message` (string, required, min 10, max 5000), `_hp` (optional, must be empty/absent for honeypot)
    - Apply `@Transform(({ value }) => sanitizeHtml(value))` (install `sanitize-html` and `@types/sanitize-html`) to `name`, `subject`, `message`
    - _Requirements: 3.2, 8.1, 8.2, 8.3_
  - [x] 4.2 Create `ContactSubmissionDto` response shape in `apps/api/src/contact/dto/contact-submission.dto.ts`
    - Mirror the `ContactSubmissionDto` interface from `@jazz-portfolio/shared`
    - _Requirements: 5.1_
  - [~] 4.3 Implement `ContactService` in `apps/api/src/contact/contact.service.ts`
    - Inject `PrismaService` and `MailService`
    - Implement `createSubmission(dto)`: sanitize fields, write DB record first, call `MailService.sendContactNotification`, return `{ id, createdAt, emailDelivered }` — set `emailDelivered: false` if `MailDeliveryException` is caught
    - If DB write throws, propagate as HTTP 500 without calling mail service
    - If `MailService.isConfigured` is false, return HTTP 503 immediately
    - Implement `listSubmissions()`: return all records ordered by `createdAt` descending
    - Implement `markAsRead(id: string)`: PATCH `isRead = true`, throw 404 if record not found
    - _Requirements: 3.3, 3.4, 3.5, 3.6, 3.8, 4.3, 5.2, 5.6_
  - [ ]* 4.4 Write property test for `ContactService.createSubmission` (P8, P9, P10, P11, P18, P19)
    - **Property 8: API rejects invalid payloads** — use fast-check to generate missing/oversized fields; assert HTTP 400 with field names in response
    - **Property 9: Submission persistence round-trip** — generate valid payloads; assert DB record matches response `id` and `createdAt`
    - **Property 10: emailDelivered flag** — mock mail success → assert `emailDelivered: true`; mock mail throw → assert `emailDelivered: false` and response still HTTP 201
    - **Property 11: DB failure prevents email** — mock Prisma to throw; assert `MailService.sendContactNotification` never called and response is HTTP 500
    - **Property 18: HTML stripping** — generate strings with HTML tags; assert stored `messageBody` contains no HTML markup; assert empty-after-strip returns HTTP 400
    - **Property 19: Non-empty honeypot causes HTTP 400** — generate non-empty strings for `_hp`; assert HTTP 400, no DB row inserted, no mail sent
    - **Validates: Requirements 3.2, 3.3, 3.5, 3.6, 3.8, 8.1, 8.2, 8.5, 8.6**
    - _Test file: `apps/api/src/contact/contact.service.pbt.spec.ts`_
  - [ ]* 4.5 Write property test for admin list and mark-as-read (P14, P16)
    - **Property 14: Admin inbox sorted descending** — generate arrays of submissions with distinct `createdAt` values; assert list response is ordered newest-first
    - **Property 16: Mark-as-read round-trip** — for any submission with `isRead = false`, call `markAsRead`; assert DB record has `isRead = true`
    - **Validates: Requirements 5.2, 5.6**
    - _Test file: `apps/api/src/contact/contact.service.pbt.spec.ts`_
  - [~] 4.6 Implement `ContactController` in `apps/api/src/contact/contact.controller.ts`
    - `POST /api/contact` — public, apply `@Throttle({ default: { limit: 5, ttl: 60000 } })`, bind `CreateContactSubmissionDto`, call `contactService.createSubmission`, return 201
    - `GET /api/admin/contact` — apply `@UseGuards(JwtAuthGuard)`, call `contactService.listSubmissions`
    - `PATCH /api/admin/contact/:id/read` — apply `@UseGuards(JwtAuthGuard)`, call `contactService.markAsRead(id)`
    - Add Swagger `@ApiTags`, `@ApiOperation`, `@ApiBearerAuth` decorators
    - _Requirements: 3.1, 3.7, 5.2, 5.6_
  - [~] 4.7 Create `ContactModule` in `apps/api/src/contact/contact.module.ts` and register in `AppModule`
    - Import `PrismaModule`, `MailModule`, `ThrottlerModule`
    - Add `ContactModule` to `AppModule` imports in `apps/api/src/app.module.ts`
    - _Requirements: 3.1_

- [ ] 5. Environment variables and validation
  - [~] 5.1 Add mail env vars to `apps/api/src/config/env.validation.ts`
    - Add `MAIL_PROVIDER` (enum: `resend` | `smtp`), `MAIL_FROM`, `MAIL_TO` as required strings
    - Add `RESEND_API_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` as optional strings; `SMTP_PORT` as optional number defaulting to 587
    - _Requirements: 4.2, 4.3_
  - [~] 5.2 Update `apps/api/.env.example` with all new mail env var placeholders
    - _Requirements: 4.2_

- [~] 6. Checkpoint — backend complete
  - Run `pnpm --filter @jazz-portfolio/api test` and `pnpm --filter @jazz-portfolio/api type-check`. Ensure all tests pass, ask the user if questions arise.

- [x] 7. i18n translation keys
  - [x] 7.1 Add `contact` namespace keys to `apps/web/src/i18n/messages/en.json`
    - Add all keys from the design document's translation namespace: `sectionTitle`, `sectionSubtitle`, `labelName`, `labelEmail`, `labelSubject`, `labelMessage`, `placeholderName`, `placeholderEmail`, `placeholderSubject`, `placeholderMessage`, `submit`, `submitting`, `successTitle`, `successBody`, `resetButton`, `errorRequired`, `errorEmailInvalid`, `errorMinLength`, `errorMaxLengthName`, `errorMaxLengthEmail`, `errorMaxLengthSubject`, `errorMaxLengthMessage`, `errorRateLimit`, `errorRateLimitGeneric`, `errorValidation`, `errorServer`, `charCountWarning`, `charCountLimit`
    - _Requirements: 7.1, 7.2_
  - [x] 7.2 Add `contact` namespace keys to `apps/web/src/i18n/messages/vi.json`
    - Translate every key from 7.1 into Vietnamese; every value must be a non-empty string
    - _Requirements: 7.2_
  - [x] 7.3 Add `contact` namespace keys to `apps/web/src/i18n/messages/ja.json`
    - Translate every key from 7.1 into Japanese; every value must be a non-empty string
    - _Requirements: 7.2_
  - [x]* 7.4 Write property test for translation key coverage (P20)
    - **Property 20: All locale files contain every contact translation key**
    - Use fast-check to iterate over every key in the `contact` namespace of `en.json`
    - Assert `vi.json` and `ja.json` each have a non-empty string for that key
    - **Validates: Requirements 7.2**
    - _Test file: `apps/web/src/i18n/i18n.pbt.test.ts`_

- [ ] 8. ContactForm component (frontend)
  - [~] 8.1 Create `apps/web/src/components/portfolio/ContactForm.tsx`
    - Use `useState` for field values (`name`, `email`, `subject`, `message`), `errors`, `status` (`idle` | `submitting` | `success` | `error`), and `serverError` string
    - Render fields: name (max 100), email (max 254), subject (max 150 per UI req), message (textarea, max 5000)
    - Include hidden honeypot `<input name="_hp" style={{ display: 'none', visibility: 'hidden' }} tabIndex={-1} autoComplete="off" />`
    - Apply jazz-theme visual tokens: dark background, gold accents (`text-amber-400` / equivalent theme token), `font-mono` labels
    - Single-column layout below md breakpoint; consistent column structure at md and above
    - _Requirements: 1.1, 1.5, 1.7, 1.8, 1.9, 8.4_
  - [~] 8.2 Implement client-side validation logic in `ContactForm.tsx`
    - On submit: check each required field is non-empty, display inline error adjacent to failing field; do not call API if any error
    - On email blur: validate RFC 5322 format, show inline error if invalid
    - Message character count: show `charCountWarning` when `4500 ≤ length < 5000`; prevent input and show `charCountLimit` at 5000
    - Clear individual field error when that field's value changes to satisfy its rule
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_
  - [~] 8.3 Implement form submission in `ContactForm.tsx`
    - Call `ApiClient.post('/contact', payload)` (or `fetch` with `AbortSignal.timeout(30000)`)
    - On flight: set `status = 'submitting'`, disable submit button
    - On HTTP 201: set `status = 'success'`, hide form fields, show `successTitle` + `successBody` + reset button
    - On HTTP 429: show `errorRateLimit` (with `retryAfter` seconds) or `errorRateLimitGeneric`; re-enable form
    - On HTTP 400: show `errorValidation`; re-enable form
    - On HTTP 5xx or timeout: show `errorServer`; re-enable form and preserve all field values
    - Source all strings from `useTranslations('contact')`
    - _Requirements: 1.2, 1.3, 1.4, 1.6, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1_
  - [ ]* 8.4 Write property test for ContactForm required-field validation (P4)
    - **Property 4: Required field validation fires on empty submit**
    - Use fast-check to generate all non-empty subsets of `{name, email, subject, message}` to leave empty
    - Assert each empty field displays an inline error and no `fetch`/`ApiClient` call is made
    - **Validates: Requirements 2.1**
    - _Test file: `apps/web/src/components/portfolio/contact-form.pbt.test.tsx`_
  - [ ]* 8.5 Write property test for email field validation (P5)
    - **Property 5: Invalid email triggers inline error on blur**
    - Use fast-check `fc.string()` filtered to exclude valid emails; trigger blur; assert inline error appears
    - **Validates: Requirements 2.2**
    - _Test file: `apps/web/src/components/portfolio/contact-form.pbt.test.tsx`_
  - [ ]* 8.6 Write property test for message character count boundaries (P6)
    - **Property 6: Message character count boundaries are enforced**
    - Generate message lengths in three ranges: `< 10`, `[4500, 5000)`, `≥ 5000`
    - Assert min-length error for `< 10` on submit; warning text for `[4500, 5000)`; input blocked for `≥ 5000`
    - **Validates: Requirements 2.3, 2.4, 2.5**
    - _Test file: `apps/web/src/components/portfolio/contact-form.pbt.test.tsx`_
  - [ ]* 8.7 Write property test for validation error clearing (P7)
    - **Property 7: Validation error clears when field becomes valid**
    - For each required field, trigger an error then update the field to a valid value; assert only that field's error is cleared
    - **Validates: Requirements 2.6**
    - _Test file: `apps/web/src/components/portfolio/contact-form.pbt.test.tsx`_
  - [ ]* 8.8 Write property test for locale-driven rendering (P3)
    - **Property 3: All form text is sourced from active locale translations**
    - Render `ContactForm` with each of the three locales; assert all visible text matches the locale's `contact.*` translation values; assert no raw key names are visible
    - **Validates: Requirements 1.6, 7.1, 7.5**
    - _Test file: `apps/web/src/components/portfolio/contact-form.pbt.test.tsx`_
  - [ ]* 8.9 Write property test for error response behavior (P2)
    - **Property 2: Error responses re-enable the form and preserve input**
    - Use fast-check to generate arbitrary 4xx/5xx status codes; mock `fetch`; assert submit button is re-enabled, an error message in the active locale is visible, and all field values are unchanged
    - **Validates: Requirements 1.4, 6.4**
    - _Test file: `apps/web/src/components/portfolio/contact-form.pbt.test.tsx`_

- [ ] 9. Embed ContactForm in existing Contact component
  - [~] 9.1 Update `apps/web/src/components/portfolio/Contact.tsx` to render `<ContactForm />` alongside existing email/phone/location info cards
    - Import and place `<ContactForm />` below or beside the existing contact-info cards without removing them
    - _Requirements: 1.7_

- [ ] 10. Admin Inbox page
  - [~] 10.1 Create `apps/web/src/app/[locale]/admin/contact/page.tsx`
    - Mark `'use client'`; on mount fetch `GET /api/admin/contact` with JWT from `useAuthStore`
    - Render a list of submission cards showing `senderName`, `senderEmail`, `subject`, formatted `createdAt`, and an unread indicator (visible only when `isRead === false`)
    - Show empty-state message when no submissions exist
    - _Requirements: 5.2, 5.3, 5.4, 5.8_
  - [~] 10.2 Implement submission detail panel and mark-as-read in `admin/contact/page.tsx`
    - Clicking a card selects it and renders full `messageBody` in a detail panel
    - "Mark as read" button issues `PATCH /api/admin/contact/:id/read` with optimistic UI update (flip `isRead` in local state immediately, roll back on failure with error notification)
    - _Requirements: 5.5, 5.6, 5.7_
  - [ ]* 10.3 Write property test for Admin Inbox rendering (P15)
    - **Property 15: Each inbox row renders all required fields**
    - Use fast-check to generate arrays of `ContactSubmissionDto` with varied `isRead` values
    - Assert every row shows `senderName`, `senderEmail`, `subject`, formatted `createdAt`; unread indicator shown iff `isRead === false`
    - **Validates: Requirements 5.3, 5.8**
    - _Test file: `apps/web/src/app/[locale]/admin/contact/admin-inbox.pbt.test.tsx`_

- [ ] 11. Add Admin Inbox link to admin navigation
  - [~] 11.1 Add a "Contact" / "Inbox" nav entry pointing to `/admin/contact` in the admin layout or sidebar navigation component
    - Follow the existing pattern used by categories, music, profile, and settings nav links
    - _Requirements: 5.2_

- [~] 12. Final checkpoint — full feature complete
  - Run `pnpm type-check`, `pnpm lint`, and `pnpm test` from the workspace root. Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for full traceability
- Checkpoints (tasks 6 and 12) ensure incremental validation at logical boundaries
- Property tests validate universal correctness properties; unit tests cover specific examples and edge cases
- The `sanitize-html` transform in the DTO runs before class-validator empty/length checks, so HTML-stripped-to-empty fields correctly trigger `@IsNotEmpty()` errors
- The `MAIL_PROVIDER` env var selects the concrete mail transport at startup; both Resend and Nodemailer share the same `MailProvider` interface
- The admin inbox uses optimistic UI for `isRead` updates, matching the pattern in existing admin pages
- All admin endpoints are JWT-protected via the existing `JwtAuthGuard`; the public POST endpoint is protected only by the existing throttler

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["3.1", "7.1", "7.2", "7.3"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1", "7.4"] },
    { "id": 4, "tasks": ["3.4", "4.2"] },
    { "id": 5, "tasks": ["3.5", "3.6", "3.7"] },
    { "id": 6, "tasks": ["4.3"] },
    { "id": 7, "tasks": ["4.4", "4.5", "4.6", "5.1"] },
    { "id": 8, "tasks": ["4.7", "5.2"] },
    { "id": 9, "tasks": ["8.1"] },
    { "id": 10, "tasks": ["8.2", "8.3"] },
    { "id": 11, "tasks": ["8.4", "8.5", "8.6", "8.7", "8.8", "8.9", "9.1"] },
    { "id": 12, "tasks": ["10.1"] },
    { "id": 13, "tasks": ["10.2", "11.1"] },
    { "id": 14, "tasks": ["10.3"] }
  ]
}
```
