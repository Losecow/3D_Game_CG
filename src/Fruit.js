import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FRUIT_DATA, RAINBOW_LEVEL, RAINBOW_DATA } from './FruitData.js';
import { getCustomTexture } from './TextureStore.js';

let _fruitIdCounter = 0;
const _geoCache  = new Map();
const _texCache  = new Map();
const _loader    = new THREE.TextureLoader();

export function makeRainbowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  ['#ff0000','#ff8800','#ffff00','#00dd00','#0088ff','#8800ff','#ff0000'].forEach(
    (c, i, a) => grad.addColorStop(i / (a.length - 1), c)
  );
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const shine = ctx.createRadialGradient(90, 80, 10, 90, 80, 90);
  shine.addColorStop(0, 'rgba(255,255,255,0.55)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/**
 * 과일 하나를 나타내는 클래스 (Three.js Mesh + cannon-es Body 결합)
 * Represents a single fruit: couples a Three.js Mesh with a cannon-es Body
 */
export class Fruit {
  /**
   * @param {number} level - 과일 단계 (0~10) / Fruit level
   * @param {THREE.Vector3} position - 초기 위치 / Initial position
   * @param {THREE.Scene} scene
   * @param {CANNON.World} physicsWorld
   * @param {CANNON.Material} fruitMaterial
   */
  constructor(level, position, scene, physicsWorld, fruitMaterial) {
    this.id = _fruitIdCounter++;
    this.level = level;
    this.data = level === RAINBOW_LEVEL ? RAINBOW_DATA : FRUIT_DATA[level];
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    this.isMerging = false;
    this.spawnTime = performance.now();

    this._birthAnim = false;
    this._birthStart = 0;

    this._buildMesh(position);
    this._buildBody(position, fruitMaterial);
  }

  /**
   * Three.js 구체 메시 생성
   * Build the Three.js sphere mesh
   */
  _buildMesh(position) {
    const { radius, color, name, texture } = this.data;

    if (!_geoCache.has(this.level)) {
      _geoCache.set(this.level, new THREE.SphereGeometry(radius, 32, 24));
    }
    const geo = _geoCache.get(this.level);

    if (this.level === RAINBOW_LEVEL) {
      if (!_texCache.has(RAINBOW_LEVEL)) _texCache.set(RAINBOW_LEVEL, makeRainbowTexture());
    } else if (!_texCache.has(this.level)) {
      _texCache.set(this.level, _loader.load(`/textures/${texture}`));
    }

    const customTex = getCustomTexture(this.level);
    const mat = new THREE.MeshStandardMaterial({
      map: customTex ?? _texCache.get(this.level),
      roughness: 0.15,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    this.scene.add(this.mesh);
  }

  /**
   * canvas 텍스트로 스프라이트 레이블 생성
   * Create a sprite label from canvas text
   */
  _makeLabel(text, radius) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 48;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.roundRect(4, 8, 120, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 24);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(mat);

    // 구체 위에 살짝 띄워 표시 / Position label slightly above the sphere
    sprite.scale.set(radius * 2.2, radius * 0.8, 1);
    sprite.position.set(0, radius + 0.1, 0);

    return sprite;
  }

  /**
   * cannon-es 구체 바디 생성
   * Build the cannon-es sphere body
   */
  _buildBody(position, fruitMaterial) {
    const { radius } = this.data;

    this.body = new CANNON.Body({
      mass: radius * radius * 2, // 크기에 비례한 질량 / Mass proportional to size
      shape: new CANNON.Sphere(radius),
      material: fruitMaterial,
      linearDamping: 0.2,   // 선형 감쇠 (공기 저항) / Linear damping (air resistance)
      angularDamping: 0.4,  // 각 감쇠 (회전 감쇠) / Angular damping
    });

    this.body.position.set(position.x, position.y, position.z);

    // 바디에 과일 참조 저장 (충돌 이벤트에서 사용)
    // Store fruit reference on body for use in collision events
    this.body.fruitRef = this;

    this.physicsWorld.addBody(this.body);
  }

  /** 합체로 생성된 과일에 팝인 애니메이션 시작 */
  playBirthAnim() {
    this._birthAnim = true;
    this._birthStart = performance.now();
    this.mesh.scale.setScalar(0);
  }

  sync() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    if (this._birthAnim) this._tickBirthAnim();
  }

  _tickBirthAnim() {
    const t = Math.min((performance.now() - this._birthStart) / 400, 1);
    // ease-out-back: 0 → 1.15 → 1.0
    const c1 = 2.0, c3 = c1 + 1;
    const scale = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    this.mesh.scale.setScalar(Math.max(0, scale));
    if (t >= 1) {
      this._birthAnim = false;
      this.mesh.scale.setScalar(1);
    }
  }

  /**
   * 씬과 물리 세계에서 과일 제거
   * Remove fruit from scene and physics world
   */
  destroy() {
    this.scene.remove(this.mesh);
    this.physicsWorld.removeBody(this.body);

    // 지오메트리는 공유 캐시이므로 dispose 하지 않음
    this.mesh.material.dispose();
    const sprite = this.mesh.children[0];
    if (sprite?.material?.map) sprite.material.map.dispose();
    if (sprite?.material) sprite.material.dispose();
  }
}
