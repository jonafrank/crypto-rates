import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT || 3001);
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  app.enableCors({ origin: corsOrigin, credentials: false });
  app.enableShutdownHooks();
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to bootstrap app', err);
  process.exit(1);
});
