import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { describeGoogleAuthError } from '../../../core/auth/google-auth-error';
import { describeMembershipError } from '../../../core/auth/membership-error';
import { ApiService } from '../../../core/http/api.service';
import { ApiError } from '../../../core/http/api-error';
import { Logo } from '../../../core/ui/logo/logo';

/** Creates the Firebase Auth user, then calls the `createTenant` callable which sets up
 *  `/tenants/{id}` and stamps the caller's custom claims to `{ tenantId, role: 'admin' }`. */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, RouterLink, Logo],
  templateUrl: './onboarding.html',
})
export class Onboarding {
  private readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly businessName = signal('');
  readonly ownerName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  /** Already signed in (e.g. with Google) but without a tenant yet — skip creating the Auth user. */
  readonly signedInEmail = computed(() => this.auth.user()?.email ?? null);

  constructor() {
    const user = this.auth.user();
    if (user) {
      this.ownerName.set(user.displayName ?? '');
      this.email.set(user.email ?? '');
    }
  }

  async signUpWithGoogle(): Promise<void> {
    this.errorMessage.set('');
    try {
      const hasTenant = await this.auth.loginWithGoogle();
      if (hasTenant) {
        await this.router.navigateByUrl('/panel');
        return;
      }
      this.ownerName.set(this.auth.user()?.displayName ?? '');
      this.email.set(this.auth.user()?.email ?? '');
    } catch (err) {
      this.errorMessage.set(describeMembershipError(err, describeGoogleAuthError));
    }
  }

  async switchAccount(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  async submit(): Promise<void> {
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      if (!this.signedInEmail()) {
        await this.auth.registerAuthUser(this.email(), this.password());
      }

      await this.api.post<{ tenantId: string }>('/api/tenants', { businessName: this.businessName(), ownerName: this.ownerName() });

      await this.auth.forceRefreshClaims();
      await this.router.navigateByUrl('/panel');
    } catch (err) {
      this.errorMessage.set(describeError(err));
      console.error(err);
    } finally {
      this.submitting.set(false);
    }
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'unavailable':
        return 'İşletme kaydı sunucusuna ulaşılamıyor. Lütfen daha sonra tekrar deneyin.';
      case 'not-found':
        return 'İşletme kaydı servisi bu adreste bulunamadı. Site yöneticisiyle iletişime geçin.';
      case 'internal':
        return 'İşletme kaydı sunucusunda hata oluştu. Lütfen daha sonra tekrar deneyin.';
      case 'unauthenticated':
        return 'Oturumunuz doğrulanamadı. Yeniden giriş yapıp tekrar deneyin.';
      case 'invalid-argument':
        return err.message;
      case 'failed-precondition':
        return err.message || 'Bu kullanıcı zaten bir işletmeye bağlı. Giriş yapın.';
      default:
        return 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.';
    }
  }

  const code = (err as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Bu e-posta zaten kayıtlı. Giriş yapın; işletmeniz yoksa buraya yönlendirilirsiniz.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalı.';
    case 'auth/invalid-email':
      return 'Geçerli bir e-posta girin.';
    case 'auth/network-request-failed':
      return 'Bağlantı hatası. İnternetinizi kontrol edin.';
    default:
      return 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.';
  }
}
