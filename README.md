# 3D LOVE 💖

Aplikasi 3D interaktif berbasis web yang menampilkan partikel membentuk hati (LOVE) menggunakan **Three.js**, dengan kontrol **hand tracking** via MediaPipe dan dukungan **touch gesture** untuk mobile.

## ✨ Fitur

- **3 Mode Tampilan:**
  - ❤ **LOVE** - Partikel membentuk hati 3D yang berdenyut
  - ✨ **SCATTER** - Partikel tersebar melayang di ruang 3D
  - 🔍 **FOCUS** - Zoom ke foto secara acak
- **Hand Tracking (Desktop)** - Kontrol menggunakan gestur tangan via webcam
- **Touch Control (Mobile)** - Tap untuk ganti mode, drag untuk rotasi, pinch untuk zoom
- **Musik Latar** - Putar/jeda lagu latar
- **Foto** - Menampilkan gambar dari folder `images/` dalam bingkai 3D
- **Efek Bloom** - Efek cahaya glow yang dramatis

## 🎮 Cara Penggunaan

### Desktop (PC/Laptop)
| Gestur Tangan | Fungsi |
|--------------|--------|
| 👊 Kepal (jari tertutup) | Mode **LOVE** |
| ✋ Buka (jari terbuka) | Mode **SCATTER** |
| 🤏 Cubit (jempol + telunjuk) | Mode **FOCUS** |
| Gerakan tangan kiri/kanan | Memutar objek 3D |

**Shortcut Keyboard:**
| Tombol | Fungsi |
|--------|--------|
| `T` | Mode LOVE |
| `S` | Mode SCATTER |
| `F` | Mode FOCUS |
| `H` | Tampilkan/sembunyikan webcam |

### Mobile (HP)
| Gestur | Fungsi |
|--------|--------|
| 👆 Tap 1x | Ganti mode (LOVE → SCATTER → FOCUS) |
| 👆 Drag | Memutar objek 3D |
| 🤏 Pinch | Zoom in/out |

## 🚀 Cara Menjalankan

1. **Clone repositori ini**
   ```bash
   git clone https://github.com/majid0511/3D_love-2.0.git
   ```
2. **Buka file `index.html`** di browser modern (Chrome, Edge, Firefox)
3. Atau jalankan dengan live server (misal: VS Code Live Server)

> **Catatan:** Hand tracking hanya berfungsi di **desktop** dengan koneksi internet (mengunduh model MediaPipe dari CDN). Di mobile, kontrol otomatis beralih ke touch gesture.

## 📁 Struktur File

```
3D love 2.0/
├── index.html                # Halaman utama
├── lagu.mp3                  # Musik latar
├── README.md                 # Dokumentasi
├── assets/
│   ├── css/
│   │   └── style.css         # Stylesheet
│   └── js/
│       └── script.js         # JavaScript utama (Three.js + MediaPipe)
└── images/                   # Folder foto
    ├── 1.jpg
    ├── 2.jpg
    ├── 3.jpg
    ├── 4.jpg
    ├── 5.jpg
    ├── 6.jpg
    └── 7.jpg
```

## 🛠 Teknologi

- **[Three.js](https://threejs.org/)** (v0.160.0) - Library 3D JavaScript
- **[MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)** - Hand landmark detection
- **[OrbitControls](https://threejs.org/docs/#examples/en/controls/OrbitControls)** - Kontrol rotasi/zoom 3D
- **[EffectComposer](https://threejs.org/docs/#examples/en/postprocessing/EffectComposer)** + UnrealBloomPass - Efek bloom

## 📸 Menambahkan Foto Sendiri

1. Masukkan file gambar ke folder `images/`
2. Edit `CONFIG.preload.scanCount` di `assets/js/script.js` jika jumlah foto berubah
3. Format yang didukung: `jpg`, `jpeg`, `png`, `webp`, `bmp`

## 📄 Lisensi

Hak cipta dilindungi. Proyek ini bersifat pribadi.

---

Dibuat dengan ❤️ menggunakan Three.js