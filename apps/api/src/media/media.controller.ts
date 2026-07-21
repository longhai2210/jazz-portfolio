import {
  Controller,
  Post,
  Body,
  Get,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresignUploadDto, PresignResponseDto } from './dto/presign-upload.dto';
import { Media } from '@jazz-portfolio/database';
import { PaginatedResponse } from '@jazz-portfolio/shared';

@ApiTags('Media Pipeline')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/presign')
  @ApiOperation({ summary: 'Generate presigned PUT URL for client uploading directly to S3' })
  @ApiResponse({ status: 201, type: PresignResponseDto, description: 'Presigned upload details returned' })
  @ApiResponse({ status: 400, description: 'Invalid file size, mime type or context' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  async generatePresignedUrl(@Body() dto: PresignUploadDto): Promise<PresignResponseDto> {
    return this.mediaService.generatePresignedUrl(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Paginated media upload logs (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated media logs returned successfully' })
  async getAllMediaAdmin(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedResponse<Media>> {
    return this.mediaService.getAllMediaAdmin(page, limit);
  }
}
