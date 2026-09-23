# OdivonSPA

Spa / masaj işletmeleri için çok kiracılı (multi-tenant) yönetim paneli. Angular 22 (standalone, signals, zoneless) + Tailwind + Firebase (Auth, Firestore, Hosting — Spark planı) + Express backend (`server/`, Render).

## Geliştirme

```bash
npm install                 # heroicons sprite'ı da üretir (postinstall)
Copy-Item server/.env.example server/.env  # ilk kurulumda (PowerShell)
firebase emulators:start --only auth,firestore,storage   # Java gerekir
npm --prefix server run dev
npx ng serve --configuration emulator --port 4201
```

Gerçek Firebase projesindeki hesaplarla giriş yapmak için `npx ng serve --port 4201` kullanın. `emulator` yapılandırmasındaki hesaplar ve işletmeler yereldir; gerçek projedeki veriler burada görünmez.

Gerçek Firebase projesine bağlı yerel Express API için bir kez `gcloud auth application-default login` çalıştırın; ardından `server/.env` içindeki `FIREBASE_AUTH_EMULATOR_HOST` ve `FIRESTORE_EMULATOR_HOST` satırlarını kaldırın veya yorum satırı yapın. Emulator çalıştırırken bu değişkenler `firebase emulators:exec` tarafından otomatik sağlanır.

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

`master` dalına push yapılınca GitHub Actions üretim derlemesini alıp Firebase Hosting ve Firestore kurallarını/indekslerini otomatik yayımlar. Kimlik doğrulama GitHub OIDC ile `github-firebase-deploy@odivonspa.iam.gserviceaccount.com` servis hesabı üzerinden yapılır; GitHub secret gerekmez. Firebase Storage projede henüz etkin olmadığı için otomatik deploy kapsamına dahil değildir.

`render.yaml`, Render Web Service yapılandırmasını sürümler: servis GitHub'daki `master` dalını izlemeli ve otomatik dağıtım açık olmalıdır. Render'da `FIREBASE_SERVICE_ACCOUNT_KEY` ve `INTERNAL_CRON_SECRET` değerlerini secret olarak; `ALLOWED_ORIGINS` değerini canlı alan adlarıyla tanımlayın. Dağıtımdan sonra `https://odivonspa-server.onrender.com/health` adresinin `{ "status": "ok" }` döndürdüğünü doğrulayın.

Mevcut bir sahip hesabı tenant claim'ini kaybederse, üretim servis hesabının bulunduğu güvenilir bir ortamda aşağıdaki komutla geri bağlanabilir. Komut yalnızca verilen tenant mevcutsa çalışır, başka tenant'a bağlı kullanıcıyı değiştirmez ve tekrar çalıştırıldığında aynı sonucu üretir.

```bash
npm --prefix server run recover:member -- --email owner@example.com --tenant-id TENANT_ID --name "Sahip Adı"
```

Yol haritası: `~/.claude/plans/` altındaki plan dosyası (SaaS çekirdeği → çok şube → müşteri yüzü → TR finans).
