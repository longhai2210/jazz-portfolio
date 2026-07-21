import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsIn, IsNotEmpty } from 'class-validator';

export class PresignUploadDto {
  @ApiProperty({ example: 'profile-pic.png', description: 'Original file name' })
  @IsString()
  @IsNotEmpty()
  filename!: string;

  @ApiProperty({ example: 'image/png', description: 'File MIME type' })
  @IsString()
  @IsNotEmpty()
  mimeType!: string;

  @ApiProperty({ example: 1024 * 1024, description: 'File size in bytes' })
  @IsNumber()
  fileSizeBytes!: number;

  @ApiProperty({ example: 'PROFILE', enum: ['PROFILE', 'CATEGORY', 'TRACK', 'GENERAL'] })
  @IsString()
  @IsIn(['PROFILE', 'CATEGORY', 'TRACK', 'GENERAL'])
  context!: 'PROFILE' | 'CATEGORY' | 'TRACK' | 'GENERAL';
}

export class PresignResponseDto {
  @ApiProperty({ description: 'Presigned PUT URL for direct browser S3 upload' })
  uploadUrl!: string;

  @ApiProperty({ description: 'Final public CloudFront CDN URL for the media asset' })
  cloudfrontUrl!: string;

  @ApiProperty({ description: 'S3 storage path key' })
  s3Key!: string;
}
