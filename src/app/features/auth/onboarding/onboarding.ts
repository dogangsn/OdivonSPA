import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AuthService } from '../../../core/auth/auth.service';
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
  private readonly functions = inject(Functions);
  private readonly router = inject(Router);

  readonly businessName = signal('');
  readonly ownerName = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly submitting = signal(false);
  readonly errorMessage = signal('');

  async submit(): Promise<void> {
    this.errorMessage.set('');
    this.submitting.set(true);
    try {
      await this.auth.registerAuthUser(this.email(), this.password());

      const createTenant = httpsCallable<{ businessName: string; ownerName: string }, { tenantId: string }>(
        this.functions,
        'createTenant',
      );
      await createTenant({ businessName: this.businessName(), ownerName: this.ownerName() });

      await this.auth.forceRefreshClaims();
      await this.router.navigateByUrl('/panel');
    } catch (err) {
      this.errorMessage.set('Kayıt oluşturulamadı. E-posta zaten kullanılıyor olabilir.');
      console.error(err);
    } finally {
      this.submitting.set(false);
    }
  }
}
