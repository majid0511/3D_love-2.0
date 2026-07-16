// ============================================================
// IMPORT MODULES
// Three.js untuk 3D, MediaPipe untuk hand & face tracking
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FilesetResolver, HandLandmarker, FaceLandmarker } from '@mediapipe/tasks-vision';

// ============================================================
// DETEKSI MOBILE
// ============================================================
const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 600;

// ============================================================
// KONFIGURASI
// ============================================================
const CONFIG = {
    colors: { bg: 0x000000, frameColor: 0xffffff, deepGreen: 0x03180a, accentRed: 0x990000 },
    particles: { count: isMobile ? 800 : 1500, dustCount: isMobile ? 1200 : 2500, treeHeight: 24, treeRadius: 8 },
    camera: { z: 50 },
    preload: { autoScanLocal: true, scanCount: 9, images: [] },
    playlist: [
        { name: 'Lagu Utama', src: 'lagu.mp3' },
        { name: 'Lagu 2', src: 'lagu2.mp3' },
    ],
    captions: {},
    face: {
        enabled: true, smileThreshold: 0.15, particleScaleMultiplier: 2.8,
        particleEmissiveMultiplier: 3.5, transitionSpeed: 3.0, dustBloomMultiplier: 5.0, colorShift: 0xff66aa,
    }
};

// ============================================================
// STATE GLOBAL
// ============================================================
const STATE = {
    mode: 'TREE', focusIndex: -1, focusTarget: null, trackIndex: 0,
    hand: { detected: false, x: 0, y: 0 },
    rotation: { x: 0, y: 0 },
    touch: { active: false, startX: 0, startY: 0, pinchDist: 0 },
    face: { detected: false, smileIntensity: 0, targetIntensity: 0, mouthRatio: 0, lastProcessed: 0, }
};

// Tracking swipe
let prevHandX = null, prevHandTime = 0, swipeCooldownUntil = 0;
const SWIPE_VELOCITY_THRESHOLD = 0.006, SWIPE_COOLDOWN_MS = 600;

// Easter egg screenshot
let peaceSignStartTime = null, captureRequested = false, captureCooldownUntil = 0;
const PEACE_HOLD_MS = 2000, CAPTURE_COOLDOWN_MS = 3000;

// ============================================================
// DOM REFERENCES (null-safe)
// ============================================================
const $ = id => document.getElementById(id);
const debugInfo = $('debug-info');
const modeIndicator = $('mode-indicator');
const photoCaption = $('photo-caption');
const loader = $('loader');
const webcamWrapper = $('webcam-wrapper');
const canvasContainer = $('canvas-container');
const overlayCanvas = $('overlay-canvas');
const overlayCtx = overlayCanvas ? overlayCanvas.getContext('2d') : null;
const bgmAudio = $('bgm');
const playBtn = $('play-btn');
const nextTrackBtn = $('next-track-btn');
const trackNameEl = $('track-name');
const camToggleBtn = $('cam-toggle-btn');
const captureFlash = $('capture-flash');
const captureNotif = $('capture-notif');

// ============================================================
// THREE.JS GLOBALS
// ============================================================
let scene, camera, renderer, composer, controls;
let mainGroup, photoMeshGroup;
let clock = new THREE.Clock();
let particleSystem = [];
let handLandmarker, faceLandmarker, video;
let sceneEnvironment = null, canvasTexture = null, bloomPass = null;
let initAttempted = false;

// ============================================================
// INIT
// ============================================================
async function init() {
    if (initAttempted) return;
    initAttempted = true;
    try {
        initThree();
        setupEnvironment();
        setupLights();
        createTextures();
        createParticles();
        createDust();
        loadPredefinedImages();
        setupPostProcessing();
        setupEvents();
        setupMusic();
        setupCamToggle();

        if (!isMobile) {
            await initMediaPipe();
        } else if (webcamWrapper) {
            webcamWrapper.classList.add('hidden');
        }

        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => { if (loader.parentNode) loader.parentNode.removeChild(loader); }, 800);
        }
        animate();
    } catch (e) {
        console.error('Init error:', e);
        if (debugInfo) debugInfo.innerText = 'Gagal memuat aplikasi';
    }
}

// ============================================================
// IMAGE PRELOAD - Smart scan: HEAD request dulu, hindari 404
// ============================================================
const EXT_PRIORITY = ['jpg', 'jpeg', 'png', 'webp', 'bmp'];
let imageScanInitiated = false;

async function checkImageExists(url) {
    try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; }
    catch { return false; }
}

