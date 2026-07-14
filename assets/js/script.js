// ============================================================
// IMPORT MODULES
// Three.js untuk 3D, MediaPipe untuk hand tracking
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// ============================================================
// DETEKSI MOBILE - Cek apakah user menggunakan HP
// ============================================================
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 600;

// ============================================================
// KONFIGURASI - Semua pengaturan dalam satu objek
// ============================================================
const CONFIG = {
    colors: {
        bg: 0x000000,          // Warna background hitam
        frameColor: 0xffffff,  // Warna bingkai foto
        deepGreen: 0x03180a,   // Hijau tua
        accentRed: 0x990000,   // Merah aksen
    },
    particles: {
        count: isMobile ? 800 : 1500,          // Jumlah partikel (lebih sedikit di mobile)
        dustCount: isMobile ? 1200 : 2500,     // Jumlah debu
        treeHeight: 24,
        treeRadius: 8
    },
    camera: { z: 50 },                          // Posisi awal kamera
    preload: {
        autoScanLocal: true,                    // Auto scan gambar lokal
        scanCount: 10,                           // Jumlah gambar di folder images/
        extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'],
        images: []
    }
};

// ============================================================
// STATE GLOBAL - Menyimpan status aplikasi
// ============================================================
const STATE = {
    mode: 'TREE',          // Mode: TREE | SCATTER | FOCUS
    focusIndex: -1,
    focusTarget: null,     // Mesh foto yang sedang di-focus
    hand: { detected: false, x: 0, y: 0 },  // Posisi tangan (MediaPipe)
    rotation: { x: 0, y: 0 },               // Rotasi grup utama
    touch: { active: false, startX: 0, startY: 0, pinchDist: 0 }  // Touch state mobile
};

// ============================================================
// VARIABEL GLOBAL THREE.JS
// ============================================================
let scene, camera, renderer, composer, controls;
let mainGroup;
let clock = new THREE.Clock();
let particleSystem = [];           // Array semua partikel
let photoMeshGroup = new THREE.Group();  // Grup untuk foto
let handLandmarker, video;
let caneTexture;
const debugInfo = document.getElementById('debug-info');
const modeIndicator = document.getElementById('mode-indicator');

// ============================================================
// INISIALISASI - Fungsi utama yang menjalankan semua setup
// ============================================================
async function init() {
    initThree();           // Setup Three.js (scene, camera, renderer)
    setupEnvironment();    // Setup environment map (pencahayaan global)
    setupLights();         // Setup lampu
    createTextures();      // Buat tekstur custom
    createParticles();     // Buat partikel love
    createDust();          // Buat partikel debu
    loadPredefinedImages(); // Load gambar dari folder images/
    setupPostProcessing(); // Setup efek bloom
    setupEvents();         // Setup event resize & keyboard
    setupMusic();          // Setup tombol musik
    setupCamToggle();      // Setup tombol kamera

    // Inisialisasi MediaPipe hanya di desktop
    if (!isMobile) {
        await initMediaPipe();
    } else {
        // Di mobile, sembunyikan webcam secara default
        document.getElementById('webcam-wrapper').classList.add('hidden');
    }

    // Hilangkan loading screen dengan fade out
    const loader = document.getElementById('loader');
    loader.style.opacity = 0;
    setTimeout(() => loader.remove(), 800);

    // Mulai animasi loop
    animate();
}

// ============================================================
// LOAD GAMBAR - Memuat gambar dari folder images/
// ============================================================
function loadPredefinedImages() {
    const loader = new THREE.TextureLoader();
    CONFIG.preload.images.forEach(url => {
        loader.load(url,
            (t) => { t.colorSpace = THREE.SRGBColorSpace; addPhotoToScene(t); },
            undefined, () => {}
        );
    });
    // Scan otomatis file images/1.jpg sampai images/7.jpg
    if (CONFIG.preload.autoScanLocal) {
        for (let i = 1; i <= CONFIG.preload.scanCount; i++) {
            CONFIG.preload.extensions.forEach(ext => {
                const path = `./images/${i}.${ext}`;
                loader.load(path,
                    (t) => { t.colorSpace = THREE.SRGBColorSpace; addPhotoToScene(t); },
                    undefined, () => {}
                );
            });
        }
    }
}

