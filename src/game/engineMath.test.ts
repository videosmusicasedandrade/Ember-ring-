import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyDamageToBase,
  applyDamageToEnemy,
  applyDamageToUnit,
  applyMergeUpgrade,
  buildArenaSlots,
  canMergeUnits,
  circlesCollide,
  computePerimeterSpawnPoint,
  computeRadialKnockbackVector,
  computeViewportTransform,
  computeWaveConfig,
  findBlockingUnitForEnemy,
  findEnemiesInSlashArc,
  findNearestEnemyInRange,
  findSlotAtPoint,
  formatSurvivalTime,
  getStageConfig,
  rollCriticalHit,
  unlockNextStage,
} from './engineMath';
import { DEFAULT_ARENA, EnemyEntity, MAX_UNIT_LEVEL, TOTAL_STAGES, UNIT_SPECS, UnitEntity } from './types';

test('computeViewportTransform adapts to both landscape and portrait without distortion', () => {
  const landscape = computeViewportTransform(1280, 720, DEFAULT_ARENA);
  assert.ok(landscape.scale > 0.8 && landscape.scale < 1);
  assert.ok(landscape.offsetX > 0);

  const portrait = computeViewportTransform(390, 844, DEFAULT_ARENA);
  assert.ok(portrait.scale > 0.5 && portrait.scale < 0.6);
  // Arena center maps to horizontal & vertical center on portrait mobile
  const screenCenterX = DEFAULT_ARENA.centerX * portrait.scale + portrait.offsetX;
  const screenCenterY = DEFAULT_ARENA.centerY * portrait.scale + portrait.offsetY;
  assert.equal(Math.round(screenCenterX), 195);
  assert.equal(Math.round(screenCenterY), 422);
});

function makeEnemy(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: 1,
    kind: 'walker',
    x: 600,
    y: 120,
    vx: 0,
    vy: 30,
    radius: 18,
    hp: 20,
    maxHp: 20,
    speed: 35,
    damage: 10,
    attackCooldown: 1,
    attackTimer: 0,
    attackAnim: 0,
    rewardEssence: 8,
    rewardScore: 15,
    walkPhase: 0,
    distanceTraveled: 0,
    hitFlash: 0,
    knockbackVx: 0,
    knockbackVy: 0,
    stunTimer: 0,
    koTimer: 0,
    isDead: false,
    bracingTimer: 0,
    lungeTimer: 0,
    lungeCooldown: 0,
    ...overrides,
  };
}

function makeUnit(overrides: Partial<UnitEntity> = {}): UnitEntity {
  const spec = UNIT_SPECS.shield;
  return {
    id: 10,
    kind: 'shield',
    slotId: 'r2-3',
    x: 500,
    y: 500,
    hp: spec.maxHp,
    maxHp: spec.maxHp,
    range: spec.range,
    damage: spec.damage,
    cooldown: spec.cooldown,
    cooldownTimer: 0,
    critChance: spec.critChance,
    facingAngle: 0,
    attackAnim: 0,
    recoil: 0,
    hitFlash: 0,
    level: 1,
    ...overrides,
  };
}

test('getStageConfig scales difficulty from Stage 1 to Stage 10 and flags final wave boss', () => {
  const s1 = getStageConfig(1);
  const s10 = getStageConfig(10);
  assert.ok(s10.hpMultiplier > s1.hpMultiplier);
  assert.ok(s10.bossHp > s1.bossHp);
  assert.ok(s10.spawnInterval < s1.spawnInterval);

  const w1 = computeWaveConfig(1, 1);
  const wFinal = computeWaveConfig(s1.totalWaves, 1);
  assert.equal(w1.isBossWave, false);
  assert.equal(wFinal.isBossWave, true);
});

test('unlockNextStage increments unlocked stage and clamps at TOTAL_STAGES', () => {
  assert.equal(unlockNextStage(1, 1), 2);
  assert.equal(unlockNextStage(2, 5), 5);
  assert.equal(unlockNextStage(TOTAL_STAGES, TOTAL_STAGES), TOTAL_STAGES);
});

