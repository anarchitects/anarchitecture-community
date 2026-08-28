import { NestAngularSsrModule } from '@anarchitects/nest-angular-ssr';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // Runtime registration is explicit in main.ts; importing AppModule must
    // still work in Jest without loading the Angular server bundle.
    NestAngularSsrModule.forRoot({ enabled: false, routing: {} }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