// ============================================================
// INISIALISASI THREE.JS - Scene, Camera, Renderer, Controls
// ============================================================
function initThree() {
    const container = document.getElementById('canvas-container');
    
    // Scene dengan fog untuk efek kedalaman
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.01);

    // Perspective Camera
    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, CONFIG.camera.z);

    // WebGL Renderer dengan optimasi performa
    renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.2;
    container.appendChild(renderer.domElement);

    // OrbitControls untuk rotasi/zoom dengan touch di mobile
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 20;
    controls.maxDistance = 100;
    controls.autoRotate = false;
    controls.enableRotate = true;
    // Nonaktifkan di desktop karena pakai hand tracking
    if (!isMobile) controls.enabled = false;

    // Grup utama yang akan dirotasi
    mainGroup = new THREE.Group();
    scene.add(mainGroup);
}

// ============================================================
// ENVIRONMENT MAP - Pencahayaan global dari ruangan
// ============================================================
function setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
}

// ============================================================
// LAMPU - Setup berbagai sumber cahaya
// ============================================================
function setupLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));    // Cahaya ambient lembut
    
    // Lampu dalam dari dalam grup (ikut rotasi)
    const innerLight = new THREE.PointLight(0xffaa00, 2, 20);
    innerLight.position.set(0, 5, 0);
    mainGroup.add(innerLight);
    
    // Spot light emas dari samping
    const spotGold = new THREE.SpotLight(0xffcc66, 1200);
    spotGold.position.set(30, 40, 40);
    spotGold.angle = 0.5; spotGold.penumbra = 0.5;
    scene.add(spotGold);
    
    // Spot light biru dari sisi lain
    const spotBlue = new THREE.SpotLight(0x6688ff, 600);
    spotBlue.position.set(-30, 20, -30);
    scene.add(spotBlue);
    
    // Fill light dari depan
    const fill = new THREE.DirectionalLight(0xffeebb, 0.8);
    fill.position.set(0, 0, 50);
    scene.add(fill);
}

// ============================================================
// POST PROCESSING - Efek Bloom (cahaya menyilaukan)
// ============================================================
function setupPostProcessing() {
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        isMobile ? 1.0 : 1.5,  // Strength (lebih rendah di mobile)
        0.4,                     // Radius
        0.85                     // Threshold
    );
    bloomPass.threshold = 0.7;
    bloomPass.strength = isMobile ? 1.0 : 1.5;
    bloomPass.radius = 0.2;
    
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
}

// ============================================================
// TEKSTUR - Membuat tekstur custom untuk batang pohon
// ============================================================
function createTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background putih dengan garis merah
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0,0,128,128);
    ctx.fillStyle = '#880000';
    ctx.beginPath();
    for(let i=-128; i<256; i+=32) {
        ctx.moveTo(i,0); ctx.lineTo(i+32,128); ctx.lineTo(i+16,128); ctx.lineTo(i-16,0);
    }
    ctx.fill();
    
    caneTexture = new THREE.CanvasTexture(canvas);
    caneTexture.wrapS = THREE.RepeatWrapping;
    caneTexture.wrapT = THREE.RepeatWrapping;
    caneTexture.repeat.set(3,3);
}

// ============================================================
// KELAS PARTIKEL - Setiap objek di scene adalah turunan kelas ini
// ============================================================
class Particle {
    constructor(mesh, type, isDust = false) {
        this.mesh = mesh;
        this.type = type;           // 'RED_BOX' | 'GOLD_BOX' | 'PINK_SPHERE' | 'PHOTO' | 'DUST'
        this.isDust = isDust;
        this.posTree = new THREE.Vector3();    // Posisi saat mode TREE (bentuk love)
        this.posScatter = new THREE.Vector3(); // Posisi saat mode SCATTER (tersebar)
        this.baseScale = mesh.scale.x;         // Skala original
        const speedMult = (type === 'PHOTO') ? 0.3 : 2.0;
        this.spinSpeed = new THREE.Vector3(
            (Math.random()-0.5)*speedMult,
            (Math.random()-0.5)*speedMult,
            (Math.random()-0.5)*speedMult
        );
        this.calculatePositions();
    }

