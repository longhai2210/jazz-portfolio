import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SiteSettingsDto, UpdateSiteSettingsDto, MailStatusDto } from '@jazz-portfolio/shared';

@ApiTags('Site Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // === Public Endpoints ===

  @Get('public')
  @ApiOperation({ summary: 'Get public site settings' })
  @ApiResponse({ status: 200, description: 'Public settings retrieved successfully' })
  async getPublicSettings(): Promise<{ isContactFormEnabled: boolean }> {
    return this.settingsService.getPublicSettings();
  }

  // === Admin Settings Endpoints ===

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/email')
  @ApiOperation({ summary: 'Get email settings and status (Admin only)' })
  @ApiResponse({ status: 200, description: 'Email settings and connection status returned' })
  async getEmailSettings(): Promise<{ settings: SiteSettingsDto; status: MailStatusDto }> {
    const settings = await this.settingsService.getSettings();
    const status = this.settingsService.getMailStatus();
    return { settings, status };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/email')
  @ApiOperation({ summary: 'Update email settings (Admin only)' })
  @ApiResponse({ status: 200, description: 'Email settings updated successfully' })
  async updateEmailSettings(
    @Body() dto: UpdateSiteSettingsDto,
  ): Promise<SiteSettingsDto> {
    return this.settingsService.updateSettings(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/email/test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a test email notification (Admin only)' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 400, description: 'Email service is not configured' })
  async sendTestEmail(): Promise<{ success: boolean; message: string }> {
    try {
      await this.settingsService.sendTestEmail();
      return { success: true, message: 'Test email sent successfully' };
    } catch (err: any) {
      throw new BadRequestException(err.message || 'Failed to send test email.');
    }
  }
}
