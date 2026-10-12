import {
  BootstrapContext,
  bootstrapApplication,
} from '@angular/platform-browser';
import { App } from './ssr/app';
import { config } from './ssr/app.config.server';

const bootstrap = (context: BootstrapContext) =>
  bootstrapApplication(App, config, context);

export default bootstrap;
