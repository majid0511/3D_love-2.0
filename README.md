# 3D LOVE - CIPUT PIC 💖

Aplikasi web 3D interaktif yang menampilkan partikel membentuk hati menggunakan **Three.js** dengan kontrol **hand tracking** via MediaPipe dan dukungan **touch gesture** untuk mobile. Proyek ini dipecah menjadi beberapa file untuk kemudahan pengelolaan.

---

## 📋 Analisis Lengkap Kode

### 1. 🏗️ Struktur Proyek

```
3D love 2.0/
├── index.html                  # Halaman utama (HTML + Import Map)
├── lagu.mp3                    # Musik latar (uri-uri playlist)
├── lagu2.mp3                   # Lagu kedua (tambahan, bisa ditambah)
├── README.md                   # Dokumentasi ini
├── .gitignore                  # Ignore file (jika ada)
├── assets/
│   ├── css/
│   │   └── style.css           # Stylesheet (177 baris)
│   └── js/
│       └── script.js           # JavaScript utama (922 baris)
└── images/                     # 10 foto (1.jpg - 10.jpg)
    ├── 1.jpg ... 10.jpg
```

---

### 2. 📄 index.html (106 baris)

**Fungsi:** Entry point aplikasi. Berisi struktur HTML tanpa CSS/JS inline.

| Bagian | Elemen | Fungsi |
|--------|--------|--------|
| **Head** | `<meta viewport>` | Responsif, cegah zoom user di mobile |
| | `<link rel="icon">` | Favicon emoji hati (💖) via data URI, hindari 404 |
| | `<link rel="stylesheet">` | Link ke `assets/css/style.css` |
| | `<script type="importmap">` | Mapping URL modul Three.js v0.160.0 & MediaPipe v0.10.3 |
| **Loading** | `#loader` | Spinner + teks "Loading Memories", fade out setelah siap |
| **Canvas** | `#canvas-container` | Wadah render Three.js (z-index: 1) |
| **Audio** | `<audio id="bgm">` | Tidak punya `<source>` langsung - src diatur via JS dari `CONFIG.playlist` |
| **UI** | `#title` | Menampilkan "CIPUT PIC" dengan gold gradient |
| | `#mode-indicator` | Menunjukkan mode aktif: LOVE / SCATTER / FOCUS |
| | `#photo-caption` | Caption foto saat mode FOCUS |
| | `#touch-hint` | Petunjuk gesture mobile (hidden di desktop) |
| **Easter Egg** | `#capture-flash` | Flash putih saat screenshot |
| | `#capture-notif` | Notifikasi "📸 Tersimpan!" |
| **Bottom Bar** | `#webcam-wrapper` | Preview kamera untuk hand tracking |
| | `#music-controls` | Tombol Play/Pause + Next Track |
| | `#cam-toggle-btn` | Toggle webcam |
| **Script** | `<script type="module">` | Load `assets/js/script.js` sebagai ES Module |

**Catatan:** Import Map diperlukan karena Three.js dan MediaPipe di-load dari CDN sebagai ES Module.

---

### 3. 🎨 assets/css/style.css (177 baris)

**Fungsi:** Semua styling visual aplikasi.

