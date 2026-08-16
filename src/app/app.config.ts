import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideEnvironmentInitializer,
  provideZonelessChangeDetection
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { providePrimeNG } from 'primeng/config';
import { ConfirmationService, MessageService } from 'primeng/api';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { provideServiceWorker } from '@angular/service-worker';

// Warm "appetite" orange as the brand/primary accent — distinct from the
// success/danger greens & reds already used for status tags across the app.
// Light mode nudges the interactive shade one step darker (700 instead of the
// Aura default 500) so button/link text clears 4.5:1 contrast against white.
const FoodTrackerPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{orange.50}',
      100: '{orange.100}',
      200: '{orange.200}',
      300: '{orange.300}',
      400: '{orange.400}',
      500: '{orange.500}',
      600: '{orange.600}',
      700: '{orange.700}',
      800: '{orange.800}',
      900: '{orange.900}',
      950: '{orange.950}'
    },
    colorScheme: {
      light: {
        primary: {
          color: '{primary.700}',
          contrastColor: '#ffffff',
          hoverColor: '{primary.800}',
          activeColor: '{primary.900}'
        }
      }
    }
  }
});

import { routes } from './app.routes';
import { GlobalErrorHandlerService } from './core/services/global-error-handler.service';
import { LanguageService } from './core/services/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    provideHttpClient(),
    provideRouter(routes),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/i18n/',
        suffix: '.json'
      }),
      fallbackLang: 'fr',
      lang: 'fr'
    }),
    provideEnvironmentInitializer(() => {
      inject(LanguageService);
    }),
    providePrimeNG({
      ripple: true,
      inputVariant: 'filled',
      theme: {
        preset: FoodTrackerPreset,
        options: {
          darkModeSelector: '.app-dark'
        }
      }
    }),
    MessageService,
    ConfirmationService,
    {
      provide: ErrorHandler,
      useClass: GlobalErrorHandlerService
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000'
    })
  ]
};
