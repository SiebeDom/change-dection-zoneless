import { ApplicationConfig, provideZonelessChangeDetection, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { routes } from './app.routes';

// Toggled by the UI: stored in localStorage, page reloads to apply
const useZone = localStorage.getItem('cd-mode') === 'zone';

export const appConfig: ApplicationConfig = {
  providers: [
    useZone
      ? provideZoneChangeDetection({ eventCoalescing: true })
      : provideZonelessChangeDetection(),
    provideRouter(routes),
    providePrimeNG({
      theme: { preset: Aura, options: { darkModeSelector: false } }
    })
  ]
};
