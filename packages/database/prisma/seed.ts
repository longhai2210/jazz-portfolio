import { PrismaClient } from '@prisma/client';
import {
  SEED_CATEGORIES,
  SEED_EDUCATION_ITEMS,
  SEED_EXPERIENCE_ITEMS,
  SEED_PROFILE,
  SEED_SKILL_ITEMS,
  type SeedCategoryItem,
} from './seed-data';

const prisma = new PrismaClient();

async function upsertCategoryItems(
  categorySlug: string,
  items: SeedCategoryItem[],
) {
  const category = await prisma.category.findUnique({
    where: { slug: categorySlug },
  });

  if (!category) {
    throw new Error(`Category "${categorySlug}" not found after upsert`);
  }

  for (const item of items) {
    await prisma.categoryItem.upsert({
      where: { id: item.id },
      update: {
        categoryId: category.id,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        imageUrl: null,
        sortOrder: item.sortOrder,
        isActive: true,
        isDeleted: false,
      },
      create: {
        id: item.id,
        categoryId: category.id,
        title: item.title,
        description: item.description,
        metadata: item.metadata,
        imageUrl: null,
        sortOrder: item.sortOrder,
        isActive: true,
        isDeleted: false,
      },
    });
  }
}

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user (password: admin123, hashed with bcrypt)
  // In production, change this immediately after first login
  const bcrypt = await import('bcrypt');
  const passwordHash = await bcrypt.hash('admin123', 12);

  await prisma.adminUser.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash,
    },
  });

  // Upsert demo profile — update fields so re-seed refreshes landing-page content
  await prisma.profile.upsert({
    where: { id: 'default-profile' },
    update: {
      name: SEED_PROFILE.name,
      title: SEED_PROFILE.title,
      introduction: SEED_PROFILE.introduction,
      bio: SEED_PROFILE.bio,
      avatarUrl: SEED_PROFILE.avatarUrl,
      socialLinks: SEED_PROFILE.socialLinks,
      contactInfo: SEED_PROFILE.contactInfo,
      isMusicEnabled: SEED_PROFILE.isMusicEnabled,
    },
    create: {
      id: 'default-profile',
      name: SEED_PROFILE.name,
      title: SEED_PROFILE.title,
      introduction: SEED_PROFILE.introduction,
      bio: SEED_PROFILE.bio,
      avatarUrl: SEED_PROFILE.avatarUrl,
      socialLinks: SEED_PROFILE.socialLinks,
      contactInfo: SEED_PROFILE.contactInfo,
      isMusicEnabled: SEED_PROFILE.isMusicEnabled,
    },
  });

  // Upsert categories by slug (refresh localized names / type on re-seed)
  for (const cat of SEED_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {
        name: cat.name,
        type: cat.type,
        sortOrder: cat.sortOrder,
        isActive: true,
        isDeleted: false,
      },
      create: {
        slug: cat.slug,
        type: cat.type,
        name: cat.name,
        sortOrder: cat.sortOrder,
        isActive: true,
        isDeleted: false,
      },
    });
  }

  // Stable-id item upserts (idempotent; re-seed overwrites demo items)
  await upsertCategoryItems('skills', SEED_SKILL_ITEMS);
  await upsertCategoryItems('experience', SEED_EXPERIENCE_ITEMS);
  await upsertCategoryItems('education', SEED_EDUCATION_ITEMS);

  // Default site settings (also seeded on API boot if missing)
  await prisma.siteSettings.upsert({
    where: { id: 'default' },
    update: {
      isContactFormEnabled: true,
    },
    create: {
      id: 'default',
      isContactFormEnabled: true,
      mailProvider: process.env.MAIL_PROVIDER || 'resend',
      mailFrom: process.env.MAIL_FROM || '',
      mailTo: process.env.MAIL_TO || '',
    },
  });

  // Intentionally no music tracks — player uses client fallbacks; avoids broken S3 URLs.

  console.log('✅ Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
