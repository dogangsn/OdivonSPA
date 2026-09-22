/** Explain actionable Google sign-in failures without exposing credential details. */
export function describeGoogleAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? error.code
    : undefined;

  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return '';
    case 'auth/unauthorized-domain':
      return 'Bu site adresi Google ile giriş için yetkilendirilmemiş. Site yöneticisiyle iletişime geçin veya yerel geliştirmede localhost adresini kullanın.';
    case 'auth/popup-blocked':
      return 'Tarayıcı giriş penceresini engelledi. Bu site için açılır pencerelere izin verip tekrar deneyin.';
    case 'auth/operation-not-allowed':
      return 'Google ile giriş etkin değil. Site yöneticisiyle iletişime geçin.';
    case 'auth/network-request-failed':
      return 'Google ile giriş servisine ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
    case 'auth/account-exists-with-different-credential':
      return 'Bu e-posta başka bir giriş yöntemiyle kayıtlı. Hesabınızı oluşturduğunuz yöntemle giriş yapın.';
    case 'auth/user-disabled':
      return 'Bu hesap devre dışı bırakılmış. Site yöneticisiyle iletişime geçin.';
    case 'auth/web-storage-unsupported':
      return 'Tarayıcı oturum verilerini saklayamıyor. Site verilerine izin verip tekrar deneyin.';
    default:
      return 'Google ile giriş yapılamadı. Lütfen tekrar deneyin.';
  }
}
