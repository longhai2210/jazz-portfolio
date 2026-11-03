import { createHash, createHmac } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { RevalidationService } from '../common/revalidation.service';
import { SpamShieldService } from './spam-shield.service';
import { generateCommentToken, verifyCommentToken } from './token.util';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateBlocklistItemDto } from './dto/create-blocklist-item.dto';
import { normalizePagination, paginatedResponse } from '../common/pagination';
import {
  AdminCommentDto,
  CommentBlocklistDto,
  CommentModerationMode,
  CommentStatus,
  PaginatedResponse,
  PublicCommentDto,
} from '@jazz-portfolio/shared';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly revalidationService: RevalidationService,
    private readonly spamShieldService: SpamShieldService,
    private readonly configService: ConfigService,
  ) {}

  private hashIp(ipAddress: string): string {
    const salt = this.configService.get<string>('COMMENT_IP_HASH_SALT');
    if (!salt || salt.length < 32) {
      throw new ServiceUnavailableException(
        'Comment security is not configured. Set COMMENT_IP_HASH_SALT.',
      );
    }
    return createHmac('sha256', salt).update(ipAddress).digest('hex');
  }

  private getTokenSecret(): string {
    const secret = this.configService.get<string>('COMMENT_TOKEN_SECRET');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'Comment security is not configured. Set COMMENT_TOKEN_SECRET.',
      );
    }
    return secret;
  }

  private mapToPublicDto(row: any): PublicCommentDto {
    return {
      id: row.id,
      authorName: row.authorName,
      content: row.body,
      parentId: row.parentId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private mapToAdminDto(row: any): AdminCommentDto {
    return {
      id: row.id,
      postId: row.postId,
      postSlug: row.post?.slug || '',
      postTitleEn: row.post?.title?.en || '',
      authorName: row.authorName,
      authorEmail: row.authorEmail,
      content: row.body,
      // The shared DTO retains its legacy property name, but only the one-way
      // hash is exposed to administrators. Raw visitor IPs are never stored.
      ipAddress: row.ipHash,
      status: row.status as CommentStatus,
      spamScore: row.spamScore,
      blockReason: Array.isArray(row.spamReasons)
        ? row.spamReasons.filter((reason: unknown) => typeof reason === 'string').join('; ') || null
        : null,
      parentId: row.parentId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // === Public Service Methods ===

  async getCommentToken(slug: string, ip: string): Promise<{ token: string; expiresAt: string }> {
    const post = await this.prisma.post.findFirst({
      where: { slug, isDeleted: false, status: 'PUBLISHED' },
      select: {
        id: true,
        areCommentsEnabled: true,
        commentsClosedAt: true,
      },
    });

    if (!post) {
      throw new NotFoundException(`Post with slug "${slug}" not found`);
    }

    if (!post.areCommentsEnabled) {
      throw new ForbiddenException('Comments are disabled for this article');
    }

    if (post.commentsClosedAt && post.commentsClosedAt <= new Date()) {
      throw new ForbiddenException('Comments are closed for this article');
    }

    // Validate both required secrets before giving the client a usable token.
    this.hashIp(ip);
    const token = generateCommentToken(post.id, ip, this.getTokenSecret());
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return { token, expiresAt };
  }

  async submitComment(
    dto: CreateCommentDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ id: string; status: CommentStatus; message: string }> {
    const settings = await this.settingsService.getCachedSettings();

    if (!settings.areCommentsEnabled) {
      throw new ForbiddenException('Comments are currently disabled globally');
    }

    if (settings.commentModerationMode === CommentModerationMode.CLOSED) {
      throw new ForbiddenException('Comments are currently closed');
    }

    // Verify post exists
    const post = await this.prisma.post.findUnique({
      where: { id: dto.postId },
      select: {
        id: true,
        isDeleted: true,
        status: true,
        areCommentsEnabled: true,
        commentsClosedAt: true,
        publishedAt: true,
      },
    });

    if (!post || post.isDeleted || post.status !== 'PUBLISHED') {
      throw new NotFoundException('Target blog post not found');
    }

    if (!post.areCommentsEnabled) {
      throw new ForbiddenException('Comments are disabled for this post');
    }

    const now = new Date();
    if (post.commentsClosedAt && post.commentsClosedAt <= now) {
      throw new ForbiddenException('Comments are closed for this post');
    }
    if (
      settings.commentAutoCloseDays > 0 &&
      post.publishedAt &&
      now.getTime() - post.publishedAt.getTime() >=
        settings.commentAutoCloseDays * 24 * 60 * 60 * 1000
    ) {
      throw new ForbiddenException('Comments are closed for this post');
    }

    // Enforce the same five-second dwell period shown by the client.
    const isTokenValid = verifyCommentToken(
      dto.commentToken,
      dto.postId,
      ipAddress,
      15 * 60 * 1000,
      5 * 1000,
      this.getTokenSecret(),
    );
    if (!isTokenValid) {
      throw new ForbiddenException('Invalid or expired comment security token');
    }

    if (settings.commentMaxPerPost > 0) {
      const existingCount = await this.prisma.comment.count({
        where: { postId: dto.postId, isDeleted: false },
      });
      if (existingCount >= settings.commentMaxPerPost) {
        throw new ForbiddenException('This post has reached its comment limit');
      }
    }

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: dto.parentId },
        select: {
          id: true,
          isDeleted: true,
          status: true,
          postId: true,
          parentId: true,
        },
      });
      if (
        !parent ||
        parent.isDeleted ||
        parent.status !== CommentStatus.APPROVED ||
        parent.postId !== dto.postId ||
        parent.parentId
      ) {
        throw new BadRequestException('Invalid parent comment');
      }
    }

    // Verify Cloudflare Turnstile CAPTCHA if enabled
    if (settings.isCommentCaptchaEnabled) {
      const captchaSecret = this.configService.get<string>('TURNSTILE_SECRET_KEY');
      if (!captchaSecret) {
        throw new ServiceUnavailableException('CAPTCHA is not configured');
      }
      if (!dto.captchaToken) {
        throw new BadRequestException('CAPTCHA verification required');
      }
      try {
        const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: captchaSecret,
            response: dto.captchaToken,
            remoteip: ipAddress,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!verifyRes.ok) {
          throw new Error(`Turnstile responded with ${verifyRes.status}`);
        }
        const captchaOutcome = (await verifyRes.json()) as { success?: boolean };
        if (!captchaOutcome.success) {
          throw new ForbiddenException('CAPTCHA verification failed');
        }
      } catch (err: unknown) {
        if (err instanceof ForbiddenException) throw err;
        throw new ServiceUnavailableException('CAPTCHA verification is temporarily unavailable');
      }
    }

    // Evaluate spam shield & blocklist
    const ipHash = this.hashIp(ipAddress);
    const spamResult = await this.spamShieldService.evaluateComment({
      authorName: dto.authorName,
      authorEmail: dto.authorEmail,
      content: dto.content,
      ipAddress: ipHash,
      maxLinks: 2,
      spamThresholdScore: settings.commentSpamThreshold || 60,
    });

    if (spamResult.isBlocked) {
      throw new ForbiddenException(spamResult.blockReason || 'Comment rejected by security filter');
    }

    let status: CommentStatus = CommentStatus.PENDING;
    if (
      !spamResult.flaggedForReview &&
      settings.commentModerationMode === CommentModerationMode.SPAM_ONLY
    ) {
      status = CommentStatus.APPROVED;
    }

    const contentHash = createHash('sha256').update(dto.content).digest('hex');

    const comment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          postId: dto.postId,
          authorName: dto.authorName,
          authorEmail: dto.authorEmail,
          body: dto.content,
          ipHash,
          userAgent: userAgent.slice(0, 400),
          contentHash,
          status,
          spamScore: spamResult.spamScore,
          spamReasons: spamResult.blockReason ? [spamResult.blockReason] : [],
          parentId: dto.parentId || null,
        },
      });

      if (status === CommentStatus.APPROVED) {
        await tx.post.update({
          where: { id: dto.postId },
          data: { commentCount: { increment: 1 } },
        });
      }
      return created;
    });

    if (status === CommentStatus.APPROVED) {
      void this.revalidationService.purge(['comments', 'posts']);
    }

    const message =
      status === CommentStatus.APPROVED
        ? 'Comment published successfully!'
        : 'Comment submitted successfully! It is pending moderation review.';

    return { id: comment.id, status: comment.status as CommentStatus, message };
  }

  async getPublicComments(
    slug: string,
    rawPage = 1,
    rawLimit = 20,
  ): Promise<PaginatedResponse<PublicCommentDto>> {
    const post = await this.prisma.post.findFirst({
      where: { slug, isDeleted: false, status: 'PUBLISHED' },
      select: { id: true },
    });

    if (!post) {
      throw new NotFoundException(`Post with slug "${slug}" not found`);
    }

    const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

    const where = {
      postId: post.id,
      isDeleted: false,
      status: CommentStatus.APPROVED,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        select: {
          id: true,
          authorName: true,
          body: true,
          parentId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    const items = rows.map((r) => this.mapToPublicDto(r));
    return paginatedResponse(items, total, page, limit);
  }

  // === Admin Service Methods ===

  async getAdminComments(
    rawPage = 1,
    rawLimit = 20,
    status?: string,
    postId?: string,
  ): Promise<PaginatedResponse<AdminCommentDto>> {
    const { page, limit, skip } = normalizePagination(rawPage, rawLimit);

    const where: any = { isDeleted: false };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (postId) {
      where.postId = postId;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        include: { post: { select: { slug: true, title: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    const items = rows.map((r) => this.mapToAdminDto(r));
    return paginatedResponse(items, total, page, limit);
  }

  async moderateComment(id: string, status: CommentStatus): Promise<AdminCommentDto> {
    let countChanged = false;
    const row = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.comment.findUnique({
        where: { id },
        select: {
          id: true,
          postId: true,
          status: true,
          isDeleted: true,
        },
      });
      if (!existing || existing.isDeleted) {
        throw new NotFoundException(`Comment with ID "${id}" not found`);
      }

      const previousStatus = existing.status as CommentStatus;
      const updated = await tx.comment.update({
        where: { id },
        data: { status, moderatedAt: new Date() },
        include: { post: { select: { slug: true, title: true } } },
      });

      if (previousStatus !== CommentStatus.APPROVED && status === CommentStatus.APPROVED) {
        await tx.post.update({
          where: { id: existing.postId },
          data: { commentCount: { increment: 1 } },
        });
        countChanged = true;
      } else if (previousStatus === CommentStatus.APPROVED && status !== CommentStatus.APPROVED) {
        await tx.post.update({
          where: { id: existing.postId },
          data: { commentCount: { decrement: 1 } },
        });
        countChanged = true;
      }
      return updated;
    });

    if (countChanged) {
      void this.revalidationService.purge(['comments', 'posts']);
    }

    return this.mapToAdminDto(row);
  }

  async bulkModerateComments(
    ids: string[],
    status: CommentStatus,
  ): Promise<{ updatedCount: number }> {
    let updatedCount = 0;
    for (const id of ids) {
      try {
        await this.moderateComment(id, status);
        updatedCount += 1;
      } catch {
        // Continue processing batch
      }
    }
    return { updatedCount };
  }

  async deleteComment(id: string): Promise<{ success: boolean }> {
    const wasApproved = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.comment.findUnique({ where: { id } });
      if (!existing || existing.isDeleted) {
        throw new NotFoundException(`Comment with ID "${id}" not found`);
      }
      await tx.comment.update({
        where: { id },
        data: { isDeleted: true },
      });

      if (existing.status === CommentStatus.APPROVED) {
        await tx.post.update({
          where: { id: existing.postId },
          data: { commentCount: { decrement: 1 } },
        });
      }
      return existing.status === CommentStatus.APPROVED;
    });

    if (wasApproved) {
      void this.revalidationService.purge(['comments', 'posts']);
    }

    return { success: true };
  }

  // === Blocklist Admin Methods ===

  async getBlocklist(): Promise<CommentBlocklistDto[]> {
    const rows = await this.prisma.commentBlocklist.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => ({
      id: r.id,
      type: r.type as any,
      value: r.value,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async createBlocklistItem(dto: CreateBlocklistItemDto): Promise<CommentBlocklistDto> {
    const r = await this.prisma.commentBlocklist.create({
      data: {
        type: dto.type,
        value: dto.value,
      },
    });

    return {
      id: r.id,
      type: r.type as any,
      value: r.value,
      createdAt: r.createdAt.toISOString(),
    };
  }

  async deleteBlocklistItem(id: string): Promise<{ success: boolean }> {
    await this.prisma.commentBlocklist.delete({
      where: { id },
    });
    return { success: true };
  }
}
