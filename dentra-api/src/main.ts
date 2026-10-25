import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from '@common/filters/http-exception.filter';
import type { AppConfig } from '@config/configuration';

async function bootstrap() {
  // rawBody: true preserves the untouched request body bytes on
  // req.rawBody alongside Nest's normal JSON-parsed req.body — needed
  // by the Razorpay webhook handler, which must verify its HMAC
  // signature against the exact bytes Razorpay sent, not a
  // re-serialized JSON.parse() of them.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useBodyParser('json', { type: ['application/json', 'application/webhook+json'] });

  const appConfig = app.get(ConfigService<AppConfig>);
  app.enableCors({ origin: appConfig.get('corsOrigins', { infer: true }) });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  // JwtAuthGuard and RolesGuard are registered as APP_GUARD providers in
  // AppModule, not here — that's what gets them real DI (JwtService,
  // Reflector) instead of a half-constructed instance.

  const config = new DocumentBuilder()
    .setTitle('Dentra API')
    .setDescription('See ../openapi.yaml for the authored contract this implements.')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
