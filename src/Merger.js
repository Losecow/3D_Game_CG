import * as THREE from 'three';
import { FRUIT_DATA, MAX_LEVEL, RAINBOW_LEVEL } from './FruitData.js';
import { Fruit } from './Fruit.js';

/**
 * 같은 단계 과일이 충돌했을 때 합체를 처리하는 클래스
 * Handles merging when two fruits of the same level collide
 */
export class Merger {
  /**
   * @param {THREE.Scene} scene
   * @param {CANNON.World} physicsWorld
   * @param {CANNON.Material} fruitMaterial
   * @param {(score: number) => void} onScore - 점수 이벤트 콜백 / Score callback
   */
  constructor(scene, physicsWorld, fruitMaterial, onScore, sound, onMaxMerge) {
    this.scene = scene;
    this.physicsWorld = physicsWorld;
    this.fruitMaterial = fruitMaterial;
    this.onScore = onScore;
    this._sound = sound;
    this._onMaxMerge = onMaxMerge;
    this._pendingMerges = [];
  }

  /**
   * cannon-es 충돌 이벤트를 구독해 같은 단계 과일 감지
   * Subscribe to cannon-es collision events to detect same-level fruits
   * @param {Fruit} fruit
   */
  watchFruit(fruit) {
    fruit.body.addEventListener('collide', (event) => {
      const otherBody = event.body;
      const otherFruit = otherBody.fruitRef;

      if (!otherFruit) return; // 벽/바닥과의 충돌 무시 / Ignore wall/floor collisions

      // 스폰 직후 200ms 이내 충돌 무시 (즉시 합체 방지)
      // Ignore collisions within 200ms of spawn (prevents instant merge)
      const now = performance.now();
      if (now - fruit.spawnTime < 200 || now - otherFruit.spawnTime < 200) return;

      const sameLevel   = fruit.level === otherFruit.level;
      const rainbowMerge = (fruit.level === RAINBOW_LEVEL) !== (otherFruit.level === RAINBOW_LEVEL); // 한쪽만 레인보우

      if ((sameLevel || rainbowMerge) && !fruit.isMerging && !otherFruit.isMerging) {
        fruit.isMerging = true;
        otherFruit.isMerging = true;
        this._pendingMerges.push([fruit, otherFruit]);
      }
    });
  }

  /**
   * 대기 중인 합체를 모두 처리 (게임 루프에서 매 프레임 호출)
   * Process all pending merges (called every frame from game loop)
   * @param {Fruit[]} fruits - 게임 과일 배열 (직접 수정됨) / Game fruits array (mutated)
   * @returns {Fruit[]} 새로 생성된 과일 배열 / Newly created fruits
   */
  processPending(fruits) {
    if (this._pendingMerges.length === 0) return [];

    const newFruits = [];

    for (const [fruitA, fruitB] of this._pendingMerges) {
      // 이미 배열에서 제거된 과일이면 스킵 (연쇄 합체 중 중복 방지)
      // Skip if already removed (prevents duplicate in chain merges)
      if (!fruits.includes(fruitA) || !fruits.includes(fruitB)) continue;

      // 두 과일의 중간 위치에 새 과일 스폰
      // Spawn new fruit at the midpoint of the two fruits
      const midPos = new THREE.Vector3()
        .addVectors(fruitA.mesh.position, fruitB.mesh.position)
        .multiplyScalar(0.5);

      // 배열에서 제거 및 물리/씬 정리
      // Remove from array and clean up physics/scene
      fruits.splice(fruits.indexOf(fruitA), 1);
      fruits.splice(fruits.indexOf(fruitB), 1);
      fruitA.destroy();
      fruitB.destroy();

      // 레인보우 합체: 일반 과일 레벨 기준으로 +1
      const isRainbowMerge = fruitA.level === RAINBOW_LEVEL || fruitB.level === RAINBOW_LEVEL;
      const baseLevel = isRainbowMerge
        ? (fruitA.level === RAINBOW_LEVEL ? fruitB.level : fruitA.level)
        : fruitA.level;

      this.onScore(FRUIT_DATA[baseLevel].score);
      this._sound.playMerge(baseLevel);

      if (baseLevel >= MAX_LEVEL) {
        this._onMaxMerge?.();
        continue;
      }

      const nextFruit = new Fruit(
        baseLevel + 1,
        midPos,
        this.scene,
        this.physicsWorld,
        this.fruitMaterial
      );

      nextFruit.playBirthAnim();
      fruits.push(nextFruit);
      newFruits.push(nextFruit);
    }

    this._pendingMerges = [];
    return newFruits;
  }

  clearPending() {
    this._pendingMerges = [];
  }
}
