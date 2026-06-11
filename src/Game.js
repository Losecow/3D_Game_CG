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
    this._currentLevel = this._randomLevel();
    this._nextLevel = this._randomLevel();

    // 게임 오버 판정용 타이머 (위험선 초과 지속 시간 ms)
    // Timer for game-over detection (ms above danger line)
    this._dangerTimer = 0;
    this._dangerThreshold = 2500; // 2.5초 이상 초과 시 게임 오버
    this._mergeGrace = 0;         // 합체 후 위험 판정 유예 시간 (ms), 3초
    this._watermelons = 0;

    this._splitView = false;
    this._dropMode  = 'click'; // 'click' | 'space'
    this._lastDropPos = null;

    this._shakeUsed   = false;   // 게임당 1회
    this._flipUsed    = false;   // 게임당 1회
    this._deleteMode  = false;   // 과일 삭제 모드
    this._onDeleteFruit = null;

    this._raycaster = new THREE.Raycaster();
    this._sound = new Sound();

    this._initRenderer();
    this._initScene();
    this._initPhysics();
    this._initContainer();
    this._initCamera();
    this._initTopCamera();
    this._initLights();
    this._initDropGuide();
    this._initMerger();
    this._initUI();
    this._initEvents();

    this._ui.setCurrentFruit(this._currentLevel);
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
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
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
    const data = FRUIT_DATA[this._currentLevel];
    const geo = new THREE.SphereGeometry(data.radius, 24, 16);
    const tex = new THREE.TextureLoader().load(`/textures/${data.texture}`);
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.2,
      metalness: 0.0,
      transparent: true,
      opacity: 0.6,
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
      this._sound,
      () => { this._watermelons++; }
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

  // 왼쪽(탑다운) 60%, 오른쪽(원근) 40%
  get _splitLeft() { return Math.floor(window.innerWidth * 0.6); }

  _updateTopCamera() {
    const aspect = this._splitLeft / window.innerHeight;
    const hw = this._gameContainer.depth / 2 + 4;
    this._topCamera.left   = -hw * aspect;
    this._topCamera.right  =  hw * aspect;
    this._topCamera.top    =  hw;
    this._topCamera.bottom = -hw;
    this._topCamera.updateProjectionMatrix();
  }

  get isSplitView()  { return this._splitView; }
  get sound()        { return this._sound; }
  get shakeUsed()    { return this._shakeUsed; }
  get flipUsed()     { return this._flipUsed; }
  get isGameOver()   { return this._isGameOver; }

  /** 모달이 열려있으면 드롭 차단 / Block drop when any modal is open */
  _isAnyModalOpen() {
    return ['settings-modal', 'leaderboard-modal', 'nickname-modal', 'feedback-modal', 'shop-modal'].some(
      id => !document.getElementById(id).classList.contains('hidden')
    );
  }

  setDropMode(mode) { this._dropMode = mode; }

  shake() {
    if (this._shakeUsed || this._isGameOver) return;
    this._shakeUsed = true;
    const strength = 30;
    this._fruits.forEach(f => {
      const impulse = new CANNON.Vec3(
        (Math.random() - 0.5) * strength,
        Math.random() * strength * 0.5,
        (Math.random() - 0.5) * strength
      );
      f.body.applyImpulse(impulse);
      f.body.wakeUp();
    });
  }

  flip() {
    if (this._flipUsed || this._isGameOver) return;
    this._flipUsed = true;
    this._fruits.forEach(f => {
      const impulse = new CANNON.Vec3(
        (Math.random() - 0.5) * 12,
        30 + Math.random() * 15,
        (Math.random() - 0.5) * 12
      );
      f.body.applyImpulse(impulse);
      f.body.wakeUp();
    });
  }

  enterDeleteMode(onDone) {
    if (this._isGameOver) return;
    this._deleteMode = true;
    this._onDeleteFruit = onDone ?? null;
  }

  exitDeleteMode() {
    this._deleteMode = false;
    const cb = this._onDeleteFruit;
    this._onDeleteFruit = null;
    cb?.();
  }

  _tryDeleteFruit(event) {
    if (this._isGameOver) { this.exitDeleteMode(); return; }
    if (this._splitView && event.clientX < this._splitLeft) return;

    const normalizedX = this._splitView
      ? ((event.clientX - this._splitLeft) / (window.innerWidth - this._splitLeft)) * 2 - 1
      : (event.clientX / window.innerWidth) * 2 - 1;
    const normalizedY = -(event.clientY / window.innerHeight) * 2 + 1;

    this._raycaster.setFromCamera(new THREE.Vector2(normalizedX, normalizedY), this._camera);
    const hits = this._raycaster.intersectObjects(this._fruits.map(f => f.mesh), false);
    if (hits.length === 0) return;

    const idx = this._fruits.findIndex(f => f.mesh === hits[0].object);
    if (idx === -1) return;

    const fruit = this._fruits.splice(idx, 1)[0];
    fruit.destroy();
    this.exitDeleteMode();
  }

  /** 분할 뷰 토글 / Toggle split view */
  toggleSplitView() {
    this._splitView = !this._splitView;
    if (this._splitView) {
      this._dropGuide.visible = false;
      this._previewSphere.visible = false;
      this._camera.aspect = (window.innerWidth - this._splitLeft) / window.innerHeight;
      this._camera.updateProjectionMatrix();
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

    // 분할 뷰에서 오른쪽 패널에만 OrbitControls 활성화 / Enable controls only on right panel in split view
    this._renderer.domElement.addEventListener('mousedown', (e) => {
      if (this._splitView) this._controls.enabled = e.clientX >= this._splitLeft;
    });
    this._renderer.domElement.addEventListener('mouseleave', () => {
      if (this._splitView) this._controls.enabled = true;
    });

    // ESC: 삭제 모드 취소
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this._deleteMode) this.exitDeleteMode();
    });

    // 스페이스바 드롭 / Spacebar drop
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        if (this._dropMode === 'space' && !this._isGameOver && !this._dropCooldown && !this._isAnyModalOpen() && this._lastDropPos) {
          this._dropFruit(this._lastDropPos);
        }
      }
    });

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
    if (this._isAnyModalOpen()) {
      this._dropGuide.visible = false;
      this._previewSphere.visible = false;
      return;
    }

    if (this._splitView) {
      const isLeftPanel = event.clientX < this._splitLeft;
      if (!isLeftPanel) {
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
      this._lastDropPos = pos.clone();
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
    this._lastDropPos = pos.clone();
    this._renderer.domElement.style.cursor = this._dropCooldown ? 'not-allowed' : 'crosshair';
  }

  _onMouseClick(event) {
    if (this._deleteMode) {
      this._tryDeleteFruit(event);
      return;
    }
    if (this._isGameOver || this._dropCooldown) return;
    if (this._dropMode !== 'click') return;
    if (this._isAnyModalOpen()) return;
    if (event.target?.closest?.('#ui, #auth-panel, #signin-area, #game-over, #controls-hint, #settings-modal, #leaderboard-modal, #nickname-modal, #feedback-modal')) return;

    if (this._splitView) {
      if (event.clientX >= this._splitLeft) return;
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
      this._camera.aspect = (window.innerWidth - this._splitLeft) / window.innerHeight;
      this._camera.updateProjectionMatrix();
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
    const r = FRUIT_DATA[this._currentLevel].radius;
    const hw = this._gameContainer.width / 2 - r;
    const hd = this._gameContainer.depth / 2 - r;
    target.x = Math.max(-hw, Math.min(hw, target.x));
    target.z = Math.max(-hd, Math.min(hd, target.z));

    return target;
  }

  /** 오른쪽 패널(탑다운 카메라)에서 XZ 드롭 좌표 계산 / Raycast using top-down camera for right panel */
  _getDropPositionTopDown(event) {
    const h = window.innerHeight;
    const leftW = this._splitLeft;

    const normalizedX = (event.clientX / leftW) * 2 - 1;
    const normalizedY = -(event.clientY / h) * 2 + 1;

    this._raycaster.setFromCamera(new THREE.Vector2(normalizedX, normalizedY), this._topCamera);

    const dropPlaneY = this._gameContainer.height + 2;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -dropPlaneY);
    const target = new THREE.Vector3();
    if (!this._raycaster.ray.intersectPlane(plane, target)) return null;

    // 과일 반지름만큼 여백을 두어 테두리가 벽 안쪽에 오도록 클램핑
    const r = FRUIT_DATA[this._currentLevel].radius;
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
    const level = this._currentLevel;
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

    // 현재 → 다음으로 시프트, 새 다음 과일 뽑기 / Shift current→next, draw new next
    this._currentLevel = this._nextLevel;
    this._nextLevel = this._randomLevel();
    this._ui.setCurrentFruit(this._currentLevel);
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
    this._mergeGrace = 3000;
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
    if (this._mergeGrace > 0) {
      this._mergeGrace -= dt * 1000;
      this._dangerTimer = 0;
      return;
    }

    const dangerY = this._gameContainer.dangerLineY;
    const now = performance.now();
    const aboveFruits = this._fruits.filter(
      (f) => !f.isMerging && f.body.position.y > dangerY && (now - f.spawnTime) > 1500
    );

    // 4개 이상 위험선 초과 시 즉시 게임 오버
    if (aboveFruits.length >= 4) {
      this._triggerGameOver();
      return;
    }

    if (aboveFruits.length > 0) {
      this._dangerTimer += dt * 1000;
      if (this._dangerTimer >= this._dangerThreshold) {
        this._triggerGameOver();
      }
    } else {
      this._dangerTimer = 0;
    }
  }

  quit() {
    if (this._isGameOver) return;
    this._triggerGameOver();
  }

  async _triggerGameOver() {
    this._isGameOver = true;
    if (this._deleteMode) this.exitDeleteMode();
    this._dropGuide.visible = false;
    this._previewSphere.visible = false;

    const result = this._auth?.isLoggedIn
      ? await this._auth.submitScore(this._score, this._watermelons)
      : null;

    const submitted = result ? result.ok : null;
    const totalWatermelons = result?.totalWatermelons ?? null;

    this._ui.showGameOver(this._score, submitted, this._watermelons, totalWatermelons, () => this._restart());
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
    this._mergeGrace = 0;
    this._dropCooldown = false;
    this._shakeUsed = false;
    this._flipUsed  = false;
    this.exitDeleteMode();

    this._currentLevel = this._randomLevel();
    this._nextLevel = this._randomLevel();
    this._ui.setScore(0);
    this._ui.setCurrentFruit(this._currentLevel);
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
      const leftW = this._splitLeft;
      const rightW = w - leftW;

      this._renderer.setScissorTest(true);

      // 왼쪽 패널: 탑다운 카메라 (드롭 조작, fog 제거) / Left panel: top-down (drop, fog off)
      this._renderer.setViewport(0, 0, leftW, h);
      this._renderer.setScissor(0, 0, leftW, h);
      const savedFog = this._scene.fog;
      this._scene.fog = null;
      this._renderer.render(this._scene, this._topCamera);
      this._scene.fog = savedFog;

      // 오른쪽 패널: 원근 카메라 (회전 가능) / Right panel: perspective (orbit controls)
      this._renderer.setViewport(leftW, 0, rightW, h);
      this._renderer.setScissor(leftW, 0, rightW, h);
      this._renderer.render(this._scene, this._camera);

      this._renderer.setScissorTest(false);
      this._renderer.setViewport(0, 0, w, h);
    } else {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this._renderer.setViewport(0, 0, w, h);
      this._renderer.render(this._scene, this._camera);
    }
  }
}
