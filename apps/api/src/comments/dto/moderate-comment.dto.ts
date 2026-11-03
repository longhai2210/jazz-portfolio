import { IsEnum } from 'class-validator';
import { CommentStatus } from '@jazz-portfolio/shared';

export class ModerateCommentDto {
  @IsEnum(CommentStatus)
  status!: CommentStatus;
}

