import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrackDto, UpdateTrackDto } from './dto/create-track.dto';
import { ReorderDto } from '../categories/dto/reorder-categories.dto';
import { Track } from '@jazz-portfolio/database';
import { TrackDto } from '@jazz-portfolio/shared';

@Injectable()
export class MusicService {
  constructor(private prisma: PrismaService) {}

  async getPublicPlaylist(): Promise<TrackDto[]> {
    return this.prisma.track.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        title: true,
        artist: true,
        cloudfrontUrl: true,
        durationSeconds: true,
        sortOrder: true,
        isActive: true,
      },
    });
  }

  async getAllTracksAdmin(): Promise<Track[]> {
    return this.prisma.track.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getTrackById(id: string): Promise<Track> {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) {
      throw new NotFoundException(`Track with ID "${id}" not found`);
    }
    return track;
  }

  async createTrack(dto: CreateTrackDto): Promise<Track> {
    return this.prisma.track.create({
      data: {
        title: dto.title,
        artist: dto.artist,
        s3Key: dto.s3Key,
        cloudfrontUrl: dto.cloudfrontUrl,
        durationSeconds: dto.durationSeconds,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async updateTrack(id: string, dto: UpdateTrackDto): Promise<Track> {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) {
      throw new NotFoundException(`Track with ID "${id}" not found`);
    }

    return this.prisma.track.update({
      where: { id },
      data: {
        title: dto.title,
        artist: dto.artist,
        s3Key: dto.s3Key,
        cloudfrontUrl: dto.cloudfrontUrl,
        durationSeconds: dto.durationSeconds,
        sortOrder: dto.sortOrder,
        isActive: dto.isActive,
      },
    });
  }

  async deleteTrack(id: string): Promise<Track> {
    const track = await this.prisma.track.findUnique({ where: { id } });
    if (!track) {
      throw new NotFoundException(`Track with ID "${id}" not found`);
    }

    return this.prisma.track.delete({ where: { id } });
  }

  async reorderPlaylist(dto: ReorderDto): Promise<{ success: boolean }> {
    await this.prisma.$transaction(
      dto.ids.map((id, index) =>
        this.prisma.track.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }
}

