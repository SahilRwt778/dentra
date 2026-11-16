import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';

/** Multipart keeps the same validated DTO: JSON details plus an optional image. */
@Injectable()
export class ProfilePhotoFormInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.is('multipart/form-data')) {
      try {
        const details: unknown = JSON.parse(request.body.details);
        if (!details || typeof details !== 'object' || Array.isArray(details))
          throw new Error();
        request.body = details;
      } catch {
        throw new BadRequestException(
          'Profile details must be a JSON object.',
        );
      }
    }
    return next.handle();
  }
}
