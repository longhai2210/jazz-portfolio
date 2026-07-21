import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/create-category.dto';
import { CreateCategoryItemDto, UpdateCategoryItemDto } from './dto/create-category-item.dto';
import { ReorderDto } from './dto/reorder-categories.dto';
import { Category, CategoryItem } from '@jazz-portfolio/database';

@ApiTags('Categories & Portfolio Items')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // === Public Endpoints ===

  @Get()
  @ApiOperation({ summary: 'Get all active categories with active items (ordered)' })
  @ApiResponse({ status: 200, description: 'List of categories returned successfully' })
  async getPublicCategories(): Promise<(Category & { items: CategoryItem[] })[]> {
    return this.categoriesService.getPublicCategories();
  }

  // === Admin Category Endpoints (must be declared before :slug) ===

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Get all categories including inactive (Admin only)' })
  @ApiResponse({ status: 200, description: 'Categories returned successfully' })
  async getAllCategoriesAdmin(): Promise<(Category & { items: CategoryItem[] })[]> {
    return this.categoriesService.getAllCategoriesAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/create')
  @ApiOperation({ summary: 'Create category (Admin only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Slug already exists' })
  async createCategory(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.createCategory(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/:id')
  @ApiOperation({ summary: 'Update category (Admin only)' })
  @ApiParam({ name: 'id', example: 'uuid-1' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto): Promise<Category> {
    return this.categoriesService.updateCategory(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/:id')
  @ApiOperation({ summary: 'Soft delete category and its items (Admin only)' })
  @ApiParam({ name: 'id', example: 'uuid-1' })
  @ApiResponse({ status: 200, description: 'Category soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async softDeleteCategory(@Param('id') id: string): Promise<Category> {
    return this.categoriesService.softDeleteCategory(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder categories (Admin only)' })
  @ApiResponse({ status: 200, description: 'Categories reordered successfully' })
  async reorderCategories(@Body() dto: ReorderDto): Promise<{ success: boolean }> {
    return this.categoriesService.reorderCategories(dto);
  }

  // === Admin Category Item Endpoints ===

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/:categoryId/items')
  @ApiOperation({ summary: 'Create category item (Admin only)' })
  @ApiParam({ name: 'categoryId', example: 'uuid-1' })
  @ApiResponse({ status: 201, description: 'Item created successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async createCategoryItem(
    @Param('categoryId') categoryId: string,
    @Body() dto: CreateCategoryItemDto,
  ): Promise<CategoryItem> {
    return this.categoriesService.createCategoryItem(categoryId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/items/:id')
  @ApiOperation({ summary: 'Update category item (Admin only)' })
  @ApiParam({ name: 'id', example: 'uuid-item-1' })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async updateCategoryItem(@Param('id') id: string, @Body() dto: UpdateCategoryItemDto): Promise<CategoryItem> {
    return this.categoriesService.updateCategoryItem(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/items/:id')
  @ApiOperation({ summary: 'Soft delete category item (Admin only)' })
  @ApiParam({ name: 'id', example: 'uuid-item-1' })
  @ApiResponse({ status: 200, description: 'Item soft-deleted successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async softDeleteCategoryItem(@Param('id') id: string): Promise<CategoryItem> {
    return this.categoriesService.softDeleteCategoryItem(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/items/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder category items (Admin only)' })
  @ApiResponse({ status: 200, description: 'Items reordered successfully' })
  async reorderCategoryItems(@Body() dto: ReorderDto): Promise<{ success: boolean }> {
    return this.categoriesService.reorderCategoryItems(dto);
  }

  // === Public slug lookup (after all admin/* static segments) ===

  @Get(':slug')
  @ApiOperation({ summary: 'Get single active category with active items by slug' })
  @ApiParam({ name: 'slug', example: 'skills' })
  @ApiResponse({ status: 200, description: 'Category returned successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async getCategoryBySlug(@Param('slug') slug: string): Promise<Category & { items: CategoryItem[] }> {
    return this.categoriesService.getCategoryBySlug(slug);
  }
}
