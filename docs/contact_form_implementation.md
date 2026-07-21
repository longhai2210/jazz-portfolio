# 🎷 Contact Form & Email Integration: Full Feature Implementation Guide

This document provides a comprehensive walkthrough of the **Contact Form with Email Integration & Admin Settings** feature. It is written to help any developer understand exactly how the data flows, how the codebase is organized, and how each component operates.

---

## 🗺️ 1. Architecture & Data Flow

When a visitor lands on the portfolio page and submits a message, the system routes data through multiple packages and services. Here is the high-level workflow:

```
[ Visitor UI: ContactForm.tsx ]
       │ (1) Validate inputs & honeypot client-side
       │ (2) POST /api/contact
       ▼
[ Backend API: ContactController ]
       │ (3) Enforce Rate Limit (ThrottlerGuard)
       │ (4) Sanitize HTML & Validate DTO
       ▼
[ Backend Service: ContactService ]
       │ (5) Save to Database (Prisma)
       │
       ├─────────────────────────────────────────┐
       ▼ (6) If DB write succeeds                ▼ (7) If DB write fails
[ MailService ]                            [ Return HTTP 500 ]
       │
       ├─► (Active Provider: Resend) ──► Send API request
       ├─► (Active Provider: SMTP)   ──► Send via Transporter
       │
       ▼ (8) Check email dispatch
[ Return HTTP 201 with emailDelivered flag ]
```

---

## 🗄️ 2. Database Layer

We introduced two new models in the PostgreSQL database using Prisma ORM.

### 1. `ContactSubmission` (Form submissions log)
Stores the messages sent by visitors.
- **`id`** (UUID, PK): Auto-generated.
- **`senderName`** (VARCHAR(100)): Sanitized name of the sender.
- **`senderEmail`** (VARCHAR(254)): Validated email address.
- **`subject`** (VARCHAR(200)): Message topic.
- **`messageBody`** (VARCHAR(5000)): The main body content.
- **`isRead`** (BOOLEAN, default: `false`): Toggled when the admin views the message.

### 2. `SiteSettings` (Single-row system configurations)
Stores settings that can be toggled by the admin at runtime.
- **`id`** (UUID, PK): Fixed value (`"default"`) to enforce a single-row constraint.
- **`isContactFormEnabled`** (BOOLEAN, default: `true`): Toggles the public contact form.
- **`mailProvider`** (VARCHAR, default: `"resend"`): Active provider (`"resend"` or `"smtp"`).
- **`mailFrom`** (VARCHAR): Custom sender email address.
- **`mailTo`** (VARCHAR): Target email address for notifications.

---

## ⚙️ 3. Backend Implementation Detail

The backend code is divided into two modules: the **Contact Module** and the **Settings Module**.

### 1. Request Sanitization & Safety
Before any message is processed:
- **Honeypot (`_hp`):** A hidden input field on the form. If automated bots fill it out, the backend rejects the request immediately with an HTTP 400 error.
- **HTML Sanitization:** All text inputs are processed using `sanitize-html` to strip any HTML tags, preventing Cross-Site Scripting (XSS) injections.
- **Length Validations:** Limits are checked (name max 100, subject max 200, message max 5000) using NestJS `class-validator` pipes.

### 2. Mail Delivery Engine (`MailService`)
The mailing engine manages the delivery of notifications to your inbox.
- **Dynamic Configuration:** During startup, `SettingsService` hooks into NestJS `OnModuleInit` to fetch the configuration from the database and updates `MailService` using `updateConfig()`. This solves the issue of NestJS providers booting up before database connections are ready.
- **Retry Logic:** If a mail provider returns a transient error (e.g., rate limit 429, timeout, network failure), `MailService` retries the delivery up to **4 times** with a **5-second delay** before failing.
- **Fallback Configurations:** If database settings are empty, the mail service falls back to env vars (`MAIL_TO`, `MAIL_FROM`, `RESEND_API_KEY`, etc.).

---

## 🎨 4. Frontend & User Interface

The frontend is built on Next.js 15 with Tailwind CSS and next-intl for localization.

### 1. The Contact Form (`ContactForm.tsx`)
- **Interactive State Machine:** Displays one of four states: `'idle'` (ready), `'submitting'` (disabled with loader), `'success'` (check icon & reset button), or `'error'` (glowing red validation box).
- **Dynamic Character Counter:** Tracks message lengths. When the length exceeds 4,500 characters, it displays a warnings badge (`"{remaining} characters remaining"`); at 5,000 characters, it blocks input.
- **Strict Validations:** Checks RFC 5322 email patterns on blur, clearing warning fields on active typing updates.

### 2. Toggleable Rendering (`Contact.tsx`)
The `Contact` wrapper receives `isContactFormEnabled` from the homepage:
```typescript
{isContactFormEnabled && (
  <ScrollReveal>
    <ContactForm />
  </ScrollReveal>
)}
```
When disabled, the form is hidden, but visitors can still see your static contacts (email, phone, location cards).

---

## 📬 5. Admin Settings & Inbox Panels

The CMS features two panels to manage settings and submissions.

### 1. System Settings Tab (`admin/settings/page.tsx`)
We split the admin settings into a tabbed layout:
- **Security Tab:** Manage password updates.
- **Email Settings Tab:**
  - Toggle form visibility (`isContactFormEnabled`).
  - Configure active mail providers and addresses.
  - Review credentials setup status (audits environment variables for SMTP or Resend setup).
  - Test routing via the "⚡ Send Test Email" trigger.

### 2. Message Inbox Page (`admin/contact/page.tsx`)
A split-pane dashboard:
- **Left Panel:** Scrollable list of messages ordered by date (newest first). Unread messages feature a glowing gold indicator.
- **Right Panel:** Detail view of the selected message containing sender headers, formatted received dates, full body, and a quick-reply action button.
- **Optimistic UI Updates:** Clicking an unread message immediately toggles `isRead` to `true` in the UI while executing the API request in the background. If the request fails, the UI rolls back automatically.

---

## 🛠️ 6. Troubleshooting & Operations

### How to test email configurations locally:
1. Ensure your local `.env` has appropriate keys (e.g. `RESEND_API_KEY` or SMTP parameters).
2. Start the services using `pnpm dev`.
3. Open `http://localhost:3000/en/admin/settings`, navigate to the **Email Settings** tab, configure the sender/recipient, and click **⚡ Send Test Email**.
4. Check your inbox for the test message.
