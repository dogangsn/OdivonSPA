# OdivonSPA

Spa / masaj işletmeleri için çok kiracılı (multi-tenant) yönetim paneli. Angular 22 (standalone, signals, zoneless) + Tailwind + Firebase (Auth, Firestore, Hosting — Spark planı) + Express backend (`server/`, Render).

## Geliştirme

```bash
npm install                 # heroicons sprite'ı da üretir (postinstall)
firebase emulators:start --only auth,firestore   # Java gerekir
npm --prefix server run dev # server/.env dosyasını server/.env.example'dan oluşturun
npx ng serve --port 4210
```

## Test

```bash
npm test          # Angular birim testleri
npm run test:e2e  # emulator + yerel server üzerinde uçtan uca (rules + API rotaları), Java gerekir
```

## Mimari notları

- Veri: `tenants/{tenantId}/…`; tenant + rol Auth custom claim'lerinde.
- Firebase projesi Spark (ücretsiz) planında kalıyor — bu planda Cloud Functions (callable/trigger/scheduled, hiçbiri) deploy edilemiyor.
- Para/stok/prim/kasa/randevu çakışması gibi kritik yazmalar bu yüzden Cloud Functions yerine bağımsız bir Express sunucusundan (`server/`, Render'da barındırılıyor) `firebase-admin` ile yapılıyor; istemci bu koleksiyonlara doğrudan yazamaz (`firestore.rules`). İstemci bu sunucuya `HttpClient` + Firebase ID token ile bağlanır (`src/app/core/http/`).
- `functions/` dizini artık deploy edilmiyor — sadece referans/geçmiş amaçlı tutuluyor (bkz. `functions/src/index.ts` başındaki not). Asıl backend kodu `server/src`'dedir; iş mantığı `functions/src`'ten birebir taşındı.
- Saat dilimi: sunucu tarafı gün sınırları `tenants/{id}.settings.timezone` (varsayılan Europe/Istanbul) ile hesaplanır (`server/src/lib/time.ts`).
- `markExpiredPackages` günlük işi artık `POST /internal/mark-expired-packages` (paylaşılan `X-Cron-Secret` ile korumalı) — GitHub Actions zamanlanmış iş veya harici bir cron pinger tarafından tetiklenir.

## Deploy

```bash
npx ng build --configuration production
firebase deploy --only firestore,hosting
```

`server/` ayrı olarak Render'a deploy edilir (Render Web Service, Root Directory `server`, Build `npm ci && npm run build`, Start `npm run start`). Gerekli ortam değişkenleri ve adım adım kurulum için `server/.env.example`'a ve ilgili plan dosyasına bakın.

Yol haritası: `~/.claude/plans/` altındaki plan dosyası (SaaS çekirdeği → çok şube → müşteri yüzü → TR finans).
