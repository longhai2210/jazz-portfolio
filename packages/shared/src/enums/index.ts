export enum CategoryType {
  SKILL = 'SKILL',
  EXPERIENCE = 'EXPERIENCE',
  EDUCATION = 'EDUCATION',
  CUSTOM = 'CUSTOM',
}

export enum PostStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum CommentStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  SPAM = 'SPAM',
  REJECTED = 'REJECTED',
}

export enum CommentModerationMode {
  ALL = 'ALL',
  SPAM_ONLY = 'SPAM_ONLY',
  CLOSED = 'CLOSED',
}

export enum BlocklistType {
  EMAIL = 'EMAIL',
  EMAIL_DOMAIN = 'EMAIL_DOMAIN',
  IP_HASH = 'IP_HASH',
  KEYWORD = 'KEYWORD',
}
