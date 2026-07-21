import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsBoolean, IsNumber, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { LocalizedStringDto } from '../../profile/dto/update-profile.dto';

export class CreateCategoryItemDto {
  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual item title' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;

  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual item description' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  description!: LocalizedStringDto;

  @ApiProperty({ example: { company: 'Google', period: '2024-Present' }, description: 'Flexible metadata JSON object' })
  @IsObject()
  @IsOptional()
  metadata = {};

  @ApiProperty({ example: 'https://cdn.example.com/item.png', required: false, nullable: true })
  @IsString()
  @IsOptional()
  imageUrl?: string | null;

  @ApiProperty({ example: 1, default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder = 0;

  @ApiProperty({ example: true, default: true })
  @IsBoolean()
  @IsOptional()
  isActive = true;
}

export class UpdateCategoryItemDto {
  @ApiProperty({ type: LocalizedStringDto, required: false })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title?: LocalizedStringDto;

  @ApiProperty({ type: LocalizedStringDto, required: false })
  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  description?: LocalizedStringDto;

  @ApiProperty({ example: { level: 'Expert' }, required: false })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiProperty({ example: 'https://cdn.example.com/item-updated.png', required: false, nullable: true })
  @IsString()
  @IsOptional()
  imageUrl?: string | null;

  @ApiProperty({ example: 1, required: false })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
