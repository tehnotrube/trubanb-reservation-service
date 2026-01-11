// Import tracing FIRST - before any other imports
import './tracing';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MetricsMiddleware } from './metrics';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the middleware instance from the DI container and apply it globally
  const metricsMiddleware = app.get(MetricsMiddleware);
  app.use(metricsMiddleware.use.bind(metricsMiddleware));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
