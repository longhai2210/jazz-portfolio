-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "is_contact_form_enabled" BOOLEAN NOT NULL DEFAULT true,
    "mail_provider" TEXT NOT NULL DEFAULT 'resend',
    "mail_from" TEXT NOT NULL DEFAULT '',
    "mail_to" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);
