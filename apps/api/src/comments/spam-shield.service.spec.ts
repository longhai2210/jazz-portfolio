import { Test, TestingModule } from '@nestjs/testing';
import { SpamShieldService } from './spam-shield.service';
import { PrismaService } from '../prisma/prisma.service';
import { BlocklistType } from '@jazz-portfolio/shared';

describe('SpamShieldService', () => {
  let service: SpamShieldService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      commentBlocklist: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpamShieldService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SpamShieldService>(SpamShieldService);
  });

  it('blocks comment when matching keyword blocklist', async () => {
    prisma.commentBlocklist.findMany.mockResolvedValue([
      { type: BlocklistType.KEYWORD, value: 'casino', isActive: true },
    ]);

    const res = await service.evaluateComment({
      authorName: 'John',
      authorEmail: 'john@example.com',
      content: 'Check out this awesome casino!',
      ipAddress: '127.0.0.1',
      maxLinks: 2,
      spamThresholdScore: 50,
    });

    expect(res.isBlocked).toBe(true);
    expect(res.blockReason).toContain('casino');
  });

  it('flags comment for review if link count exceeds maxLinks', async () => {
    prisma.commentBlocklist.findMany.mockResolvedValue([]);

    const res = await service.evaluateComment({
      authorName: 'John',
      authorEmail: 'john@example.com',
      content: 'Links: http://one.com http://two.com http://three.com',
      ipAddress: '127.0.0.1',
      maxLinks: 1,
      spamThresholdScore: 50,
    });

    expect(res.isBlocked).toBe(false);
    expect(res.flaggedForReview).toBe(true);
  });
});
