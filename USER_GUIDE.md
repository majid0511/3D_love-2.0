# 📘 Panduan Pengguna - CIPUT PIC 💖

Selamat datang di **CIPUT PIC** — aplikasi 3D interaktif yang menampilkan partikel berbentuk hati dengan kontrol tangan (hand tracking) dan fitur keren lainnya!

---

## 📌 Daftar Isi

- [Apa Itu CIPUT PIC?](#apa-itu-ciput-pic)
- [Cara Membuka Aplikasi](#cara-membuka-aplikasi)
- [Tiga Mode Utama](#tiga-mode-utama)
- [Kontrol di Desktop (Pakai Tangan)](#kontrol-di-desktop-pakai-tangan)
- [Kontrol di HP (Sentuhan)](#kontrol-di-hp-sentuhan)
- [Tombol di Layar](#tombol-di-layar)
- [Musik Latar](#musik-latar)
- [Easter Egg: Screenshot ✌️](#easter-egg-screenshot-️)
- [Tips & Troubleshooting](#tips--troubleshooting)

---

## Apa Itu CIPUT PIC?

**CIPUT PIC** adalah aplikasi web 3D yang menampilkan ribuan partikel berwarna membentuk **hati (love)**. Kamu bisa:

- ✅ Melihat partikel love dalam 3D
- ✅ Berinteraksi menggunakan **gerakan tangan** (di laptop/PC dengan kamera)
- ✅ Berinteraksi menggunakan **sentuhan** (di HP)
- ✅ Melihat foto-foto dalam bingkai 3D
- ✅ Mendengarkan musik latar
- ✅ Mengambil screenshot dengan pose peace sign ✌️

---

## Cara Membuka Aplikasi

1. Buka file **`index.html`** di browser (Chrome / Firefox / Edge versi terbaru)
2. Tunggu sampai tulisan **"Loading Memories"** menghilang
3. Aplikasi siap digunakan! 🎉

> 💡 **Koneksi internet diperlukan** untuk pertama kali karena aplikasi memuat library Three.js dan MediaPipe dari CDN.

---

## Tiga Mode Utama

Aplikasi punya **3 mode** yang bisa kamu ganti-ganti:

| Mode | Tampilan | Kegunaan |
|------|----------|----------|
| ❤️ **LOVE** | Partikel membentuk hati | Mode awal, melihat love 3D berputar |
| ✨ **SCATTER** | Partikel bertebaran | Semua partikel terbang acak + foto membesar |
| 🔍 **FOCUS** | Satu foto tampil besar | Melihat foto detail, bisa geser-geser foto |

**Cara ganti mode:**
- **Desktop:** Buka/tutup tangan (lihat [Kontrol Desktop](#kontrol-di-desktop-pakai-tangan))
- **HP:** Tap sekali di layar (lihat [Kontrol HP](#kontrol-di-hp-sentuhan))
- **Keyboard:** Tekan tombol **T** (LOVE), **S** (SCATTER), atau **F** (FOCUS)

---

## Kontrol di Desktop (Pakai Tangan)

> ⚠️ **Syarat:** Kamera harus aktif dan kamu sudah mengizinkan akses kamera.

### Gerakan Tangan

| Gerakan | Cara | Hasil |
|---------|------|-------|
| ✊ **Kepal** | Tutup semua jari | Masuk mode **LOVE** (hati) |
| ✋ **Tangan Terbuka** | Buka semua jari lebar | Masuk mode **SCATTER** (tersebar) |
| 🤏 **Cubit** | Ibu jari + telunjuk hampir menyentuh | Masuk mode **FOCUS** (zoom foto) |
| 👉 **Geser (Swipe)** | Gerak tangan kiri/kanan cepat | Ganti foto (saat mode FOCUS) |
| ✌️ **Peace Sign** | Telunjuk + tengah lurus, tahan **2 detik** | **Screenshot otomatis** tersimpan! |

### Gerak-Gerik Tambahan

| Aksi | Hasil |
|------|-------|
| Gerakkan telapak tangan ke kiri/kanan | Love berputar mengikuti tangan |
| Gerakkan telapak tangan ke atas/bawah | Love miring mengikuti tangan |

---

## Kontrol di HP (Sentuhan)

| Gestur | Cara | Hasil |
|--------|------|-------|
| 👆 **Tap 1x** | Sentuh layar sebentar | Ganti mode: LOVE → SCATTER → FOCUS → LOVE |
| 👉 **Geser Horizontal** | Sentuh + geser kiri/kanan (> 40px) | Ganti foto (saat mode FOCUS) |
| 🖐️ **Seret 1 jari** | Sentuh + geser | Memutar love 3D |
| 🤏 **Cubit 2 jari** | Sentuh dengan 2 jari + rapatkan/renggangkan | Zoom in/out |

> 💡 Petunjuk "Seret untuk putar • Pinch untuk zoom" akan muncul di bagian bawah layar HP.

---

## Tombol di Layar

Di bagian kanan bawah ada beberapa tombol:

| Tombol | Fungsi |
|--------|--------|
| 🎵 **Musik** | Play/Pause musik latar |
| ⏭ **Next** | Ganti ke lagu berikutnya (hanya muncul jika ada > 1 lagu) |
| 📷 **Kamera** | Tampilkan/Sembunyikan kamera (webcam) |
| 📷 **Tutup** | Sembunyikan kamera (setelah kamera aktif) |

---

## Musik Latar

- Musik akan mulai otomatis setelah kamu **klik/tap pertama kali** di halaman
- Tekan tombol **🎵 Musik** untuk Play/Pause
- Tekan **⏭ Next** untuk ganti lagu
- Lagu akan ganti otomatis saat lagu selesai
- Nama lagu yang sedang diputar muncul di atas tombol

---

## Easter Egg: Screenshot ✌️

Kamu bisa mengambil screenshot kapan saja!

**Cara (Desktop):**
1. Tunjukkan pose **peace sign (✌️)** ke kamera
2. Tahan pose tersebut selama **2 detik**
3. Layar akan berkedip putih ⚡
4. Notifikasi **"📸 Tersimpan!"** muncul
5. File screenshot otomatis terdownload: `ciput-pic-{waktu}.png`

**Tips:**
- Tunggu 3 detik sebelum bisa screenshot lagi (anti-spam)
- Screenshot akan menyimpan tampilan 3D **tanpa overlay webcam**

---

## Tips & Troubleshooting

### ❌ Kamera tidak muncul
- Klik tombol **📷 Kamera** untuk mengaktifkan
- Pastikan browser diizinkan mengakses kamera
- Di HP, kamera hanya aktif jika kamu tekan tombol kamera

### ❌ Partikel terlalu berat / lemot
- Di HP akan otomatis menggunakan kualitas lebih ringan
- Tutup aplikasi lain yang berat

### ❌ Musik tidak bunyi
- Klik/tap di halaman terlebih dahulu (kebijakan browser)
- Periksa volume speaker

### ❌ Gambar/foto tidak muncul
- Aplikasi akan scan folder `images/` untuk file `.jpg`, `.jpeg`, `.png`, `.webp`, `.bmp`
- Pastikan foto ada di folder `images/` dengan nama `1.jpg`, `2.jpg`, dst.

### 💡 Tips Penggunaan
- **Desktop:** Gunakan di ruangan dengan pencahayaan cukup agar hand tracking lebih akurat
- **HP:** Putar layar untuk pengalaman lebih luas
- Mode **FOCUS** cocok untuk lihat foto satu per satu dengan detail
- Mode **SCATTER** cocok untuk efek kembang api partikel

---

## 🎯 Ringkasan Cepat

```
🎬 Buka index.html → Loading selesai
   │
   ├── ❤️ LOVE     = Partikel bentuk hati (mode awal)
   ├── ✨ SCATTER  = Partikel bertebaran (buka tangan / tap 2x)
   └── 🔍 FOCUS    = Foto tampil besar (cubit / tap 3x)
   
🎵 Musik  → Play/Pause
⏭ Next   → Ganti lagu
📷 Kamera → Tampilkan/Sembunyikan kamera

✌️ Peace sign tahan 2 detik = Screenshot!
```

---

Selamat menikmati! 💖

*Dibuat dengan ❤️ menggunakan Three.js & MediaPipe*