| Section | Detail |
|---------|--------|
| **Google Fonts** | Import `Cinzel` (font elegan bergaya roman) |
| **Global Reset** | `box-sizing: border-box`, `touch-action: none` (cegah scroll), `-webkit-tap-highlight-color: transparent` |
| **Body** | Fullscreen hitam (`overflow: hidden`), font Cinzel |
| **Loading Screen** | Spinner animasi `spin` 1s, border emas, teks emas uppercase |
| **Title** | Posisi absolute center-top, `pointer-events: none`, gradient emas dengan `background-clip: text`, glow shadow |
| **Button (`.upload-btn`)** | Glassmorphism (`backdrop-filter: blur`), border emas, hover jadi emas solid dengan box-shadow glow |
| **Bottom Bar** | Flexbox space-between, `pointer-events: none` (event menembus ke tombol) |
| **Webcam Wrapper** | Border emas, `transition` smooth untuk hide/show, clamp untuk ukuran responsif, `.hidden` class: opacity + dimensi jadi 0 |
| **Webcam** | `object-fit: cover`, `scaleX(-1)` (mirror untuk selfie) |
| **Debug Info** | Monospace kecil di pojok kiri bawah webcam |
| **Touch Hint** | Hidden di desktop (`display: none`), muncul di mobile via media query |
| **Mode Indicator** | Absolute, center, teks gold transparan 40% |
| **Responsive** | `@media max-width:600px` → touch hint muncul, webcam mengecil, button mengecil |
| | `@media max-width:380px` → button lebih kecil lagi untuk layar sangat sempit |

**Teknik CSS digunakan:**
- `clamp()` untuk ukuran font responsif
- `backdrop-filter: blur(8px)` untuk efek glassmorphism
- `background-clip: text` untuk gradient text
- CSS `@keyframes` untuk spinner animasi
- `pointer-events: none` / `auto` untuk kontrol event
- `@media queries` untuk responsive design

---

### 4. 🧠 assets/js/script.js (922 baris)

#### 4.1 Imports & Konfigurasi

```javascript
// Library:
import * as THREE from 'three';                          // 3D engine
import { OrbitControls } from 'three/addons/controls';   // Rotasi/zoom touch
import { EffectComposer, RenderPass, UnrealBloomPass } from 'three/addons/postprocessing'; // Bloom effect
import { RoomEnvironment } from 'three/addons/environments'; // Environment map
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'; // Hand tracking
```

#### 4.2 Deteksi Mobile

```javascript
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 600;
```
- Mempengaruhi jumlah partikel, kualitas render, kontrol (touch vs hand tracking), visibility webcam.

#### 4.3 CONFIG - Objek Konfigurasi

| Properti | Value | Keterangan |
|----------|-------|------------|
| `colors.bg` | `0x000000` | Background hitam |
| `colors.frameColor` | `0xffffff` | Bingkai foto putih metalik |
| `particles.count` | 800 (mobile) / 1500 (desktop) | Partikel love |
| `particles.dustCount` | 1200 / 2500 | Partikel debu |
| `preload.scanCount` | 10 | Jumlah gambar di folder images/ |
| `preload.extensions` | jpg, jpeg, png, webp, bmp | Format gambar yang didukung |
| `playlist` | Array `{ name, src }` | Daftar lagu, auto-next |
| `captions` | Object `{ 1: 'caption', ... }` | Caption per foto |

#### 4.4 STATE - Status Aplikasi

| Properti | Default | Fungsi |
|----------|---------|--------|
| `mode` | `'TREE'` | Mode: TREE (love) / SCATTER / FOCUS |
| `focusTarget` | `null` | Mesh foto yang di-focus |
| `trackIndex` | `0` | Index lagu yang diputar |
| `hand` | `{ detected: false, x: 0, y: 0 }` | Data hand tracking |
| `rotation` | `{ x: 0, y: 0 }` | Rotasi grup utama |
| `touch` | `{ active, startX, startY, pinchDist }` | Touch state mobile |

#### 4.5 Alur Inisialisasi (`init()`)

```
init()
├── initThree()          → Scene, Camera, Renderer, OrbitControls, MainGroup
├── setupEnvironment()   → PMREMGenerator + RoomEnvironment
├── setupLights()        → Ambient + Point + 2 Spot + Directional
├── createTextures()     → CanvasTexture untuk batang (cane pattern)
├── createParticles()    → 800-1500 mesh membentuk love
├── createDust()         → 1200-2500 tetrahedron kecil
├── loadPredefinedImages() → Load images/1.jpg .. 10.jpg
├── setupPostProcessing() → RenderPass + UnrealBloomPass
├── setupEvents()        → Resize + Keyboard shortcuts
├── setupMusic()         → Playlist player
├── setupCamToggle()     → Webcam show/hide
├── initMediaPipe()      → (Desktop only) HandLandmarker
├── Hide loader (fade out 800ms)
└── animate()            → Loop utama
```

