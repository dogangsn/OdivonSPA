import { TestBed } from '@angular/core/testing';
import { ThemeService, THEME_COOKIE_NAME, THEME_STORAGE_KEY, getCookie, setCookie, removeCookie } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
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

    // Clear cookies & storage
    removeCookie(THEME_COOKIE_NAME);
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}

    TestBed.configureTestingModule({
      providers: [ThemeService],
    });
    service = TestBed.inject(ThemeService);
  });

  afterEach(() => {
    removeCookie(THEME_COOKIE_NAME);
    try {
      localStorage.removeItem(THEME_STORAGE_KEY);
    } catch {}
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should set theme mode to dark and persist in cookie and localStorage', () => {
    service.setMode('dark');
    expect(service.mode()).toBe('dark');
    expect(service.isDark()).toBe(true);

    // Verify cookie
    expect(getCookie(THEME_COOKIE_NAME)).toBe('dark');
    // Verify localStorage fallback
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    // Verify DOM class
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('should set theme mode to light and persist in cookie and localStorage', () => {
    service.setMode('light');
    expect(service.mode()).toBe('light');
    expect(service.isDark()).toBe(false);

    // Verify cookie
    expect(getCookie(THEME_COOKIE_NAME)).toBe('light');
    // Verify localStorage fallback
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    // Verify DOM class
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should toggle between dark and light modes', () => {
    service.setMode('light');
    expect(service.isDark()).toBe(false);

    service.toggle();
    expect(service.isDark()).toBe(true);
    expect(service.mode()).toBe('dark');
    expect(getCookie(THEME_COOKIE_NAME)).toBe('dark');

    service.toggle();
    expect(service.isDark()).toBe(false);
    expect(service.mode()).toBe('light');
    expect(getCookie(THEME_COOKIE_NAME)).toBe('light');
  });

  it('cookie helpers should set, get and remove cookie correctly', () => {
    setCookie('test_cookie', 'test_val', 1);
    expect(getCookie('test_cookie')).toBe('test_val');

    removeCookie('test_cookie');
    expect(getCookie('test_cookie')).toBeNull();
  });
});
