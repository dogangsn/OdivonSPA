import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from '@angular/fire/auth';
import { StaffRole, TenantClaims } from '../models';
import { ApiError } from '../http/api-error';
import { ApiService } from '../http/api.service';

/** `GET /spa/me` — the caller's tenant and spa role, resolved by Main API from its user profile. */
interface SpaMe {
  tenantId: string;
  tenantName: string;
  role: StaffRole | null;
  isOwner: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly api = inject(ApiService);

  private readonly _user = signal<User | null | undefined>(undefined);
  private readonly _claims = signal<TenantClaims | null>(null);
  private readonly _tenantName = signal<string | null>(null);
  private readonly _ready = signal(false);

  /** `undefined` = auth state not yet resolved, `null` = signed out. */
  readonly user = this._user.asReadonly();
  readonly claims = this._claims.asReadonly();
  readonly tenantName = this._tenantName.asReadonly();

  readonly isReady = this._ready.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());
  readonly tenantId = computed(() => this._claims()?.tenantId ?? null);
  readonly role = computed(() => this._claims()?.role ?? null);
  readonly isAdmin = computed(() => this.role() === 'admin');
  readonly isReception = computed(() => this.role() === 'reception');
  readonly isTherapist = computed(() => this.role() === 'therapist');

  constructor() {
    authState(this.auth).subscribe(async (user) => {
      // Make the freshly restored Firebase user available to the API interceptor before
      // it asks Firebase for the ID token.
      this._user.set(user);
      try {
        await this.loadMembership(user);
      } catch (error) {
        this._claims.set(null);
        console.error('İşletme üyeliği okunamadı.', error);
      } finally {
        // Guards must wait for the membership, not just the Firebase user object.
        this._ready.set(true);
      }
    });
  }

  /** Firebase ID token for calling Odivon Main API — auto-refreshes near expiry. */
  async getIdToken(): Promise<string | null> {
    // Auth state notifications may arrive after sign-in resolves. The onboarding
    // request must still carry the freshly signed-in user's token.
    const user = this.auth.currentUser;
    return user ? user.getIdToken() : null;
  }

  /** Call after any request that changes this user's tenant or role (onboarding, role change). */
  async forceRefreshClaims(): Promise<void> {
    await this.loadMembership(this.auth.currentUser);
  }

  /**
   * Reads the tenant and role from Main API. A signed-in user without a profile yet (fresh
   * sign-up, first Google login) gets `false` and is sent to onboarding.
   */
  private async loadMembership(user: User | null): Promise<boolean> {
    if (!user) {
      this._claims.set(null);
      this._tenantName.set(null);
      return false;
    }
    try {
      const me = await this.api.get<SpaMe>('/spa/me');
      const claims = me.role ? { tenantId: me.tenantId, role: me.role } : null;
      this._claims.set(claims);
      this._tenantName.set(me.tenantName);
      return !!claims;
    } catch (error) {
      if (error instanceof ApiError && error.apiCode === 'USER_NOT_FOUND') {
        this._claims.set(null);
        return false;
      }
      throw error;
    }
  }

  /** Resolves after the membership is loaded, so callers can navigate without racing the auth guard. */
  async login(email: string, password: string): Promise<boolean> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    this._user.set(credential.user);
    return this.loadMembership(credential.user);
  }

  /** Returns `true` when the account already belongs to a tenant, `false` when it still needs onboarding. */
  async loginWithGoogle(): Promise<boolean> {
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    this._user.set(credential.user);
    return this.loadMembership(credential.user);
  }

  /** Creates the Firebase Auth user only — the tenant is created by `POST /spa/onboarding`. */
  async registerAuthUser(email: string, password: string): Promise<User> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    this._user.set(credential.user);
    return credential.user;
  }

  async resetPassword(email: string): Promise<void> {
    await sendPasswordResetEmail(this.auth, email);
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }
}