    // Hitung posisi untuk mode TREE (bentuk love) dan SCATTER (acak)
    calculatePositions() {
        if (this.type === 'PHOTO') {
            // Foto: posisi tree diatur nanti oleh updatePhotoLayout()
            this.posTree.set(0,0,0);
            const rScatter = 18 + Math.random()*12;
            const theta = Math.random()*Math.PI*2;
            const phi = Math.acos(2*Math.random()-1);
            this.posScatter.set(
                rScatter*Math.sin(phi)*Math.cos(theta),
                rScatter*Math.sin(phi)*Math.sin(theta),
                rScatter*Math.cos(phi)
            );
            return;
        }
        
        // Bentuk LOVE menggunakan rumus parametric heart curve
        const t = Math.random()*Math.PI*2;
        const scale = 0.85;
        const x = 14*Math.pow(Math.sin(t),3);
        const y = 11*Math.cos(t)-4*Math.cos(2*t)-1.5*Math.cos(3*t)-0.5*Math.cos(4*t);
        const z = Math.cos(t)*2+(Math.random()-0.5)*1.2;
        this.posTree.set(x*scale, y*scale, z*scale);
        
        // Posisi scatter: tersebar di bola acak
        let rScatter = this.isDust ? (15+Math.random()*20) : (10+Math.random()*15);
        const sTheta = Math.random()*Math.PI*2;
        const sPhi = Math.acos(2*Math.random()-1);
        this.posScatter.set(
            rScatter*Math.sin(sPhi)*Math.cos(sTheta),
            rScatter*Math.sin(sPhi)*Math.sin(sTheta),
            rScatter*Math.cos(sPhi)
        );
    }

    // Update posisi, rotasi, dan skala setiap frame
    update(dt, mode, focusTargetMesh) {
        // Tentukan target posisi berdasarkan mode
        let target = this.posTree;
        if (mode === 'SCATTER') target = this.posScatter;
        else if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) {
                // Foto yang di-focus dibawa ke depan kamera
                const desiredWorldPos = new THREE.Vector3(0,2,35);
                const invMatrix = new THREE.Matrix4().copy(mainGroup.matrixWorld).invert();
                target = desiredWorldPos.applyMatrix4(invMatrix);
            } else {
                target = this.posScatter;
            }
        }
        
        // Lerp posisi dengan kecepatan berbeda
        const lerpSpeed = (mode==='FOCUS' && this.mesh===focusTargetMesh) ? 5.0 : 2.0;
        this.mesh.position.lerp(target, lerpSpeed*dt);
        
        // Rotasi berdasarkan mode
        if (mode==='SCATTER') {
            this.mesh.rotation.x += this.spinSpeed.x*dt;
            this.mesh.rotation.y += this.spinSpeed.y*dt;
            this.mesh.rotation.z += this.spinSpeed.z*dt;
        } else if (mode==='TREE') {
            if (this.type==='PHOTO') {
                this.mesh.lookAt(0,this.mesh.position.y,0);
                this.mesh.rotateY(Math.PI);
            } else {
                this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x,0,dt);
                this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z,0,dt);
                this.mesh.rotation.y += 0.5*dt;
            }
        }
        if (mode==='FOCUS' && this.mesh===focusTargetMesh) {
            this.mesh.lookAt(camera.position);
        }
        
        // Skala dinamis
        let s = this.baseScale;
        if (this.isDust) {
            s = this.baseScale*(0.8+0.4*Math.sin(clock.elapsedTime*4+this.mesh.id));
            if (mode==='TREE') s = 0;  // Debu menghilang di mode love
        } else if (mode==='SCATTER' && this.type==='PHOTO') {
            s = this.baseScale*2.5;     // Foto lebih besar di mode scatter
        } else if (mode==='FOCUS') {
            if (this.mesh===focusTargetMesh) s = 4.5;  // Foto focus lebih besar
            else s = this.baseScale*0.8;
        }
        this.mesh.scale.lerp(new THREE.Vector3(s,s,s), 4*dt);
    }
}

// ============================================================
// UPDATE LAYOUT FOTO - Atur posisi foto membentuk love di mode TREE
// ============================================================
function updatePhotoLayout() {
    const photos = particleSystem.filter(p => p.type==='PHOTO');
    const count = photos.length;
    if (count===0) return;
    photos.forEach((p,i) => {
        const t = (i/count)*Math.PI*2;
        const scale = 0.85;
        const x = 16*Math.pow(Math.sin(t),3);
        const y = 13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t);
        p.posTree.set(x*scale, y*scale, 0.5);
        p.mesh.lookAt(0,0,50);
    });
}

