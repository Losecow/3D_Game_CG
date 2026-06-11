import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FRUIT_DATA, RAINBOW_LEVEL, RAINBOW_DATA } from './FruitData.js';
import { getCustomTexture } from './TextureStore.js';

let _fruitIdCounter = 0;
const _geoCache  = new Map();
const _texCache  = new Map();
const _loader    = new THREE.TextureLoader();


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

    if (!_texCache.has(this.level)) {
      const t = _loader.load(`/textures/${texture}`);
      if (this.level === RAINBOW_LEVEL) t.wrapS = THREE.RepeatWrapping;
      _texCache.set(this.level, t);
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

    if (this.level === RAINBOW_LEVEL) this._initRainbowFX(radius);
  }

  _initRainbowFX(radius) {
    // 외곽 글로우 구체 (BackSide: 안쪽 면이 바깥을 향해 후광 효과)
    const glowGeo = new THREE.SphereGeometry(radius * 1.55, 24, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.22,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this._glowMesh = new THREE.Mesh(glowGeo, glowMat);
    this.mesh.add(this._glowMesh);

    // 두 번째 글로우 레이어 (더 크고 흐릿)
    const outerGeo = new THREE.SphereGeometry(radius * 2.0, 24, 16);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this._outerGlowMesh = new THREE.Mesh(outerGeo, outerMat);
    this.mesh.add(this._outerGlowMesh);

    this.mesh.material.emissiveIntensity = 0;
    this._fxColor = new THREE.Color();
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
    if (this.level === RAINBOW_LEVEL) this._tickRainbowFX();
  }

  _tickRainbowFX() {
    const t = performance.now() / 1000;
    const hue = (t * 0.5) % 1;

    // 에미시브 색상 순환 (발광)
    this._fxColor.setHSL(hue, 1.0, 0.55);
    this.mesh.material.emissive.copy(this._fxColor);
    this.mesh.material.emissiveIntensity = 0.45 + 0.25 * Math.sin(t * 5.0);

    // 텍스쳐 흐르기
    if (this.mesh.material.map) {
      this.mesh.material.map.offset.x = (t * 0.09) % 1;
      this.mesh.material.map.needsUpdate = true;
    }

    // 내부 글로우: 보색으로 순환
    if (this._glowMesh) {
      this._fxColor.setHSL((hue + 0.5) % 1, 1.0, 0.65);
      this._glowMesh.material.color.copy(this._fxColor);
      this._glowMesh.material.opacity = 0.18 + 0.12 * Math.sin(t * 3.5);
      this._glowMesh.scale.setScalar(1 + 0.07 * Math.sin(t * 6.0));
    }

    // 외부 글로우: 느리게 펄스
    if (this._outerGlowMesh) {
      this._fxColor.setHSL((hue + 0.25) % 1, 1.0, 0.6);
      this._outerGlowMesh.material.color.copy(this._fxColor);
      this._outerGlowMesh.material.opacity = 0.06 + 0.05 * Math.sin(t * 2.0);
      this._outerGlowMesh.scale.setScalar(1 + 0.04 * Math.sin(t * 2.5 + 1));
    }
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

    this.mesh.material.dispose();
    if (this._glowMesh) {
      this._glowMesh.geometry.dispose();
      this._glowMesh.material.dispose();
    }
    if (this._outerGlowMesh) {
      this._outerGlowMesh.geometry.dispose();
      this._outerGlowMesh.material.dispose();
    }
  }
}
