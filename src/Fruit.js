import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { FRUIT_DATA } from './FruitData.js';

let _fruitIdCounter = 0;

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
    this.data = FRUIT_DATA[level];
    this.scene = scene;
    this.physicsWorld = physicsWorld;

    // 합체 처리 중인지 여부 (중복 합체 방지) / Merging flag to prevent duplicate merges
    this.isMerging = false;
    // 드롭 직후 잠깐 충돌 무시를 위한 타임스탬프 / Timestamp to ignore collision right after drop
    this.spawnTime = performance.now();

    this._buildMesh(position);
    this._buildBody(position, fruitMaterial);
  }

  /**
   * Three.js 구체 메시 생성
   * Build the Three.js sphere mesh
   */
  _buildMesh(position) {
    const { radius, color, name } = this.data;

    const geo = new THREE.SphereGeometry(radius, 24, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.6,
      metalness: 0.1,
    });

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;

    // 과일 이름 스프라이트 (작은 텍스트 레이블)
    // Fruit name sprite (small text label)
    this.mesh.add(this._makeLabel(name, radius));

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

  /**
   * 물리 바디 위치를 Three.js 메시에 동기화
   * Sync physics body position/rotation to Three.js mesh
   */
  sync() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  /**
   * 씬과 물리 세계에서 과일 제거
   * Remove fruit from scene and physics world
   */
  destroy() {
    this.scene.remove(this.mesh);
    this.physicsWorld.removeBody(this.body);

    // 메모리 해제 / Dispose memory
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