async function loadPredefinedImages() {
    const loader = new THREE.TextureLoader();
    if (CONFIG.preload.images.length > 0) {
        CONFIG.preload.images.forEach(url => {
            loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; addPhotoToScene(t); }, undefined, () => {});
        });
    }
    if (CONFIG.preload.autoScanLocal && !imageScanInitiated) {
        imageScanInitiated = true;
        for (let i = 1; i <= CONFIG.preload.scanCount; i++) {
            for (const ext of EXT_PRIORITY) {
                const path = `./images/${i}.${ext}`;
                try {
                    if (await checkImageExists(path)) {
                        await new Promise(resolve => {
                            loader.load(path,
                                t => { t.colorSpace = THREE.SRGBColorSpace; addPhotoToScene(t, i); resolve(); },
                                undefined, () => resolve()
                            );
                        });
                        break;
                    }
                } catch { /* skip */ }
            }
        }
    }
}

// ============================================================
// THREE.JS SETUP
// ============================================================
function initThree() {
    if (!canvasContainer) throw new Error('Canvas container not found');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.01);

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, CONFIG.camera.z);

    renderer = new THREE.WebGLRenderer({
        antialias: !isMobile, alpha: false, powerPreference: "high-performance",
        preserveDrawingBuffer: true // Diperlukan untuk screenshot toDataURL
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
    renderer.toneMapping = THREE.ReinhardToneMapping;
    renderer.toneMappingExposure = 2.2;
    canvasContainer.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 20;
    controls.maxDistance = 100;
    controls.autoRotate = false;
    controls.enableRotate = true;
    if (!isMobile) controls.enabled = false;

    mainGroup = new THREE.Group();
    scene.add(mainGroup);
    photoMeshGroup = new THREE.Group();
}

function setupEnvironment() {
    if (!renderer) return;
    try {
        const pmrem = new THREE.PMREMGenerator(renderer);
        sceneEnvironment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environment = sceneEnvironment;
        pmrem.dispose();
    } catch (e) { console.warn('Environment failed:', e); }
}

function setupLights() {
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const il = new THREE.PointLight(0xffaa00, 2, 20);
    il.position.set(0, 5, 0);
    mainGroup.add(il);
    const sg = new THREE.SpotLight(0xffcc66, 1200);
    sg.position.set(30, 40, 40); sg.angle = 0.5; sg.penumbra = 0.5;
    scene.add(sg);
    const sb = new THREE.SpotLight(0x6688ff, 600);
    sb.position.set(-30, 20, -30);
    scene.add(sb);
    const fl = new THREE.DirectionalLight(0xffeebb, 0.8);
    fl.position.set(0, 0, 50);
    scene.add(fl);
}

function createTextures() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#880000';
    ctx.beginPath();
    for (let i = -128; i < 256; i += 32) {
        ctx.moveTo(i, 0); ctx.lineTo(i + 32, 128); ctx.lineTo(i + 16, 128); ctx.lineTo(i - 16, 0);
    }
    ctx.fill();
    if (canvasTexture) canvasTexture.dispose();
    canvasTexture = new THREE.CanvasTexture(c);
    canvasTexture.wrapS = canvasTexture.wrapT = THREE.RepeatWrapping;
    canvasTexture.repeat.set(3, 3);
}

function setupPostProcessing() {
    const renderScene = new RenderPass(scene, camera);
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        isMobile ? 1.0 : 1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.7;
    bloomPass.strength = isMobile ? 1.0 : 1.5;
    bloomPass.radius = 0.2;
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
}

