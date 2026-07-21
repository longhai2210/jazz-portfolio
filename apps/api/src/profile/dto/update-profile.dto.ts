import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsObject, IsOptional, IsNotEmpty, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class LocalizedStringDto {
  @ApiProperty({ example: 'Hello', description: 'English translation' })
  @IsString()
  @IsNotEmpty()
  en!: string;

  @ApiProperty({ example: 'Xin chào', description: 'Vietnamese translation' })
  @IsString()
  @IsNotEmpty()
  vi!: string;

  @ApiProperty({ example: 'こんにちは', description: 'Japanese translation' })
  @IsString()
  @IsNotEmpty()
  ja!: string;
}

export class UpdateProfileDto {
  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual name' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  name!: LocalizedStringDto;

  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual title' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  title!: LocalizedStringDto;

  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual introduction' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  introduction!: LocalizedStringDto;

  @ApiProperty({ type: LocalizedStringDto, description: 'Multilingual bio description' })
  @IsObject()
  @ValidateNested()
  @Type(() => LocalizedStringDto)
  bio!: LocalizedStringDto;

  @ApiProperty({ example: 'https://cdn.example.com/avatar.jpg', required: false, nullable: true })
  @IsString()
  @IsOptional()
  avatarUrl?: string | null;

  @ApiProperty({ example: 'https://cdn.example.com/bg.jpg', required: false, nullable: true })
  @IsString()
  @IsOptional()
  backgroundUrl?: string | null;

  @ApiProperty({ example: { github: 'https://github.com', linkedin: 'https://linkedin.com' } })
  @IsObject()
  socialLinks!: Record<string, string>;

  @ApiProperty({ example: { email: 'email@example.com' } })
  @IsObject()
  contactInfo!: Record<string, string>;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  isMusicEnabled?: boolean;
}

