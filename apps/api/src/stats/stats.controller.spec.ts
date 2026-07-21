import { Test, TestingModule } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';

describe('StatsController (admin contract smoke)', () => {
  let controller: StatsController;
  const statsService = {
    getAdminStats: jest.fn().mockResolvedValue({
      categories: 2,
      items: 5,
      tracks: 3,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StatsController],
      providers: [{ provide: StatsService, useValue: statsService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(StatsController);
  });

  it('returns lightweight dashboard counts from StatsService', async () => {
    await expect(controller.getStats()).resolves.toEqual({
      categories: 2,
      items: 5,
      tracks: 3,
    });
    expect(statsService.getAdminStats).toHaveBeenCalled();
  });
});
