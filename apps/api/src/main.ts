import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

function resolveCorsOrigins(): string | string[] {
  const raw =
    process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3000';
  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0]! : origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters & interceptors
  const { HttpExceptionFilter } = await import('./common/filters/http-exception.filter');
  const { TransformInterceptor } = await import('./common/interceptors/transform.interceptor');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());


  // API prefix
  app.setGlobalPrefix('api');

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Jazz Portfolio API')
    .setDescription('Backend API for the Jazz Portfolio')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`\ud83c\udfb7 Jazz Portfolio API running on http://localhost:${port}`);
  console.log(`\ud83d\udcda Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
