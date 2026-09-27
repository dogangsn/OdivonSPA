import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../../core/auth/auth.service';
import { Logo } from '../../../core/ui/logo/logo';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, MatIconModule, Logo],
  templateUrl: './forgot-password.html',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  readonly email = signal('');
  readonly submitting = signal(false);
  readonly sent = signal(false);
  readonly errorMessage = signal('');

  async submit(): Promise<void> {
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      await this.auth.resetPassword(this.email());
      this.sent.set(true);
    } catch (err) {
      // Never reveal whether an account exists: an unknown address looks exactly like a sent e-mail.
      const code = (err as { code?: string })?.code;
      if (code === 'auth/invalid-email' || code === 'auth/missing-email') {
        this.errorMessage.set('Geçerli bir e-posta adresi girin.');
      } else if (code === 'auth/too-many-requests' || code === 'auth/network-request-failed') {
        this.errorMessage.set('İstek şu anda gönderilemedi. Lütfen biraz sonra tekrar deneyin.');
      } else {
        this.sent.set(true);
      }
    } finally {
      this.submitting.set(false);
    }
  }
}
