import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: 'home',               loadComponent: () => import('./demos/home.component').then(m => m.HomeComponent) },
  { path: 'interpolation',      loadComponent: () => import('./demos/interpolation.component').then(m => m.InterpolationComponent) },
  { path: 'cd-triggers',        loadComponent: () => import('./demos/cd-triggers/cd-triggers.component').then(m => m.CdTriggersComponent) },
  { path: 'reactive-forms',     loadComponent: () => import('./demos/reactive-forms.component').then(m => m.ReactiveFormsComponent) },
  { path: 'immutability',       loadComponent: () => import('./demos/immutability/immutability.component').then(m => m.ImmutabilityComponent) },
  { path: 'onpush-shield',      loadComponent: () => import('./demos/onpush-shield.component').then(m => m.OnpushShieldComponent) },
  { path: 'expression-changed', loadComponent: () => import('./demos/expression-changed.component').then(m => m.ExpressionChangedComponent) },
  { path: 'router-demo',        loadComponent: () => import('./demos/router-demo/router-demo.component').then(m => m.RouterDemoComponent) },
  { path: 'async-writes',       loadComponent: () => import('./demos/async-writes/async-writes.component').then(m => m.AsyncWritesComponent) },
];
