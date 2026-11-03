import {
  BlocklistType,
  CategoryType,
  CommentModerationMode,
  CommentStatus,
  PostStatus,
} from '../enums';

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

// === Posts ===
export interface PostListItemDto {
  id: string;
  slug: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  coverImageUrl: string | null;
  tags: string[];
  readingMinutes: number;
  commentCount: number;
  publishedAt: string | null;
}

/** Public detail — adds body, never exposes counters used for moderation. */
export interface PostDetailDto extends PostListItemDto {
  content: LocalizedString;
  areCommentsEnabled: boolean;
  commentsClosed: boolean;
}

/** Admin view — adds lifecycle + soft-delete state. */
export interface AdminPostDto extends PostDetailDto {
  status: PostStatus;
  viewCount: number;
  commentsClosedAt: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostRequest {
  slug: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  content: LocalizedString;
  coverImageUrl?: string | null;
  tags?: string[];
  status?: PostStatus;
  areCommentsEnabled?: boolean;
}

export type UpdatePostRequest = Partial<CreatePostRequest>;

// === Comments ===
/** Public shape. NOTE: no email, no ipAddress, no spam fields. */
export interface PublicCommentDto {
  id: string;
  parentId: string | null;
  authorName: string;
  content: string;
  createdAt: string;
  replies?: PublicCommentDto[];
}

export interface AdminCommentDto extends Omit<PublicCommentDto, 'replies'> {
  postId: string;
  postSlug: string;
  postTitleEn?: string;
  authorEmail: string;
  status: CommentStatus;
  spamScore: number;
  blockReason?: string | null;
  ipAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommentTokenDto {
  token: string;
  expiresAt: string;
}

export interface CreateCommentRequest {
  postId: string;
  parentId?: string | null;
  commentToken: string;
  authorName: string;
  authorEmail: string;
  content: string;
  captchaToken?: string;
}

export interface CreateCommentResponseDto {
  id: string;
  status: CommentStatus;
  message: string;
}

export interface ModerateCommentRequest {
  status: CommentStatus;
}

export interface BulkModerateRequest {
  ids: string[];
  status: CommentStatus;
}

export interface CommentBlocklistDto {
  id: string;
  type: BlocklistType;
  value: string;
  pattern?: string | null;
  isActive?: boolean;
  createdAt: string;
  updatedAt?: string;
}


export interface CreateBlocklistItemRequest {
  type: BlocklistType;
  value: string;
  pattern?: string;
}


// === Feature Settings ===
export interface FeatureSettingsDto {
  isBlogEnabled: boolean;
  areCommentsEnabled: boolean;
  commentModerationMode: CommentModerationMode;
  isCommentCaptchaEnabled: boolean;
  commentAutoCloseDays: number;
  commentMaxPerPost: number;
  commentSpamThreshold: number;
  commentNotifyEmail: boolean;
  updatedAt: string;
}

export type UpdateFeatureSettingsDto = Partial<Omit<FeatureSettingsDto, 'updatedAt'>>;

export interface FeatureSettingsStatusDto {
  captchaConfigured: boolean;   // TURNSTILE_SECRET_KEY present
  tokenSecretConfigured: boolean;
  ipSaltConfigured: boolean;
  pendingCommentCount: number;
}

export interface PublicSettingsDto {
  isContactFormEnabled: boolean;
  isBlogEnabled: boolean;
  areCommentsEnabled: boolean;
  isCommentCaptchaEnabled: boolean;
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
  publishedPosts?: number;
  draftPosts?: number;
  pendingComments?: number;
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
