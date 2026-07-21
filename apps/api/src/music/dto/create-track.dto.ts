import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class CreateTrackDto {
  @ApiProperty({ example: 'Autumn Leaves', description: 'Song title' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'Miles Davis', description: 'Artist name' })
  @IsString()
  artist!: string;

  @ApiProperty({ example: 'tracks/autumn-leaves.mp3', description: 'S3 storage path key' })
  @IsString()
  s3Key!: string;

  @ApiProperty({ example: 'https://cdn.example.com/tracks/autumn-leaves.mp3', description: 'CloudFront CDN distribution URL' })
  @IsString()
  cloudfrontUrl!: string;

  @ApiProperty({ example: 345, description: 'Duration in seconds' })
  @IsNumber()
  durationSeconds!: number;

  @ApiProperty({ example: 1, default: 0, required: false })
  @IsNumber()
  @IsOptional()
  sortOrder = 0;

  @ApiProperty({ example: true, default: true, required: false })
  @IsBoolean()
  @IsOptional()
  isActive = true;
}

export class UpdateTrackDto {
  @ApiProperty({ example: 'Autumn Leaves (Live)', required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ example: 'Miles Davis Quintet', required: false })
  @IsString()
  @IsOptional()
  artist?: string;

  @ApiProperty({ example: 'tracks/autumn-leaves-live.mp3', required: false })
  @IsString()
  @IsOptional()
  s3Key?: string;

  @ApiProperty({ example: 'https://cdn.example.com/tracks/autumn-leaves-live.mp3', required: false })
  @IsString()
  @IsOptional()
  cloudfrontUrl?: string;

  @ApiProperty({ example: 360, required: false })
  @IsNumber()
  @IsOptional()
  durationSeconds?: number;

  @ApiProperty({ example: 2, required: false })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
