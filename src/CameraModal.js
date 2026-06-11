import * as THREE from 'three';
import { FRUIT_DATA } from './FruitData.js';

export class CameraModal {
  constructor(game) {
    this._game       = game;
    this._stream     = null;
    this._selectedLevel = null;

    this._modal      = document.getElementById('camera-modal');
    this._stepFruit  = document.getElementById('camera-step-fruit');
    this._stepCam    = document.getElementById('camera-step-cam');
    this._video      = document.getElementById('camera-video');
    this._canvas     = document.getElementById('camera-canvas');
    this._fruitGrid  = document.getElementById('camera-fruit-grid');
    this._noCam         = document.getElementById('camera-no-cam');
    this._selectedLabel = document.getElementById('camera-selected-name');
    this._nextBtn         = document.getElementById('camera-next-btn');
    this._stepPreview     = document.getElementById('camera-step-preview');
    this._sphereCanvas    = document.getElementById('camera-sphere-canvas');
    this._sphereCleanup   = null;

    document.getElementById('camera-btn').addEventListener('click', () => this.open());
    document.getElementById('camera-close').addEventListener('click', () => this.close());
    document.getElementById('camera-next-btn').addEventListener('click', () => this._goStep2());
    document.getElementById('camera-back-btn').addEventListener('click', () => this._goStep1());
    document.getElementById('camera-capture-btn').addEventListener('click', () => this._capture());
    document.getElementById('camera-upload').addEventListener('change', e => this._handleUpload(e));
    document.getElementById('camera-retake-btn').addEventListener('click', async () => this._goStep2());
    document.getElementById('camera-apply-btn').addEventListener('click', () => this._applyTexture());
    this._modal.addEventListener('click', e => { if (e.target === this._modal) this.close(); });

    this._buildGrid();
  }

  open() {
    this._selectedLevel = null;
    this._nextBtn.disabled = true;
    this._modal.classList.remove('hidden');
    this._goStep1();
  }

  close() {
    this._stopCamera();
    this._stopSpherePreview();
    this._modal.classList.add('hidden');
  }

  // ──────── Step 1: 과일 선택 ────────

  _goStep1() {
    this._stopCamera();
    this._noCam.classList.add('hidden');
    this._stepFruit.classList.remove('hidden');
    this._stepCam.classList.add('hidden');
    this._stepPreview.classList.add('hidden');
  }

  _buildGrid() {
    this._fruitGrid.innerHTML = '';
    FRUIT_DATA.forEach((data, level) => {
      const item = document.createElement('div');
      item.className = 'cam-fruit-item';
      item.dataset.level = level;

      const img = document.createElement('img');
      img.src = `/textures/${data.texture}`;
      img.width = 44;
      img.height = 44;
      item.appendChild(img);

      const span = document.createElement('span');
      span.textContent = data.name;
      item.appendChild(span);

      item.addEventListener('click', () => {
        this._selectedLevel = level;
        this._fruitGrid.querySelectorAll('.cam-fruit-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        this._nextBtn.disabled = false;
      });

      this._fruitGrid.appendChild(item);
    });
  }

  // ──────── Step 2: 카메라 ────────

  async _goStep2() {
    this._stopSpherePreview();
    this._stepFruit.classList.add('hidden');
    this._stepPreview.classList.add('hidden');
    this._stepCam.classList.remove('hidden');
    this._selectedLabel.textContent = FRUIT_DATA[this._selectedLevel].name;
    await this._startCamera();
  }

  _goStep3() {
    this._stepCam.classList.add('hidden');
    this._stepPreview.classList.remove('hidden');
    this._startSpherePreview();
  }

  _startSpherePreview() {
    this._stopSpherePreview();

    const c = this._sphereCanvas;
    const size = c.parentElement.clientWidth || 280;
    c.width  = size;
    c.height = size;

    const renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 3.2);

    scene.add(new THREE.AmbientLight(0xffffff, 1.0));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(2, 2, 2);
    scene.add(dir);

    const tex    = new THREE.CanvasTexture(this._canvas);
    const geo    = new THREE.SphereGeometry(1, 48, 32);
    const mat    = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 });
    const sphere = new THREE.Mesh(geo, mat);
    scene.add(sphere);

    let animId;
    const loop = () => {
      animId = requestAnimationFrame(loop);
      sphere.rotation.y += 0.012;
      renderer.render(scene, camera);
    };
    loop();

    this._sphereCleanup = () => {
      cancelAnimationFrame(animId);
      renderer.dispose();
      geo.dispose();
      mat.dispose();
      tex.dispose();
    };
  }

  _stopSpherePreview() {
    this._sphereCleanup?.();
    this._sphereCleanup = null;
  }

  async _startCamera() {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      this._video.srcObject = this._stream;
    } catch {
      this._noCam.classList.remove('hidden');
    }
  }

  _stopCamera() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video.srcObject = null;
  }

  // ──────── 캡처 / 업로드 ────────

  _capture() {
    const vw = this._video.videoWidth;
    const vh = this._video.videoHeight;
    if (!vw || !vh) return;

    const size = Math.min(vw, vh);
    const sx = (vw - size) / 2;
    const sy = (vh - size) / 2;

    this._canvas.width = 256;
    this._canvas.height = 256;
    const ctx = this._canvas.getContext('2d');
    ctx.translate(256, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this._video, sx, sy, size, size, 0, 0, 256, 256);

    this._stopCamera();
    this._goStep3();
  }

  _handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const sx = (img.width  - size) / 2;
      const sy = (img.height - size) / 2;
      this._canvas.width = 256;
      this._canvas.height = 256;
      const ctx = this._canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      this._goStep3();
    };
    img.src = url;
    e.target.value = '';
  }

  _applyTexture() {
    const texture = new THREE.CanvasTexture(this._canvas);
    texture.needsUpdate = true;
    this._game.applyCustomTexture(this._selectedLevel, texture);
    this.close();
  }
}
