import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { Shell } from './shell';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { VersionService } from '../../core/version/version.service';

describe('Shell Component', () => {
  let shell: Shell;
  let router: Router;
  let mockStorage: Record<string, string> = {};

  beforeEach(async () => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        mockStorage = {};
      },
    };

    if (typeof window !== 'undefined') {
      try {
        Object.defineProperty(window, 'localStorage', {
          value: storageMock,
          writable: true,
          configurable: true,
        });
      } catch {}
    }

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            user: signal({ email: 'admin@odivon.com', displayName: 'Admin User' }),
            role: signal('admin'),
            logout: () => Promise.resolve(),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            isDark: signal(false),
            toggle: () => {},
          },
        },
        {
          provide: VersionService,
          useValue: {
            current: { version: '1.0.2', commit: 'fb43a7d' },
            openModal: () => {},
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Shell);
    shell = fixture.componentInstance;
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    mockStorage = {};
  });

  it('should create the shell component', () => {
    expect(shell).toBeTruthy();
  });

  it('should have all menu groups expanded by default', () => {
    expect(shell.allGroupsExpanded()).toBe(true);
    expect(shell.isGroupExpanded('OPERASYON')).toBe(true);
    expect(shell.isGroupExpanded('KATALOG')).toBe(true);
  });

  it('should collapse and expand individual menu groups on toggleGroup()', () => {
    // Toggle OPERASYON to collapse it
    shell.toggleGroup('OPERASYON');
    expect(shell.isGroupExpanded('OPERASYON')).toBe(false);
    expect(shell.allGroupsExpanded()).toBe(false);

    // Toggle OPERASYON again to expand it
    shell.toggleGroup('OPERASYON');
    expect(shell.isGroupExpanded('OPERASYON')).toBe(true);
    expect(shell.allGroupsExpanded()).toBe(true);
  });

  it('should collapse all groups with collapseAllGroups() and expand with expandAllGroups()', () => {
    shell.collapseAllGroups();
    expect(shell.isGroupExpanded('OPERASYON')).toBe(false);
    expect(shell.isGroupExpanded('KATALOG')).toBe(false);
    expect(shell.isGroupExpanded('FİNANS')).toBe(false);
    expect(shell.allGroupsExpanded()).toBe(false);

    shell.expandAllGroups();
    expect(shell.isGroupExpanded('OPERASYON')).toBe(true);
    expect(shell.isGroupExpanded('KATALOG')).toBe(true);
    expect(shell.allGroupsExpanded()).toBe(true);
  });

  it('should toggle desktop sidebar visibility and mobile sidebar correctly', () => {
    // Desktop sidebar starts visible
    expect(shell.desktopSidebarVisible()).toBe(true);

    // Calling toggleSidebar on desktop toggles visibility
    shell.toggleSidebar();
    expect(shell.desktopSidebarVisible()).toBe(false);

    shell.toggleSidebar();
    expect(shell.desktopSidebarVisible()).toBe(true);

    // Mobile sidebar close
    shell.sidebarOpen.set(true);
    shell.closeSidebar();
    expect(shell.sidebarOpen()).toBe(false);
  });

  it('should filter search results correctly', () => {
    shell.searchQuery.set('Randevu');
    const results = shell.searchResults();
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.label === 'Randevular')).toBe(true);
  });

  it('should manage notifications mark as read', () => {
    expect(shell.unreadCount()).toBeGreaterThan(0);
    shell.markAllNotificationsAsRead();
    expect(shell.unreadCount()).toBe(0);
  });
});
