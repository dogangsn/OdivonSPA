import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  User,
  authState,
  createUserWithEmailAndPassword,
  getIdTokenResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from '@angular/fire/auth';
import { TenantClaims } from '../models';
import { ApiService } from '../http/api.service';

type MembershipResolution =
  | { status: 'claimed' | 'restored'; tenantId: string; role: TenantClaims['role'] }
  | { status: 'none' };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);
  private readonly api = inject(ApiService);

  private readonly _user = signal<User | null | undefined>(undefined);
  private readonly _claims = signal<TenantClaims | null>(null);
  private readonly _ready = signal(false);

  /** `undefined` = auth state not yet resolved, `null` = signed out. */
  readonly user = this._user.asReadonly();
  readonly claims = this._claims.asReadonly();

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
        await this.ensureMembership(user);
      } catch (error) {
        this._claims.set(null);
        console.error('Firebase üyeliği okunamadı.', error);
      } finally {
        // Guards must wait for claims, not just the Firebase user object.
        this._ready.set(true);
      }
    });
  }

  private async refreshClaims(user: User | null): Promise<TenantClaims | null> {
    if (!user) {
      this._claims.set(null);
      return null;
    }
    const tokenResult = await getIdTokenResult(user, true);
    const claims = tokenResult.claims as Partial<TenantClaims>;
    const tenantClaims = claims.tenantId && claims.role ? (claims as TenantClaims) : null;
    this._claims.set(tenantClaims);
    return tenantClaims;
  }

  /** Firebase ID token for calling our own backend (server/) — auto-refreshes near expiry. */
  async getIdToken(): Promise<string | null> {
    // Auth state notifications may arrive after sign-in resolves. The onboarding
    // request must still carry the freshly signed-in user's token.
    const user = this.auth.currentUser;
    return user ? user.getIdToken() : null;
  }

  /** Call after any backend request that mutates this user's custom claims (role change, tenant creation). */
  async forceRefreshClaims(): Promise<void> {
    const user = this._user();
    if (!user) return;
    await this.refreshClaims(user);
  }

  /**
   * Resolves a lost tenant claim from a single verified active staff membership. The server
   * performs the lookup and rejects ambiguous e-mail matches, so the client never chooses a tenant.
   */
  private async ensureMembership(user: User | null): Promise<boolean> {
    const claims = await this.refreshClaims(user);
    if (claims) return true;
    if (!user) return false;

    const result = await this.api.post<MembershipResolution>('/api/membership/resolve');
    if (result.status === 'restored' || result.status === 'claimed') {
      return !!(await this.refreshClaims(user));
    }
    return false;
  }

  /** Resolves after claims are loaded, so callers can navigate without racing the auth guard. */
  async login(email: string, password: string): Promise<boolean> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    this._user.set(credential.user);
    return this.ensureMembership(credential.user);
  }

  /** Returns `true` when the account already belongs to a tenant, `false` when it still needs onboarding. */
  async loginWithGoogle(): Promise<boolean> {
    const credential = await signInWithPopup(this.auth, new GoogleAuthProvider());
    this._user.set(credential.user);
    return this.ensureMembership(credential.user);
  }

  /** Creates the Firebase Auth user only — tenant/claims are assigned by the `createTenant` callable. */
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
