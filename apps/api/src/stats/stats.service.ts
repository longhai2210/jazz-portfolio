import { Injectable } from '@nestjs/common';
import { AdminStatsDto } from '@jazz-portfolio/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAdminStats(): Promise<AdminStatsDto> {
    const [categories, items, tracks] = await Promise.all([
      this.prisma.category.count({ where: { isDeleted: false } }),
      this.prisma.categoryItem.count({ where: { isDeleted: false } }),
      this.prisma.track.count(),
    ]);

    return { categories, items, tracks };
  }
}
