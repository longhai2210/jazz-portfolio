import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateCategoryItemDto, UpdateCategoryItemDto } from './dto/create-category-item.dto';
import { ReorderDto } from './dto/reorder-categories.dto';
import { Category, CategoryItem } from '@jazz-portfolio/database';
import { RevalidationService } from '../common/revalidation.service';

@Injectable()
export class CategoriesService {
  constructor(
    private prisma: PrismaService,
    private readonly revalidationService: RevalidationService,
  ) {}

  // === Categories ===

  async getPublicCategories(): Promise<(Category & { items: CategoryItem[] })[]> {
    return this.prisma.category.findMany({
      where: {
        isDeleted: false,
        isActive: true,
      },
      include: {
        items: {
          where: {
            isDeleted: false,
            isActive: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  async getAllCategoriesAdmin(): Promise<(Category & { items: CategoryItem[] })[]> {
    return this.prisma.category.findMany({
      where: { isDeleted: false },
      include: {
        items: {
          where: { isDeleted: false },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getCategoryBySlug(slug: string): Promise<Category & { items: CategoryItem[] }> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        items: {
          where: { isDeleted: false, isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category || category.isDeleted) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }

    return category;
  }

  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
    }

    const created = await this.prisma.category.create({
      data: {
        name: dto.name as any,
        slug: dto.slug,
        type: dto.type,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    void this.revalidationService.purge(['categories']);
    return created;
  }

  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || category.isDeleted) {
      throw new NotFoundException('Category not found');
    }

    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.prisma.category.findUnique({ where: { slug: dto.slug } });
      if (existing) {
        throw new ConflictException(`Category with slug "${dto.slug}" already exists`);
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name ? (dto.name as any) : undefined,
        slug: dto.slug,
        type: dto.type,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    void this.revalidationService.purge(['categories']);
    return updated;
  }

  async softDeleteCategory(id: string): Promise<Category> {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category || category.isDeleted) {
      throw new NotFoundException('Category not found');
    }

    // Soft delete category and its children
    const deleted = await this.prisma.$transaction(async (tx) => {
      await tx.categoryItem.updateMany({
        where: { categoryId: id },
        data: { isDeleted: true },
      });

      return tx.category.update({
        where: { id },
        data: { isDeleted: true },
      });
    });

    void this.revalidationService.purge(['categories']);
    return deleted;
  }

  async reorderCategories(dto: ReorderDto): Promise<{ success: boolean }> {
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.category.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    void this.revalidationService.purge(['categories']);
    return { success: true };
  }

  // === Category Items ===

  async createCategoryItem(categoryId: string, dto: CreateCategoryItemDto): Promise<CategoryItem> {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category || category.isDeleted) {
      throw new NotFoundException('Category not found');
    }

    const created = await this.prisma.categoryItem.create({
      data: {
        categoryId,
        title: dto.title as any,
        description: dto.description as any,
        metadata: dto.metadata as any,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    void this.revalidationService.purge(['categories']);
    return created;
  }

  async updateCategoryItem(id: string, dto: UpdateCategoryItemDto): Promise<CategoryItem> {
    const item = await this.prisma.categoryItem.findUnique({ where: { id } });
    if (!item || item.isDeleted) {
      throw new NotFoundException('Category item not found');
    }

    const updated = await this.prisma.categoryItem.update({
      where: { id },
      data: {
        title: dto.title ? (dto.title as any) : undefined,
        description: dto.description ? (dto.description as any) : undefined,
        metadata: dto.metadata ? (dto.metadata as any) : undefined,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });

    void this.revalidationService.purge(['categories']);
    return updated;
  }

  async softDeleteCategoryItem(id: string): Promise<CategoryItem> {
    const item = await this.prisma.categoryItem.findUnique({ where: { id } });
    if (!item || item.isDeleted) {
      throw new NotFoundException('Category item not found');
    }

    const deleted = await this.prisma.categoryItem.update({
      where: { id },
      data: { isDeleted: true },
    });

    void this.revalidationService.purge(['categories']);
    return deleted;
  }

  async reorderCategoryItems(dto: ReorderDto): Promise<{ success: boolean }> {
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.categoryItem.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    void this.revalidationService.purge(['categories']);
    return { success: true };
  }
}
