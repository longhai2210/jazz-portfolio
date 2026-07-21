import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { CACHE_TAGS, PublicCacheTag } from '@/lib/api-public';

const VALID_TAGS = new Set<string>(Object.values(CACHE_TAGS));

/**
 * Invalidate Next Data Cache tags used by PublicApiClient.
 *
 * POST /api/revalidate
 * Headers: `x-revalidate-secret: <REVALIDATE_SECRET>`
 * Body: `{ "tag": "profile" | "categories" | "settings" | "music" }`
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-revalidate-secret');
  if (!process.env.REVALIDATE_SECRET || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ message: 'Invalid secret' }, { status: 401 });
  }

  let body: { tag?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const tag = body.tag;
  if (!tag || !VALID_TAGS.has(tag)) {
    return NextResponse.json(
      {
        message: 'Invalid or missing tag',
        validTags: [...VALID_TAGS],
      },
      { status: 400 },
    );
  }

  revalidateTag(tag as PublicCacheTag);

  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}
