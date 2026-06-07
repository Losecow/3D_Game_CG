import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * 게임 컨테이너 (박스형 투명 벽 + 바닥)
 * Game container: box-shaped transparent walls + floor
 */
export class Container {
  /**
   * @param {THREE.Scene} scene
   * @param {CANNON.World} physicsWorld - cannon-es 물리 세계 인스턴스
   * @param {CANNON.Material} wallMaterial - 벽 재질
   */
  constructor(scene, physicsWorld, wallMaterial) {
    // 컨테이너 크기 / Container dimensions
    this.width  = 12;   // X축 너비
    this.depth  = 12;   // Z축 깊이
    this.height = 20;   // Y축 높이
    this.wallThickness = 0.5;

    // 게임 오버 위험선 높이 (컨테이너 바닥 기준 Y 좌표)
    // Danger line Y position (from floor)
    this.dangerLineY = this.height * 0.80;

    this._buildVisuals(scene);
    this._buildPhysics(physicsWorld, wallMaterial);
    this._buildDangerLine(scene);
  }

  /**
   * Three.js 시각적 요소 생성 (투명 벽 + 불투명 바닥)
   * Build Three.js visual meshes (transparent walls + opaque floor)
   */
  _buildVisuals(scene) {
    const w = this.width;
    const d = this.depth;
    const h = this.height;
    const t = this.wallThickness;

    // 벽 재질: 투명 / Wall material: transparent
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x88ccff,
      transparent: true,
      opacity: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // 벽 테두리 재질 / Wall edge material
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x88ccff, opacity: 0.5, transparent: true });

    // 바닥 재질 / Floor material
    const floorTex = new THREE.TextureLoader().load('/textures/basket_floor.png');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(3, 3);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 });

    const panels = [
      // [너비, 높이, 위치 x, y, z, 회전 y]
      // [width, height, pos x, y, z, rot y]
      { geo: new THREE.PlaneGeometry(w, h), x: 0,       y: h / 2, z: -d / 2, ry: 0            }, // 뒷면 / back
      { geo: new THREE.PlaneGeometry(w, h), x: 0,       y: h / 2, z:  d / 2, ry: Math.PI      }, // 앞면 / front
      { geo: new THREE.PlaneGeometry(d, h), x: -w / 2,  y: h / 2, z: 0,      ry: Math.PI / 2  }, // 왼쪽 / left
      { geo: new THREE.PlaneGeometry(d, h), x:  w / 2,  y: h / 2, z: 0,      ry: -Math.PI / 2 }, // 오른쪽 / right
    ];

    panels.forEach(({ geo, x, y, z, ry }) => {
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      scene.add(mesh);

      // 엣지라인으로 윤곽 표시 / Show outline with edge lines
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, edgeMat);
      line.position.set(x, y, z);
      line.rotation.y = ry;
      scene.add(line);
    });

    // 바닥 / Floor
    const floorGeo = new THREE.BoxGeometry(w, t, d);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -t / 2, 0);
    scene.add(floorMesh);
  }

  /**
   * cannon-es 물리 바디 생성 (보이지 않는 충돌 면)
   * Build cannon-es physics bodies (invisible collision planes)
   */
  _buildPhysics(physicsWorld, wallMaterial) {
    const w = this.width;
    const d = this.depth;
    const h = this.height;
    const t = this.wallThickness;

    // 고정 바디 공통 옵션 / Static body options
    const staticOpts = { mass: 0, material: wallMaterial };

    const walls = [
      // 바닥 / Floor
      { pos: [0, -t / 2, 0],   halfExt: [w / 2, t / 2, d / 2] },
      // 왼쪽 벽 / Left wall
      { pos: [-w / 2 - t / 2, h / 2, 0], halfExt: [t / 2, h / 2, d / 2] },
      // 오른쪽 벽 / Right wall
      { pos: [ w / 2 + t / 2, h / 2, 0], halfExt: [t / 2, h / 2, d / 2] },
      // 뒷면 벽 / Back wall
      { pos: [0, h / 2, -d / 2 - t / 2], halfExt: [w / 2, h / 2, t / 2] },
      // 앞면 벽 / Front wall
      { pos: [0, h / 2,  d / 2 + t / 2], halfExt: [w / 2, h / 2, t / 2] },
    ];

    walls.forEach(({ pos, halfExt }) => {
      const body = new CANNON.Body(staticOpts);
      body.addShape(new CANNON.Box(new CANNON.Vec3(...halfExt)));
      body.position.set(...pos);
      physicsWorld.addBody(body);
    });
  }

  /**
   * 위험선 시각화 (빨간 테두리 라인)
   * Visualize the danger line (red border line)
   */
  _buildDangerLine(scene) {
    const w = this.width;
    const d = this.depth;
    const y = this.dangerLineY;

    const points = [
      new THREE.Vector3(-w / 2, y, -d / 2),
      new THREE.Vector3( w / 2, y, -d / 2),
      new THREE.Vector3( w / 2, y,  d / 2),
      new THREE.Vector3(-w / 2, y,  d / 2),
      new THREE.Vector3(-w / 2, y, -d / 2),
    ];

    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0xff3333, opacity: 0.8, transparent: true });
    const line = new THREE.Line(geo, mat);
    scene.add(line);

    this.dangerLineMesh = line;
  }
}
