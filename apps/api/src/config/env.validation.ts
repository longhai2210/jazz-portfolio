import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsString, validateSync, MinLength, IsOptional } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @Type(() => Number)
  PORT = 3001;

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters long' })
  JWT_SECRET!: string;

  @IsString()
  JWT_EXPIRATION = '24h';

  @IsString()
  AWS_REGION = 'ap-southeast-1';

  @IsString()
  AWS_S3_BUCKET!: string;

  @IsString()
  AWS_CLOUDFRONT_DOMAIN = '';

  @IsString()
  FRONTEND_URL = 'http://localhost:3000';

  /** Comma-separated allowlist; overrides FRONTEND_URL when set. Required with credentials: true. */
  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  /**
   * Cookie SameSite for the JWT httpOnly cookie.
   * Use `none` for cross-origin web→api (also requires Secure / COOKIE_SECURE=true).
   */
  @IsString()
  @IsOptional()
  COOKIE_SAME_SITE?: string;

  /** Override Secure flag on auth cookie (`true`/`false`). Default: true when SameSite=none. */
  @IsString()
  @IsOptional()
  COOKIE_SECURE?: string;

  @IsEnum(['resend', 'smtp'])
  MAIL_PROVIDER = 'resend';

  @IsString()
  @IsOptional()
  MAIL_FROM?: string;

  @IsString()
  @IsOptional()
  MAIL_TO?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  SMTP_PORT = 587;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
