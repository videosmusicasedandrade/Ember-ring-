import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_ROUTES,
  advanceEnemyAlongRoute,
  applyDamageToBase,
  applyDamageToEnemy,
  applyDamageToUnit,
  applyHeroXpGain,
  applyMergeUpgrade,
  buildArenaForStage,
  buildArenaSlots,
  canMergeUnits,
  circlesCollide,
  computeRadialKnockbackVector,
  computeRouteSpawnPoint,
  computeRouteTotalLength,
  computeViewportTransform,
  computeWaveConfig,
  findBlockingUnitForEnemy,
  findEnemiesInSlashArc,
  findNearestEnemyInRange,
  findSlotAtPoint,
  formatSurvivalTime,
  getHeroLevelFromXp,
  getHeroStatsForLevel,
  getStageConfig,
  pointToSegmentDistance,
  pushEnemyBackAlongRoute,
  rollCriticalHit,
  unlockNextStage,
} from './engineMath';
import {
  DEFAULT_ARENA,
  EnemyEntity,
  HERO_XP_THRESHOLDS,
  HeroEntity,
  MAX_HERO_LEVEL,
  MAX_UNIT_LEVEL,
  TOTAL_STAGES,
  UNIT_SPECS,
  UnitEntity,
} from './types';

function makeEnemy(overrides: Partial<EnemyEntity> = {}): EnemyEntity {
  return {
    id: 1,
    kind: 'walker',
    x: 96,
    y: 410,
    vx: 30,
    vy: 0,
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
    xpReward: 10,
    walkPhase: 0,
    distanceTraveled: 0,
    waypointIndex: 1,
    laneOffset: 0,
    pathProgress: 0,
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
    slotId: 's1-4',
    x: 380,
    y: 510,
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

test('computeViewportTransform adapts to both landscape and portrait without distortion', () => {
  const landscape = computeViewportTransform(1280, 720, DEFAULT_ARENA);
  assert.ok(landscape.scale > 0.8 && landscape.scale < 1);
  assert.ok(landscape.offsetX > 0);

  const portrait = computeViewportTransform(390, 844, DEFAULT_ARENA);
  assert.ok(portrait.scale > 0.3 && portrait.scale < 0.45);
  const screenCenterX = DEFAULT_ARENA.centerX * portrait.scale + portrait.offsetX;
  const screenCenterY = DEFAULT_ARENA.centerY * portrait.scale + portrait.offsetY;
  assert.equal(Math.round(screenCenterX), 195);
  assert.equal(Math.round(screenCenterY), 422);
});

test('all 10 stages have distinct routes and non-overlapping slots clear of the road', () => {
  assert.equal(STAGE_ROUTES.length, TOTAL_STAGES);

  const routeSignatures = new Set<string>();
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    const arena = buildArenaForStage(stage);
    const slots = buildArenaSlots(arena);
    assert.ok(slots.length >= 12, `Stage ${stage} should have >= 12 tactical slots`);

    const sig = arena.waypoints.map((w) => `${w.x},${w.y}`).join('->');
    assert.equal(routeSignatures.has(sig), false, `Stage ${stage} repeated a route!`);
    routeSignatures.add(sig);

    for (const s of slots) {
      let minRoadDist = Infinity;
      for (let i = 0; i < arena.waypoints.length - 1; i++) {
        const d = pointToSegmentDistance(
          s.x,
          s.y,
          arena.waypoints[i].x,
          arena.waypoints[i].y,
          arena.waypoints[i + 1].x,
          arena.waypoints[i + 1].y
        );
        if (d < minRoadDist) minRoadDist = d;
      }
      assert.ok(
        minRoadDist >= arena.roadHalfWidth + 24,
        `Stage ${stage} slot ${s.id} too close to road (${minRoadDist.toFixed(1)}px)`
      );
      assert.ok(s.x >= 90 && s.x <= 1080 && s.y >= 145 && s.y <= 665, `Stage ${stage} slot ${s.id} out of safe HUD bounds`);
    }

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const d = Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y);
        assert.ok(
          d >= 70,
          `Stage ${stage} slots ${slots[i].id} and ${slots[j].id} overlap (${d.toFixed(1)}px)`
        );
      }
    }
  }
});

