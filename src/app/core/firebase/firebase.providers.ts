import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth, connectAuthEmulator } from '@angular/fire/auth';
import { environment } from '../../../environments/environment';

/**
 * Firebase is used for Authentication only; all data goes through Odivon Main API
 * (`environment.apiBaseUrl`). When `environment.useEmulators` is true, Auth points at the local
 * Firebase Auth emulator.
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
];