test('formatSurvivalTime formats elapsed seconds into MM:SS', () => {
  assert.equal(formatSurvivalTime(0), '00:00');
  assert.equal(formatSurvivalTime(75), '01:15');
  assert.equal(formatSurvivalTime(125.9), '02:05');
});

test('buildArenaSlots generates concentric circular slots centered around arena center', () => {
  const slots = buildArenaSlots(DEFAULT_ARENA);
  assert.equal(slots.length, 16);
  const ring1 = slots.filter((s) => s.ring === 1);
  const ring2 = slots.filter((s) => s.ring === 2);
  assert.equal(ring1.length, 6);
  assert.equal(ring2.length, 10);

  for (const s of ring1) {
    const dist = Math.hypot(s.x - DEFAULT_ARENA.centerX, s.y - DEFAULT_ARENA.centerY);
    assert.ok(Math.abs(dist - 102) <= 2, `Expected ring 1 dist ~102, got ${dist}`);
  }
});

test('computePerimeterSpawnPoint places enemies on outer circle perimeter', () => {
  const right = computePerimeterSpawnPoint(0, DEFAULT_ARENA, 0);
  assert.equal(Math.round(right.x), DEFAULT_ARENA.centerX + DEFAULT_ARENA.spawnRadius);
  assert.equal(Math.round(right.y), DEFAULT_ARENA.centerY);

  const bottom = computePerimeterSpawnPoint(Math.PI / 2, DEFAULT_ARENA, 0);
  assert.equal(Math.round(bottom.x), DEFAULT_ARENA.centerX);
  assert.equal(Math.round(bottom.y), DEFAULT_ARENA.centerY + DEFAULT_ARENA.spawnRadius);
});

test('circlesCollide accurately detects hit and miss boundaries', () => {
  assert.equal(circlesCollide(100, 100, 10, 115, 100, 6), true);
  assert.equal(circlesCollide(100, 100, 10, 125, 100, 10), false);
});

test('rollCriticalHit multiplies damage by 1.75 when rng is below critChance', () => {
  const crit = rollCriticalHit(20, 0.25, 0.1);
  assert.equal(crit.isCrit, true);
  assert.equal(crit.damage, 35);

  const normal = rollCriticalHit(20, 0.25, 0.5);
  assert.equal(normal.isCrit, false);
  assert.equal(normal.damage, 20);
});

test('computeRadialKnockbackVector pushes enemies outward from arena center', () => {
  const v = computeRadialKnockbackVector(600, 420, 700, 420, 420);
  assert.equal(Math.round(v.vx), 420);
  assert.equal(Math.round(v.vy), 0);
});

test('findNearestEnemyInRange prioritizes enemies in range closest to core', () => {
  const unit = { x: 450, y: 420, range: 220 };
  const farOutOfRange = makeEnemy({ id: 1, x: 950, y: 420 });
  const outerInRange = makeEnemy({ id: 2, x: 320, y: 420 });
  const innerInRange = makeEnemy({ id: 3, x: 520, y: 420 });

  const target = findNearestEnemyInRange(unit, [farOutOfRange, outerInRange, innerInRange], DEFAULT_ARENA);
  assert.equal(target?.id, 3);
});

test('findEnemiesInSlashArc hits multiple enemies inside crescent arc', () => {
  const enemies = [
    makeEnemy({ id: 1, x: 750, y: 420 }),
    makeEnemy({ id: 2, x: 740, y: 455 }),
    makeEnemy({ id: 3, x: 550, y: 420 }),
  ];
  const hit = findEnemiesInSlashArc(700, 420, 0, 95, Math.PI * 0.45, enemies);
  assert.deepEqual(
    hit.map((e) => e.id),
    [1, 2]
  );
});

