# Maxxima Badminton Academy — Sistem Operasi (Portal Admin + pangkalan data penuh)

Aplikasi web statik (tiada proses build) + Supabase (pangkalan data, log masuk, akses ikut peranan, notifikasi masa nyata).

## Cara ia berfungsi (supaya admin tidak masuk data berulang kali)
```
Lokasi ─┐
Coach  ─┴─► KELAS (lokasi + coach + hari/masa + PROGRAM) ─┐
                                                          ├─► PELAJAR (pilih pakej + kelas)
Program ──► PAKEJ (sesi, harga, tempoh sah) ──────────────┘        │
                                                                   ▼
        kehadiran menolak 1 sesi ─► baki tinggal 1 ─► INVOIS PEMBAHARUAN AUTO ─► bayar ─► pakej baharu aktif + RESIT
```
* Kelas dan pakej bersambung melalui **program** (kelas Foundation guna pakej Foundation).
* Pakej: **jadual tetap** (pelajar didaftar ke kelas) atau **fleksibel** (ibu bapa tempah sesi sendiri).
* "Dimaafkan" tidak menolak sesi. Hadir, lewat hadir, tidak hadir dan batal lewat menolak sesi.
* Pakej aktif apabila bayaran disahkan; tempoh sah bermula tarikh bayaran. Pakej tamat tempoh ditandakan "Tamat" (baki hangus).
* Kadar lama pelajar sedia ada kekal (harga boleh diubah semasa jual pakej).
* Bayaran ibu bapa (bukti) → admin sahkan/tolak → resit (`RCP-YYMM-####`) + notifikasi.

## Mod Demo
`npx serve .` atau `python3 -m http.server` lalu buka `index.html`. Selagi `js/config.js` kosong, aplikasi berjalan dalam **mod demo** (data rekaan, tidak kekal). Enjin demo (`js/engine.js`) meniru trigger pangkalan data.

## Pasang dengan Supabase
1. Cipta projek di https://supabase.com.
2. **SQL Editor** → jalankan berturutan: `supabase/schema.sql`, `supabase/seed.sql`, `supabase/storage.sql` (bucket peribadi bukti bayaran).
3. **Authentication → Providers → Email**: matikan **"Allow new users to sign up"**.
4. **Authentication → URL Configuration**: Site URL = alamat laman anda.
5. Deploy Edge Function jemputan pengguna:
   ```
   supabase login && supabase link --project-ref <PROJECT_REF>
   supabase functions deploy invite-user
   ```
6. Isi `js/config.js`: `SUPABASE_URL` dan `SUPABASE_ANON_KEY` (kunci **anon** sahaja; jangan letak service-role key).
7. Admin pertama: Authentication → Users → Invite user, kemudian di SQL Editor:
   ```sql
   update profiles set role = 'admin', active = true where email = 'emel-anda@contoh.com';
   ```
8. Hos folder ini (Netlify / Cloudflare Pages / GitHub Pages / Vercel).
9. (Pilihan) Luputkan pakej setiap hari: Supabase → Database → Cron: `select public.expire_packages();` — fungsi ini menyemak admin; app juga memanggilnya setiap kali admin log masuk.

## Peranan & akses (diuji pada Postgres sebenar)
| Peranan | Akses |
|---|---|
| `admin` | Semua data |
| `coach` | Kelas & pelajar sendiri; tanda kehadiran; **tidak** nampak invois/pakej/harga |
| `parent` | Anak sendiri sahaja: jadual, pakej & baki, invois, resit; hantar bukti bayaran (`pending`); tempah/batal sesi fleksibel melalui fungsi `book_session` / `cancel_booking` (semakan baki, kerusi, notis 48 jam di pelayan) |

## Status binaan
* **Siap:** Portal Admin (Persediaan, Leads, Trial, Pendaftaran, Pelajar, Jadual, Kehadiran, Kejohanan, Invois & Bayaran, Pakej, Coach, HR, Pengguna, Tetapan), skema pangkalan data lengkap untuk 3 peranan, notifikasi dalam app.
* **Belum:** Portal Coach, Portal Ibu Bapa/Pelajar (tempah sesi, hantar bayaran, muat turun resit — fungsi pangkalan data sudah sedia), notifikasi push telefon (PWA), import pukal CSV.
* **Tidak diuji secara langsung:** sambungan Supabase sebenar dari pelayar, Edge Function jemputan, Realtime. Skema, trigger dan RLS diuji pada Postgres 16; aplikasi diuji penuh dalam mod demo.
