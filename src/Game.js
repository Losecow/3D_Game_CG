import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';
import { World } from './World.js';
import { Container } from './Container.js';
import { Fruit } from './Fruit.js';
import { Merger } from './Merger.js';
import { UI } from './UI.js';
import { FRUIT_DATA, MAX_DROP_LEVEL, MAX_LEVEL } from './FruitData.js';
import { Sound } from './Sound.js';

/**
 * 메인 게임 클래스 - 씬, 루프, 상태 관리를 총괄
 * Main game class: orchestrates scene, loop, and state management
 */
export class Game {
  constructor(container, auth = null) {
    this._container = container; // DOM 마운트 컨테이너 / DOM mount container
    this._auth = auth;
    this._fruits = [];           // 현재 씬의 모든 과일 / All fruits in scene
    this._score = 0;
    this._isGameOver = false;
    this._dropCooldown = false;  // 연속 드롭 방지 / Prevent rapid dropping
    this._nextLevel = this._randomLevel();

    // 게임 오버 판정용 타이머 (위험선 초과 지속 시간 ms)
    // Timer for game-over detection (ms above danger line)
    this._dangerTimer = 0;
    this._dangerThreshold = 2500; // 2.5초 이상 초과 시 게임 오버
    this._watermelons = 0;

    this._splitView = false;

    this._raycaster = new THREE.Raycaster();
    this._sound = new Sound();

    this._initRenderer();
    this._initScene();
    this._initPhysics();
    this._initContainer();
    this._initCamera();
    this._initTopCamera();
    this._initSideCamera();
    this._initLights();
    this._initDropGuide();
    this._initMerger();
    this._initUI();
    this._initEvents();

    this._ui.setNextFruit(this._nextLevel);

    this._lastTime = performance.now();
    this._animate();
  }

  // ─────────────────────────────── 초기화 ───────────────────────────────

  /** Three.js 렌더러 설정 / Set up Three.js renderer */
  _initRenderer() {
    this._renderer = new THREE.WebGLRenderer({ antialias: true });
    this._renderer.setSize(window.innerWidth, window.innerHeight);
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.shadowMap.enabled = true;
    this._renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._container.appendChild(this._renderer.domElement);
  }

