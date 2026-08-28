import { bootstrapNestAngularSsr } from '@anarchitects/nest-angular-ssr';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  const globalPrefix = 'api';
  app.setGlobalPrefix(globalPrefix);
  await bootstrapNestAngularSsr(app, {
    angular: {
      buildOutput: {
        root: 'dist/apps/fixtures/nest-angular-split/frontend',
      },
      allowedHosts: ['localhost', '127.0.0.1'],
    },
    routing: { apiPrefix: globalPrefix },
  });
  const port = process.env.PORT || 3000;
  await app.listen(port, '127.0.0.1');
  Logger.log(
    `Application is running on: http://127.0.0.1:${port}/${globalPrefix}`,
  );
}

void bootstrap();
