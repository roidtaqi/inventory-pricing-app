# Kalkulator Tekad Mandiri

Mobile-first PWA untuk membantu owner/admin toko retail, sembako, grosir, dan minimarket kecil menghitung harga jual, mengelola inventaris produk, membuat draft perubahan harga, melakukan approval, dan menyimpan riwayat perubahan harga.

Aplikasi ini bukan POS/kasir. Harga aktif hanya berubah setelah approval.

## Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Dexie IndexedDB untuk local-first storage
- Vitest untuk unit test formula

## Setup

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
```

Release PWA:

```bash
npm run build
```

Upload isi folder `dist/` ke hosting HTTPS seperti Netlify, Vercel, Cloudflare Pages, Firebase Hosting, atau server sendiri dengan TLS. PWA install prompt di Android dan service worker di iOS/Android membutuhkan HTTPS, kecuali saat testing di `localhost`.

Preview web untuk client:

1. Jalankan `npm run build`.
2. Upload isi folder `dist/` ke hosting HTTPS.
3. Kirim URL preview ke client.
4. Client bisa membuka dari browser; jika perlu install, gunakan `Install app` di Chrome Android atau `Add to Home Screen` di Safari iOS.

Build ini sudah menyertakan fallback SPA (`_redirects` dan `vercel.json`) agar refresh/deep link seperti `/products`, `/approval`, dan `/history` tetap membuka aplikasi.

## Deploy ke Railway

Railway bisa dipakai untuk preview web. Repo ini sudah menyediakan `Dockerfile` dan `Caddyfile`, sehingga Railway akan build React/Vite lalu serve folder `dist/` memakai Caddy.

Langkah dari GitHub:

1. Push repo ke GitHub.
2. Buka Railway, pilih `New Project`.
3. Pilih `Deploy from GitHub repo`.
4. Pilih repo aplikasi ini.
5. Railway akan mendeteksi `Dockerfile` dan menjalankan build.
6. Setelah deploy selesai, buka service `Settings` -> `Networking`.
7. Klik `Generate Domain`.
8. Kirim domain Railway itu ke client.

Health check tersedia di:

```txt
/health
```

Client-side route seperti `/products`, `/approval`, dan `/history` akan fallback ke `index.html` melalui Caddy.

Preview build:

```bash
npm run preview
```

Unit test:

```bash
npm test
```

Lint:

```bash
npm run lint
```

## Formula Harga

Margin yang digunakan adalah margin dari harga jual, bukan markup dari modal.

```txt
Harga Jual Rekomendasi = Modal Final / (1 - Margin)
Profit = Harga Jual - Modal Final
Margin Aktual = Profit / Harga Jual
```

Contoh:

```txt
Modal final = Rp10.000
Margin = 20%
Harga rekomendasi = 10.000 / (1 - 0,20) = Rp12.500
```

## PPN Supplier

Mode PPN:

- `NO_PPN`: final cost sama dengan input cost.
- `PPN_EXCLUDED`: input cost belum termasuk PPN.
- `PPN_INCLUDED`: input cost sudah termasuk PPN.

Rate PPN diambil dari Settings dan tidak di-hardcode di kalkulator.

## Rounding

Rounding default adalah ribuan terdekat:

- Sisa harga `>= Rp500`: naik ke ribuan berikutnya.
- Sisa harga `< Rp500`: turun ke ribuan bawah.

## Modul MVP

- Kalkulator harga mobile-first
- Product CRUD dengan multi-satuan
- Master data kategori, brand, dan supplier
- Margin rule default, kategori, brand, supplier, produk
- Draft price calculation
- Approval dan scheduled price activation
- Price history
- Settings PPN, margin default, app name, export JSON
- Seed data produk sembako/minimarket
- Installable PWA untuk iOS dan Android
- Import CSV katalog produk, satuan, supplier, dan modal

## Install di Android

1. Deploy folder `dist/` ke URL HTTPS.
2. Buka URL tersebut di Chrome Android.
3. Pilih menu Chrome, lalu `Install app` atau `Add to Home screen`.
4. App akan muncul di launcher seperti aplikasi biasa.

## Install di iOS

1. Deploy folder `dist/` ke URL HTTPS.
2. Buka URL tersebut di Safari iPhone/iPad.
3. Tap tombol Share.
4. Pilih `Add to Home Screen`.
5. App akan muncul di Home Screen dan berjalan dalam mode standalone.

## Native Store Build

Build APK/AAB Android dan IPA iOS belum termasuk di release ini. Untuk distribusi Play Store/App Store, project bisa dibungkus dengan Capacitor, lalu butuh signing key Android, Xcode/macOS untuk iOS, dan Apple Developer account.

## Struktur Kode

```txt
src/db
  db.ts       IndexedDB schema
  seed.ts     Sample data dan default settings

src/services
  TaxCalculatorService.ts
  PricingCalculatorService.ts
  RoundingService.ts
  MarginRuleResolver.ts
  ApprovalService.ts
  PriceHistoryService.ts
  ProductUnitCostHistoryService.ts
  CsvImportService.ts

src/pages
  CalculatorPage.tsx
  ProductsPage.tsx
  ProductFormPage.tsx
  MarginPage.tsx
  MarginRuleFormPage.tsx
  ApprovalPage.tsx
  HistoryPage.tsx
  SettingsPage.tsx
  MasterDataPage.tsx
  ImportCsvPage.tsx
```

## Format CSV Produk

Import CSV tersedia dari `Lainnya -> Import CSV`. Kolom yang didukung:

```csv
sku,name,category,brand,supplier,unit_name,conversion_to_base,manual_cost,active_selling_price,min_selling_price,max_selling_price,barcode,pricing_mode,ppn_mode,ppn_rate,effective_date,notes
```

Kolom wajib:

- `sku`
- `name`
- `unit_name`
- `manual_cost`

Nilai `pricing_mode` mendukung `AUTO_MARGIN`, `MANUAL_PRICE`, `LOCKED_PRICE`. Nilai `ppn_mode` mendukung `NO_PPN`, `PPN_INCLUDED`, `PPN_EXCLUDED`. Saat import berhasil, aplikasi akan membuat/update produk, kategori, brand, supplier, satuan, dan mencatat riwayat modal per satuan.

## Sample Data

Seed data mencakup kategori seperti Mie Instan, Minuman, Beras, Minyak, Gula, Rokok, Telur, dan Bumbu Dapur, plus contoh produk Indomie Goreng, Mie Sedaap Soto, Aqua 600ml, Beras Ramos 5kg, Minyak Goreng 1L, Gula Pasir 1kg, dan Telur Ayam 1kg.

## Changelog

### 0.1.0

- MVP local-first dengan kalkulator pricing, product inventory, margin rules, approval flow, history, settings, seed data, dan unit test formula.
