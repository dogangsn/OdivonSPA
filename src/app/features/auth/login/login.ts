import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { describeGoogleAuthError } from '../../../core/auth/google-auth-error';
import { describeMembershipError } from '../../../core/auth/membership-error';
import { Logo } from '../../../core/ui/logo/logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, Logo],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly submitMethod = signal<'google' | 'password' | null>(null);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');

  async signInWithGoogle(): Promise<void> {
    this.errorMessage.set('');
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
    this.submitting.set(true);
    this.submitMethod.set('password');
    try {
      const hasTenant = await this.auth.login(this.email(), this.password());
      await this.router.navigateByUrl(hasTenant ? '/panel' : '/auth/onboarding');
    } catch (err) {
      this.errorMessage.set(describeMembershipError(err, () => 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.'));
    } finally {
      this.submitting.set(false);
      this.submitMethod.set(null);
    }
  }
}
