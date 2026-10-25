import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/** Status codes this API uses that aren't in Nest's built-in HttpStatus enum. */
const EXTRA_STATUS_CODES: Record<number, string> = {
  423: 'LOCKED',
};

/**
 * Normalizes every thrown error into the Error schema from openapi.yaml
 * ({ code, message }) so no endpoint leaks a stack trace or a bare
 * NestJS default error shape to a client.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('UnhandledException');

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // A 500 here means a bug, not a client mistake — log the real cause
    // server-side; the client still only ever sees {code, message}.
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
    }

    const body =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof body === 'string'
        ? body
        : (body as { message?: string | string[] })?.message ?? 'Unexpected error';

    response.status(status).json({
      code: HttpStatus[status] ?? EXTRA_STATUS_CODES[status] ?? 'ERROR',
      message: Array.isArray(message) ? message.join(', ') : message,
    });
  }
}
