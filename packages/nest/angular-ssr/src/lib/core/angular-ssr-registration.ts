import type { ApplicationRef, Type } from '@angular/core';
import type { BootstrapContext } from '@angular/platform-browser';

export type AngularSsrServerBootstrap =
  | Type<unknown>
  | ((context: BootstrapContext) => Promise<ApplicationRef>);

export type AngularSsrServerBootstrapLoader = () => Promise<AngularSsrServerBootstrap>;

export interface AngularSsrRegistrationOptions {
  bootstrap: AngularSsrServerBootstrapLoader;
  document: string;
  baseHref?: string;
  inlineCriticalCss?: boolean;
  routeExtractionUrl?: string | URL;
  allowedHosts?: readonly string[];
}
