/**
 * Canonical demo persona for local/dev seeding.
 * Promoted from apps/web/src/lib/mocks/portfolio.ts (jazz-themed Full Stack demo).
 * Replace via Admin CMS or by editing these constants.
 */

export type LocalizedString = { en: string; vi: string; ja: string };

export const SEED_PROFILE = {
  name: {
    en: 'Miles Davis',
    vi: 'Miles Davis',
    ja: 'マイルス・デイヴィス',
  } satisfies LocalizedString,
  title: {
    en: 'Jazz Innovator & Trumpeter',
    vi: 'Nhà phát kiến nhạc Jazz & Nghệ sĩ Trumpet',
    ja: 'ジャズ革新者・トランペット奏者',
  } satisfies LocalizedString,
  introduction: {
    en: 'Improvising on canvas, scales, and code to create timeless experiences. Welcome to my creative portfolio.',
    vi: 'Ngẫu hứng trên khung vẽ, các thang âm và các dòng mã để tạo ra những trải nghiệm vượt thời gian. Chào mừng đến với danh mục sáng tạo của tôi.',
    ja: 'キャンバス、スケール、そしてコードで即興を重ね、時代を超えた体験を創り出します。私のクリエイティブ・ポートフォリオへようこそ。',
  } satisfies LocalizedString,
  bio: {
    en: 'I am a software engineer and creative technologist. Just like in jazz, where structure (chords) meets free-form improvisation, I design backend models with absolute rigour while building frontend UI interactions with fluid, dynamic micro-animations.\nExplore my skills and career experience below.',
    vi: 'Tôi là một kỹ sư phần mềm và nhà phát triển công nghệ sáng tạo. Giống như trong nhạc jazz, nơi cấu trúc (hợp âm) gặp gỡ với sự ngẫu hứng tự do, tôi thiết kế các mô hình backend với sự nghiêm ngặt tuyệt đối trong khi xây dựng các tương tác UI frontend với các vi hoạt ảnh mượt mà, năng động.\nKhám phá các kỹ năng và kinh nghiệm nghề nghiệp của tôi bên dưới.',
    ja: '私はソフトウェアエンジニアであり、クリエイティブ・テクノロジストです。コード（構造）と即興演奏（自由形式）が交差するジャズのように、厳格なバックエンド設計と流動的でダイナミックなマイクロアニメーションによるフロントエンドUIの相互作用を両立させます。\n以下で私のスキルとキャリア実績をご覧ください。',
  } satisfies LocalizedString,
  avatarUrl: null as string | null,
  socialLinks: {
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
  },
  contactInfo: {
    email: 'hello@example.com',
    phone: '+84 (0) 90 123 4567',
    location: 'Saigon, Vietnam',
  },
  isMusicEnabled: true,
};

export const SEED_CATEGORIES = [
  {
    slug: 'skills',
    type: 'SKILL',
    name: {
      en: 'Skills & Toolkit',
      vi: 'Kỹ năng & Công cụ',
      ja: 'スキルと言語ツール',
    } satisfies LocalizedString,
    sortOrder: 1,
  },
  {
    slug: 'experience',
    type: 'EXPERIENCE',
    name: {
      en: 'Work History',
      vi: 'Lịch sử làm việc',
      ja: '経歴・職歴',
    } satisfies LocalizedString,
    sortOrder: 2,
  },
  {
    slug: 'education',
    type: 'EDUCATION',
    name: {
      en: 'Education',
      vi: 'Học vấn',
      ja: '学歴',
    } satisfies LocalizedString,
    sortOrder: 3,
  },
] as const;

export type SeedCategoryItem = {
  id: string;
  title: LocalizedString;
  description: LocalizedString;
  metadata: Record<string, unknown>;
  sortOrder: number;
};

