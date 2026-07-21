import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { Profile } from '@jazz-portfolio/database';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfile(): Promise<Profile> {
    const profile = await this.prisma.profile.findUnique({
      where: { id: 'default-profile' },
    });
    if (!profile) {
      throw new NotFoundException('Profile configuration not found');
    }
    return profile;
  }

  async updateProfile(dto: UpdateProfileDto): Promise<Profile> {
    return this.prisma.profile.update({
      where: { id: 'default-profile' },
      data: {
        name: dto.name as any,
        title: dto.title as any,
        introduction: dto.introduction as any,
        bio: dto.bio as any,
        avatarUrl: dto.avatarUrl,
        backgroundUrl: dto.backgroundUrl,
        socialLinks: dto.socialLinks as any,
        contactInfo: dto.contactInfo as any,
        isMusicEnabled: dto.isMusicEnabled,
      },
    });

  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Admin user not found');
    }

    const isMatch = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Current password does not match');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }
}
