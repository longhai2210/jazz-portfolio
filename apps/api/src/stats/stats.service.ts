import { Injectable } from '@nestjs/common';
import { AdminStatsDto } from '@jazz-portfolio/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats(): Promise<AdminStatsDto> {
    const [
      categories,
      items,
      tracks,
      publishedPosts,
      draftPosts,
      pendingComments,
    ] = await Promise.all([
      this.prisma.category.count({ where: { isDeleted: false } }),
      this.prisma.categoryItem.count({ where: { isDeleted: false } }),
      this.prisma.track.count(),
      this.prisma.post.count({ where: { isDeleted: false, status: 'PUBLISHED' } }),
      this.prisma.post.count({ where: { isDeleted: false, status: 'DRAFT' } }),
      this.prisma.comment.count({ where: { isDeleted: false, status: 'PENDING' } }),
    ]);

    return {
      categories,
      items,
      tracks,
      publishedPosts,
      draftPosts,
      pendingComments,
    };
  }
}