test('applyDamageToEnemy reduces hp, respects shield brace, and triggers KO state', () => {
  const shielded = makeEnemy({ kind: 'shielded', hp: 40, maxHp: 40, bracingTimer: 0.5 });
  const hit1 = applyDamageToEnemy(shielded, 20);
  assert.equal(hit1.actualDamage, 11);
  assert.equal(shielded.hp, 29);
  assert.equal(hit1.killed, false);

  const hit2 = applyDamageToEnemy(shielded, 100);
  assert.equal(hit2.killed, true);
  assert.equal(shielded.isDead, true);
  assert.equal(shielded.hp, 0);
});

test('canMergeUnits validates same kind, same level, distinct ids, and max level cap', () => {
  const u1 = makeUnit({ id: 1, kind: 'shield', level: 1 });
  const u2 = makeUnit({ id: 2, kind: 'shield', level: 1 });
  const u3 = makeUnit({ id: 3, kind: 'scout', level: 1 });
  const u4 = makeUnit({ id: 4, kind: 'shield', level: 2 });
  const uMax = makeUnit({ id: 5, kind: 'shield', level: MAX_UNIT_LEVEL });

  assert.equal(canMergeUnits(u1, u2), true);
  assert.equal(canMergeUnits(u1, u1), false);
  assert.equal(canMergeUnits(u1, u3), false);
  assert.equal(canMergeUnits(u1, u4), false);
  assert.equal(canMergeUnits(uMax, makeUnit({ id: 6, kind: 'shield', level: MAX_UNIT_LEVEL })), false);
});

test('applyMergeUpgrade levels up unit, boosts stats, and restores full HP', () => {
  const u = makeUnit({ id: 1, kind: 'shield', level: 1, hp: 50 });
  const prevDamage = u.damage;
  const prevMaxHp = u.maxHp;
  const prevCooldown = u.cooldown;

  applyMergeUpgrade(u);
  assert.equal(u.level, 2);
  assert.ok(u.damage > prevDamage);
  assert.ok(u.maxHp > prevMaxHp);
  assert.equal(u.hp, u.maxHp);
  assert.ok(u.cooldown < prevCooldown);
});

test('findBlockingUnitForEnemy detects frontline defenders and applyDamageToUnit destroys at 0 HP', () => {
  const shield = makeUnit({ id: 10, kind: 'shield', x: 500, y: 500, hp: 30, maxHp: 175 });
  const farScout = makeUnit({ id: 11, kind: 'scout', x: 300, y: 300 });
  const enemy = makeEnemy({ x: 525, y: 515, radius: 18 });

  const blocker = findBlockingUnitForEnemy(enemy, [farScout, shield]);
  assert.equal(blocker?.id, 10);

  const res = applyDamageToUnit(shield, 35);
  assert.equal(res.destroyed, true);
  assert.equal(shield.hp, 0);
  assert.equal(findBlockingUnitForEnemy(enemy, [farScout, shield]), null);
});

test('applyDamageToBase clamps HP at 0 and flags game over', () => {
  const r1 = applyDamageToBase(100, 25);
  assert.equal(r1.nextHp, 75);
  assert.equal(r1.isGameOver, false);

  const r2 = applyDamageToBase(15, 40);
  assert.equal(r2.nextHp, 0);
  assert.equal(r2.isGameOver, true);
});

test('computeWaveConfig scales enemy count and spawn pace smoothly', () => {
  const w1 = computeWaveConfig(1, 1);
  const w4 = computeWaveConfig(4, 3);
  assert.ok(w4.totalEnemies > w1.totalEnemies);
  assert.ok(w4.spawnInterval < w1.spawnInterval);
  assert.ok(w4.hpMultiplier > w1.hpMultiplier);
});

test('findSlotAtPoint resolves clicked slot coordinates cleanly', () => {
  const slots = buildArenaSlots(DEFAULT_ARENA);
  const target = slots[0];
  const found = findSlotAtPoint(target.x + 5, target.y - 4, slots);
  assert.equal(found?.id, target.id);
  assert.equal(findSlotAtPoint(10, 10, slots), null);
});
