import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { BlogService } from './blog.service';
import { PrismaService } from '../prisma/prisma.service';
import { RevalidationService } from '../common/revalidation.service';
import { PostStatus } from '@jazz-portfolio/shared';

describe('BlogService', () => {
  let service: BlogService;
  let prisma: any;
  let revalidationService: jest.Mocked<RevalidationService>;

  const mockPostRow = {
    id: 'post-1',
    slug: 'test-post',
    title: { en: 'Test Title', vi: 'Tiêu đề', ja: 'タイトル' },
    excerpt: { en: 'Test Excerpt', vi: 'Tóm tắt', ja: '概要' },
    content: { en: '# Test Content', vi: '# Nội dung', ja: '# コンテンツ' },
    coverImageUrl: 'https://cdn.example.com/cover.jpg',
    status: PostStatus.PUBLISHED,
    tags: ['jazz', 'code'],
    readingMinutes: 2,
    commentCount: 0,
    viewCount: 10,
    areCommentsEnabled: true,
    commentsClosedAt: null,
    publishedAt: new Date('2026-07-01T00:00:00Z'),
    isDeleted: false,
    createdAt: new Date('2026-07-01T00:00:00Z'),
    updatedAt: new Date('2026-07-01T00:00:00Z'),
  };

  beforeEach(async () => {
    prisma = {
      post: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    revalidationService = {
      purge: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlogService,
        { provide: PrismaService, useValue: prisma },
        { provide: RevalidationService, useValue: revalidationService },
      ],
    }).compile();

    service = module.get<BlogService>(BlogService);
  });

  describe('getPublicPosts', () => {
    it('returns paginated public post items without content field', async () => {
      prisma.$transaction.mockResolvedValue([[mockPostRow], 1]);

      const result = await service.getPublicPosts(1, 10);
      expect(result.items.length).toBe(1);
      expect(result.items[0].slug).toBe('test-post');
      expect((result.items[0] as any).content).toBeUndefined();
    });
  });

  describe('getPublicPostBySlug', () => {
    it('returns post detail for a published post', async () => {
      prisma.post.findFirst.mockResolvedValue(mockPostRow);
      prisma.post.update.mockResolvedValue(mockPostRow);

      const result = await service.getPublicPostBySlug('test-post');
      expect(result.slug).toBe('test-post');
      expect(result.content.en).toBe('# Test Content');
      expect(prisma.post.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            id: true,
            content: true,
            areCommentsEnabled: true,
          }),
        }),
      );
    });

    it('throws NotFoundException if post is not found', async () => {
      prisma.post.findFirst.mockResolvedValue(null);

      await expect(service.getPublicPostBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPost', () => {
    it('creates post as DRAFT and calculates reading time', async () => {
      prisma.post.findFirst.mockResolvedValue(null); // slug available
      prisma.post.create.mockResolvedValue({
        ...mockPostRow,
        status: PostStatus.DRAFT,
        publishedAt: null,
      });

      const dto = {
        slug: 'my-draft',
        title: { en: 'My Draft', vi: 'Bản nháp', ja: '下書き' },
        excerpt: { en: 'Excerpt', vi: 'Tóm tắt', ja: '概要' },
        content: { en: 'Content', vi: 'Nội dung', ja: '内容' },
      };

      const result = await service.createPost(dto);
      expect(result.status).toBe(PostStatus.DRAFT);
      expect(prisma.post.create).toHaveBeenCalled();
    });
  });

  describe('publishPost', () => {
    it('updates status to PUBLISHED and triggers revalidation purge', async () => {
      prisma.post.findUnique.mockResolvedValue({
        ...mockPostRow,
        status: PostStatus.DRAFT,
      });
      prisma.post.update.mockResolvedValue(mockPostRow);

      const result = await service.publishPost('post-1');
      expect(result.status).toBe(PostStatus.PUBLISHED);
      expect(revalidationService.purge).toHaveBeenCalledWith(['posts']);
    });
  });
});
