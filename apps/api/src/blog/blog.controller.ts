import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { FeatureFlagGuard } from '../common/feature-flag/feature-flag.guard';
import { RequireFeature } from '../common/feature-flag/require-feature.decorator';
import {
  PaginatedResponse,
  PostDetailDto,
  PostListItemDto,
} from '@jazz-portfolio/shared';

@ApiTags('Blog')
@UseGuards(FeatureFlagGuard)
@RequireFeature('blog', { notFoundWhenOff: true })
@Controller('blog')
export class BlogController {
  constructor(private readonly blogService: BlogService) {}

  @Get('posts')
  @ApiOperation({ summary: 'Get paginated list of published blog posts' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'tag', required: false, example: 'jazz' })
  @ApiResponse({ status: 200, description: 'Published posts list returned' })
  @ApiResponse({ status: 404, description: 'Blog feature disabled' })
  async getPosts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('tag') tag?: string,
  ): Promise<PaginatedResponse<PostListItemDto>> {
    return this.blogService.getPublicPosts(page, limit, tag);
  }

  @Get('posts/:slug')
  @ApiOperation({ summary: 'Get single published post detail by slug' })
  @ApiResponse({ status: 200, description: 'Post detail returned' })
  @ApiResponse({ status: 404, description: 'Post not found or blog feature disabled' })
  async getPostBySlug(
    @Param('slug') slug: string,
  ): Promise<PostDetailDto> {
    return this.blogService.getPublicPostBySlug(slug);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get distinct tags with counts for published posts' })
  @ApiResponse({ status: 200, description: 'Tag list returned' })
  @ApiResponse({ status: 404, description: 'Blog feature disabled' })
  async getTags(): Promise<{ tag: string; count: number }[]> {
    return this.blogService.getPublicTags();
  }
}
