import 'reflect-metadata';
import { bootstrapNestAngularSsr } from '@anarchitects/nest-angular-ssr';

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule, fixtureOptions } from './app/app.module.js';

async function bootstrap() {
  const port = Number(process.env.PORT ?? '3312');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { logger: false },
  );

  app.setGlobalPrefix('api');
  if (process.env.NEST_SSR_API === 'explicit') {
    await bootstrapNestAngularSsr(app, fixtureOptions);
  }
  app.enableShutdownHooks();
  await app.listen(port, '127.0.0.1');
  console.log(`SSR_FIXTURE_PORT=${new URL(await app.getUrl()).port}`);
}

void bootstrap();
