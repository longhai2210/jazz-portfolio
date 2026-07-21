import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEmpty,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import sanitizeHtml from 'sanitize-html';

export class CreateContactSubmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => sanitizeHtml(value as string, { allowedTags: [], allowedAttributes: {} }))
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @Transform(({ value }) => sanitizeHtml(value as string, { allowedTags: [], allowedAttributes: {} }))
  subject!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(5000)
  @Transform(({ value }) => sanitizeHtml(value as string, { allowedTags: [], allowedAttributes: {} }))
  message!: string;

  // Honeypot — must be absent or empty
  @IsOptional()
  @IsEmpty()
  _hp?: string;
}
