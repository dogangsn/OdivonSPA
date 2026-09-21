import { inject } from '@angular/core';
import { provideFirebaseApp, initializeApp, FirebaseApp } from '@angular/fire/app';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { provideFirestore, initializeFirestore, connectFirestoreEmulator } from '@angular/fire/firestore';
import { provideStorage, getStorage, connectStorageEmulator } from '@angular/fire/storage';
import { provideAnalytics, getAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { environment } from '../../../environments/environment';

/**
 * Firebase (AngularFire) providers for the app. When `environment.useEmulators` is true,
 * every service is pointed at the local Firebase Emulator Suite so development never touches
 * real tenant data (see `firebase.json` for emulator ports).
 */
export const firebaseProviders = [
  provideFirebaseApp(() => initializeApp(environment.firebase)),
  provideAuth(() => {
    const auth = getAuth();
    if (environment.useEmulators) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    }
    return auth;
  }),
  provideFirestore(() => {
    // ignoreUndefinedProperties: our services pass `field: value || undefined` for optional
    // fields, and Firestore's addDoc/updateDoc otherwise reject any `undefined` value outright.
    const app = inject(FirebaseApp);
    const firestore = initializeFirestore(app, { ignoreUndefinedProperties: true });
    if (environment.useEmulators) {
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
    }
    return firestore;
  }),
  provideStorage(() => {
    const storage = getStorage();
    if (environment.useEmulators) {
      connectStorageEmulator(storage, '127.0.0.1', 9199);
    }
    return storage;
  }),
  // Analytics has no emulator and would otherwise pollute real reports with local dev traffic.
  ...(environment.production ? [provideAnalytics(() => getAnalytics()), ScreenTrackingService, UserTrackingService] : []),
];
