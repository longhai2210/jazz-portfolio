export class ContactSubmissionDto {
  id!: string;
  senderName!: string;
  senderEmail!: string;
  subject!: string;
  messageBody!: string;
  isRead!: boolean;
  createdAt!: string; // ISO 8601 UTC
  updatedAt!: string; // ISO 8601 UTC
}

/** Inbox list row — full messageBody is only on detail endpoints. */
export class ContactSubmissionListItemDto {
  id!: string;
  senderName!: string;
  senderEmail!: string;
  subject!: string;
  isRead!: boolean;
  createdAt!: string;
  updatedAt!: string;
}

export class CreateContactSubmissionResponseDto {
  id!: string;
  createdAt!: string; // ISO 8601 UTC
  emailDelivered!: boolean;
}
