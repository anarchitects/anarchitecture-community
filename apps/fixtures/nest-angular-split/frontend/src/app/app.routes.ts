import { Component } from '@angular/core';
import { Route } from '@angular/router';

@Component({ template: '<p id="route-marker">Home route</p>' })
class HomeRoute {}

export const appRoutes: Route[] = [
  { path: 'redirect', redirectTo: '', pathMatch: 'full' },
  { path: '', component: HomeRoute, pathMatch: 'full' },
];