// ============================================================
// BUAT PARTIKEL LOVE - Kotak & bola yang membentuk love
// ============================================================
function createParticles() {
    const sphereGeo = new THREE.SphereGeometry(0.5,32,32);
    const boxGeo = new THREE.BoxGeometry(0.55,0.55,0.55);
    
    // Material emas
    const goldMat = new THREE.MeshStandardMaterial({ color:0xffd700, metalness:1.0, roughness:0.1, emissive:0xffaa00, emissiveIntensity:0.2 });
    // Material merah (paling banyak)
    const redMat = new THREE.MeshStandardMaterial({ color:0xff0033, metalness:0.15, roughness:0.05, clearcoat:1.0, clearcoatRoughness:0.03, emissive:0x990000, emissiveIntensity:0.35 });
    // Material pink
    const pinkMat = new THREE.MeshPhysicalMaterial({ color:0xff66aa, metalness:0.1, roughness:0.2, clearcoat:1.0, emissive:0xff0066, emissiveIntensity:0.3 });
    
    for (let i=0; i<CONFIG.particles.count; i++) {
        const rand = Math.random();
        let mesh, type;
        if (rand<0.60) { mesh = new THREE.Mesh(boxGeo, redMat); type='RED_BOX'; }
        else if (rand<0.85) { mesh = new THREE.Mesh(boxGeo, goldMat); type='GOLD_BOX'; }
        else { mesh = new THREE.Mesh(sphereGeo, pinkMat); type='PINK_SPHERE'; }
        const s = 0.4+Math.random()*0.5;
        mesh.scale.set(s,s,s);
        mesh.rotation.set(Math.random()*6, Math.random()*6, Math.random()*6);
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh, type, false));
    }
    mainGroup.add(photoMeshGroup);
}

// ============================================================
// BUAT DEBU - Partikel kecil yang melayang di mode scatter
// ============================================================
function createDust() {
    const geo = new THREE.TetrahedronGeometry(0.08,0);
    const mat = new THREE.MeshBasicMaterial({ color:0xffcccc, transparent:true, opacity:0.6 });
    for(let i=0; i<CONFIG.particles.dustCount; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(0.5+Math.random());
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh,'DUST',true));
    }
}

// ============================================================
// TAMBAH FOTO - Membuat mesh foto dengan bingkai
// ============================================================
function addPhotoToScene(texture) {
    const frameMat = new THREE.MeshStandardMaterial({ color:CONFIG.colors.frameColor, metalness:1.0, roughness:0.1 });
    let width=1.2, height=1.2;
    if (texture.image) {
        const aspect = texture.image.width/texture.image.height;
        if (aspect>1) height=width/aspect; else width=height*aspect;
    }
    const frameGeo = new THREE.BoxGeometry(1.4,1.4,0.05);
    const frame = new THREE.Mesh(frameGeo, frameMat);
    const photoGeo = new THREE.PlaneGeometry(width, height);
    const photoMat = new THREE.MeshBasicMaterial({ map:texture, side:THREE.DoubleSide });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.04;
    
    // Grup berisi frame + foto
    const group = new THREE.Group();
    group.add(frame); group.add(photo);
    frame.scale.set(width/1.2, height/1.2, 1);
    const s=0.8; group.scale.set(s,s,s);
    
    photoMeshGroup.add(group);
    particleSystem.push(new Particle(group,'PHOTO',false));
    updatePhotoLayout();
}

// ============================================================
// MEDIAPIPE (DESKTOP ONLY) - Hand tracking untuk kontrol gerakan tangan
// ============================================================
async function initMediaPipe() {
    video = document.getElementById('webcam');
    const constraints = { video: { width:{ideal:640}, height:{ideal:480}, frameRate:{ideal:30} } };
    try {
        // Load MediaPipe vision tasks
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        // Buat HandLandmarker untuk deteksi 21 titik tangan
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });
        // Akses webcam
        if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
            debugInfo.innerText = "Kamera aktif. Tunjukkan tangan.";
        }
    } catch(e) {
        console.warn("Webcam/MediaPipe error:", e);
        debugInfo.innerText = "Kamera tidak tersedia";
        document.getElementById('webcam-wrapper').classList.add('hidden');
    }
}

let lastVideoTime = -1;
// Loop prediksi webcam setiap frame
async function predictWebcam() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        if (handLandmarker) {
            const result = handLandmarker.detectForVideo(video, performance.now());
            processGestures(result);
        }
    }
    requestAnimationFrame(predictWebcam);
}