// ============================================================
// PARTICLE CLASS - Setiap particle punya material independen
// ============================================================
class Particle {
    constructor(mesh, type, isDust = false) {
        this.mesh = mesh;
        this.type = type;
        this.isDust = isDust;
        this.posTree = new THREE.Vector3();
        this.posScatter = new THREE.Vector3();
        this.baseScale = mesh.scale ? mesh.scale.x : 1;
        const speedMult = (type === 'PHOTO') ? 0.3 : 2.0;
        this.spinSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult
        );
        if (mesh.isMesh && mesh.material) {
            this.mat = mesh.material;
            this.origEmissiveIntensity = mesh.material.emissiveIntensity || 0;
            this.origEmissive = mesh.material.emissive ? mesh.material.emissive.getHex() : 0;
            this.origColor = mesh.material.color ? mesh.material.color.getHex() : 0;
            this.origOpacity = mesh.material.opacity !== undefined ? mesh.material.opacity : 1;
        } else {
            this.mat = null;
            this.origEmissiveIntensity = 0; this.origEmissive = 0; this.origColor = 0; this.origOpacity = 1;
        }
        this.calculatePositions();
    }

    calculatePositions() {
        if (this.type === 'PHOTO') {
            this.posTree.set(0, 0, 0);
            const r = 18 + Math.random() * 12, theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
            this.posScatter.set(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi));
            return;
        }
        const t = Math.random() * Math.PI * 2, sc = 0.85;
        this.posTree.set(
            14 * Math.pow(Math.sin(t), 3) * sc,
            (11 * Math.cos(t) - 4 * Math.cos(2 * t) - 1.5 * Math.cos(3 * t) - 0.5 * Math.cos(4 * t)) * sc,
            Math.cos(t) * 2 + (Math.random() - 0.5) * 1.2
        );
        const r = this.isDust ? (15 + Math.random() * 20) : (10 + Math.random() * 15);
        const st = Math.random() * Math.PI * 2, sp = Math.acos(2 * Math.random() - 1);
        this.posScatter.set(r * Math.sin(sp) * Math.cos(st), r * Math.sin(sp) * Math.sin(st), r * Math.cos(sp));
    }

    update(dt, mode, focusTargetMesh) {
        let target = this.posTree;
        if (mode === 'SCATTER') target = this.posScatter;
        else if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) {
                const wp = new THREE.Vector3(0, 2, 35);
                wp.applyMatrix4(new THREE.Matrix4().copy(mainGroup.matrixWorld).invert());
                target = wp;
            } else target = this.posScatter;
        }
        const ls = (mode === 'FOCUS' && this.mesh === focusTargetMesh) ? 5.0 : 2.0;
        this.mesh.position.lerp(target, ls * dt);

        if (mode === 'SCATTER') {
            this.mesh.rotation.x += this.spinSpeed.x * dt;
            this.mesh.rotation.y += this.spinSpeed.y * dt;
            this.mesh.rotation.z += this.spinSpeed.z * dt;
        } else if (mode === 'TREE') {
            if (this.type === 'PHOTO') { this.mesh.lookAt(0, this.mesh.position.y, 0); this.mesh.rotateY(Math.PI); }
            else { this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt); this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt); this.mesh.rotation.y += 0.5 * dt; }
        }
        if (mode === 'FOCUS' && this.mesh === focusTargetMesh) this.mesh.lookAt(camera.position);

        let s = this.baseScale;
        if (this.isDust) {
            s = this.baseScale * (0.8 + 0.4 * Math.sin(clock.elapsedTime * 4 + (this.mesh.id || 0)));
            if (mode === 'TREE') s = 0;
        } else if (mode === 'SCATTER' && this.type === 'PHOTO') s = this.baseScale * 2.5;
        else if (mode === 'FOCUS') s = (this.mesh === focusTargetMesh) ? 4.5 : this.baseScale * 0.8;

        const smile = STATE.face.smileIntensity;
        if (smile > 0.01 && !this.isDust && this.type !== 'PHOTO' && this.mat) {
            s *= 1 + smile * (CONFIG.face.particleScaleMultiplier - 1);
            if (this.mat.emissiveIntensity !== undefined)
                this.mat.emissiveIntensity = this.origEmissiveIntensity + smile * CONFIG.face.particleEmissiveMultiplier;
            if (this.mat.color && smile > 0.3) {
                const t = (smile - 0.3) / 0.7;
                this.mat.color.lerpColors(new THREE.Color(this.origColor), new THREE.Color(CONFIG.face.colorShift), t * 0.4);
            }
        } else if (this.mat && this.type !== 'PHOTO' && !this.isDust) {
            if (this.mat.emissiveIntensity !== undefined)
                this.mat.emissiveIntensity = THREE.MathUtils.lerp(this.mat.emissiveIntensity, this.origEmissiveIntensity, 4 * dt);
            if (this.mat.color && this.origColor)
                this.mat.color.lerp(new THREE.Color(this.origColor), 4 * dt);
        }
        if (this.isDust && smile > 0.01 && this.mat) {
            s *= 1 + smile * 1.5;
            this.mat.opacity = THREE.MathUtils.lerp(this.mat.opacity, 0.3 + smile * 0.6, 4 * dt);
        } else if (this.isDust && this.mat) {
            this.mat.opacity = THREE.MathUtils.lerp(this.mat.opacity, this.origOpacity, 4 * dt);
        }
        if (this.mesh.scale) this.mesh.scale.lerp(new THREE.Vector3(s, s, s), 4 * dt);
    }

    dispose() {
        if (this.mesh && this.mesh.isMesh && this.mat) this.mat.dispose();
        if (this.mesh && this.mesh.geometry) this.mesh.geometry.dispose();
        if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
    }
}

// ============================================================
// PHOTO LAYOUT
// ============================================================
function updatePhotoLayout() {
    const photos = particleSystem.filter(p => p.type === 'PHOTO');
    if (photos.length === 0) return;
    photos.forEach((p, i) => {
        const t = (i / photos.length) * Math.PI * 2, sc = 0.85;
        p.posTree.set(16 * Math.pow(Math.sin(t), 3) * sc, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * sc, 0.5);
        p.mesh.lookAt(0, 0, 50);
    });
}

