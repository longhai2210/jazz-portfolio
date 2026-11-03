import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

function normalizeMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value) return value;
  if (Array.isArray(value)) {
    const messages = value.filter((item): item is string => typeof item === 'string');
    if (messages.length > 0) return messages.join(', ');
  }
  return fallback;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const payload = res as { message?: unknown; error?: unknown };
        message = normalizeMessage(payload.message, message);
        error = normalizeMessage(payload.error, error);
      } else if (typeof res === 'string') {
        message = res;
      }
    } else if (exception instanceof Error) {
      error = exception.name;
    }

    const diagnostic = exception instanceof Error ? exception.stack : String(exception);
    this.logger.error(`${status} - ${error}: ${message}`, diagnostic);

    response.status(status).json({
      statusCode: status,
      message,
      error,
    });
  }
}
