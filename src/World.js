import * as CANNON from 'cannon-es';

/**
 * cannon-es 물리 세계 설정 및 관리
 * Manages the cannon-es physics world
 */
export class World {
  constructor() {
    // 물리 세계 생성 / Create physics world
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -20, 0), // 중력 (y축 아래 방향) / Gravity downward
    });

    // 충돌 감지 방식: SAPBroadphase - 많은 오브젝트에 효율적
    // Collision broadphase: SAPBroadphase - efficient for many objects
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    // 솔버 반복 횟수 증가 (안정적인 쌓기를 위해)
    // Increase solver iterations for stable stacking
    this.world.solver.iterations = 20;

    // 재질 설정 / Material setup
    this.fruitMaterial = new CANNON.Material('fruit');
    this.wallMaterial = new CANNON.Material('wall');

    // 과일-과일 접촉 설정 (약간 탄성 있게)
    // Fruit-fruit contact (slightly bouncy)
    const fruitContact = new CANNON.ContactMaterial(
      this.fruitMaterial,
      this.fruitMaterial,
      { friction: 0.3, restitution: 0.2 }
    );

    // 과일-벽 접촉 설정 (거의 튀지 않게)
    // Fruit-wall contact (barely bouncy)
    const wallContact = new CANNON.ContactMaterial(
      this.fruitMaterial,
      this.wallMaterial,
      { friction: 0.5, restitution: 0.1 }
    );

    this.world.addContactMaterial(fruitContact);
    this.world.addContactMaterial(wallContact);
  }

  /**
   * 물리 시뮬레이션 한 스텝 진행
   * Step the physics simulation forward
   * @param {number} dt - 델타 타임 (초) / delta time in seconds
   */
  step(dt) {
    // 최대 스텝 크기 제한 (탭 비활성화 후 복귀 시 폭발 방지)
    // Cap dt to prevent explosion after tab focus loss
    const fixedStep = 1 / 60;
    const maxSubSteps = 3;
    this.world.step(fixedStep, Math.min(dt, 0.1), maxSubSteps);
  }
}
