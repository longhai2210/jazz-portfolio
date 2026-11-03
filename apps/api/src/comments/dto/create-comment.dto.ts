import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';

const sanitizeText = (val: unknown) => {
  if (typeof val !== 'string') return val;
  return sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }).trim();
};

export class CreateCommentDto {
  @IsString()
  postId!: string;

  @IsString()
  @Length(2, 60)
  @Transform(({ value }) => sanitizeText(value))
  authorName!: string;

  @IsEmail()
  @MaxLength(254)
  @Transform(({ value }) => value?.trim().toLowerCase())
  authorEmail!: string;

  @IsString()
  @Length(2, 2000)
  @Transform(({ value }) => sanitizeText(value))
  content!: string;

  @IsString()
  commentToken!: string;


  @IsOptional()
  @IsString()
  captchaToken?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}