  /** Three.js 씬 설정 / Set up Three.js scene */
  _initScene() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0xffffff);
    this._scene.fog = new THREE.Fog(0xffffff, 40, 80);
  }

  /** cannon-es 물리 세계 초기화 / Initialize cannon-es physics world */
  _initPhysics() {
    this._world = new World();
    this._physicsWorld = this._world.world;
  }

  /** 컨테이너 생성 / Create container */
  _initContainer() {
    this._gameContainer = new Container(
      this._scene,
      this._physicsWorld,
      this._world.wallMaterial
    );
  }

  /** 카메라 및 OrbitControls 설정 / Set up camera and OrbitControls */
  _initCamera() {
    this._camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      200
    );

    // 살짝 위에서 내려다보는 초기 위치 / Initial position: slightly above and angled
    this._camera.position.set(0, 22, 28);
    this._camera.lookAt(0, 8, 0);

    this._controls = new OrbitControls(this._camera, this._renderer.domElement);
    this._controls.target.set(0, 8, 0);
    this._controls.minDistance = 10;
    this._controls.maxDistance = 60;
    this._controls.maxPolarAngle = Math.PI / 2 + 0.2; // 바닥 아래로 못 보게 / Prevent looking below floor
    this._controls.enableDamping = true;
    this._controls.dampingFactor = 0.08;
  }

  /** 조명 설정 / Set up lights */
  _initLights() {
    // 전체 환경광 / Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this._scene.add(ambient);

    // 주 방향광 (그림자 생성) / Main directional light (casts shadows)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 30, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 80;
    dirLight.shadow.camera.top    =  25;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.camera.left   = -20;
    dirLight.shadow.camera.right  =  20;
    this._scene.add(dirLight);

    // 보조 포인트 라이트 / Fill point light
    const fillLight = new THREE.PointLight(0x4488ff, 0.5, 50);
    fillLight.position.set(-10, 20, -10);
    this._scene.add(fillLight);
  }

  /**
   * 드롭 가이드라인 (마우스 위치에 따라 움직이는 수직 반투명 기둥)
   * Drop guide: translucent vertical line that follows the mouse
   */
  _initDropGuide() {
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 30, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
    });
    this._dropGuide = new THREE.Mesh(geo, mat);
    this._dropGuide.visible = false;
    this._scene.add(this._dropGuide);

    // 드롭 위치 미리보기 구체 / Preview sphere at drop position
    this._initPreviewSphere();
  }

  /** 드롭할 과일 미리보기 구체 / Drop position preview sphere */
  _initPreviewSphere() {
    const data = FRUIT_DATA[this._nextLevel];
    const geo = new THREE.SphereGeometry(data.radius, 24, 16);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color),
      transparent: true,
      opacity: 0.4,
    });
    this._previewSphere = new THREE.Mesh(geo, mat);
    this._previewSphere.visible = false;
    this._scene.add(this._previewSphere);
  }

  /** 합체 매니저 초기화 / Initialize merger */
  _initMerger() {
    this._merger = new Merger(
      this._scene,
      this._physicsWorld,
      this._world.fruitMaterial,
      (score) => this._addScore(score),
      this._sound
    );
  }

  /** UI 초기화 / Initialize UI */
  _initUI() {
    this._ui = new UI(this._auth);
  }

  /** 위에서 내려다보는 직교 카메라 / Top-down orthographic camera */
  _initTopCamera() {
    const aspect = (window.innerWidth / 2) / window.innerHeight;
    const hw = this._gameContainer.depth / 2 + 4;
    this._topCamera = new THREE.OrthographicCamera(
      -hw * aspect, hw * aspect, hw, -hw, 0.1, 200
    );
    this._topCamera.position.set(0, 50, 0);
    this._topCamera.up.set(0, 0, -1);
    this._topCamera.lookAt(0, 0, 0);
  }

  _updateTopCamera() {
    const aspect = (window.innerWidth / 2) / window.innerHeight;
    const hw = this._gameContainer.depth / 2 + 4;
    this._topCamera.left   = -hw * aspect;
    this._topCamera.right  =  hw * aspect;
    this._topCamera.top    =  hw;
    this._topCamera.bottom = -hw;
    this._topCamera.updateProjectionMatrix();
  }

  /** 왼쪽 패널용 고정 사이드 카메라 / Fixed side camera for left panel */
  _initSideCamera() {
    this._sideCamera = new THREE.PerspectiveCamera(
      55,
      (window.innerWidth / 2) / window.innerHeight,
      0.1,
      200
    );
    this._sideCamera.position.set(28, 10, 0);
    this._sideCamera.lookAt(0, 10, 0);
  }

  _updateSideCamera() {
    this._sideCamera.aspect = (window.innerWidth / 2) / window.innerHeight;
    this._sideCamera.updateProjectionMatrix();
  }

  /** 분할 뷰 토글 / Toggle split view */
  toggleSplitView() {
    this._splitView = !this._splitView;
    if (this._splitView) {
      this._controls.enabled = false;
      this._dropGuide.visible = false;
      this._previewSphere.visible = false;
      this._updateSideCamera();
      this._updateTopCamera();
    } else {
      this._controls.enabled = true;
      this._camera.aspect = window.innerWidth / window.innerHeight;
      this._camera.updateProjectionMatrix();
    }
    return this._splitView;
  }

  /** 이벤트 리스너 등록 / Register event listeners */
  _initEvents() {
    window.addEventListener('mousemove', (e) => this._onMouseMove(e));
    window.addEventListener('click',     (e) => this._onMouseClick(e));
    window.addEventListener('resize',    ()  => this._onResize());

    // 터치 지원 / Touch support
    window.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this._onMouseMove(e.touches[0]);
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      e.preventDefault();
      this._onMouseClick(e.changedTouches[0]);
    }, { passive: false });
  }

  // ─────────────────────────────── 이벤트 핸들러 ───────────────────────────────

  _onMouseMove(event) {
    if (this._isGameOver) return;

    if (this._splitView) {
      const isRightPanel = event.clientX > window.innerWidth / 2;
      if (!isRightPanel) {
        this._dropGuide.visible = false;
        this._previewSphere.visible = false;
        this._renderer.domElement.style.cursor = 'default';
        return;
      }
      const pos = this._getDropPositionTopDown(event);
      if (!pos) {
        this._dropGuide.visible = false;
        this._previewSphere.visible = false;
        return;
      }
      const spawnY = this._gameContainer.height + 1.5;
      this._dropGuide.position.set(pos.x, spawnY / 2, pos.z);
      this._dropGuide.visible = true;
      this._previewSphere.position.set(pos.x, spawnY, pos.z);
      this._previewSphere.visible = true;
      this._renderer.domElement.style.cursor = this._dropCooldown ? 'not-allowed' : 'crosshair';
      return;
    }

    const pos = this._getDropPosition(event);
    if (!pos) {
      this._dropGuide.visible = false;
      this._previewSphere.visible = false;
      return;
    }
    const spawnY = this._gameContainer.height + 1.5;
    this._dropGuide.position.set(pos.x, spawnY / 2, pos.z);
    this._dropGuide.visible = true;
    this._previewSphere.position.set(pos.x, spawnY, pos.z);
    this._previewSphere.visible = true;
    this._renderer.domElement.style.cursor = this._dropCooldown ? 'not-allowed' : 'crosshair';
  }

  _onMouseClick(event) {
    if (this._isGameOver || this._dropCooldown) return;

    if (this._splitView) {
      if (event.clientX <= window.innerWidth / 2) return;
      const pos = this._getDropPositionTopDown(event);
      if (!pos) return;
      this._dropFruit(pos);
      return;
    }

    const pos = this._getDropPosition(event);
    if (!pos) return;
    this._dropFruit(pos);
  }

  _onResize() {
    if (this._splitView) {
      this._updateSideCamera();
      this._updateTopCamera();
    } else {
      this._camera.aspect = window.innerWidth / window.innerHeight;
      this._camera.updateProjectionMatrix();
    }
    this._renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ─────────────────────────────── 드롭 ───────────────────────────────

  /**
   * 마우스 위치를 컨테이너 바닥 위의 XZ 좌표로 변환
   * Convert mouse position to XZ coordinate above container floor
   */
  _getDropPosition(event) {
    const mouse = new THREE.Vector2(
      (event.clientX / window.innerWidth) * 2 - 1,
      -(event.clientY / window.innerHeight) * 2 + 1
    );

    this._raycaster.setFromCamera(mouse, this._camera);

    const dropPlaneY = this._gameContainer.height + 2;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dropPlaneY);
    const target = new THREE.Vector3();
    const hit = this._raycaster.ray.intersectPlane(plane, target);

    if (!hit) return null;

    // 과일 반지름만큼 여백을 두어 테두리가 벽 안쪽에 오도록 클램핑
    // Clamp so the fruit edge stays inside the container walls
    const r = FRUIT_DATA[this._nextLevel].radius;
    const hw = this._gameContainer.width / 2 - r;
    const hd = this._gameContainer.depth / 2 - r;
    target.x = Math.max(-hw, Math.min(hw, target.x));
    target.z = Math.max(-hd, Math.min(hd, target.z));

    return target;
  }

  /** 오른쪽 패널(탑다운 카메라)에서 XZ 드롭 좌표 계산 / Raycast using top-down camera for right panel */
  _getDropPositionTopDown(event) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const half = Math.floor(w / 2);

    const normalizedX = ((event.clientX - half) / (w - half)) * 2 - 1;
    const normalizedY = -(event.clientY / h) * 2 + 1;

    this._raycaster.setFromCamera(new THREE.Vector2(normalizedX, normalizedY), this._topCamera);

    const dropPlaneY = this._gameContainer.height + 2;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dropPlaneY);
    const target = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(plane, target)) return null;

    // 과일 반지름만큼 여백을 두어 테두리가 벽 안쪽에 오도록 클램핑
    const r = FRUIT_DATA[this._nextLevel].radius;
    const hw = this._gameContainer.width / 2 - r;
    const hd = this._gameContainer.depth / 2 - r;
    target.x = Math.max(-hw, Math.min(hw, target.x));
    target.z = Math.max(-hd, Math.min(hd, target.z));
    return target;
  }

  /**
   * 지정 위치에서 과일 낙하
   * Drop a fruit at the specified position
   */
  _dropFruit(position) {
    const level = this._nextLevel;
    const dropPos = new THREE.Vector3(
      position.x,
      this._gameContainer.height + 1.5,
      position.z
    );

    const fruit = new Fruit(
      level,
      dropPos,
      this._scene,
      this._physicsWorld,
      this._world.fruitMaterial
    );

    this._fruits.push(fruit);
    this._merger.watchFruit(fruit);
    this._sound.playDrop();

    // 다음 과일 준비 / Prepare next fruit
    this._nextLevel = this._randomLevel();
    this._ui.setNextFruit(this._nextLevel);
    this._updatePreviewSphere();

    // 드롭 쿨다운 (0.5초) / Drop cooldown: 0.5s
    this._dropCooldown = true;
    setTimeout(() => { this._dropCooldown = false; }, 500);
  }

  /** 다음 과일에 맞게 미리보기 구체 재생성 / Rebuild preview sphere for next fruit */
  _updatePreviewSphere() {
    this._scene.remove(this._previewSphere);
    this._previewSphere.geometry.dispose();
    this._previewSphere.material.dispose();
    this._initPreviewSphere();
  }

  // ─────────────────────────────── 점수 / 상태 ───────────────────────────────

  _addScore(points) {
    this._score += points;
    this._ui.setScore(this._score);
  }

  _randomLevel() {
    return Math.floor(Math.random() * (MAX_DROP_LEVEL + 1));
  }

  // ─────────────────────────────── 게임 오버 감지 ───────────────────────────────

  /**
   * 과일이 일정 시간 위험선 위에 있으면 게임 오버
   * Game over if any fruit stays above the danger line for too long
   */
  _checkGameOver(dt) {
    const dangerY = this._gameContainer.dangerLineY;
    const now = performance.now();
    const hasAbove = this._fruits.some(
      (f) => !f.isMerging && f.body.position.y > dangerY && (now - f.spawnTime) > 1500
    );

    if (hasAbove) {
      this._dangerTimer += dt * 1000;
      if (this._dangerTimer >= this._dangerThreshold) {
        this._triggerGameOver();
      }
    } else {
      this._dangerTimer = 0; // 위험선 아래로 내려오면 초기화 / Reset if below line
    }
  }

  quit() {
    if (this._isGameOver) return;
    this._triggerGameOver();
  }

  async _triggerGameOver() {
    this._isGameOver = true;
    this._dropGuide.visible = false;
    this._previewSphere.visible = false;

    const submitted = this._auth?.isLoggedIn
      ? await this._auth.submitScore(this._score, this._watermelons)
      : null;

    this._ui.showGameOver(this._score, submitted, () => this._restart());
  }

  /** 게임 재시작 / Restart the game */
  _restart() {
    [...this._fruits].forEach((f) => f.destroy());
    this._fruits = [];
    this._merger.clearPending();

    this._score = 0;
    this._watermelons = 0;
    this._isGameOver = false;
    this._dangerTimer = 0;
    this._dropCooldown = false;

    this._nextLevel = this._randomLevel();
    this._ui.setScore(0);
    this._ui.setNextFruit(this._nextLevel);
    this._updatePreviewSphere();
  }

  // ─────────────────────────────── 게임 루프 ───────────────────────────────

  _animate() {
    requestAnimationFrame(() => this._animate());

    const now = performance.now();
    const dt = (now - this._lastTime) / 1000; // 초 단위 / In seconds
    this._lastTime = now;

    if (!this._isGameOver) {
      // 1. 물리 시뮬레이션 스텝 / Step physics
      this._world.step(dt);

      // 2. 합체 처리 / Process merges
      const newFruits = this._merger.processPending(this._fruits);
      newFruits.forEach((f) => {
        this._merger.watchFruit(f);
        if (f.level === MAX_LEVEL) this._watermelons++;
      });

      // 3. Three.js 메시 동기화 / Sync meshes
      this._fruits.forEach((f) => f.sync());

      // 4. 게임 오버 체크 / Check game over
      this._checkGameOver(dt);
    }

    // 5. 카메라 컨트롤 업데이트 / Update camera controls
    this._controls.update();

    // 6. 렌더 / Render
    if (this._splitView) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const half = Math.floor(w / 2);

      this._renderer.setScissorTest(true);

      // 왼쪽 패널: 고정 사이드 카메라 (높이 확인) / Left panel: fixed side camera (height view)
      this._renderer.setViewport(0, 0, half, h);
      this._renderer.setScissor(0, 0, half, h);
      this._renderer.render(this._scene, this._sideCamera);

      // 오른쪽 패널: 위에서 보는 카메라 (fog 제거로 선명하게) / Right panel: top-down, fog off
      this._renderer.setViewport(half, 0, w - half, h);
      this._renderer.setScissor(half, 0, w - half, h);
      const savedFog = this._scene.fog;
      this._scene.fog = null;
      this._renderer.render(this._scene, this._topCamera);
      this._scene.fog = savedFog;

      this._renderer.setScissorTest(false);
      // viewport 전체 크기로 복원 / Restore full viewport
      this._renderer.setViewport(0, 0, w, h);
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this._renderer.setViewport(0, 0, w, h);
      this._renderer.render(this._scene, this._camera);
    }
  }
}
