import '@angular/compiler';

import { Module } from '@nestjs/common';
import { NestAngularSsrModule } from '@anarchitects/nest-angular-ssr';
import { join } from 'node:path';

import { HealthController } from './health.controller.js';
import { fixtureAngularSsrRegistration } from '../ssr/angular-ssr-fixture.js';

export const fixtureOptions = {
  angular: fixtureAngularSsrRegistration,
  routing: { browserAssetsDir: join(process.cwd(), 'src/assets/browser') },
};

@Module({
  imports: [
    ...(process.env.NEST_SSR_API === 'explicit'
      ? []
      : [
          process.env.NEST_SSR_API === 'async'
            ? NestAngularSsrModule.forRootAsync({
                useFactory: async () => fixtureOptions,
              })
            : NestAngularSsrModule.forRoot(fixtureOptions),
        ]),
  ],
  controllers: [HealthController],
})
export class AppModule {}
