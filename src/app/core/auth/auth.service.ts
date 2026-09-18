import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  User,
  authState,
  createUserWithEmailAndPassword,
  getIdTokenResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from '@angular/fire/auth';
import { TenantClaims } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);

  private readonly _user = signal<User | null | undefined>(undefined);
  private readonly _claims = signal<TenantClaims | null>(null);

  /** `undefined` = auth state not yet resolved, `null` = signed out. */
  readonly user = this._user.asReadonly();
  readonly claims = this._claims.asReadonly();

  readonly isReady = computed(() => this._user() !== undefined);
  readonly isAuthenticated = computed(() => !!this._user());
  readonly tenantId = computed(() => this._claims()?.tenantId ?? null);
  readonly role = computed(() => this._claims()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isReception = computed(() => this.role() === 'reception');
  readonly isTherapist = computed(() => this.role() === 'therapist');

  constructor() {
    authState(this.auth).subscribe(async (user) => {
      this._user.set(user);
      await this.refreshClaims(user);
    });
  }

  private async refreshClaims(user: User | null): Promise<void> {
    if (!user) {
      this._claims.set(null);
      return;
    }
    const tokenResult = await getIdTokenResult(user);
    const claims = tokenResult.claims as Partial<TenantClaims>;
    this._claims.set(claims.tenantId && claims.role ? (claims as TenantClaims) : null);
  }

  /** Call after any Cloud Function that mutates this user's custom claims (role change, tenant creation). */
  async forceRefreshClaims(): Promise<void> {
    const user = this._user();
    if (!user) return;
    await user.getIdToken(true);
    await this.refreshClaims(user);
  }

  async login(email: string, password: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, email, password);
  }

  /** Creates the Firebase Auth user only — tenant/claims are assigned by the `createTenant` callable. */
  async registerAuthUser(email: string, password: string): Promise<User> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    return credential.user;
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