export const SEED_SKILL_ITEMS: SeedCategoryItem[] = [
  {
    id: 'seed-skill-typescript',
    title: { en: 'TypeScript', vi: 'TypeScript', ja: 'TypeScript' },
    description: { en: '', vi: '', ja: '' },
    metadata: { group: 'Languages' },
    sortOrder: 1,
  },
  {
    id: 'seed-skill-react-next',
    title: { en: 'React & Next.js', vi: 'React & Next.js', ja: 'React & Next.js' },
    description: { en: '', vi: '', ja: '' },
    metadata: { group: 'Frameworks' },
    sortOrder: 2,
  },
  {
    id: 'seed-skill-nestjs',
    title: { en: 'NestJS & Node', vi: 'NestJS & Node', ja: 'NestJS & Node' },
    description: { en: '', vi: '', ja: '' },
    metadata: { group: 'Backend' },
    sortOrder: 3,
  },
  {
    id: 'seed-skill-postgres',
    title: { en: 'PostgreSQL & Prisma', vi: 'PostgreSQL & Prisma', ja: 'PostgreSQL & Prisma' },
    description: { en: '', vi: '', ja: '' },
    metadata: { group: 'Database' },
    sortOrder: 4,
  },
  {
    id: 'seed-skill-aws',
    title: { en: 'AWS Cloud Services', vi: 'Dịch vụ đám mây AWS', ja: 'AWSクラウドサービス' },
    description: { en: '', vi: '', ja: '' },
    metadata: { group: 'Backend' },
    sortOrder: 5,
  },
];

export const SEED_EXPERIENCE_ITEMS: SeedCategoryItem[] = [
  {
    id: 'seed-exp-lead',
    title: {
      en: 'Lead Full Stack Engineer',
      vi: 'Kỹ sư Full Stack Trưởng',
      ja: 'リードフルスタックエンジニア',
    },
    description: {
      en: 'Architected NestJS rest microservices and optimized PostgreSQL querying plans.\nLed migration of customer portals to Next.js 15 App Router.',
      vi: 'Kiến trúc các microservices REST bằng NestJS và tối ưu hóa các kế hoạch truy vấn PostgreSQL.\nDẫn dắt việc di chuyển các cổng thông tin khách hàng sang Next.js 15 App Router.',
      ja: 'NestJSによるRESTマイクロサービスの構築、およびPostgreSQLクエリ実行プランの最適化。\n顧客ポータルのNext.js 15 App Routerへの移行を牽引。',
    },
    metadata: {
      company: 'Blue Note Systems',
      period: '2023 - Present',
      tags: ['NestJS', 'Next.js', 'PostgreSQL', 'Docker', 'AWS'],
    },
    sortOrder: 1,
  },
  {
    id: 'seed-exp-developer',
    title: {
      en: 'Software Developer',
      vi: 'Nhà phát triển phần mềm',
      ja: 'ソフトウェア開発者',
    },
    description: {
      en: 'Developed clean reactive user interfaces with React and Tailwind CSS.\nMaintained databases migrations and added RESTful API endpoints.',
      vi: 'Phát triển các giao diện người dùng phản ứng sạch bằng React và Tailwind CSS.\nDuy trì các migrations cơ sở dữ liệu và thêm các endpoints API RESTful.',
      ja: 'ReactとTailwind CSSを用いたクリーンな対話型ユーザーインターフェースの開発。\nデータベースマイグレーションの保守およびRESTful APIエンドポイントの新規実装。',
    },
    metadata: {
      company: 'Kind of Blue Labs',
      period: '2021 - 2023',
      tags: ['React', 'Node.js', 'Express', 'MongoDB'],
    },
    sortOrder: 2,
  },
];

export const SEED_EDUCATION_ITEMS: SeedCategoryItem[] = [
  {
    id: 'seed-edu-cs',
    title: {
      en: 'B.S. Computer Science',
      vi: 'Cử nhân Khoa học Máy tính',
      ja: 'コンピュータサイエンス学士',
    },
    description: {
      en: 'Focused on software engineering, algorithms, and creative computing.',
      vi: 'Tập trung vào kỹ thuật phần mềm, thuật toán và điện toán sáng tạo.',
      ja: 'ソフトウェア工学、アルゴリズム、クリエイティブ・コンピューティングに注力。',
    },
    metadata: {
      institution: 'University of Improvisation',
      period: '2017 - 2021',
      location: 'Saigon, Vietnam',
    },
    sortOrder: 1,
  },
];
