import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    canActivate: [guestGuard],
    children: [
      { path: 'login', loadComponent: () => import('./features/auth/login/login').then((m) => m.Login) },
      {
        path: 'onboarding',
        loadComponent: () => import('./features/auth/onboarding/onboarding').then((m) => m.Onboarding),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./features/auth/forgot-password/forgot-password').then((m) => m.ForgotPassword),
      },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', redirectTo: 'panel', pathMatch: 'full' },
      { path: 'panel', loadComponent: () => import('./features/dashboard/panel').then((m) => m.Panel) },

      {
        path: 'randevular',
        loadComponent: () => import('./features/appointments/appointments-calendar').then((m) => m.AppointmentsCalendar),
      },
      {
        path: 'seanslar',
        children: [
          { path: '', loadComponent: () => import('./features/sessions-pos/sessions-list').then((m) => m.SessionsList) },
          { path: 'yeni', loadComponent: () => import('./features/sessions-pos/pos').then((m) => m.Pos) },
          { path: ':id/fis', loadComponent: () => import('./features/sessions-pos/session-receipt').then((m) => m.SessionReceipt) },
        ],
      },
      {
        path: 'musteriler',
        children: [
          { path: '', loadComponent: () => import('./features/customers/customers-list').then((m) => m.CustomersList) },
          {
            path: ':id',
            loadComponent: () => import('./features/customers/customer-detail').then((m) => m.CustomerDetail),
          },
        ],
      },
      {
        path: 'paketler',
        loadComponent: () => import('./features/packages/packages-list').then((m) => m.PackagesList),
      },

      {
        path: 'katalog',
        children: [
          {
            path: 'hizmetler',
            loadComponent: () => import('./features/catalog/services/services-list').then((m) => m.ServicesList),
          },
          {
            path: 'urunler',
            loadComponent: () => import('./features/catalog/products/products-list').then((m) => m.ProductsList),
          },
          {
            path: 'odalar',
            loadComponent: () => import('./features/catalog/rooms/rooms-list').then((m) => m.RoomsList),
          },
        ],
      },

      {
        path: 'finans',
        children: [
          {
            path: 'odemeler',
            loadComponent: () => import('./features/finance/payments/payments-list').then((m) => m.PaymentsList),
          },
          {
            path: 'primler',
            canActivate: [roleGuard(['admin'])],
            loadComponent: () => import('./features/finance/commissions/commissions').then((m) => m.Commissions),
          },
          {
            path: 'prim-kurallari',
            canActivate: [roleGuard(['admin'])],
            loadComponent: () => import('./features/finance/commissions/commission-rules').then((m) => m.CommissionRules),
          },
          {
            path: 'giderler',
            canActivate: [roleGuard(['admin'])],
            loadComponent: () => import('./features/finance/expenses/expenses-list').then((m) => m.ExpensesList),
          },
          {
            path: 'kasa',
            loadComponent: () => import('./features/finance/cash-register/cash-register-day').then((m) => m.CashRegisterDayPage),
          },
        ],
      },

      {
        path: 'ekip',
        children: [
          {
            path: 'personel',
            canActivate: [roleGuard(['admin'])],
            loadComponent: () => import('./features/staff/personnel/personnel-list').then((m) => m.PersonnelList),
          },
          {
            path: 'gorevler',
            loadComponent: () => import('./features/staff/tasks/tasks-list').then((m) => m.TasksList),
          },
          {
            path: 'izinler',
            loadComponent: () => import('./features/staff/leaves/leaves-list').then((m) => m.LeavesList),
          },
        ],
      },

      {
        path: 'raporlar',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/reports/reports').then((m) => m.Reports),
      },

      {
        path: 'yonetim',
        canActivate: [roleGuard(['admin'])],
        children: [
          {
            path: 'kullanicilar',
            loadComponent: () => import('./features/admin/users-roles/users-roles').then((m) => m.UsersRoles),
          },
          {
            path: 'denetim',
            loadComponent: () => import('./features/admin/audit-log/audit-log').then((m) => m.AuditLogPage),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
