import type { LocalizedString } from './seed-data';

export interface SeedPost {
  id: string;
  slug: string;
  title: LocalizedString;
  excerpt: LocalizedString;
  content: LocalizedString;
  coverImageUrl: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  tags: string[];
  readingMinutes: number;
  areCommentsEnabled: boolean;
  publishedAt: Date | null;
}

export interface SeedComment {
  id: string;
  postId: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'SPAM' | 'REJECTED';
  spamScore: number;
  spamReasons: string[];
  ipHash: string;
  userAgent: string;
  contentHash: string;
  locale: string;
}

export const SEED_POSTS: SeedPost[] = [
  {
    id: 'seed-post-1',
    slug: 'welcome-to-my-journal',
    title: {
      en: 'Welcome to My Journal: Structure and Improvisation',
      vi: 'Chào mừng đến với Nhật ký của tôi: Cấu trúc và Ngẫu hứng',
      ja: '私のジャーナルへようこそ：構造と即興',
    },
    excerpt: {
      en: 'Exploring the parallels between jazz music composition and software architecture.',
      vi: 'Khám phá sự tương đồng giữa sáng tác nhạc jazz và kiến trúc phần mềm.',
      ja: 'ジャズ音楽の作曲とソフトウェアアーキテクチャの類似性を探る。',
    },
    content: {
      en: '# Welcome to My Journal\n\nJust like in **jazz**, where structure (chords) meets free-form improvisation, software design thrives on solid foundational patterns paired with agile adaptation.\n\nHere I share thoughts on engineering, design systems, and digital craftsmanship.',
      vi: '# Chào mừng đến với Nhật ký của tôi\n\nGiống như trong **nhạc jazz**, nơi cấu trúc (hợp âm) gặp gỡ với sự ngẫu hứng tự do, thiết kế phần mềm phát triển dựa trên các mô hình nền tảng vững chắc kết hợp với sự thích ứng linh hoạt.\n\nTại đây tôi chia sẻ suy nghĩ về kỹ thuật, hệ thống thiết kế và chế tác kỹ thuật số.',
      ja: '# 私のジャーナルへようこそ\n\nコード（構造）と即興演奏（自由形式）が交差する**ジャズ**のように、ソフトウェア設計は堅牢な基礎パターンとアジャイルな適応の組み合わせによって繁栄します。\n\nここではエンジニアリング、デザインシステム、デジタルクラフトマンシップに関する思考を共有します。',
    },
    coverImageUrl: null,
    status: 'PUBLISHED',
    tags: ['jazz', 'engineering', 'architecture'],
    readingMinutes: 3,
    areCommentsEnabled: true,
    publishedAt: new Date('2026-07-01T10:00:00Z'),
  },
  {
    id: 'seed-post-2',
    slug: 'building-resilient-web-applications',
    title: {
      en: 'Draft: Building Resilient Web Applications',
      vi: 'Bản nháp: Xây dựng Ứng dụng Web Bền vững',
      ja: '下書き: レジリエントなWebアプリケーションの構築',
    },
    excerpt: {
      en: 'Notes on error handling, defense-in-depth, and rate-limiting strategies.',
      vi: 'Ghi chú về xử lý lỗi, phòng thủ chiều sâu và chiến lược giới hạn tốc độ.',
      ja: 'エラー処理、多層防御、レート制限戦略についてのメモ。',
    },
    content: {
      en: '# Building Resilient Web Applications\n\n*Work in progress...*\n\nKey takeaways:\n- Defense in depth\n- Graceful degradation',
      vi: '# Xây dựng Ứng dụng Web Bền vững\n\n*Đang soạn thảo...*\n\nBài học chính:\n- Phòng thủ chiều sâu\n- Suy giảm mượt mà',
      ja: '# レジリエントなWebアプリケーションの構築\n\n*執筆中...*\n\n主なポイント:\n- 多層防御\n- グレイスフル・デグラデーション',
    },
    coverImageUrl: null,
    status: 'DRAFT',
    tags: ['security', 'web', 'draft'],
    readingMinutes: 2,
    areCommentsEnabled: true,
    publishedAt: null,
  },
];

export const SEED_COMMENTS: SeedComment[] = [
  {
    id: 'seed-comment-1',
    postId: 'seed-post-1',
    parentId: null,
    authorName: 'John Coltrane',
    authorEmail: 'coltrane@example.com',
    body: 'Great insights on the parallels between chord changes and architecture!',
    status: 'APPROVED',
    spamScore: 0,
    spamReasons: [],
    ipHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    contentHash: 'a1b2c3d4e5f60789',
    locale: 'en',
  },
  {
    id: 'seed-comment-2',
    postId: 'seed-post-1',
    parentId: null,
    authorName: 'Bill Evans',
    authorEmail: 'bill@example.com',
    body: 'Looking forward to reading more about design systems.',
    status: 'PENDING',
    spamScore: 10,
    spamReasons: ['Short body'],
    ipHash: 'f4c8996fb92427ae41e4649b934ca495991b7852b855e3b0c44298fc1c149afb',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    contentHash: 'b2c3d4e5f60789a1',
    locale: 'en',
  },
  {
    id: 'seed-comment-3',
    postId: 'seed-post-1',
    parentId: null,
    authorName: 'Spam Bot',
    authorEmail: 'spammer@bad-domain.xyz',
    body: 'Buy cheap crypto now at http://example-spam-link.xyz!',
    status: 'SPAM',
    spamScore: 85,
    spamReasons: ['Contains URL', 'Keyword hit: crypto', 'Disposable email domain'],
    ipHash: '991b7852b855e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b',
    userAgent: 'Python-urllib/3.9',
    contentHash: 'c3d4e5f60789a1b2',
    locale: 'en',
  },
];
