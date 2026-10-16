import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { ApiService } from '../../../core/http/api.service';
import { ApiError } from '../../../core/http/api-error';
import { Logo } from '../../../core/ui/logo/logo';

export interface RegistrationSuccessInfo {
  email: string;
  displayName: string;
  tenantName: string;
}

/** Handles new business registration with email verification. */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule, RouterLink, Logo, MatIconModule],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.scss',
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
  readonly resending = signal(false);
  readonly resendSuccess = signal(false);
  readonly submitMethod = signal<'form' | null>(null);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly registeredSuccess = signal<RegistrationSuccessInfo | null>(null);

  readonly signedInEmail = computed(() => this.auth.user()?.email ?? null);

  constructor() {
    const user = this.auth.user();
    if (user) {
      this.ownerName.set(user.displayName ?? '');
      this.email.set(user.email ?? '');
    }
  }

  async switchAccount(): Promise<void> {
    await this.auth.logout();
    await this.router.navigateByUrl('/auth/login');
  }

  async submit(): Promise<void> {
    if (this.submitting()) return;

    this.errorMessage.set('');
    this.submitting.set(true);
    this.submitMethod.set('form');

    try {
      if (this.signedInEmail()) {
        // User already has an authenticated Google session; complete tenant creation directly.
        await this.api.post<{ tenantId: string }>('/spa/onboarding', {
          businessName: this.businessName(),
          ownerName: this.ownerName(),
        });
        await this.auth.forceRefreshClaims();
        await this.router.navigateByUrl('/panel');
      } else {
        // Standard email/password registration with email verification workflow
        const result = await this.auth.register({
          tenantName: this.businessName(),
          displayName: this.ownerName(),
          email: this.email(),
          password: this.password(),
        });

        this.registeredSuccess.set(result);
      }
    } catch (err) {
      this.errorMessage.set(describeError(err));
      console.error(err);
    } finally {
      this.submitting.set(false);
      this.submitMethod.set(null);
    }
  }

  async resendVerificationMail(): Promise<void> {
    const successInfo = this.registeredSuccess();
    if (!successInfo?.email || this.resending()) return;

    this.resending.set(true);
    this.resendSuccess.set(false);
    try {
      await this.auth.resendVerification(successInfo.email);
      this.resendSuccess.set(true);
    } catch (err) {
      console.error('Failed to resend verification link', err);
      this.errorMessage.set('Doğrulama bağlantısı tekrar gönderilemedi. Lütfen bir süre sonra tekrar deneyin.');
    } finally {
      this.resending.set(false);
    }
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.message) {
      return err.message;
    }
    switch (err.code) {
      case 'unavailable':
        return 'Kayıt sunucusuna şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.';
      case 'not-found':
        return 'Kayıt servisi bulunamadı. Lütfen sistem yöneticisiyle iletişime geçin.';
      case 'internal':
        return 'Kayıt sunucusunda bir hata oluştu. Lütfen tekrar deneyin.';
      case 'unauthenticated':
        return 'Oturumunuz doğrulanamadı. Lütfen yeniden deneyin.';
      case 'invalid-argument':
        return err.message || 'Lütfen girdiğiniz bilgileri kontrol edin.';
      case 'failed-precondition':
        return err.message || 'Bu kullanıcı zaten bir işletmeye bağlı. Giriş yapmayı deneyin.';
      default:
        return 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.';
    }
  }

  const code = (err as { code?: string }).code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
    case 'auth/email-already-exists':
      return 'Bu e-posta adresi zaten kayıtlı. Lütfen giriş yapmayı deneyin.';
    case 'auth/weak-password':
      return 'Şifre en az 8 karakter uzunluğunda olmalıdır.';
    case 'auth/invalid-email':
      return 'Lütfen geçerli bir e-posta adresi girin.';
    case 'auth/network-request-failed':
      return 'Bağlantı hatası. Lütfen internet bağlantınızı kontrol edin.';
    default:
      return (err as { message?: string })?.message || 'Kayıt oluşturulamadı. Lütfen tekrar deneyin.';
  }
}
