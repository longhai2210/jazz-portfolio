import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModerateCommentDto } from './dto/moderate-comment.dto';
import { BulkModerateDto } from './dto/bulk-moderate.dto';
import { CreateBlocklistItemDto } from './dto/create-blocklist-item.dto';
import {
  AdminCommentDto,
  CommentBlocklistDto,
  PaginatedResponse,
} from '@jazz-portfolio/shared';

@ApiTags('Comments Admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('admin/comments')
export class CommentsAdminController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated comments for admin moderation queue' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, example: 'PENDING' })
  @ApiQuery({ name: 'postId', required: false })
  @ApiResponse({ status: 200, description: 'Comments list returned' })
  async getComments(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('postId') postId?: string,
  ): Promise<PaginatedResponse<AdminCommentDto>> {
    return this.commentsService.getAdminComments(page, limit, status, postId);
  }

  @Patch(':id/moderate')
  @ApiOperation({ summary: 'Update comment moderation status (APPROVE / REJECT / SPAM)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Comment status updated' })
  async moderateComment(
    @Param('id') id: string,
    @Body() dto: ModerateCommentDto,
  ): Promise<AdminCommentDto> {
    return this.commentsService.moderateComment(id, dto.status);
  }

  @Post('bulk-moderate')
  @ApiOperation({ summary: 'Bulk update moderation status for multiple comments' })
  @ApiResponse({ status: 200, description: 'Comments status updated' })
  async bulkModerate(
    @Body() dto: BulkModerateDto,
  ): Promise<{ updatedCount: number }> {
    return this.commentsService.bulkModerateComments(dto.ids, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a comment' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Comment deleted' })
  async deleteComment(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.commentsService.deleteComment(id);
  }

  // === Blocklist Endpoints ===

  @Get('blocklist')
  @ApiOperation({ summary: 'Get all active blocklist rules' })
  @ApiResponse({ status: 200, description: 'Blocklist rules returned' })
  async getBlocklist(): Promise<CommentBlocklistDto[]> {
    return this.commentsService.getBlocklist();
  }

  @Post('blocklist')
  @ApiOperation({ summary: 'Add a new blocklist rule (keyword, IP, email, domain)' })
  @ApiResponse({ status: 201, description: 'Blocklist rule created' })
  async createBlocklistItem(
    @Body() dto: CreateBlocklistItemDto,
  ): Promise<CommentBlocklistDto> {
    return this.commentsService.createBlocklistItem(dto);
  }

  @Delete('blocklist/:id')
  @ApiOperation({ summary: 'Delete a blocklist rule by ID' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Blocklist rule deleted' })
  async deleteBlocklistItem(
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.commentsService.deleteBlocklistItem(id);
  }
}
