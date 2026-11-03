import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import sanitizeHtml from 'sanitize-html';
import { PostStatus } from '@jazz-portfolio/shared';

const sanitizeText = (val: unknown) => {
  if (typeof val !== 'string') return val;
  return sanitizeHtml(val, { allowedTags: [], allowedAttributes: {} }).trim();
};

export class LocalizedStringDto {
  @IsString()
  @Transform(({ value }) => sanitizeText(value))
  en!: string;

  @IsString()
  @Transform(({ value }) => sanitizeText(value))
  vi!: string;

  @IsString()
  @Transform(({ value }) => sanitizeText(value))
  ja!: string;
}

export class RawLocalizedStringDto {
  @IsString()
  en!: string;

  @IsString()
  vi!: string;

  @IsString()
  ja!: string;
}

export class CreatePostDto {
  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug must contain only lowercase alphanumeric characters and hyphens',
  })
  slug!: string;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;

  @ValidateNested()
  @Type(() => LocalizedStringDto)
  excerpt!: LocalizedStringDto;

  /** Content is Markdown authored by admin — sanitized at render time in RSC, so no tag stripping here */
  @ValidateNested()
  @Type(() => RawLocalizedStringDto)
  content!: RawLocalizedStringDto;


  @IsOptional()
  @IsString()
  coverImageUrl?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @ArrayMaxSize(8)
  tags?: string[];

  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;

  @IsOptional()
  @IsBoolean()
  areCommentsEnabled?: boolean;
}
