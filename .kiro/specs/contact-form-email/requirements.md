# Requirements Document

## Introduction

This feature adds an interactive contact form to the jazz portfolio's existing Contact section, enabling visitors to send messages directly to the site owner via email. The form integrates with a transactional email provider (e.g., Resend or Nodemailer/SMTP), persists submissions in the database for audit purposes, and exposes an admin inbox view for reviewing received messages. The feature is multilingual (EN, VI, JA) and follows all existing jazz-theme design conventions.

## Glossary

- **Contact_Form**: The client-side React form rendered inside the `Contact` component in `apps/web`.
- **Contact_API**: The NestJS `/api/contact` endpoint in `apps/api` that receives and processes form submissions.
- **Mail_Service**: The NestJS service responsible for sending outbound email via a transactional email provider.
- **Contact_Submission**: A persisted record of a form submission stored in the PostgreSQL database.
- **Admin_Inbox**: The admin CMS page at `/admin/contact` that lists and displays received Contact_Submissions.
- **Rate_Limiter**: The existing `@nestjs/throttler` guard applied per-IP to prevent submission abuse.
- **Visitor**: An unauthenticated user browsing the public portfolio.
- **Admin**: The authenticated site owner accessing the admin CMS panel.
- **Locale**: One of the three supported language codes: `en`, `vi`, or `ja`.

---

## Requirements

### Requirement 1: Contact Form UI

**User Story:** As a Visitor, I want to fill in and submit a contact form on the portfolio website, so that I can send a message to the site owner without leaving the page.

#### Acceptance Criteria

1. THE Contact_Form SHALL render the following fields: sender name (required, max 100 characters), sender email (required, max 254 characters), subject (required, max 150 characters), and message body (required, max 2000 characters).
2. WHEN a Visitor submits the Contact_Form with all required fields filled, THE Contact_Form SHALL display a loading indicator and SHALL disable the submit button for a maximum of 30 seconds while the submission is in progress, preventing duplicate submissions.
3. WHEN the Contact_API returns HTTP 201, THE Contact_Form SHALL replace the form with a success message in the active Locale and SHALL provide a reset control that clears all fields and returns the form to its initial empty state.
4. WHEN the Contact_API returns any non-201 response or the request times out, THE Contact_Form SHALL re-enable the submit button and SHALL display an error message in the active Locale.
5. WHILE the viewport width is below 768px (md breakpoint), THE Contact_Form SHALL render all fields in a single-column layout stacked vertically.
6. WHEN the Contact_Form is rendered, THE Contact_Form SHALL display all labels, placeholders, and status messages in the active Locale.
7. THE Contact_Form SHALL integrate into the existing `Contact` component without replacing the existing email, phone, and location contact-info cards.
8. WHILE the viewport width is 768px (md breakpoint) or above, THE Contact_Form SHALL render in a layout consistent with the surrounding portfolio section column structure.
9. THE Contact_Form SHALL apply the existing jazz-theme visual tokens (dark background, gold accents, font-mono labels).

---

### Requirement 2: Client-Side Validation

**User Story:** As a Visitor, I want immediate feedback when I enter invalid data, so that I can correct mistakes before submitting the form.

#### Acceptance Criteria

1. WHEN a required field is empty and the Visitor attempts to submit the Contact_Form, THE Contact_Form SHALL display an inline validation error message adjacent to that field.
2. WHEN the sender email field contains a value that does not conform to RFC 5322 email format and the field loses focus, THE Contact_Form SHALL display an inline validation error message adjacent to that field.
3. WHEN the message body contains fewer than 10 characters and the Visitor attempts to submit the Contact_Form, THE Contact_Form SHALL display an inline validation error stating the minimum length requirement.
4. WHEN the message body character count reaches 4500 characters, THE Contact_Form SHALL display a character-count warning adjacent to the message field indicating how many characters remain before the limit.
5. WHEN the message body character count reaches 5000 characters, THE Contact_Form SHALL prevent additional character input and SHALL display a character-count indicator showing the limit has been reached.
6. WHEN a field that previously had a validation error is updated to a value that satisfies that field's validation rule, THE Contact_Form SHALL clear the inline validation error for that field.

