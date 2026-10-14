import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { describeGoogleAuthError } from '../../../core/auth/google-auth-error';
import { describeMembershipError } from '../../../core/auth/membership-error';
import { Logo } from '../../../core/ui/logo/logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, Logo, MatIconModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly submitMethod = signal<'google' | 'password' | null>(null);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  readonly updated = signal(this.route.snapshot.queryParamMap.get('updated') === '1');
  readonly verified = signal(
    this.route.snapshot.queryParamMap.get('verified') === 'true' ||
      this.route.snapshot.queryParamMap.get('verified') === '1',
  );
  readonly unverifiedEmail = signal<string | null>(null);
  readonly resending = signal(false);
  readonly resendSuccess = signal(false);

  async signInWithGoogle(): Promise<void> {
    this.errorMessage.set('');
    this.unverifiedEmail.set(null);
    this.submitting.set(true);
    this.submitMethod.set('google');
    try {
      const hasTenant = await this.auth.loginWithGoogle();
      await this.router.navigateByUrl(hasTenant ? '/panel' : '/auth/onboarding');
    } catch (err) {
      this.errorMessage.set(describeMembershipError(err, describeGoogleAuthError));
    } finally {
      this.submitting.set(false);
      this.submitMethod.set(null);
    }
  }

  async submit(): Promise<void> {
    this.errorMessage.set('');
    this.unverifiedEmail.set(null);
    this.resendSuccess.set(false);
    this.submitting.set(true);
    this.submitMethod.set('password');
    try {
      const hasTenant = await this.auth.login(this.email(), this.password());
      await this.router.navigateByUrl(hasTenant ? '/panel' : '/auth/onboarding');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-not-verified') {
        this.unverifiedEmail.set(this.email());
      } else {
        this.errorMessage.set(
          describeMembershipError(err, () => 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.'),
        );
      }
    } finally {
      this.submitting.set(false);
      this.submitMethod.set(null);
    }
  }

  async resendVerificationMail(): Promise<void> {
    const targetEmail = this.unverifiedEmail() || this.email();
    if (!targetEmail || this.resending()) return;

    this.resending.set(true);
    this.resendSuccess.set(false);
    try {
      await this.auth.resendVerification(targetEmail);
      this.resendSuccess.set(true);
    } catch (err) {
      console.error('Failed to resend verification link', err);
      this.errorMessage.set('Doğrulama bağlantısı tekrar gönderilemedi. Lütfen daha sonra tekrar deneyin.');
    } finally {
      this.resending.set(false);
    }
  }
}
