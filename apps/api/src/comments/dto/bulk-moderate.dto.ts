import { ArrayNotEmpty, IsArray, IsEnum, IsString } from 'class-validator';
import { CommentStatus } from '@jazz-portfolio/shared';

export class BulkModerateDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];

  @IsEnum(CommentStatus)
  status!: CommentStatus;
}

