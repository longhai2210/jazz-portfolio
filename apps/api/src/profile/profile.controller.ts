import { Controller, Get, Put, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Profile } from '@jazz-portfolio/database';

@ApiTags('Profile & Settings')
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get public portfolio profile' })
  @ApiResponse({ status: 200, description: 'Profile details returned' })
  @ApiResponse({ status: 404, description: 'Profile configuration not found' })
  async getProfile(): Promise<Profile> {
    return this.profileService.getProfile();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/update')
  @ApiOperation({ summary: 'Update profile details (Admin only)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized access token' })
  async updateProfile(@Body() dto: UpdateProfileDto): Promise<Profile> {
    return this.profileService.updateProfile(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/password')
  @ApiOperation({ summary: 'Change admin login password (Admin only)' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Current password does not match' })
  @ApiResponse({ status: 412, description: 'Validation fails' })
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(req.user.id, dto);
  }
}