---

### Requirement 3: Form Submission API

**User Story:** As a Visitor, I want my submitted message to be reliably received by the site owner, so that my inquiry is not lost.

#### Acceptance Criteria

1. WHEN the Contact_Form submits valid data, THE Contact_API SHALL accept HTTP POST requests to `/api/contact` without requiring authentication.
2. THE Contact_API SHALL validate the request body using `class-validator`; IF any of the required fields (`name`, `email`, `message`) are missing or fail validation, THEN THE Contact_API SHALL reject the request with HTTP 400 and a descriptive error message identifying the failing fields.
3. WHEN a valid submission is received, THE Contact_API SHALL persist a Contact_Submission record to the PostgreSQL database before attempting to send email.
4. WHEN a valid submission is received, THE Contact_API SHALL invoke the Mail_Service to send a notification email to the site owner's configured address.
5. WHEN the Mail_Service successfully delivers the notification email, THE Contact_API SHALL return HTTP 201 with a success payload `{ data: { id, createdAt: "<ISO 8601 UTC>", emailDelivered: true } }`.
6. IF the Mail_Service fails to deliver the notification email, THEN THE Contact_API SHALL still return HTTP 201 with payload `{ data: { id, createdAt: "<ISO 8601 UTC>", emailDelivered: false } }` (the submission has been persisted).
7. THE Contact_API SHALL apply the existing Rate_Limiter, allowing a maximum of 5 submissions per IP address within any 60-second window, and SHALL return HTTP 429 when this limit is exceeded.
8. IF persisting the Contact_Submission to the database fails, THEN THE Contact_API SHALL return HTTP 500 and SHALL NOT invoke the Mail_Service.

---

### Requirement 4: Email Notification

**User Story:** As an Admin, I want to receive an email notification when a visitor submits the contact form, so that I can respond promptly.

#### Acceptance Criteria

1. WHEN a Contact_Submission is successfully persisted by the Contact_API, THE Mail_Service SHALL send a notification email addressed to the `MAIL_TO` environment variable and from the `MAIL_FROM` environment variable, including the sender's name, sender's email address, subject, message body, and submission timestamp in ISO 8601 UTC format.
2. THE Mail_Service SHALL use the SMTP credentials or API key configured in the environment variables to authenticate with the email provider.
3. WHEN the application starts and any of `MAIL_TO`, `MAIL_FROM`, or required email provider credentials are not set, THE Mail_Service SHALL log a startup configuration error and the Contact_API SHALL return HTTP 503 for any submission request until the configuration is corrected.
4. IF the email provider returns a transient error during delivery, THEN THE Mail_Service SHALL retry the delivery up to 3 times with a 5-second interval between attempts before treating the failure as non-recoverable.
5. IF the email provider returns a non-recoverable error (such as invalid credentials, rejected sender, or permanent delivery failure) or all retry attempts are exhausted, THEN THE Mail_Service SHALL throw a structured exception that the Contact_API exception handler can capture and log.

---

### Requirement 5: Submission Persistence and Admin Inbox

**User Story:** As an Admin, I want to view all received contact form submissions in the CMS, so that I can manage and review messages even if an email was delayed or missed.

#### Acceptance Criteria

1. THE Contact_API SHALL store each Contact_Submission with the fields: `id` (UUID), `senderName` (max 100 characters), `senderEmail` (max 254 characters), `subject` (max 200 characters), `messageBody` (max 5000 characters), `isRead` (boolean, default false), `createdAt`, and `updatedAt`.
2. WHEN an Admin accesses the Admin_Inbox, THE Admin_Inbox SHALL retrieve Contact_Submissions from `GET /api/admin/contact` (JWT-protected) sorted by `createdAt` descending.
3. WHILE the Admin_Inbox is displayed and Contact_Submissions are present, THE Admin_Inbox SHALL display each Contact_Submission's sender name, sender email, subject, and submission date in a list view.
4. WHEN the Admin_Inbox is displayed and no Contact_Submissions exist, THE Admin_Inbox SHALL display an empty-state message indicating no messages have been received.
5. WHEN an Admin selects a Contact_Submission in the Admin_Inbox list, THE Admin_Inbox SHALL display the full message body of that submission.
6. WHEN an Admin marks a Contact_Submission as read, THE Admin_Inbox SHALL send `PATCH /api/admin/contact/:id/read` (JWT-protected) and SHALL update the `isRead` flag in the database.
7. IF the `PATCH /api/admin/contact/:id/read` request fails, THEN THE Admin_Inbox SHALL retain the previous `isRead` state in the UI and SHALL display an error notification to the Admin.
8. WHILE the Admin_Inbox is displayed, each Contact_Submission row SHALL show a visible unread indicator when `isRead` is false and SHALL not show the unread indicator when `isRead` is true.

