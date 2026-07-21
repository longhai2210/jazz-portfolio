import {
  Controller,
  Post,
  Get,
  UseGuards,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import {
  AUTH_COOKIE_NAME,
  buildAuthCookieOptions,
  buildClearAuthCookieOptions,
} from './auth-cookie';
import { AuthResponseDto, AuthUserDto } from '@jazz-portfolio/shared';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login admin user; sets httpOnly JWT cookie',
    description:
      'Sets cookie `jazz_access_token` (httpOnly, Secure per env, SameSite via COOKIE_SAME_SITE). ' +
      'For cross-origin web→api, use COOKIE_SAME_SITE=none and COOKIE_SECURE=true with CORS credentials.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful; JWT set as httpOnly cookie' })
  @ApiResponse({ status: 401, description: 'Invalid username or password' })
  async login(
    @Request() req: { user: { id: string; username: string } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, body } = this.authService.login(req.user);
    res.cookie(AUTH_COOKIE_NAME, accessToken, buildAuthCookieOptions());
    return body;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear admin JWT httpOnly cookie' })
  @ApiResponse({ status: 200, description: 'Cookie cleared' })
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ success: boolean }> {
    res.clearCookie(AUTH_COOKIE_NAME, buildClearAuthCookieOptions());
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return current admin from JWT (cookie or Bearer)' })
  @ApiResponse({ status: 200, description: 'Authenticated user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  me(@Request() req: { user: { id: string; username: string } }): AuthUserDto {
    return this.authService.assertUser(req.user);
  }
}