// ============================================================
// PROSES GESTUR TANGAN - Deteksi posisi jari untuk ganti mode
// ============================================================
function processGestures(result) {
    if (result.landmarks && result.landmarks.length>0) {
        STATE.hand.detected = true;
        const lm = result.landmarks[0];  // Tangan pertama
        
        // Posisi tengah telapak tangan (landmark 9) untuk kontrol rotasi
        STATE.hand.x = (lm[9].x-0.5)*2;
        STATE.hand.y = (lm[9].y-0.5)*2;
        
        const thumb=lm[4], index=lm[8], wrist=lm[0], middleMCP=lm[9];
        const handSize = Math.hypot(middleMCP.x-wrist.x, middleMCP.y-wrist.y);
        if (handSize<0.02) return;
        
        // Hitung rata-rata jarak ujung jari ke pergelangan
        const tips=[lm[8],lm[12],lm[16],lm[20]];
        let avgTipDist=0;
        tips.forEach(t => avgTipDist += Math.hypot(t.x-wrist.x, t.y-wrist.y));
        avgTipDist/=4;
        
        const pinchDist = Math.hypot(thumb.x-index.x, thumb.y-index.y);
        const extensionRatio = avgTipDist/handSize;    // Rasio bukaan jari
        const pinchRatio = pinchDist/handSize;         // Rasio cubitan
        
        debugInfo.innerText = `Ext:${extensionRatio.toFixed(2)} Pinch:${pinchRatio.toFixed(2)} | ${STATE.mode}`;
        
        // Logika gestur:
        // - Tangan tertutup (extensionRatio < 1.5) -> Mode TREE (love)
        // - Cubit (pinchRatio < 0.35) -> Mode FOCUS (zoom foto acak)
        // - Tangan terbuka (extensionRatio > 1.7) -> Mode SCATTER
        if (extensionRatio<1.5) {
            STATE.mode='TREE'; STATE.focusTarget=null;
        } else if (pinchRatio<0.35) {
            if (STATE.mode!=='FOCUS') {
                STATE.mode='FOCUS';
                const photos=particleSystem.filter(p=>p.type==='PHOTO');
                if (photos.length) STATE.focusTarget=photos[Math.floor(Math.random()*photos.length)].mesh;
            }
        } else if (extensionRatio>1.7) {
            STATE.mode='SCATTER'; STATE.focusTarget=null;
        }
        updateModeIndicator();
    } else {
        STATE.hand.detected = false;
        debugInfo.innerText = "Tangan tidak terdeteksi";
    }
}

// ============================================================
// TOUCH CONTROLS (MOBILE) - Kontrol sentuh untuk HP
// ============================================================
function setupTouchControls() {
    const canvas = renderer.domElement;

    // Single tap -> ganti mode (TREE -> SCATTER -> FOCUS)
    let tapTimeout = null;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            tapTimeout = setTimeout(() => { tapTimeout = null; }, 200);
            STATE.touch.startX = e.touches[0].clientX;
            STATE.touch.startY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            STATE.touch.pinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, { passive: true });

    canvas.addEventListener('touchend', (e) => {
        if (tapTimeout !== null && e.changedTouches.length === 1) {
            const dx = Math.abs(e.changedTouches[0].clientX - STATE.touch.startX);
            const dy = Math.abs(e.changedTouches[0].clientY - STATE.touch.startY);
            if (dx < 10 && dy < 10) {  // Pastikan bukan drag/geser
                // Cycle mode
                const modes = ['TREE','SCATTER','FOCUS'];
                const idx = modes.indexOf(STATE.mode);
                const next = modes[(idx+1)%modes.length];
                STATE.mode = next;
                if (next==='FOCUS') {
                    const photos = particleSystem.filter(p=>p.type==='PHOTO');
                    if (photos.length) STATE.focusTarget = photos[Math.floor(Math.random()*photos.length)].mesh;
                } else {
                    STATE.focusTarget = null;
                }
                updateModeIndicator();
            }
        }
    }, { passive: true });
}

// ============================================================
// UPDATE INDIKATOR MODE - Update teks mode di layar
// ============================================================
function updateModeIndicator() {
    const labels = { TREE: '❤ LOVE', SCATTER: '✨ SCATTER', FOCUS: '🔍 FOCUS' };
    modeIndicator.textContent = labels[STATE.mode] || STATE.mode;
}

