import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, HttpStatus, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { MusicService } from './music.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateTrackDto, UpdateTrackDto } from './dto/create-track.dto';
import { ReorderDto } from '../categories/dto/reorder-categories.dto';
import { Track } from '@jazz-portfolio/database';
import { TrackDto } from '@jazz-portfolio/shared';

@ApiTags('Music Playlist Management')
@Controller('music')
export class MusicController {
  constructor(private readonly musicService: MusicService) {}

  // === Public Endpoints ===

  @Get()
  @ApiOperation({ summary: 'Get active tracks for background audio playlist' })
  @ApiResponse({ status: 200, description: 'Playlist returned successfully (s3Key omitted)' })
  async getPublicPlaylist(): Promise<TrackDto[]> {
    return this.musicService.getPublicPlaylist();
  }

  // === Admin Endpoints ===

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('admin/all')
  @ApiOperation({ summary: 'Get all tracks including inactive (Admin only)' })
  @ApiResponse({ status: 200, description: 'All tracks returned successfully' })
  async getAllTracksAdmin(): Promise<Track[]> {
    return this.musicService.getAllTracksAdmin();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('admin/create')
  @ApiOperation({ summary: 'Create new track metadata record (Admin only)' })
  @ApiResponse({ status: 201, description: 'Track created successfully' })
  async createTrack(@Body() dto: CreateTrackDto): Promise<Track> {
    return this.musicService.createTrack(dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('admin/:id')
  @ApiOperation({ summary: 'Update track metadata (Admin only)' })
  @ApiParam({ name: 'id', example: 'uuid-1' })
  @ApiResponse({ status: 200, description: 'Track updated successfully' })
  @ApiResponse({ status: 404, description: 'Track not found' })
  async updateTrack(@Param('id') id: string, @Body() dto: UpdateTrackDto): Promise<Track> {
    return this.musicService.updateTrack(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('admin/:id')
  @ApiOperation({ summary: 'Delete track metadata record (Admin only)' })
  @ApiParam({ name: 'id', example: 'uuid-1' })
  @ApiResponse({ status: 200, description: 'Track deleted successfully' })
  @ApiResponse({ status: 404, description: 'Track not found' })
  async deleteTrack(@Param('id') id: string): Promise<Track> {
    return this.musicService.deleteTrack(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('admin/reorder')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reorder playlist tracks (Admin only)' })
  @ApiResponse({ status: 200, description: 'Playlist reordered successfully' })
  async reorderPlaylist(@Body() dto: ReorderDto): Promise<{ success: boolean }> {
    return this.musicService.reorderPlaylist(dto);
  }
}
