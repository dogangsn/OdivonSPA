import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { Auth, applyActionCode } from '@angular/fire/auth';
import { AuthService } from '../../../core/auth/auth.service';
import { Logo } from '../../../core/ui/logo/logo';
import { ApiError } from '../../../core/http/api-error';

export type VerificationState = 'loading' | 'success' | 'error' | 'idle';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './verify-email.html',
  styleUrl: './verify-email.scss',
})
export class VerifyEmail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly auth = inject(Auth);

  readonly state = signal<VerificationState>('loading');
  readonly verifiedEmail = signal<string | null>(null);
  readonly errorMessage = signal<string>('');
  readonly resendEmail = signal<string>('');
  readonly resending = signal<boolean>(false);
  readonly resendSuccess = signal<boolean>(false);
  readonly resendError = signal<string>('');
  readonly currentYear = new Date().getFullYear();

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParams;
    const token = params['token'];
    const oobCode = params['oobCode'];

    if (token) {
      await this.verifyWithBackendToken(token);
    } else if (oobCode) {
      await this.verifyWithFirebaseActionCode(oobCode);
    } else {
      this.state.set('idle');
    }
  }

  private async verifyWithBackendToken(token: string): Promise<void> {
    this.state.set('loading');
    this.errorMessage.set('');
    try {
      const res = await this.authService.verifyEmail(token);
      this.verifiedEmail.set(res.email || null);
      if (res.email) {
        this.resendEmail.set(res.email);
      }
      this.state.set('success');
    } catch (err: unknown) {
      this.state.set('error');
      if (err instanceof ApiError) {
        this.errorMessage.set(err.message || 'Geçersiz veya süresi dolmuş e-posta doğrulama bağlantısı.');
      } else {
        const message = (err as { message?: string })?.message;
        this.errorMessage.set(message || 'Doğrulama işlemi sırasında bir hata oluştu. Lütfen yeni bir bağlantı isteyin.');
      }
    }
  }

  private async verifyWithFirebaseActionCode(oobCode: string): Promise<void> {
    this.state.set('loading');
    this.errorMessage.set('');
    try {
      await applyActionCode(this.auth, oobCode);
      this.state.set('success');
    } catch (err: unknown) {
      this.state.set('error');
      const message = (err as { message?: string })?.message;
      this.errorMessage.set(message || 'Doğrulama kodu geçersiz veya süresi dolmuş.');
    }
  }

  async sendNewVerificationLink(): Promise<void> {
    const email = this.resendEmail().trim().toLowerCase();
    if (!email || this.resending()) return;

    this.resending.set(true);
    this.resendError.set('');
    this.resendSuccess.set(false);

    try {
      await this.authService.resendVerification(email);
      this.resendSuccess.set(true);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        this.resendError.set(err.message || 'Doğrulama e-postası gönderilemedi. Lütfen tekrar deneyin.');
      } else {
        this.resendError.set('Bağlantı hatası oluştu. Lütfen e-posta adresinizi kontrol edip tekrar deneyin.');
      }
    } finally {
      this.resending.set(false);
    }
  }
}