// ============================================================
// SETUP EVENTS - Resize window & keyboard shortcuts
// ============================================================
function setupEvents() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
    
    // Keyboard shortcuts (PC)
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k==='h') {
            document.getElementById('webcam-wrapper').classList.toggle('hidden');
        }
        if (k==='t') { STATE.mode='TREE'; STATE.focusTarget=null; updateModeIndicator(); }
        if (k==='s') { STATE.mode='SCATTER'; STATE.focusTarget=null; updateModeIndicator(); }
        if (k==='f') {
            STATE.mode='FOCUS';
            const photos=particleSystem.filter(p=>p.type==='PHOTO');
            if (photos.length) STATE.focusTarget=photos[Math.floor(Math.random()*photos.length)].mesh;
            updateModeIndicator();
        }
    });

    // Touch controls untuk mobile
    if (isMobile) setupTouchControls();
}

// ============================================================
// SETUP MUSIK - Tombol play/pause lagu
// ============================================================
function setupMusic() {
    const bgm = document.getElementById('bgm');
    const playBtn = document.getElementById('play-btn');
    playBtn.addEventListener('click', () => {
        if (bgm.paused) { bgm.play(); playBtn.innerText = '⏸ Pause'; }
        else { bgm.pause(); playBtn.innerText = '🎵 Musik'; }
    });
    // Auto-play setelah user klik pertama kali
    window.addEventListener('click', () => {
        if (bgm.paused && bgm.currentTime===0) bgm.play().catch(()=>{});
    }, { once: true });
}

// ============================================================
// SETUP KAMERA TOGGLE - Tombol show/hide webcam
// ============================================================
function setupCamToggle() {
    const camBtn = document.getElementById('cam-toggle-btn');
    const webcamWrapper = document.getElementById('webcam-wrapper');
    let camVisible = !isMobile;
    if (!camVisible) webcamWrapper.classList.add('hidden');

    camBtn.addEventListener('click', async () => {
        camVisible = !camVisible;
        if (camVisible) {
            webcamWrapper.classList.remove('hidden');
            camBtn.innerText = '📷 Tutup';
            // Init mediapipe di mobile jika belum
            if (isMobile && !handLandmarker) {
                await initMediaPipe();
            }
        } else {
            webcamWrapper.classList.add('hidden');
            camBtn.innerText = '📷 Kamera';
        }
    });
}

// ============================================================
// ANIMASI LOOP - Fungsi utama yang berjalan setiap frame
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    // Update OrbitControls (mobile)
    if (isMobile) controls.update();

    // Efek pulse (detak) di mode love
    let pulse = 1.0;
    if (STATE.mode==='TREE') pulse = 1.0+Math.sin(time*1.3)*0.03;
    mainGroup.scale.lerp(new THREE.Vector3(pulse,pulse,pulse), 2*dt);

    // Rotasi grup utama
    if (!isMobile) {
        // Desktop: rotasi dikontrol oleh hand tracking
        if (STATE.hand.detected) {
            const targetRotY = STATE.hand.x*Math.PI*0.5;
            const targetRotX = STATE.hand.y*Math.PI*0.2;
            STATE.rotation.y += (targetRotY-STATE.rotation.y)*2.0*dt;
            STATE.rotation.x += (targetRotX-STATE.rotation.x)*2.0*dt;
        } else {
            // Auto-rotate lambat jika tangan tidak terdeteksi
            STATE.rotation.y += 0.2*dt;
            STATE.rotation.x += (0-STATE.rotation.x)*dt;
        }
        mainGroup.rotation.y = STATE.rotation.y;
        mainGroup.rotation.x = STATE.rotation.x;
    } else {
        // Mobile: OrbitControls handle camera, auto-rotate grup lambat
        if (!controls.enabled) {
            STATE.rotation.y += 0.15*dt;
            mainGroup.rotation.y = STATE.rotation.y;
        }
    }

    // Update semua partikel
    particleSystem.forEach(p => {
        p.update(dt, STATE.mode, STATE.focusTarget);
        if (p.type==='PHOTO' && STATE.mode==='TREE') {
            p.mesh.lookAt(camera.position);
        }
    });

    // Render dengan efek bloom
    composer.render();
}

// ============================================================
// START - Jalankan aplikasi
// ============================================================
init();