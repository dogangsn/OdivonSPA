import { LOCALE_ID, ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeTr from '@angular/common/locales/tr';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { firebaseProviders } from './core/firebase/firebase.providers';
import { provideOdivonIcons } from './core/icons/icon.providers';

registerLocaleData(localeTr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    { provide: LOCALE_ID, useValue: 'tr' },
    ...firebaseProviders,
    provideOdivonIcons(),
  ],
};
