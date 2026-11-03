import { slugify, ensureUniqueSlug, estimateReadingMinutes } from './slug.util';

describe('slug.util', () => {
  describe('slugify', () => {
    it('converts title to clean URL slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('  Jazz & Code 2026!  ')).toBe('jazz-code-2026');
    });

    it('strips Vietnamese diacritics', () => {
      expect(slugify('Chào mừng đến với Nhật ký')).toBe('chao-mung-den-voi-nhat-ky');
      expect(slugify('Kỹ sư Phần mềm Trưởng')).toBe('ky-su-phan-mem-truong');
    });

    it('handles special characters and empty inputs', () => {
      expect(slugify('!!!')).toBe('');
      expect(slugify('')).toBe('');
    });
  });

  describe('ensureUniqueSlug', () => {
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        post: {
          findFirst: jest.fn(),
        },
      };
    });

    it('returns candidate when no existing post uses slug', async () => {
      mockPrisma.post.findFirst.mockResolvedValue(null);
      const slug = await ensureUniqueSlug(mockPrisma, 'My New Post');
      expect(slug).toBe('my-new-post');
    });

    it('appends counter when slug collision occurs', async () => {
      mockPrisma.post.findFirst
        .mockResolvedValueOnce({ id: 'existing-1' })
        .mockResolvedValueOnce({ id: 'existing-2' })
        .mockResolvedValueOnce(null);

      const slug = await ensureUniqueSlug(mockPrisma, 'My New Post');
      expect(slug).toBe('my-new-post-3');
    });
  });

  describe('estimateReadingMinutes', () => {
    it('returns at least 1 minute for short content', () => {
      expect(
        estimateReadingMinutes({
          en: 'Short text',
          vi: 'Văn bản ngắn',
          ja: '短いテキスト',
        }),
      ).toBe(1);
    });

    it('calculates reading time for long text', () => {
      const longEnText = Array(600).fill('word').join(' ');
      expect(
        estimateReadingMinutes({
          en: longEnText,
          vi: 'ngắn',
          ja: '短い',
        }),
      ).toBe(3);
    });
  });
});
