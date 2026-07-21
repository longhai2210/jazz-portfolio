import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController (contract smoke)', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns ok status payload for GET /health', () => {
    const result = controller.check();
    expect(result.status).toBe('ok');
    expect(result.service).toBe('jazz-portfolio-api');
    expect(typeof result.timestamp).toBe('string');
  });
});
