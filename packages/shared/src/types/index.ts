import { CategoryType } from '../enums';

// === Multilingual Content ===
export interface LocalizedString {
  en: string;
  vi: string;
  ja: string;
}

export type Locale = 'en' | 'vi' | 'ja';

// === Profile ===
export interface ProfileDto {
  id: string;
  name: LocalizedString;
  title: LocalizedString;
  introduction: LocalizedString;
  bio: LocalizedString;
  avatarUrl: string | null;
  backgroundUrl: string | null;
  socialLinks: Record<string, string>;
  contactInfo: Record<string, string>;
  isMusicEnabled: boolean;
  updatedAt: string;
}


// === Category ===
export interface CategoryDto {
  id: string;
  name: LocalizedString;
  slug: string;
  type: CategoryType;
  sortOrder: number;
  isActive: boolean;
  items?: CategoryItemDto[];
}

export interface CategoryItemDto {
  id: string;
  categoryId: string;
  title: LocalizedString;
  description: LocalizedString;
  metadata: Record<string, unknown>;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
}

// === Music ===
export interface TrackDto {
  id: string;
  title: string;
  artist: string;
  cloudfrontUrl: string;
  durationSeconds: number;
  sortOrder: number;
  isActive: boolean;
}

// === Auth ===
export interface LoginDto {
  username: string;
  password: string;
}

/** Login / session identity — JWT lives in httpOnly cookie, not in the body. */
export interface AuthResponseDto {
  username: string;
}

export interface AuthUserDto {
  id: string;
  username: string;
}

// === Contact Form ===
export interface ContactSubmissionDto {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  messageBody: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

/** List row: omits full messageBody to keep inbox payloads small. */
export interface ContactSubmissionListItemDto {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateContactSubmissionResponseDto {
  id: string;
  createdAt: string;
  /** True when a notification send was queued (fire-and-forget; not SMTP confirmation). */
  emailDelivered: boolean;
}

// === Pagination ===
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// === Settings ===
export interface SiteSettingsDto {
  id: string;
  isContactFormEnabled: boolean;
  mailProvider: string;
  mailFrom: string;
  mailTo: string;
  updatedAt: string;
}

export interface UpdateSiteSettingsDto {
  isContactFormEnabled?: boolean;
  mailProvider?: string;
  mailFrom?: string;
  mailTo?: string;
}

export interface MailStatusDto {
  provider: string;
  isConfigured: boolean;
  hasApiKey: boolean;
  hasSmtpCredentials: boolean;
}

// === Admin Dashboard ===
export interface AdminStatsDto {
  categories: number;
  items: number;
  tracks: number;
}

// === API Response ===
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string;
  error?: string;
}
