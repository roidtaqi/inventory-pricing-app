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

## Real-time Sync ke Integrated POS App

Aplikasi ini bisa mengirim catalog/harga aktif secara real-time ke Integrated POS App dan menerima sales event dari POS melalui sync server WebSocket yang tersedia di repo POS.

Jalankan sync server dari repo POS:

```bash
cd ../integrated-pos-app
npm run sync:server
```

Lalu jalankan Inventory Pricing App:

```bash
cd ../inventory-pricing-app
npm run dev
```

Alur:

1. Buka `Home -> Data & Pengaturan -> Sync`.
2. Isi URL `ws://localhost:8787`.
3. Aktifkan real-time sync.
4. Klik `Simpan & Connect`.
5. Klik `Publish Catalog Sekarang` untuk mengirim produk, satuan, dan harga aktif ke POS.
6. Transaksi POS yang masuk akan tersimpan di tabel lokal `posSales` dan tampil di halaman Real-time Sync.

Catatan arsitektur:

- Inventory Pricing App tetap source of truth untuk produk, satuan, dan harga aktif.
- POS tetap sales execution layer.
- Sync server lokal menyimpan event di `.sync-data/realtime-sync-state.json` pada repo POS.
- Untuk production, WebSocket server ini perlu diberi auth, tenant/outlet scoping, retry policy, dan conflict resolution.

## Cloud Sync Multi-device

Untuk membuat data Inventory terlihat sama di laptop dan HP, gunakan sync server yang sudah berjalan di Railway.

Contoh URL:

```txt
wss://pos-server.up.railway.app
```

Di halaman `Home -> Data & Pengaturan -> Sync`:

1. Isi URL sync server.
2. Isi `API token` jika service sync server memakai env `SYNC_API_TOKEN`.
3. Di laptop yang datanya sudah lengkap, klik `Upload Cloud`.
4. Di HP/perangkat lain, klik `Ambil Cloud`.

`Upload Cloud` menyimpan snapshot Inventory ke sync server. `Ambil Cloud` mengambil dan menggabungkan data cloud ke IndexedDB perangkat tersebut.

Data yang ikut disync:

- Produk
- Satuan produk
- Kategori
- Brand
- Supplier
- Margin rule
- Draft/approval harga
- Riwayat harga
- Riwayat modal produk
- Settings aplikasi, kecuali konfigurasi sync lokal perangkat

Jika sync server Railway dipasangkan dengan PostgreSQL dan env `DATABASE_URL`, snapshot cloud akan tersimpan di PostgreSQL. Jika tidak ada `DATABASE_URL`, server fallback ke file storage/container.

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

## Deploy Gratis ke Render

Untuk deploy bersamaan dengan Integrated POS App, gunakan Blueprint dari repo POS:

```txt
https://github.com/roidtaqi/integrated-pos-app
```

Blueprint tersebut akan membuat tiga service:

- `inventory-pricing-app` sebagai Render Static Site.
- `integrated-pos-app` sebagai Render Static Site.
- `integrated-pos-sync-server` sebagai Render Free Web Service untuk WebSocket sync.

Setelah deploy selesai, buka service `integrated-pos-sync-server`, salin URL Render-nya, lalu ubah dari:

```txt
https://integrated-pos-sync-server.onrender.com
```

menjadi:

```txt
wss://integrated-pos-sync-server.onrender.com
```

Gunakan URL `wss://...` itu di `Home -> Data & Pengaturan -> Sync`.

Catatan Render Free:

- Sync server bisa sleep setelah tidak aktif, lalu butuh waktu untuk bangun kembali.
- Data sync server disimpan di filesystem service gratis, jadi cocok untuk demo/preview, bukan production final.
- Jika WebSocket belum connect, buka dulu `/health` dari URL sync server untuk membangunkan service.

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

Import CSV tersedia dari `Home -> Data & Pengaturan -> Import`. Kolom yang didukung:

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

### Unreleased - 2026-06-17

- Mengubah arah UX utama menjadi workflow-guided: `Setup -> Produk -> Margin -> Hitung -> Approval -> Riwayat`.
- Menambahkan `Home` sebagai halaman awal yang lebih ringkas untuk akses hitung harga, menu utama, dan data/pengaturan.
- Mengubah bottom navigation menjadi `Home`, `Produk`, `Hitung`, `Approval`, dan `Riwayat`.
- Memindahkan Kalkulator ke route `/calculator` dengan shortcut `/calculator?mode=invoice` dan `/calculator?mode=product`.
- Merapikan Kalkulator agar diawali pilihan mode `Hitung dari Faktur Supplier` atau `Hitung dari Produk Terdaftar`.
- Mengganti akses setup dari menu `Lainnya` ke Home agar Pengaturan, Master Data, Import, dan Sync tetap mudah ditemukan.

### Unreleased - 2026-06-11

- Menambahkan mode `Faktur` di Kalkulator untuk menghitung harga dari nota supplier tanpa harus memilih produk dari master data.
- Kalkulator Faktur mendukung input `Crt`, `Pcs`, `Isi/Karton`, `Harga Karton`, `Diskon (%)`, mode PPN, dan `Margin Manual (%)`.
- Kalkulator Faktur menampilkan total pcs, setara karton, total setelah diskon/PPN, modal per pcs, harga jual dari margin, profit, dan margin aktual.
- Input harga pada Kalkulator Faktur mendukung format angka umum seperti `120000`, `120.000`, `120,000`, dan shorthand ribuan seperti `26,5`.
- Menambahkan perhitungan modal dari barang datang total ke satuan jual, termasuk kasus 1 karton isi banyak pcs dan partial pcs.
- Menambahkan pilihan `Input isi manual` pada `Satuan Datang` agar perhitungan karton/paket tetap bisa dilakukan meskipun satuan tersebut belum ada di master produk.
- Merapikan UX Riwayat Harga agar filter produk dan kategori saling mengikuti sehingga kombinasi produk-kategori yang salah tidak mudah dipilih.
- Merapikan UX Tambah Margin agar kombinasi tipe aturan dan target yang sudah ada otomatis memuat margin tersimpan dan update rule existing, bukan membuat duplikat.
- Menambahkan unit test untuk perhitungan faktur dan pembagian modal total ke satuan jual.

### 0.1.0

- MVP local-first dengan kalkulator pricing, product inventory, margin rules, approval flow, history, settings, seed data, dan unit test formula.
