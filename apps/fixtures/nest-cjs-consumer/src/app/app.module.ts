import '@angular/compiler';

import { Module } from '@nestjs/common';
import { NestAngularSsrModule } from '@anarchitects/nest-angular-ssr';
import { join } from 'node:path';

import { HealthController } from './health.controller';
import { fixtureAngularSsrRegistration } from '../ssr/angular-ssr-fixture';

@Module({
  imports: [
    NestAngularSsrModule.forRoot({
      angular: fixtureAngularSsrRegistration,
      routing: {
        browserAssetsDir: join(process.cwd(), 'src/assets/browser'),
      },
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
