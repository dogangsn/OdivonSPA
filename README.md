# OdivonSPA

Spa / masaj işletmeleri için çok kiracılı (multi-tenant) yönetim paneli. Angular 22 (standalone, signals, zoneless) + Tailwind + Firebase Auth + Hosting. Tüm veri **Odivon Main API** üzerinden gelir (`OdivonMainApi` deposu, `/api/v1/spa/*`, modül `spa`); istemci Firestore'a doğrudan erişmez.

## Geliştirme

```bash
npm install                 # heroicons sprite'ı da üretir (postinstall)
# OdivonMainApi klasöründe: npm run start:dev  (http://localhost:3000/api/v1)
npx ng serve --port 4201
```

Giriş, Main API'nin Firebase projesindeki (`odivon-main-api-a2095`) Auth hesaplarıyla yapılır. Bu projede Authentication → Sign-in method altında E-posta/Şifre (ve kullanılacaksa Google) açık olmalıdır.

## Test

```bash
npm test                  # Angular birim testleri
```

İş kuralı testleri (POS tutarı, prim motoru, kasa özeti, zaman) Main API'dedir: `src/modules/spa/shared/*.spec.ts`. `.github/workflows/ci.yml` birim testleri ve üretim derlemesini her PR'da çalıştırır; `master`'a push'ta deploy iş akışı önce testleri çalıştırır.

## Mimari notları

- İstemci → Main API: `HttpClient` + Firebase ID token (`src/app/core/http/`). Listeler `ApiCrudService` ile okunur; yazmalardan sonra, dakikada bir ve sekme odağa geldiğinde yenilenir (`DataRefreshService`) — eski Firestore canlı dinleyicilerinin yerini tutar.
- Tenant ve spa rolü (admin / reception / therapist) `GET /spa/me`'den gelir; yetkiler Main API'nin rol/izin sisteminde (`spa-admin`, `spa-reception`, `spa-therapist` rolleri).
- Yeni işletme: kullanıcı Firebase'de kayıt olur / Google ile girer, ardından `POST /spa/onboarding` işletmeyi oluşturur.
- Tarihler API'den ISO metin olarak gelir, `ApiService` bunları `Date`'e çevirir.
- Randevu çakışması, POS, paket satışı, kasa, prim ve iade kuralları Main API'de transaction içinde uygulanır. Süresi dolan paketler listelenirken `expired` yapılır (ayrı cron yok).

## Deploy

```bash
npx ng build --configuration production
firebase deploy --only hosting,firestore
```

`master` dalına push yapılınca GitHub Actions üretim derlemesini alıp Firebase Hosting'i (`odivonspa` projesi) yayımlar. Bu projenin Firestore kuralları artık tüm erişimi kapatır; veri Main API'nin kendi projesindedir. Kimlik doğrulama GitHub OIDC ile `github-firebase-deploy@odivonspa.iam.gserviceaccount.com` servis hesabı üzerinden yapılır.
