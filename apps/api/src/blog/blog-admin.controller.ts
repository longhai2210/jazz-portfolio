import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
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
import { BlogService } from './blog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminPostDto, PaginatedResponse } from '@jazz-portfolio/shared';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@ApiTags('Blog Admin')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('blog/admin/posts')
export class BlogAdminController {
  constructor(private readonly blogService: BlogService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated blog posts for admin management' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, example: 'PUBLISHED' })
  @ApiQuery({ name: 'includeDeleted', required: false, example: false })
  @ApiResponse({ status: 200, description: 'Admin post list returned' })
  async getPosts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('includeDeleted', new DefaultValuePipe(false), ParseBoolPipe)
    includeDeleted?: boolean,
  ): Promise<PaginatedResponse<AdminPostDto>> {
    return this.blogService.getAdminPosts(page, limit, status, includeDeleted);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new blog post (defaults to DRAFT)' })
  @ApiResponse({ status: 201, description: 'Post created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createPost(@Body() dto: CreatePostDto): Promise<AdminPostDto> {
    return this.blogService.createPost(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single post detail by ID for editing (Admin)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Post detail returned' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async getPostById(@Param('id') id: string): Promise<AdminPostDto> {
    return this.blogService.getAdminPostById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update post content, slug, or metadata' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Post updated successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async updatePost(
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<AdminPostDto> {
    return this.blogService.updatePost(id, dto);
  }

  @Patch(':id/publish')
  @ApiOperation({ summary: 'Publish a draft post' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Post published successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async publishPost(@Param('id') id: string): Promise<AdminPostDto> {
    return this.blogService.publishPost(id);
  }

  @Patch(':id/unpublish')
  @ApiOperation({ summary: 'Unpublish a post (revert to DRAFT)' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Post unpublished successfully' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async unpublishPost(@Param('id') id: string): Promise<AdminPostDto> {
    return this.blogService.unpublishPost(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a post' })
  @ApiParam({ name: 'id' })
  @ApiResponse({ status: 200, description: 'Post soft deleted' })
  @ApiResponse({ status: 404, description: 'Post not found' })
  async deletePost(@Param('id') id: string): Promise<{ success: boolean }> {
    return this.blogService.deletePost(id);
  }
}
