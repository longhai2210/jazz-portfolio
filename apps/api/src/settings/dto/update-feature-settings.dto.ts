import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { CommentModerationMode } from '@jazz-portfolio/shared';

export class UpdateFeatureSettingsDto {
  @IsOptional()
  @IsBoolean()
  isBlogEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  areCommentsEnabled?: boolean;

  @IsOptional()
  @IsEnum(CommentModerationMode)
  commentModerationMode?: CommentModerationMode;

  @IsOptional()
  @IsBoolean()
  isCommentCaptchaEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  commentAutoCloseDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  commentMaxPerPost?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  commentSpamThreshold?: number;

  @IsOptional()
  @IsBoolean()
  commentNotifyEmail?: boolean;
}
