import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app/app.module.js';
import { setupAngularSsrFixture } from './ssr/angular-ssr-fixture.js';

async function bootstrap() {
  const port = Number(process.env.PORT ?? '3312');

  await setupAngularSsrFixture();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  app.setGlobalPrefix('api');
  await app.listen(port, '127.0.0.1');
}

void bootstrap();
