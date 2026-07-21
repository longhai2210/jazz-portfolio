import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AUTH_COOKIE_NAME } from '../auth-cookie';

interface JwtPayload {
  sub: string;
  username: string;
}

function cookieExtractor(req: Request): string | null {
  const token = req?.cookies?.[AUTH_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is missing');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Trust the signed JWT payload — no DB round-trip per request.
   * Password-change / revoke flows should invalidate tokens via short TTL or a denylist later.
   */
  validate(payload: JwtPayload) {
    if (!payload?.sub || !payload?.username) {
      throw new UnauthorizedException('Invalid token payload');
    }

    return { id: payload.sub, username: payload.username };
  }
}
