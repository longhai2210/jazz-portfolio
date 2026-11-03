import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Ip,
  Headers,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { CommentsService } from './comments.service';
import { FeatureFlagGuard } from '../common/feature-flag/feature-flag.guard';
import { RequireFeature } from '../common/feature-flag/require-feature.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentStatus, PaginatedResponse, PublicCommentDto } from '@jazz-portfolio/shared';

@ApiTags('Comments')
@UseGuards(FeatureFlagGuard)
@RequireFeature('comments', { notFoundWhenOff: true })
@Controller('blog')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:slug/comment-token')
  @ApiOperation({ summary: 'Get short-lived HMAC security token to submit a comment' })
  @ApiResponse({ status: 200, description: 'Security token generated' })
  @ApiResponse({ status: 404, description: 'Post not found or comments disabled' })
  async getCommentToken(
    @Param('slug') slug: string,
    @Ip() ip: string,
  ): Promise<{ token: string; expiresAt: string }> {
    return this.commentsService.getCommentToken(slug, ip);
  }

  @Get('posts/:slug/comments')
  @ApiOperation({ summary: 'Get paginated list of approved comments for a blog post' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiResponse({ status: 200, description: 'Approved comments list returned' })
  async getPublicComments(
    @Param('slug') slug: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
  ): Promise<PaginatedResponse<PublicCommentDto>> {
    return this.commentsService.getPublicComments(slug, page);
  }

  @Post('comments')
  @UseGuards(ThrottlerGuard, FeatureFlagGuard)
  @RequireFeature('comments', { notFoundWhenOff: false })
  @ApiOperation({ summary: 'Submit a new comment (rate-limited, spam-shielded)' })
  @ApiResponse({ status: 201, description: 'Comment submitted' })
  @ApiResponse({ status: 403, description: 'Invalid token, rate limit, or spam shield reject' })
  async submitComment(
    @Body() dto: CreateCommentDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent = '',
  ): Promise<{ id: string; status: CommentStatus; message: string }> {
    return this.commentsService.submitComment(dto, ip, userAgent);
  }
}
