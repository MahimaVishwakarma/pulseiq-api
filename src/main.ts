import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import helmet from 'helmet';
import compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Security
  app.use(helmet());
  app.use(compression());

  // CORS
  app.enableCors({
    origin: [process.env.FRONTEND_URL ?? 'http://localhost:3000'],
    credentials: true,
  });

  // Global prefix
  app.setGlobalPrefix('api/v1', { exclude: ['stripe/webhook'] });

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('PulseIQ API')
      .setDescription('AI-Native Email Warmup & Lead Intelligence Platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, doc, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = parseInt(process.env.PORT ?? '4000', 10);
  await app.listen(port);
  console.log(`🚀 PulseIQ API running on http://localhost:${port}`);
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
