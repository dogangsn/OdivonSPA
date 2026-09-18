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
    } catch {
      this.errorMessage.set('Bu e-posta ile bir hesap bulunamadı.');
    } finally {
      this.submitting.set(false);
    }
  }
}