test('Hero XP progression scales level, attack power, range, and caps at MAX_HERO_LEVEL', () => {
  assert.equal(getHeroLevelFromXp(0), 1);
  assert.equal(getHeroLevelFromXp(HERO_XP_THRESHOLDS[1]), 2);
  assert.equal(getHeroLevelFromXp(9999), MAX_HERO_LEVEL);

  const stats1 = getHeroStatsForLevel('archer', 1);
  const stats4 = getHeroStatsForLevel('archer', 4);
  assert.ok(stats4.damage > stats1.damage);
  assert.ok(stats4.cooldown < stats1.cooldown);
  assert.ok(stats4.range > stats1.range);

  const hero: HeroEntity = {
    heroClass: 'bomber',
    slotId: 's1-5',
    x: 545,
    y: 295,
    level: 1,
    xp: 0,
    kills: 0,
    ...getHeroStatsForLevel('bomber', 1),
    cooldownTimer: 0,
    facingAngle: 0,
    attackAnim: 0,
    recoil: 0,
    levelUpFlash: 0,
  };

  const res = applyHeroXpGain(hero, HERO_XP_THRESHOLDS[1] + 5);
  assert.equal(res.leveledUp, true);
  assert.equal(res.newLevel, 2);
  assert.ok(hero.blastRadius > getHeroStatsForLevel('bomber', 1).blastRadius);

  const maxRes = applyHeroXpGain(hero, 1000);
  assert.equal(maxRes.isMaxReached, true);
  assert.equal(hero.level, MAX_HERO_LEVEL);
});

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

test('computeRouteSpawnPoint and advanceEnemyAlongRoute march enemies from portal to castle', () => {
  const arena = buildArenaForStage(3);
  const wps = arena.waypoints;
  const totalLen = computeRouteTotalLength(wps);
  const spawn = computeRouteSpawnPoint(wps, 0);
  assert.equal(Math.round(spawn.x), wps[0].x);
  assert.equal(Math.round(spawn.y), wps[0].y);

  const enemy = makeEnemy({ x: spawn.x, y: spawn.y, waypointIndex: 1, laneOffset: 0 });
  const step1 = advanceEnemyAlongRoute(enemy, wps, 120, 40, totalLen);
  assert.equal(step1.reachedCastle, false);
  assert.ok(enemy.pathProgress > 0 && enemy.pathProgress < 0.25);

  const stepFinal = advanceEnemyAlongRoute(enemy, wps, totalLen + 200, 40, totalLen);
  assert.equal(stepFinal.reachedCastle, true);
  assert.equal(enemy.pathProgress, 1);
});

test('pushEnemyBackAlongRoute moves enemies backward along route segments without leaving road', () => {
  const arena = buildArenaForStage(2);
  const wps = arena.waypoints;
  const totalLen = computeRouteTotalLength(wps);
  const enemy = makeEnemy({ x: wps[0].x, y: wps[0].y, waypointIndex: 1 });
  advanceEnemyAlongRoute(enemy, wps, 350, 40, totalLen);
  const progressBefore = enemy.pathProgress;

  pushEnemyBackAlongRoute(enemy, wps, 160, totalLen);
  assert.ok(enemy.pathProgress < progressBefore);
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

test('computeRadialKnockbackVector pushes outward from origin', () => {
  const v = computeRadialKnockbackVector(600, 420, 700, 420, 420);
  assert.equal(Math.round(v.vx), 420);
  assert.equal(Math.round(v.vy), 0);
});

test('findNearestEnemyInRange prioritizes enemies furthest along the route toward the Castle', () => {
  const unit = { x: 420, y: 420, range: 260 };
  const farOutOfRange = makeEnemy({ id: 1, x: 950, y: 420, pathProgress: 0.9 });
  const trailingInRange = makeEnemy({ id: 2, x: 350, y: 420, pathProgress: 0.2 });
  const leadingInRange = makeEnemy({ id: 3, x: 520, y: 420, pathProgress: 0.55 });

  const target = findNearestEnemyInRange(unit, [farOutOfRange, trailingInRange, leadingInRange], DEFAULT_ARENA);
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
  const slots = buildArenaSlots(buildArenaForStage(1));
  const target = slots[0];
  const found = findSlotAtPoint(target.x + 5, target.y - 4, slots);
  assert.equal(found?.id, target.id);
  assert.equal(findSlotAtPoint(10, 10, slots), null);
});
