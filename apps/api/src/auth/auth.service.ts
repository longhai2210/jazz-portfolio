import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { AuthResponseDto, AuthUserDto } from '@jazz-portfolio/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.prisma.adminUser.findUnique({
      where: { username },
    });

    if (user && (await bcrypt.compare(pass, user.passwordHash))) {
      const { passwordHash: _passwordHash, ...result } = user;
      return result;
    }
    return null;
  }

  /** Sign JWT for cookie storage; response body only exposes identity. */
  login(user: { id: string; username: string }): { accessToken: string; body: AuthResponseDto } {
    const payload = { username: user.username, sub: user.id };
    return {
      accessToken: this.jwtService.sign(payload),
      body: { username: user.username },
    };
  }

  toAuthUser(user: { id: string; username: string }): AuthUserDto {
    return { id: user.id, username: user.username };
  }

  assertUser(user: { id?: string; username?: string } | undefined): AuthUserDto {
    if (!user?.id || !user?.username) {
      throw new UnauthorizedException('Not authenticated');
    }
    return this.toAuthUser({ id: user.id, username: user.username });
  }
}