// ============================================================
// CREATE PARTICLES
// ============================================================
function createParticles() {
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);

    for (let i = 0; i < CONFIG.particles.count; i++) {
        const rand = Math.random();
        let mesh, type;
        if (rand < 0.60) {
            mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
                color: 0xff0033, metalness: 0.15, roughness: 0.05, clearcoat: 1.0,
                clearcoatRoughness: 0.03, emissive: 0x990000, emissiveIntensity: 0.35
            }));
            type = 'RED_BOX';
        } else if (rand < 0.85) {
            mesh = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({
                color: 0xffd700, metalness: 1.0, roughness: 0.1, emissive: 0xffaa00, emissiveIntensity: 0.2
            }));
            type = 'GOLD_BOX';
        } else {
            mesh = new THREE.Mesh(sphereGeo, new THREE.MeshPhysicalMaterial({
                color: 0xff66aa, metalness: 0.1, roughness: 0.2, clearcoat: 1.0,
                emissive: 0xff0066, emissiveIntensity: 0.3
            }));
            type = 'PINK_SPHERE';
        }
        const s = 0.4 + Math.random() * 0.5;
        mesh.scale.set(s, s, s);
        mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh, type, false));
    }
    mainGroup.add(photoMeshGroup);
}

// ============================================================
// CREATE DUST
// ============================================================
function createDust() {
    const geo = new THREE.TetrahedronGeometry(0.08, 0);
    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffcccc, transparent: true, opacity: 0.6 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(0.5 + Math.random());
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh, 'DUST', true));
    }
}

// ============================================================
// ADD PHOTO
// ============================================================
function addPhotoToScene(texture, imgNumber = null) {
    const frameMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.frameColor, metalness: 1.0, roughness: 0.1 });
    let width = 1.2, height = 1.2;
    if (texture.image) {
        const aspect = texture.image.width / texture.image.height;
        if (aspect > 1) height = width / aspect; else width = height * aspect;
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.05), frameMat);
    const photoMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    photoMat.toneMapped = false;
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(width, height), photoMat);
    photo.position.z = 0.04;
    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);
    frame.scale.set(width / 1.2, height / 1.2, 1);
    group.scale.set(0.8, 0.8, 0.8);
    group.userData.caption = (imgNumber !== null && CONFIG.captions[imgNumber]) ? CONFIG.captions[imgNumber] : '';
    photoMeshGroup.add(group);
    particleSystem.push(new Particle(group, 'PHOTO', false));
    updatePhotoLayout();
}

