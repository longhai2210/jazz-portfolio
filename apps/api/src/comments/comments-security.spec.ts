import { CommentStatus, PublicCommentDto } from '@jazz-portfolio/shared';
import { CommentsService } from './comments.service';

describe('Comments Security & PII Regression Suite', () => {
  it('guarantees PublicCommentDto contract contains zero PII fields', () => {
    const mockDbRow = {
      id: 'comment-sec-1',
      authorName: 'Anonymous Listener',
      authorEmail: 'confidential@user.com',
      body: 'This is a public comment.',
      ipHash: 'hashed-ip',
      status: CommentStatus.APPROVED,
      spamScore: 12,
      spamReasons: ['Heuristic warning'],
      parentId: null,
      createdAt: new Date('2026-07-27T12:00:00Z'),
      updatedAt: new Date('2026-07-27T12:00:00Z'),
    };

    const service = new CommentsService({} as any, {} as any, {} as any, {} as any, {} as any);

    const publicDto: PublicCommentDto = (service as any).mapToPublicDto(mockDbRow);

    expect(publicDto.id).toBe('comment-sec-1');
    expect(publicDto.authorName).toBe('Anonymous Listener');
    expect(publicDto.content).toBe('This is a public comment.');

    // Strict PII Security Invariant Checks
    expect((publicDto as any).authorEmail).toBeUndefined();
    expect((publicDto as any).ipAddress).toBeUndefined();
    expect((publicDto as any).spamScore).toBeUndefined();
    expect((publicDto as any).blockReason).toBeUndefined();
    expect((publicDto as any).status).toBeUndefined();
  });
});