---

### Requirement 6: Submission Feedback to Visitor

**User Story:** As a Visitor, I want clear feedback after submitting the contact form, so that I know whether my message was received.

#### Acceptance Criteria

1. WHEN the Contact_API returns HTTP 201, THE Contact_Form SHALL replace the form fields with a success message in the active Locale confirming the message was sent.
2. WHEN the Contact_API returns HTTP 429, THE Contact_Form SHALL display a rate-limit error message in the active Locale; IF the API response includes a `retryAfter` value, THEN the message SHALL specify that duration, OTHERWISE the message SHALL instruct the Visitor to try again later.
3. WHEN the Contact_API returns HTTP 400, THE Contact_Form SHALL display a generic validation error message in the active Locale.
4. WHEN the Contact_API returns any HTTP 5xx status, THE Contact_Form SHALL display a server-error message in the active Locale and SHALL preserve the Visitor's form input so that no data is lost.
5. WHILE the success state is displayed, THE Contact_Form SHALL show a button that, when clicked, clears all fields and returns the form to its initial empty state.
6. WHEN a form submission is in flight, THE Contact_Form SHALL display a loading/submitting indicator and SHALL disable the submit button until a response is received or the request times out.

---

### Requirement 7: Internationalization

**User Story:** As a Visitor browsing in any supported language, I want the contact form to be fully translated, so that the experience feels native to my locale.

#### Acceptance Criteria

1. THE Contact_Form SHALL source all visible strings (labels, placeholders, validation messages, success/error feedback) from the `next-intl` translation files for each Locale.
2. WHEN translation keys for the contact form are added, THE translation files for all three Locales (`en.json`, `vi.json`, `ja.json`) SHALL contain a non-empty translated string for every key.
3. WHEN the active Locale changes while the Contact_Form is rendered, THE Contact_Form SHALL display updated strings matching the new Locale without requiring a full page reload.
4. IF the locale-switching mechanism encounters an error while the Contact_Form is rendered, THEN THE Contact_Form SHALL display strings in the previously active Locale and SHALL not display untranslated key names.
5. IF a translation key required by the Contact_Form is missing from the active Locale's translation file, THEN THE Contact_Form SHALL fall back to the English (`en`) translation for that key and SHALL not display the raw key name to the Visitor.

---

### Requirement 8: Security and Spam Protection

**User Story:** As an Admin, I want the contact form to be protected against automated spam and abuse, so that the inbox remains manageable.

#### Acceptance Criteria

1. THE Contact_API SHALL sanitize all text fields in the request body to strip HTML tags before persisting or emailing the data.
2. WHERE a honeypot field is present in the request body, THE Contact_API SHALL reject any submission in which the honeypot field is non-empty with HTTP 400.
3. THE Contact_API SHALL enforce the following maximum field lengths: sender name 100 characters, sender email 254 characters, subject 200 characters, and message body 5000 characters, rejecting requests that exceed any of these limits with HTTP 400.
4. THE Contact_Form SHALL include a hidden honeypot input field styled with `display: none` and `visibility: hidden` so that it is not visible to human visitors but will be auto-filled by bots.
5. IF a submission's honeypot field is non-empty or a field length limit is exceeded, THEN THE Contact_API SHALL return HTTP 400 without persisting the Contact_Submission or invoking the Mail_Service.
6. IF sanitizing a text field results in an empty string after HTML stripping, THEN THE Contact_API SHALL treat the field as empty and SHALL return HTTP 400 with a descriptive validation error.