// ============================================================
// MEDIAPIPE - Hand & Face tracking
// ============================================================
async function initMediaPipe() {
    video = $('webcam');
    if (!video) return;
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
            runningMode: "VIDEO", numHands: 1
        });
        if (CONFIG.face.enabled) {
            try {
                faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`, delegate: "GPU" },
                    runningMode: "VIDEO", numFaces: 1,
                    outputFaceBlendshapes: true,
                    outputFacialTransformationMatrixes: false,
                });
            } catch (e) { console.warn("FaceLandmarker error:", e); faceLandmarker = null; }
        }
        if (overlayCanvas) { overlayCanvas.width = 640; overlayCanvas.height = 480; }
        if (navigator.mediaDevices?.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
            video.srcObject = stream;
            video.addEventListener("loadeddata", () => {
                if (overlayCanvas) { overlayCanvas.width = video.videoWidth || 640; overlayCanvas.height = video.videoHeight || 480; }
                predictWebcam();
            });
            if (debugInfo) debugInfo.innerText = "Kamera aktif. Tunjukkan tangan & wajah.";
        }
    } catch (e) {
        console.warn("Webcam/MediaPipe error:", e);
        if (debugInfo) debugInfo.innerText = "Kamera tidak tersedia";
        if (webcamWrapper) webcamWrapper.classList.add('hidden');
    }
}

let lastVideoTime = -1, lastHandResult = null, lastFaceResult = null;

async function predictWebcam() {
    if (!video || video.currentTime === lastVideoTime) { requestAnimationFrame(predictWebcam); return; }
    lastVideoTime = video.currentTime;
    if (overlayCtx) overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (handLandmarker) {
        const r = handLandmarker.detectForVideo(video, performance.now());
        processGestures(r);
        lastHandResult = r;
    }
    if (faceLandmarker && CONFIG.face.enabled) {
        try {
            const r = faceLandmarker.detectForVideo(video, performance.now());
            processFaceGestures(r);
            lastFaceResult = r;
        } catch (e) { /* ignore */ }
    }
    if (!lastHandResult || !lastHandResult.landmarks || lastHandResult.landmarks.length === 0) lastHandResult = null;
    if (!lastFaceResult || !lastFaceResult.faceLandmarks || lastFaceResult.faceLandmarks.length === 0) lastFaceResult = null;

    if (overlayCtx) {
        if (lastHandResult && lastHandResult.landmarks && lastHandResult.landmarks.length > 0)
            drawHandOverlay(lastHandResult.landmarks[0]);
        if (lastFaceResult && lastFaceResult.faceLandmarks && lastFaceResult.faceLandmarks.length > 0)
            drawFaceOverlay(lastFaceResult.faceLandmarks[0]);
        if (modeIndicator) {
            overlayCtx.fillStyle = 'rgba(255,255,255,0.5)';
            overlayCtx.font = '10px monospace';
            overlayCtx.fillText(modeIndicator.textContent, 8, 16);
        }
    }
    requestAnimationFrame(predictWebcam);
}

// ============================================================
// FACE GESTURE - Blendshapes + geometric
// ============================================================
function processFaceGestures(result) {
    const now = performance.now();

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
        STATE.face.detected = true;
        const lm = result.faceLandmarks[0];

        let smileFromBlendshapes = 0;
        if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
            const blendshapes = result.faceBlendshapes[0];
            for (const bs of blendshapes) {
                if (bs.categoryName === 'mouthSmileLeft' || bs.categoryName === 'mouthSmileRight') {
                    smileFromBlendshapes = Math.max(smileFromBlendshapes, bs.score);
                }
            }
        }

        const leftCorner = lm[61], rightCorner = lm[291];
        const upperLip = lm[13], lowerLip = lm[14];
        const leftEye = lm[33], rightEye = lm[263];

        const faceWidth = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y, rightEye.z - leftEye.z);
        if (faceWidth < 0.01) return;

        const mouthWidth = Math.hypot(rightCorner.x - leftCorner.x, rightCorner.y - leftCorner.y, rightCorner.z - leftCorner.z);
        const mouthHeight = Math.hypot(lowerLip.x - upperLip.x, lowerLip.y - upperLip.y, lowerLip.z - upperLip.z);
        const normalizedMouthWidth = mouthWidth / faceWidth;
        const mouthOpenRatio = mouthHeight / faceWidth;

        const geometricSmile = Math.max(0, Math.min(1, (normalizedMouthWidth - 0.38) / 0.35));
        let finalIntensity = smileFromBlendshapes > 0 ? smileFromBlendshapes : geometricSmile;
        if (mouthOpenRatio > 0.08) finalIntensity = Math.min(1, finalIntensity + 0.3);

        STATE.face.targetIntensity = finalIntensity;
        STATE.face.lastProcessed = now;

        if (finalIntensity > CONFIG.face.smileThreshold && debugInfo) {
            debugInfo.innerText = `😊 Senyum ${Math.round(finalIntensity * 100)}% | ${STATE.mode}`;
        }
    } else {
        STATE.face.detected = false;
        STATE.face.targetIntensity = 0;
    }
}

// ============================================================
// OVERLAY DRAWING
// ============================================================
const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]
];

const FACE_LANDMARK_INDICES = [
    0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
    17,18,19,20,21, 22,23,24,25,26,
    27,28,29,30,31,32,33,34,35,
    36,37,38,39,40,41, 42,43,44,45,46,47,
    48,49,50,51,52,53,54,55,56,57,58,59,
    60,61,62,63,64,65,66,67,
    68,69,70,71,72,73,
];

const FACE_CONNECTIONS = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],
    [17,18],[18,19],[19,20],[20,21],[22,23],[23,24],[24,25],[25,26],
    [27,28],[28,29],[29,30],[31,32],[32,33],[33,34],[34,35],
    [36,37],[37,38],[38,39],[39,40],[40,41],[41,36],
    [42,43],[43,44],[44,45],[45,46],[46,47],[47,42],
    [48,49],[49,50],[50,51],[51,52],[52,53],[53,54],[54,55],[55,56],[56,57],[57,58],[58,59],[59,48],
    [60,61],[61,62],[62,63],[63,64],[64,65],[65,66],[66,67],[67,60],
    [27,48],[27,59]
];

function drawHandOverlay(lm) {
    if (!overlayCtx || !overlayCanvas) return;
    const ctx = overlayCtx, w = overlayCanvas.width, h = overlayCanvas.height;
        // CSS sudah scaleX(-1) di video & overlay, jadi pakai p.x langsung
        // (tanpa mirror) agar landmark sejajar dengan gambar yang sudah terbalik.
        const pts = lm.map(p => ({ x: p.x * w, y: p.y * h }));
    ctx.strokeStyle = 'rgba(255,200,100,0.7)';
    ctx.lineWidth = 2;
    HAND_CONNECTIONS.forEach(([i, j]) => {
        if (pts[i] && pts[j]) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
    });
    pts.forEach((p, idx) => {
        const isTip = [4, 8, 12, 16, 20].includes(idx);
        ctx.fillStyle = isTip ? '#ff4488' : '#ffcc44';
        ctx.beginPath(); ctx.arc(p.x, p.y, isTip ? 4 : 2.5, 0, Math.PI * 2); ctx.fill();
        if (isTip) { ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '8px monospace'; ctx.fillText(idx, p.x + 4, p.y - 4); }
    });
}

function drawFaceOverlay(lm) {
    if (!overlayCtx || !overlayCanvas) return;
    const ctx = overlayCtx, w = overlayCanvas.width, h = overlayCanvas.height;
        // CSS sudah scaleX(-1) di video & overlay, jadi pakai p.x langsung
        // (tanpa mirror) agar landmark sejajar dengan gambar yang sudah terbalik.
        const pts = lm.map(p => ({ x: p.x * w, y: p.y * h }));
    ctx.strokeStyle = 'rgba(100,200,255,0.4)';
    ctx.lineWidth = 1;
    FACE_CONNECTIONS.forEach(([i, j]) => {
        if (pts[i] && pts[j]) { ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke(); }
    });
    FACE_LANDMARK_INDICES.forEach(idx => {
        if (!pts[idx]) return;
        const p = pts[idx];
        if (idx >= 48 && idx <= 67) ctx.fillStyle = `rgba(255,100,150,${idx >= 60 ? 0.6 : 0.4})`;
        else if (idx >= 36 && idx <= 47) ctx.fillStyle = 'rgba(100,255,200,0.5)';
        else if (idx >= 27 && idx <= 35) ctx.fillStyle = 'rgba(200,200,100,0.4)';
        else ctx.fillStyle = 'rgba(100,200,255,0.3)';
        ctx.beginPath(); ctx.arc(p.x, p.y, (idx >= 48 && idx <= 67) ? 1.5 : 1, 0, Math.PI * 2); ctx.fill();
    });
}

// ============================================================
// NAVIGATE PHOTO
// ============================================================
function navigatePhoto(dir) {
    const photos = particleSystem.filter(p => p.type === 'PHOTO');
    if (!photos.length) return;
    let idx = photos.findIndex(p => p.mesh === STATE.focusTarget);
    if (idx === -1) idx = 0;
    idx = (idx + dir + photos.length) % photos.length;
    STATE.focusTarget = photos[idx].mesh;
    updateModeIndicator();
}

// ============================================================
// GESTURE PROCESSING
// ============================================================
function processGestures(result) {
    if (result.landmarks && result.landmarks.length > 0) {
        STATE.hand.detected = true;
        const lm = result.landmarks[0];
        // Mirorkan x agar konsisten dengan tampilan video yang sudah di-scaleX(-1)
        // MediaPipe raw: x=0 = kiri gambar asli, x=1 = kanan gambar asli
        // Video (mirror): x=0 = kanan visual, x=1 = kiri visual
        // Gunakan mirrored x agar gesture sesuai dengan apa yang dilihat user
        const mirroredX = 1 - lm[9].x;
        STATE.hand.x = (mirroredX - 0.5) * 2;
        STATE.hand.y = (lm[9].y - 0.5) * 2;

        const mirroredLm = lm.map(p => ({ x: 1 - p.x, y: p.y, z: p.z }));

        const thumb = mirroredLm[4], index = mirroredLm[8], wrist = mirroredLm[0], middleMCP = mirroredLm[9];
        const handSize = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y);
        if (handSize < 0.02) return;

        const tips = [mirroredLm[8], mirroredLm[12], mirroredLm[16], mirroredLm[20]];
        let avgTipDist = 0;
        tips.forEach(t => avgTipDist += Math.hypot(t.x - wrist.x, t.y - wrist.y));
        avgTipDist /= 4;

        const pinchDist = Math.hypot(thumb.x - index.x, thumb.y - index.y);
        const extensionRatio = avgTipDist / handSize;
        const pinchRatio = pinchDist / handSize;

        if (debugInfo && STATE.face.smileIntensity <= CONFIG.face.smileThreshold)
            debugInfo.innerText = `Ext:${extensionRatio.toFixed(2)} Pinch:${pinchRatio.toFixed(2)} | ${STATE.mode}`;

        const now = performance.now();
        if (STATE.mode === 'FOCUS' && prevHandX !== null) {
            const dt = now - prevHandTime;
            if (dt > 0 && dt < 400) {
                const vel = (STATE.hand.x - prevHandX) / dt;
                if (Math.abs(vel) > SWIPE_VELOCITY_THRESHOLD && now > swipeCooldownUntil) {
                    navigatePhoto(vel > 0 ? 1 : -1);
                    swipeCooldownUntil = now + SWIPE_COOLDOWN_MS;
                }
            }
        }
        prevHandX = STATE.hand.x;
        prevHandTime = now;

        const indexDist = Math.hypot(mirroredLm[8].x - wrist.x, mirroredLm[8].y - wrist.y) / handSize;
        const middleDist = Math.hypot(mirroredLm[12].x - wrist.x, mirroredLm[12].y - wrist.y) / handSize;
        const ringDist = Math.hypot(mirroredLm[16].x - wrist.x, mirroredLm[16].y - wrist.y) / handSize;
        const pinkyDist = Math.hypot(mirroredLm[20].x - wrist.x, mirroredLm[20].y - wrist.y) / handSize;
        const isPeaceSign = indexDist > 1.3 && middleDist > 1.3 && ringDist < 1.1 && pinkyDist < 1.1;

        if (isPeaceSign && now > captureCooldownUntil) {
            if (peaceSignStartTime === null) peaceSignStartTime = now;
            const held = now - peaceSignStartTime;
            const progress = Math.min(held / PEACE_HOLD_MS, 1);
            if (debugInfo) debugInfo.innerText = `✌️ ${Math.round(progress * 100)}%`;
            if (held >= PEACE_HOLD_MS) {
                captureRequested = true;
                captureCooldownUntil = now + CAPTURE_COOLDOWN_MS;
                peaceSignStartTime = null;
            }
        } else peaceSignStartTime = null;

        if (!isPeaceSign) {
            if (extensionRatio < 1.5) {
                STATE.mode = 'TREE'; STATE.focusTarget = null;
            } else if (pinchRatio < 0.35) {
                if (STATE.mode !== 'FOCUS') {
                    STATE.mode = 'FOCUS';
                    const photos = particleSystem.filter(p => p.type === 'PHOTO');
                    if (photos.length) {
                        STATE.focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh;
                    }
                }
            } else if (extensionRatio > 1.7) {
                STATE.mode = 'SCATTER'; STATE.focusTarget = null;
            }
        }
        updateModeIndicator();
    } else STATE.hand.detected = false;
}

// ============================================================
// TOUCH CONTROLS (MOBILE)
// ============================================================
function setupTouchControls() {
    const canvas = renderer.domElement;
    if (!canvas) return;
    let tapTimeout = null;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            tapTimeout = setTimeout(() => { tapTimeout = null; }, 200);
            STATE.touch.startX = e.touches[0].clientX;
            STATE.touch.startY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            STATE.touch.pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        }
    }, { passive: true });
    canvas.addEventListener('touchend', (e) => {
        if (tapTimeout !== null && e.changedTouches.length === 1) {
            const dx = e.changedTouches[0].clientX - STATE.touch.startX;
            const dy = e.changedTouches[0].clientY - STATE.touch.startY;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                const modes = ['TREE', 'SCATTER', 'FOCUS'];
                const idx = modes.indexOf(STATE.mode);
                const next = modes[(idx + 1) % modes.length];
                STATE.mode = next;
                if (next === 'FOCUS') {
                    const photos = particleSystem.filter(p => p.type === 'PHOTO');
                    if (photos.length) { STATE.focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh; }
                } else STATE.focusTarget = null;
                updateModeIndicator();
            } else if (STATE.mode === 'FOCUS' && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
                navigatePhoto(dx < 0 ? 1 : -1);
            }
        }
    }, { passive: true });
}

// ============================================================
// UI UPDATES
// ============================================================
function updateModeIndicator() {
    if (!modeIndicator) return;
    const labels = { TREE: '❤ LOVE', SCATTER: '✨ SCATTER', FOCUS: '🔍 FOCUS' };
    modeIndicator.textContent = labels[STATE.mode] || STATE.mode;
    updatePhotoCaption();
}

function updatePhotoCaption() {
    if (!photoCaption) return;
    const caption = (STATE.mode === 'FOCUS' && STATE.focusTarget) ? STATE.focusTarget.userData.caption : '';
    if (caption) { photoCaption.textContent = caption; photoCaption.classList.add('visible'); }
    else photoCaption.classList.remove('visible');
}

// ============================================================
// EVENTS
// ============================================================
function setupEvents() {
    window.addEventListener('resize', () => {
        const w = window.innerWidth, h = window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
        if (bloomPass) bloomPass.resolution.set(w, h);
    });
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'h' && webcamWrapper) webcamWrapper.classList.toggle('hidden');
        if (k === 't') { STATE.mode = 'TREE'; STATE.focusTarget = null; updateModeIndicator(); }
        if (k === 's') { STATE.mode = 'SCATTER'; STATE.focusTarget = null; updateModeIndicator(); }
        if (k === 'f') {
            STATE.mode = 'FOCUS';
            const photos = particleSystem.filter(p => p.type === 'PHOTO');
            if (photos.length) { STATE.focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh; }
            updateModeIndicator();
        }
    });
    if (isMobile) setupTouchControls();
}

// ============================================================
// MUSIC
// ============================================================
function setupMusic() {
    if (!bgmAudio || !playBtn) return;
    function loadTrack(index, autoplay) {
        const pl = CONFIG.playlist;
        if (!pl.length) return;
        STATE.trackIndex = ((index % pl.length) + pl.length) % pl.length;
        const track = pl[STATE.trackIndex];
        bgmAudio.src = track.src;
        if (trackNameEl) trackNameEl.textContent = track.name;
        if (autoplay) bgmAudio.play().catch(() => {});
    }
    loadTrack(0, false);
    playBtn.addEventListener('click', () => {
        if (bgmAudio.paused) { bgmAudio.play(); playBtn.innerText = '⏸ Pause'; }
        else { bgmAudio.pause(); playBtn.innerText = '🎵 Musik'; }
    });
    if (nextTrackBtn) {
        if (CONFIG.playlist.length > 1) {
            nextTrackBtn.classList.remove('hidden');
            nextTrackBtn.addEventListener('click', () => {
                loadTrack(STATE.trackIndex + 1, !bgmAudio.paused);
                if (playBtn) playBtn.innerText = bgmAudio.paused ? '🎵 Musik' : '⏸ Pause';
            });
        } else nextTrackBtn.classList.add('hidden');
    }
    bgmAudio.addEventListener('ended', () => {
        loadTrack(STATE.trackIndex + 1, true);
        if (playBtn) playBtn.innerText = '⏸ Pause';
    });
    window.addEventListener('click', () => {
        if (bgmAudio.paused && bgmAudio.currentTime === 0) {
            bgmAudio.play().catch(() => {});
            if (playBtn) playBtn.innerText = '⏸ Pause';
        }
    }, { once: true });
}

// ============================================================
// CAM TOGGLE
// ============================================================
function setupCamToggle() {
    if (!camToggleBtn || !webcamWrapper) return;
    let camVisible = !isMobile;
    if (!camVisible) webcamWrapper.classList.add('hidden');
    camToggleBtn.addEventListener('click', async () => {
        camVisible = !camVisible;
        if (camVisible) {
            webcamWrapper.classList.remove('hidden');
            camToggleBtn.innerText = '📷 Tutup';
            if (isMobile && !handLandmarker) await initMediaPipe();
        } else {
            webcamWrapper.classList.add('hidden');
            camToggleBtn.innerText = '📷 Kamera';
        }
    });
}

// ============================================================
// ANIMATION LOOP
// ============================================================
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    if (isMobile) controls.update();

    if (CONFIG.face.enabled) {
        STATE.face.smileIntensity = THREE.MathUtils.lerp(STATE.face.smileIntensity, STATE.face.targetIntensity, CONFIG.face.transitionSpeed * dt);
        if (STATE.face.smileIntensity < 0.001) STATE.face.smileIntensity = 0;
    }

    let pulse = 1.0;
    if (STATE.mode === 'TREE') pulse = 1.0 + Math.sin(time * 1.3) * 0.03;
    if (STATE.face.smileIntensity > 0.01) pulse *= 1 + STATE.face.smileIntensity * 0.1;
    mainGroup.scale.lerp(new THREE.Vector3(pulse, pulse, pulse), 2 * dt);

    if (!isMobile) {
        if (STATE.hand.detected) {
            const tY = STATE.hand.x * Math.PI * 0.5, tX = STATE.hand.y * Math.PI * 0.2;
            STATE.rotation.y += (tY - STATE.rotation.y) * 2.0 * dt;
            STATE.rotation.x += (tX - STATE.rotation.x) * 2.0 * dt;
        } else { STATE.rotation.y += 0.2 * dt; STATE.rotation.x += (0 - STATE.rotation.x) * dt; }
        mainGroup.rotation.y = STATE.rotation.y;
        mainGroup.rotation.x = STATE.rotation.x;
    } else if (!controls.enabled) { STATE.rotation.y += 0.15 * dt; mainGroup.rotation.y = STATE.rotation.y; }

    particleSystem.forEach(p => {
        p.update(dt, STATE.mode, STATE.focusTarget);
        if (p.type === 'PHOTO' && STATE.mode === 'TREE') p.mesh.lookAt(camera.position);
    });

    if (composer) composer.render();

    if (captureRequested) { captureRequested = false; captureScreenshot(); }
}

// ============================================================
// SCREENSHOT
// ============================================================
function captureScreenshot() {
    try {
        const dataURL = renderer.domElement.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `ciput-pic-${Date.now()}.png`;
        link.href = dataURL;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showCaptureFeedback();
    } catch (e) { console.warn('Screenshot failed:', e); }
}

function showCaptureFeedback() {
    if (captureFlash) { captureFlash.classList.add('active'); setTimeout(() => captureFlash.classList.remove('active'), 250); }
    if (captureNotif) { captureNotif.classList.add('visible'); setTimeout(() => captureNotif.classList.remove('visible'), 2200); }
}

// ============================================================
// START
// ============================================================
init();