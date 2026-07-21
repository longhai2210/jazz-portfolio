import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../prisma/prisma.service';
import { PresignUploadDto, PresignResponseDto } from './dto/presign-upload.dto';
import { FILE_SIZE_LIMITS, ALLOWED_IMAGE_TYPES, ALLOWED_AUDIO_TYPES } from '@jazz-portfolio/shared';
import * as crypto from 'crypto';
import { normalizePagination, paginatedResponse } from '../common/pagination';

@Injectable()
export class MediaService {
  private s3Client: S3Client;
  private bucketName: string;
  private cloudfrontDomain: string;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const region = this.configService.get<string>('AWS_REGION') || 'ap-southeast-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || 'jazz-portfolio-media';
    this.cloudfrontDomain = this.configService.get<string>('AWS_CLOUDFRONT_DOMAIN') || '';

    const s3Config: any = { region };
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (accessKeyId && secretAccessKey) {
      s3Config.credentials = { accessKeyId, secretAccessKey };
    }

    this.s3Client = new S3Client(s3Config);
  }

  async generatePresignedUrl(dto: PresignUploadDto): Promise<PresignResponseDto> {
    // 1. Validate file size and mime types
    if (dto.context === 'TRACK') {
      if (dto.fileSizeBytes > FILE_SIZE_LIMITS.AUDIO_MAX_BYTES) {
        throw new BadRequestException(`Audio file exceeds limit of ${FILE_SIZE_LIMITS.AUDIO_MAX_BYTES / (1024 * 1024)}MB`);
      }
      if (!ALLOWED_AUDIO_TYPES.includes(dto.mimeType as any)) {
        throw new BadRequestException(`Invalid audio type. Allowed types: ${ALLOWED_AUDIO_TYPES.join(', ')}`);
      }
    } else {
      if (dto.fileSizeBytes > FILE_SIZE_LIMITS.IMAGE_MAX_BYTES) {
        throw new BadRequestException(`Image file exceeds limit of ${FILE_SIZE_LIMITS.IMAGE_MAX_BYTES / (1024 * 1024)}MB`);
      }
      if (!ALLOWED_IMAGE_TYPES.includes(dto.mimeType as any)) {
        throw new BadRequestException(`Invalid image type. Allowed types: ${ALLOWED_IMAGE_TYPES.join(', ')}`);
      }
    }

    // 2. Generate unique S3 Key
    const uuid = crypto.randomUUID();
    const cleanFileName = dto.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const s3Key = `${dto.context.toLowerCase()}/${uuid}-${cleanFileName}`;

    // 3. Create Presigned PUT URL
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: s3Key,
      ContentType: dto.mimeType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    // 4. Determine public access CDN URL
    const cloudfrontUrl = this.cloudfrontDomain
      ? `https://${this.cloudfrontDomain}/${s3Key}`
      : `https://${this.bucketName}.s3.amazonaws.com/${s3Key}`;

    // 5. Track media record in DB
    await this.prisma.media.create({
      data: {
        filename: dto.filename,
        s3Key,
        cloudfrontUrl,
        mimeType: dto.mimeType,
        fileSizeBytes: dto.fileSizeBytes,
        context: dto.context,
      },
    });

    return {
      uploadUrl,
      cloudfrontUrl,
      s3Key,
    };
  }

  async getAllMediaAdmin(page?: number, limit?: number) {
    const { page: safePage, limit: safeLimit, skip } = normalizePagination(page, limit);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.media.findMany({
        skip,
        take: safeLimit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.media.count(),
    ]);

    return paginatedResponse(items, total, safePage, safeLimit);
  }
}
