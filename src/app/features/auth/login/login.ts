import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { Logo } from '../../../core/ui/logo/logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, Logo],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  async submit(): Promise<void> {
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      await this.auth.login(this.email(), this.password());
      await this.router.navigateByUrl('/panel');
    } catch {
      this.errorMessage.set('E-posta veya şifre hatalı. Lütfen tekrar deneyin.');
    } finally {
      this.submitting.set(false);
    }
  }
}
