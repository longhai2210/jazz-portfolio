import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../common/revalidation.service';
import { normalizePagination, paginatedResponse } from '../common/pagination';
import {
  AdminPostDto,
  LocalizedString,
  PaginatedResponse,
  PostDetailDto,
  PostListItemDto,
  PostStatus,
} from '@jazz-portfolio/shared';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { ensureUniqueSlug, estimateReadingMinutes } from './slug.util';

@Injectable()
export class BlogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidationService: RevalidationService,
  ) {}

  /** Map database Post model to Public PostListItemDto (no content payload) */
  private mapToListItemDto(row: any): PostListItemDto {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title as LocalizedString,
      excerpt: row.excerpt as LocalizedString,
      coverImageUrl: row.coverImageUrl,
      tags: row.tags,
      readingMinutes: row.readingMinutes,
      commentCount: row.commentCount,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  }

  /** Map database Post model to AdminPostDto */
  private mapToAdminDto(row: any): AdminPostDto {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title as LocalizedString,
      excerpt: row.excerpt as LocalizedString,
      content: row.content as LocalizedString,
      coverImageUrl: row.coverImageUrl,
      tags: row.tags,
      readingMinutes: row.readingMinutes,
      commentCount: row.commentCount,
      viewCount: row.viewCount,
      status: row.status as PostStatus,
      areCommentsEnabled: row.areCommentsEnabled,
      commentsClosed: !!(
        row.commentsClosedAt && row.commentsClosedAt <= new Date()
      ),
      commentsClosedAt: row.commentsClosedAt
        ? row.commentsClosedAt.toISOString()
        : null,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      isDeleted: row.isDeleted,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // === Public Service Methods ===

  async getPublicPosts(
    rawPage = 1,
    rawLimit = 10,
    tag?: string,
  ): Promise<PaginatedResponse<PostListItemDto>> {
    const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

    const where: any = {
      isDeleted: false,
      status: PostStatus.PUBLISHED,
    };

    if (tag) {
      where.tags = { has: tag };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          coverImageUrl: true,
          tags: true,
          readingMinutes: true,
          commentCount: true,
          publishedAt: true,
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    const items = rows.map((r) => this.mapToListItemDto(r));
    return paginatedResponse(items, total, page, limit);
  }

  async getPublicPostBySlug(slug: string): Promise<PostDetailDto> {
    const row = await this.prisma.post.findFirst({
      where: {
        slug,
        isDeleted: false,
        status: PostStatus.PUBLISHED,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        content: true,
        coverImageUrl: true,
        tags: true,
        readingMinutes: true,
        commentCount: true,
        publishedAt: true,
        areCommentsEnabled: true,
        commentsClosedAt: true,
      },
    });

    if (!row) {
      throw new NotFoundException(`Post with slug "${slug}" not found`);
    }

    // Increment view count asynchronously
    void this.prisma.post
      .update({
        where: { id: row.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    return {
      id: row.id,
      slug: row.slug,
      title: row.title as unknown as LocalizedString,
      excerpt: row.excerpt as unknown as LocalizedString,
      content: row.content as unknown as LocalizedString,
      coverImageUrl: row.coverImageUrl,
      tags: row.tags,
      readingMinutes: row.readingMinutes,
      commentCount: row.commentCount,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      areCommentsEnabled: row.areCommentsEnabled,
      commentsClosed: !!(
        row.commentsClosedAt && row.commentsClosedAt <= new Date()
      ),
    };
  }

  async getPublicTags(): Promise<{ tag: string; count: number }[]> {
    const rows = await this.prisma.post.findMany({
      where: { isDeleted: false, status: PostStatus.PUBLISHED },
      select: { tags: true },
    });

    const frequencyMap = new Map<string, number>();
    for (const r of rows) {
      for (const tag of r.tags) {
        frequencyMap.set(tag, (frequencyMap.get(tag) || 0) + 1);
      }
    }

    return Array.from(frequencyMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }

  // === Admin Service Methods ===

  async getAdminPosts(
    rawPage = 1,
    rawLimit = 20,
    status?: string,
    includeDeleted = false,
  ): Promise<PaginatedResponse<AdminPostDto>> {
    const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

    const where: any = {};
    if (!includeDeleted) {
      where.isDeleted = false;
    }
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.post.count({ where }),
    ]);

    const items = rows.map((r) => this.mapToAdminDto(r));
    return paginatedResponse(items, total, page, limit);
  }

  async getAdminPostById(id: string): Promise<AdminPostDto> {
    const row = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!row) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return this.mapToAdminDto(row);
  }

  async createPost(dto: CreatePostDto): Promise<AdminPostDto> {
    const uniqueSlug = await ensureUniqueSlug(this.prisma, dto.slug);
    const readingMinutes = estimateReadingMinutes(
      dto.content as unknown as LocalizedString,
    );

    const status = dto.status || PostStatus.DRAFT;
    const publishedAt = status === PostStatus.PUBLISHED ? new Date() : null;

    const row = await this.prisma.post.create({
      data: {
        slug: uniqueSlug,
        title: dto.title as any,
        excerpt: dto.excerpt as any,
        content: dto.content as any,
        coverImageUrl: dto.coverImageUrl || null,
        tags: dto.tags || [],
        status,
        readingMinutes,
        areCommentsEnabled: dto.areCommentsEnabled ?? true,
        publishedAt,
      },
    });

    if (status === PostStatus.PUBLISHED) {
      void this.revalidationService.purge(['posts']);
    }

    return this.mapToAdminDto(row);
  }

  async updatePost(id: string, dto: UpdatePostDto): Promise<AdminPostDto> {
    const existing = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    const data: any = {};

    if (dto.slug && dto.slug !== existing.slug) {
      data.slug = await ensureUniqueSlug(this.prisma, dto.slug, id);
    }

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.excerpt !== undefined) data.excerpt = dto.excerpt;
    if (dto.content !== undefined) {
      data.content = dto.content;
      data.readingMinutes = estimateReadingMinutes(
        dto.content as unknown as LocalizedString,
      );
    }
    if (dto.coverImageUrl !== undefined) data.coverImageUrl = dto.coverImageUrl;
    if (dto.tags !== undefined) data.tags = dto.tags;
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (
        dto.status === PostStatus.PUBLISHED &&
        !existing.publishedAt
      ) {
        data.publishedAt = new Date();
      }
    }
    if (dto.areCommentsEnabled !== undefined) {
      data.areCommentsEnabled = dto.areCommentsEnabled;
    }

    const row = await this.prisma.post.update({
      where: { id },
      data,
    });

    if (
      existing.status === PostStatus.PUBLISHED ||
      row.status === PostStatus.PUBLISHED
    ) {
      void this.revalidationService.purge(['posts']);
    }

    return this.mapToAdminDto(row);
  }

  async publishPost(id: string): Promise<AdminPostDto> {
    const existing = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    const publishedAt = existing.publishedAt || new Date();

    const row = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.PUBLISHED,
        publishedAt,
      },
    });

    void this.revalidationService.purge(['posts']);
    return this.mapToAdminDto(row);
  }

  async unpublishPost(id: string): Promise<AdminPostDto> {
    const existing = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    const row = await this.prisma.post.update({
      where: { id },
      data: {
        status: PostStatus.DRAFT,
      },
    });

    void this.revalidationService.purge(['posts']);
    return this.mapToAdminDto(row);
  }

  async deletePost(id: string): Promise<{ success: boolean }> {
    const existing = await this.prisma.post.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    await this.prisma.post.update({
      where: { id },
      data: { isDeleted: true },
    });

    if (existing.status === PostStatus.PUBLISHED) {
      void this.revalidationService.purge(['posts']);
    }

    return { success: true };
  }
}
