import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { StaffRole } from '../models';
import { authGuard, guestGuard } from './auth.guard';
import { roleGuard } from './role.guard';

class FakeAuth {
  readonly isReady = signal(true);
  readonly isAuthenticated = signal(false);
  readonly tenantId = signal<string | null>(null);
  readonly role = signal<StaffRole | null>(null);
}

describe('route guards', () => {
  let auth: FakeAuth;
  const route = {} as ActivatedRouteSnapshot;
  const state = {} as RouterStateSnapshot;

  beforeEach(() => {
    auth = new FakeAuth();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  });

  const run = (guard: typeof authGuard) => TestBed.runInInjectionContext(() => guard(route, state));
  const path = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

  it('authGuard sends guests to login and tenant-less users to onboarding', async () => {
    expect(path(await run(authGuard))).toBe('/auth/login');

    auth.isAuthenticated.set(true);
    expect(path(await run(authGuard))).toBe('/auth/onboarding');

    auth.tenantId.set('t1');
    expect(await run(authGuard)).toBe(true);
  });

  it('authGuard waits until auth state is ready', async () => {
    auth.isReady.set(false);
    auth.isAuthenticated.set(true);
    auth.tenantId.set('t1');
    const pending = run(authGuard) as Promise<unknown>;
    let settled = false;
    void pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    auth.isReady.set(true);
    TestBed.tick();
    expect(await pending).toBe(true);
  });

  it('guestGuard sends signed-in members to the panel', async () => {
    expect(await run(guestGuard)).toBe(true);
    auth.isAuthenticated.set(true);
    auth.tenantId.set('t1');
    expect(path(await run(guestGuard))).toBe('/panel');
  });

  it('roleGuard only lets listed roles through', () => {
    const adminOnly = roleGuard(['admin']);
    auth.role.set('reception');
    expect(path(run(adminOnly))).toBe('/panel');
    auth.role.set(null);
    expect(path(run(adminOnly))).toBe('/panel');
    auth.role.set('admin');
    expect(run(adminOnly)).toBe(true);
    auth.role.set('therapist');
    expect(run(roleGuard(['admin', 'reception', 'therapist']))).toBe(true);
  });
});
