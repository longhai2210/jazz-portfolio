import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsEnum, IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CategoryType } from '@jazz-portfolio/shared';
import { LocalizedStringDto } from '../../profile/dto/update-profile.dto';

export class CreateCategoryDto {
  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual category name' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  name!: LocalizedStringDto;

  @ApiProperty({ example: 'skills', description: 'URL friendly slug' })
  @IsString()
  slug!: string;

  @ApiProperty({ enum: CategoryType, example: CategoryType.SKILL })
  @IsEnum(CategoryType)
  type!: CategoryType;

  @ApiProperty({ example: 1, default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder = 0;

  @ApiProperty({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive = true;
}

export class UpdateCategoryDto {
  @ApiProperty({ type: LocalizedStringDto, required: false })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  name?: LocalizedStringDto;

  @ApiProperty({ example: 'skills-updated', required: false })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiProperty({ enum: CategoryType, required: false })
  @IsEnum(CategoryType)
  @IsOptional()
  type?: CategoryType;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
