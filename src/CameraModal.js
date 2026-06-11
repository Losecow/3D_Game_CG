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
    this._noCam      = document.getElementById('camera-no-cam');
    this._selectedLabel = document.getElementById('camera-selected-name');
    this._nextBtn    = document.getElementById('camera-next-btn');

    document.getElementById('camera-btn').addEventListener('click', () => this.open());
    document.getElementById('camera-close').addEventListener('click', () => this.close());
    document.getElementById('camera-next-btn').addEventListener('click', () => this._goStep2());
    document.getElementById('camera-back-btn').addEventListener('click', () => this._goStep1());
    document.getElementById('camera-capture-btn').addEventListener('click', () => this._capture());
    document.getElementById('camera-upload').addEventListener('change', e => this._handleUpload(e));
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
    this._modal.classList.add('hidden');
  }

  // ──────── Step 1: 과일 선택 ────────

  _goStep1() {
    this._stopCamera();
    this._noCam.classList.add('hidden');
    this._stepFruit.classList.remove('hidden');
    this._stepCam.classList.add('hidden');
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
    this._stepFruit.classList.add('hidden');
    this._stepCam.classList.remove('hidden');
    this._selectedLabel.textContent = FRUIT_DATA[this._selectedLevel].name;
    await this._startCamera();
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
    // 좌우 반전 (셀카 거울 효과)
    ctx.translate(256, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(this._video, sx, sy, size, size, 0, 0, 256, 256);

    this._applyTexture();
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
      this._applyTexture();
    };
    img.src = url;
    // input 초기화 (같은 파일 재선택 가능하게)
    e.target.value = '';
  }

  _applyTexture() {
    const texture = new THREE.CanvasTexture(this._canvas);
    texture.needsUpdate = true;
    this._game.applyCustomTexture(this._selectedLevel, texture);
    this.close();
  }
}
