import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminStatsDto } from '@jazz-portfolio/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsService } from './stats.service';

@ApiTags('Admin Stats')
@Controller('admin')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('stats')
  @ApiOperation({ summary: 'Lightweight CMS dashboard counts (Admin only)' })
  @ApiResponse({ status: 200, description: 'Dashboard counts retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(): Promise<AdminStatsDto> {
    return this.statsService.getAdminStats();
  }
}
