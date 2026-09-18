import { StaffRole } from '../../core/models';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles?: StaffRole[]; // omitted = visible to everyone
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    title: 'GENEL',
    items: [{ label: 'Panel', icon: 'heroicons_solid:squares-2x2', route: '/panel' }],
  },
  {
    title: 'OPERASYON',
    items: [
      { label: 'Randevular', icon: 'heroicons_outline:calendar-days', route: '/randevular' },
      { label: 'Seanslar', icon: 'heroicons_outline:presentation-chart-line', route: '/seanslar' },
      { label: 'Müşteriler', icon: 'heroicons_outline:users', route: '/musteriler' },
      { label: 'Paketler', icon: 'heroicons_outline:cube', route: '/paketler' },
    ],
  },
  {
    title: 'KATALOG',
    items: [
      { label: 'Hizmetler', icon: 'heroicons_outline:sparkles', route: '/katalog/hizmetler' },
      { label: 'Ürünler & Stok', icon: 'heroicons_outline:cube-transparent', route: '/katalog/urunler' },
      { label: 'Odalar', icon: 'heroicons_outline:home-modern', route: '/katalog/odalar' },
    ],
  },
  {
    title: 'FİNANS',
    items: [
      { label: 'Ödemeler', icon: 'heroicons_outline:credit-card', route: '/finans/odemeler' },
      { label: 'Primler', icon: 'heroicons_outline:percent-badge', route: '/finans/primler', roles: ['admin'] },
      { label: 'Giderler', icon: 'heroicons_outline:document-text', route: '/finans/giderler', roles: ['admin'] },
      { label: 'Günlük Kasa', icon: 'heroicons_outline:banknotes', route: '/finans/kasa' },
    ],
  },
  {
    title: 'EKİP',
    items: [
      { label: 'Personel', icon: 'heroicons_outline:user-circle', route: '/ekip/personel', roles: ['admin'] },
      { label: 'Görevler', icon: 'heroicons_outline:clipboard-document-list', route: '/ekip/gorevler' },
      { label: 'İzinler', icon: 'heroicons_outline:calendar', route: '/ekip/izinler' },
    ],
  },
  {
    title: 'RAPORLAR',
    items: [{ label: 'Raporlar', icon: 'heroicons_outline:chart-bar', route: '/raporlar', roles: ['admin'] }],
  },
  {
    title: 'YÖNETİM',
    items: [
      { label: 'Kullanıcılar & Roller', icon: 'heroicons_outline:shield-check', route: '/yonetim/kullanicilar', roles: ['admin'] },
      { label: 'Denetim Kaydı', icon: 'heroicons_outline:document-magnifying-glass', route: '/yonetim/denetim', roles: ['admin'] },
    ],
  },
];
