import { PrismaService } from '../prisma/prisma.service';
import { LocalizedString } from '@jazz-portfolio/shared';

/**
 * Converts input text into a URL-friendly slug.
 * Strips Vietnamese diacritics, converts to lowercase, handles non-alphanumeric chars.
 */
export function slugify(text: string): string {
  if (!text) return '';

  return (
    text
      // Normalize Unicode and strip Vietnamese diacritics
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      // Replace Vietnamese specific characters (đ, Đ)
      .replace(/[đĐ]/g, 'd')
      // Lowercase
      .toLowerCase()
      // Replace non-alphanumeric characters with hyphen
      .replace(/[^a-z0-9]+/g, '-')
      // Strip leading and trailing hyphens
      .replace(/^-+|-+$/g, '')
  );
}

/**
 * Ensures slug uniqueness by checking existing posts in DB and suffixing `-2`, `-3` if taken.
 */
export async function ensureUniqueSlug(
  prisma: PrismaService,
  baseSlug: string,
  currentPostId?: string,
): Promise<string> {
  const cleanBase = slugify(baseSlug) || 'post';
  let candidate = cleanBase;
  let counter = 2;

  while (true) {
    const existing = await prisma.post.findFirst({
      where: {
        slug: candidate,
        isDeleted: false,
        ...(currentPostId ? { NOT: { id: currentPostId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${cleanBase}-${counter}`;
    counter++;
  }
}

/**
 * Estimates reading time in minutes based on the longest locale content.
 */
export function estimateReadingMinutes(content: LocalizedString): number {
  if (!content) return 1;

  const enText = content.en || '';
  const viText = content.vi || '';
  const jaText = content.ja || '';

  // Calculate words for EN/VI and characters for JA
  const enWords = enText.trim().split(/\s+/).filter(Boolean).length;
  const viWords = viText.trim().split(/\s+/).filter(Boolean).length;
  const jaChars = jaText.replace(/\s+/g, '').length;

  const enMinutes = enWords / 200;
  const viMinutes = viWords / 200;
  const jaMinutes = jaChars / 500;

  const maxMinutes = Math.max(enMinutes, viMinutes, jaMinutes);
  return Math.max(1, Math.ceil(maxMinutes));
}
