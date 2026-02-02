// Import tracing FIRST - before any other imports
import './tracing';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { MetricsMiddleware } from './metrics';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the middleware instance from the DI container and apply it globally
  const metricsMiddleware = app.get(MetricsMiddleware);
  app.use(metricsMiddleware.use.bind(metricsMiddleware));

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'reservation',
      protoPath: join(__dirname, 'proto/reservation.proto'),
      url: `0.0.0.0:${process.env.GRPC_PORT ?? 50052}`,
    },
  });

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Reservation Service API')
    .setDescription('API for managing reservation requests and reservations')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