#### 4.6 Three.js Setup

**Renderer:**
```javascript
renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,           // Anti-aliasing nonaktif di mobile (performa)
    alpha: false,                   // Background hitam solid
    powerPreference: "high-performance",
    preserveDrawingBuffer: true     // PENTING: untuk screenshot toDataURL
});
renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 2));
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 2.2;
```

**Camera:**
- PerspectiveCamera with FOV 42°, near 0.1, far 1000
- Position: (0, 2, 50)

**OrbitControls:**
- Damping enabled (smooth)
- Min distance: 20, Max: 100
- Disabled on desktop (pakai hand tracking)

**Fog:**
```javascript
scene.fog = new THREE.FogExp2(0x000000, 0.01); // Fog hitam eksponensial
```

#### 4.7 Pencahayaan (6 sumber cahaya)

| Cahaya | Warna | Intensitas | Posisi |
|--------|-------|------------|--------|
| Ambient | Putih | 0.6 | Global |
| Point | Jingga (#ffaa00) | 2 | (0, 5, 0) - **di dalam mainGroup** |
| Spot Gold | Emas (#ffcc66) | 1200 | (30, 40, 40) |
| Spot Blue | Biru (#6688ff) | 600 | (-30, 20, -30) |
| Directional | Krem (#ffeebb) | 0.8 | (0, 0, 50) |

**Penting:** Point light ada di dalam `mainGroup`, jadi ikut rotasi grup → efek lampu senter berputar bersama love.

#### 4.8 Efek Bloom

```javascript
bloomPass = new UnrealBloomPass(size, strength, radius, threshold);
// strength: 1.0 (mobile) / 1.5 (desktop)
// threshold: 0.7 (hanya objek terang yang kena bloom)
// radius: 0.2
```

#### 4.9 Partikel LOVE (Heart Curve)

Menggunakan **parametric heart equation**:
```javascript
x(t) = 14 * sin³(t)
y(t) = 11*cos(t) - 4*cos(2t) - 1.5*cos(3t) - 0.5*cos(4t)
z(t) = 2*cos(t) + random offset
```

Setiap partikel punya 2 posisi:
- `posTree` → Posisi di bentuk love (TREE mode)
- `posScatter` → Posisi acak di bola 3D (SCATTER mode)

**Lerp animation:** Particle.position.lerp(target, speed * dt) untuk transisi smooth antar mode.

#### 4.10 Material Partikel

| Tipe | Distribusi | Material |
|------|-----------|----------|
| RED_BOX | 60% | MeshStandardMaterial, merah (#ff0033), emissive, clearcoat |
| GOLD_BOX | 25% | MeshStandardMaterial, emas (#ffd700), metalness 1.0 |
| PINK_SPHERE | 15% | MeshPhysicalMaterial, pink (#ff66aa), clearcoat, emissive |
| DUST | - | MeshBasicMaterial, pink transparan, tetrahedron kecil |
| PHOTO | per gambar | PlaneGeometry + BoxGeometry frame, MeshBasicMaterial (toneMapped: false) |

#### 4.11 Foto (addPhotoToScene)

- Membuat frame 3D dari `BoxGeometry` dengan bingkai putih metalik
- Foto sebagai `PlaneGeometry` dengan `MeshBasicMaterial`
- **`toneMapped: false`** → Foto tidak terpengaruh tone mapping exposure (supaya tidak overexposed)
- Caption disimpan di `group.userData.caption`
- Posisi foto di mode TREE menggunakan heart curve juga

#### 4.12 MediaPipe Hand Tracking

**Inisialisasi:**
```javascript
handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/.../hand_landmarker.task",
        delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
});
```

**Deteksi 21 landmark tangan,** digunakan untuk:
- **Rotasi grup:** Posisi telapak (landmark 9) → `STATE.hand.x` dan `STATE.hand.y`
- **Gesture:** Extension ratio + pinch ratio
- **Swipe:** Perubahan `STATE.hand.x` terhadap waktu → navigasi foto di FOCUS mode
- **Peace sign:** Deteksi khusus telunjuk & tengah lurus, manis & kelingking menekuk

#### 4.13 Logika Gestur

```
                    ┌─────────────────┐
                    │  Hand detected? │
                    └────────┬────────┘
                             │ yes
                             ▼
              ┌──────────────────────────────┐
              │ Hitung extensionRatio &      │
              │        pinchRatio            │
              └──────────────┬───────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
      extensionRatio   pinchRatio     extensionRatio
         < 1.5          < 0.35           > 1.7
      (TERTUTUP)      (CUBIT)        (TERBUKA)
           │              │                │
           ▼              ▼                ▼
      Mode TREE      Mode FOCUS       Mode SCATTER
      (LOVE)         (zoom foto)      (tersebar)
```

**Tambahan:**
- **Swipe detection:** Saat FOCUS mode, swipe tangan kiri/kanan cepat → ganti foto
- **Peace sign (✌️):** Tahan 2 detik → screenshot otomatis terdownload

#### 4.14 Touch Controls (Mobile)

| Gestur | Aksi |
|--------|------|
| Tap 1x (< 200ms, dx < 10px) | Cycle mode: TREE → SCATTER → FOCUS → TREE |
| Swipe horizontal (> 40px, saat FOCUS) | Navigasi foto |
| Drag 1 jari | OrbitControls rotasi |
| Pinch 2 jari | OrbitControls zoom |

#### 4.15 Music Playlist

```javascript
playlist: [
    { name: 'Lagu Utama', src: 'lagu.mp3' },
    { name: 'Lagu 2', src: 'lagu2.mp3' },
]
```
- Auto-next setelah lagu selesai (event `ended`)
- Tombol `next-track-btn` muncul hanya jika ada > 1 lagu
- Wrap around: setelah lagu terakhir kembali ke pertama

#### 4.16 Easter Egg: Screenshot

```
Peace sign (✌️) terdeteksi
        │
        ▼
Timer mulai (peaceSignStartTime = now)
        │
        ▼
Setiap frame: cek apakah peace sign masih aktif
        │
        ▼
Jika ditahan ≥ 2000ms (PEACE_HOLD_MS)
        │
        ▼
captureRequested = true
        │
        ▼
Setelah frame selesai di-render di animate()
        │
        ▼
renderer.domElement.toDataURL('image/png')
        │
        ▼
Download file: ciput-pic-{timestamp}.png
        │
        ▼
Flash putih + notifikasi "📸 Tersimpan!" (250ms + 2200ms)
```

**Cooldown:** 3000ms antar screenshot untuk mencegah spam.

#### 4.17 Animation Loop (`animate()`)

Per frame:
1. Update OrbitControls (mobile)
2. Pulse effect: `1.0 + sin(time * 1.3) * 0.03` (mode TREE)
3. Rotasi grup: hand tracking (desktop) atau auto-rotate (mobile)
4. Update semua partikel: posisi, rotasi, skala
5. Foto di mode TREE: `lookAt(camera)`
6. Render dengan composer (bloom)
7. Proses screenshot jika diminta

#### 4.18 Screenshot & Feedback Visual

```javascript
function captureScreenshot() {
    const dataURL = renderer.domElement.toDataURL('image/png');
    // Buat <a> element, set download + href, trigger click
    // Tampilkan flash putih + notifikasi
}
```

**Elemen HTML terkait:**
- `#capture-flash` → Flash putih (opacity 1 → 0 dalam 250ms)
- `#capture-notif` → Notifikasi muncul 2.2 detik lalu hilang

---

### 5. 🔄 Mode Interaksi

| Mode | Nama di UI | Partikel Love | Partikel Debu | Foto | Rotasi |
|------|-----------|---------------|---------------|------|--------|
| **TREE** | ❤ LOVE | Bentuk heart, pulse | Sembunyi (scale=0) | Di heart curve, face camera | Auto-rotate lambat |
| **SCATTER** | ✨ SCATTER | Tersebar di bola, berputar acak | Melayang, scale berdenyut | Besar 2.5x, berputar acak | User control |
| **FOCUS** | 🔍 FOCUS | Tersebar (kecuali foto focus) | Melayang | 1 foto besar 4.5x di depan, sisanya kecil | User control |

---

### 6. ⚙️ Performa & Optimasi

| Teknik | Benefit |
|--------|---------|
| `setPixelRatio(min(...))` | Batasi resolusi di layar HiDPI |
| Particle count lebih rendah di mobile | Performa lebih baik di HP |
| `antialias: false` di mobile | Hemat GPU |
| `FogExp2` | Kurangi detail objek jauh (alami) |
| `powerPreference: "high-performance"` | Prioritaskan GPU dedicated |
| Sequential image loading | Hindari 404 berlebihan (coba ext 1 per 1) |
| `toneMapped: false` untuk foto | Foto tetap natural meski bloom tinggi |
| Cooldown swipe & capture | Cegah spam event |

---

### 7. 🧪 Edge Cases & Penanganan Error

| Kasus | Penanganan |
|-------|-----------|
| Webcam tidak tersedia | Catch error, hidden webcam, info "Kamera tidak tersedia" |
| MediaPipe gagal load | Console.warn + hidden webcam |
| Gambar tidak ditemukan | Sequential retry dengan ekstensi berbeda, berhenti jika semua gagal |
| Audio auto-play diblokir | catch() pada promise play, tetap jalan setelah user click |
| Playlist kosong | Check `playlist.length`, skip next button |
| Foto 0 di scene | Check `photos.length` sebelum akses |
| Mobile tanpa kamera | Webcam hidden default, toggle kamera akan init MediaPipe |
| Tangan terlalu kecil di frame | `handSize < 0.02` skip processing |
| Gap besar antar frame hand | dt < 400ms filter untuk swipe |
| Screenshot gagal | Try-catch, console.warn |

---

### 8. 🔧 Konfigurasi yang Bisa Diubah

Di `assets/js/script.js`, cari objek `CONFIG`:

```javascript
// Ubah jumlah partikel:
particles: { count: 1500, dustCount: 2500 }

// Ubah jumlah foto yang di-scan:
preload: { scanCount: 10 }

// Tambah lagu:
playlist: [
    { name: 'Lagu 1', src: 'lagu.mp3' },
    { name: 'Lagu 2', src: 'lagu2.mp3' },
]

// Tambah caption foto:
captions: { 1: 'Momen spesial', 2: 'Hari bahagia' }
```

---

### 9. 🎯 Ringkasan

**Aplikasi ini menggabungkan:**
- ✅ **3D Rendering** - Three.js dengan efek bloom dramatis
- ✅ **Computer Vision** - MediaPipe hand landmark detection real-time
- ✅ **Gesture Recognition** - Fist, open hand, pinch, peace sign, swipe
- ✅ **Touch Interface** - Tap, drag, pinch untuk mobile
- ✅ **Audio Player** - Playlist multi-lagu dengan auto-next
- ✅ **Multi-mode** - LOVE (heart), SCATTER (explosion), FOCUS (photo zoom)
- ✅ **Photo Gallery** - Frame 3D dengan caption
- ✅ **Easter Egg** - Peace sign screenshot
- ✅ **Responsive** - Desktop hand tracking ↔ Mobile touch
- ✅ **Optimized** - Perbedaan kualitas sesuai device

---

Dibuat dengan ❤️ menggunakan Three.js & MediaPipe