import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { CommentsService } from './comments.service';
import { SpamShieldService } from './spam-shield.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { RevalidationService } from '../common/revalidation.service';
import { CommentModerationMode, CommentStatus } from '@jazz-portfolio/shared';
import * as tokenUtil from './token.util';

describe('CommentsService', () => {
  let service: CommentsService;
  let prisma: any;
  let spamShield: jest.Mocked<SpamShieldService>;
  let settingsService: jest.Mocked<SettingsService>;
  let revalidationService: jest.Mocked<RevalidationService>;

  const mockPost = {
    id: 'post-100',
    slug: 'my-jazz-post',
    title: { en: 'Jazz Music Post' },
    status: 'PUBLISHED',
    areCommentsEnabled: true,
    commentsClosedAt: null,
    isDeleted: false,
  };

  const mockComment = {
    id: 'comment-1',
    postId: 'post-100',
    parentId: null,
    authorName: 'John Coltrane',
    authorEmail: 'john@coltrane.io',
    body: 'Awesome saxophone solo!',
    status: CommentStatus.PENDING,
    spamScore: 0,
    spamReasons: [],
    ipHash: 'hashed-ip',
    isDeleted: false,
    createdAt: new Date('2026-07-27T10:00:00Z'),
    updatedAt: new Date('2026-07-27T10:00:00Z'),
    post: mockPost,
  };

  beforeEach(async () => {
    prisma = {
      post: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      comment: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      commentBlocklist: {
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest
        .fn()
        .mockImplementation(async (input: any) =>
          typeof input === 'function' ? input(prisma) : Promise.all(input),
        ),
    };

    spamShield = {
      evaluateComment: jest.fn().mockResolvedValue({
        isBlocked: false,
        spamScore: 0,
        flaggedForReview: false,
      }),
    } as any;

    settingsService = {
      getCachedSettings: jest.fn().mockResolvedValue({
        areCommentsEnabled: true,
        commentModerationMode: CommentModerationMode.ALL,
        isCommentCaptchaEnabled: false,
        commentAutoCloseDays: 30,
        commentMaxPerPost: 500,
        commentMaxLinks: 2,
        commentSpamThresholdScore: 50,
      }),
    } as any;

    revalidationService = {
      purge: jest.fn().mockResolvedValue(undefined),
    } as any;

    const configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'COMMENT_TOKEN_SECRET') return 'super-secret-token-key-32-bytes-long!';
        if (key === 'COMMENT_IP_HASH_SALT') return 'super-secret-ip-hash-salt-32-bytes-long!';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SpamShieldService, useValue: spamShield },
        { provide: SettingsService, useValue: settingsService },
        { provide: RevalidationService, useValue: revalidationService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('submitComment Security Pipeline', () => {
    it('throws ForbiddenException if comment token is invalid', async () => {
      jest.spyOn(tokenUtil, 'verifyCommentToken').mockReturnValue(false);
      prisma.post.findUnique.mockResolvedValue(mockPost);

      await expect(
        service.submitComment(
          {
            postId: 'post-100',
            commentToken: 'invalid-token',
            authorName: 'Hacker',
            authorEmail: 'hacker@bot.com',
            content: 'Spam body',
          },
          '127.0.0.1',
          'JestUA',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException if spam shield blocks the comment', async () => {
      jest.spyOn(tokenUtil, 'verifyCommentToken').mockReturnValue(true);
      prisma.post.findUnique.mockResolvedValue(mockPost);
      spamShield.evaluateComment.mockResolvedValue({
        isBlocked: true,
        blockReason: 'Matched blocklist keyword: "casino"',
        spamScore: 100,
        flaggedForReview: true,
      });

      await expect(
        service.submitComment(
          {
            postId: 'post-100',
            commentToken: 'valid-token',
            authorName: 'Spammer',
            authorEmail: 'spammer@casino.com',
            content: 'Visit our casino!',
          },
          '127.0.0.1',
          'JestUA',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates comment as PENDING when moderation mode is ALL', async () => {
      jest.spyOn(tokenUtil, 'verifyCommentToken').mockReturnValue(true);
      prisma.post.findUnique.mockResolvedValue(mockPost);
      prisma.comment.create.mockResolvedValue(mockComment);

      const res = await service.submitComment(
        {
          postId: 'post-100',
          commentToken: 'valid-token',
          authorName: 'John Coltrane',
          authorEmail: 'john@coltrane.io',
          content: 'Awesome saxophone solo!',
        },
        '127.0.0.1',
        'JestUA',
      );

      expect(res.status).toBe(CommentStatus.PENDING);
      expect(prisma.comment.create).toHaveBeenCalled();
      const createData = prisma.comment.create.mock.calls[0][0].data;
      expect(createData.ipHash).toHaveLength(64);
      expect(createData.ipHash).not.toBe('127.0.0.1');
      expect(createData.body).toBe('Awesome saxophone solo!');
    });
  });

  describe('getPublicComments PII Leak Guard', () => {
    it('returns only APPROVED comments and strips PII fields (email, ip, spamScore)', async () => {
      prisma.post.findFirst.mockResolvedValue(mockPost);
      prisma.$transaction.mockResolvedValue([[mockComment], 1]);

      const res = await service.getPublicComments('my-jazz-post', 1, 10);

      expect(res.items.length).toBe(1);
      expect(prisma.post.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ select: { id: true } }),
      );
      expect(prisma.comment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: {
            id: true,
            authorName: true,
            body: true,
            parentId: true,
            createdAt: true,
          },
        }),
      );
      const pubComment = res.items[0] as any;
      expect(pubComment.authorName).toBe('John Coltrane');
      expect(pubComment.content).toBe('Awesome saxophone solo!');

      // Security check: confirm PII fields are completely stripped
      expect(pubComment.authorEmail).toBeUndefined();
      expect(pubComment.ipAddress).toBeUndefined();
      expect(pubComment.spamScore).toBeUndefined();
      expect(pubComment.blockReason).toBeUndefined();
    });
  });

  describe('moderateComment State Machine', () => {
    it('approving a pending comment increments post commentCount and purges cache tags', async () => {
      prisma.comment.findUnique.mockResolvedValue({
        ...mockComment,
        status: CommentStatus.PENDING,
      });
      prisma.comment.update.mockResolvedValue({
        ...mockComment,
        status: CommentStatus.APPROVED,
      });
      prisma.post.update.mockResolvedValue(mockPost);

      const updated = await service.moderateComment('comment-1', CommentStatus.APPROVED);

      expect(updated.status).toBe(CommentStatus.APPROVED);
      expect(prisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-100' },
        data: { commentCount: { increment: 1 } },
      });
      expect(revalidationService.purge).toHaveBeenCalledWith(['comments', 'posts']);
    });
  });
});
