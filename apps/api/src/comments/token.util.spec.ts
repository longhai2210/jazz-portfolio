import { generateCommentToken, verifyCommentToken } from './token.util';

describe('token.util', () => {
  beforeAll(() => {
    process.env.COMMENT_TOKEN_SECRET = 'test-comment-token-secret-at-least-32-bytes';
  });

  it('generates a valid token and verifies it for matching postId and ip', () => {
    const postId = 'post-123';
    const ip = '127.0.0.1';
    const token = generateCommentToken(postId, ip);

    expect(token).toBeDefined();
    expect(verifyCommentToken(token, postId, ip)).toBe(true);
  });

  it('rejects token when postId or ip differs', () => {
    const postId = 'post-123';
    const ip = '127.0.0.1';
    const token = generateCommentToken(postId, ip);

    expect(verifyCommentToken(token, 'different-post', ip)).toBe(false);
    expect(verifyCommentToken(token, postId, '192.168.1.1')).toBe(false);
  });

  it('rejects expired token', () => {
    const postId = 'post-123';
    const ip = '127.0.0.1';
    const oldTimestamp = Date.now() - 16 * 60 * 1000;
    const token = `${oldTimestamp}.fakesignature`;

    expect(verifyCommentToken(token, postId, ip)).toBe(false);
  });

  it('can enforce a minimum token dwell time', () => {
    const now = Date.now();
    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(now);
    const token = generateCommentToken('post-123', '127.0.0.1');

    expect(verifyCommentToken(token, 'post-123', '127.0.0.1', 15 * 60 * 1000, 5000)).toBe(false);

    dateNow.mockReturnValue(now + 5000);
    expect(verifyCommentToken(token, 'post-123', '127.0.0.1', 15 * 60 * 1000, 5000)).toBe(true);
    dateNow.mockRestore();
  });
});
