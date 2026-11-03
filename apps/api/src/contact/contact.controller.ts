import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { ContactService } from './contact.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateContactSubmissionDto } from './dto/create-contact-submission.dto';
import {
  ContactSubmissionDto,
  ContactSubmissionListItemDto,
  CreateContactSubmissionResponseDto,
} from './dto/contact-submission.dto';
import { PaginatedResponse } from '@jazz-portfolio/shared';

import { FeatureFlagGuard } from '../common/feature-flag/feature-flag.guard';
import { RequireFeature } from '../common/feature-flag/require-feature.decorator';

@ApiTags('Contact Form')
@Controller()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  // === Public Endpoint ===

  @UseGuards(ThrottlerGuard, FeatureFlagGuard)
  @RequireFeature('contact')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit contact form message' })
  @ApiResponse({
    status: 201,
    description: 'Message stored; notification email queued',
    type: CreateContactSubmissionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error or invalid honeypot field' })
  @ApiResponse({ status: 403, description: 'Contact form is disabled' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @ApiResponse({ status: 503, description: 'Email notification service is not configured' })
  async createSubmission(
    @Body() dto: CreateContactSubmissionDto,
  ): Promise<CreateContactSubmissionResponseDto> {
    return this.contactService.createSubmission(dto);
  }


  // === Admin Endpoints ===

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/contact')
  @ApiOperation({ summary: 'Paginated contact submissions without full message body (Admin only)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated submissions list retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listSubmissions(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedResponse<ContactSubmissionListItemDto>> {
    return this.contactService.listSubmissions(page, limit);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/contact/:id')
  @ApiOperation({ summary: 'Get a single contact submission with full body (Admin only)' })
  @ApiParam({ name: 'id', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Submission retrieved successfully', type: ContactSubmissionDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async getSubmission(@Param('id') id: string): Promise<ContactSubmissionDto> {
    return this.contactService.getSubmissionById(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/contact/:id/read')
  @ApiOperation({ summary: 'Mark contact submission as read (Admin only)' })
  @ApiParam({ name: 'id', example: '123e4567-e89b-12d3-a456-426614174000' })
  @ApiResponse({ status: 200, description: 'Submission marked as read successfully', type: ContactSubmissionDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Submission not found' })
  async markAsRead(@Param('id') id: string): Promise<ContactSubmissionDto> {
    return this.contactService.markAsRead(id);
  }
}
