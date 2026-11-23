import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLY_ALBUM,
  ENEMY_ALBUM,
  getUnlockedAlliesForStage,
  getUnlockedEnemiesForStage,
  isAllyUnlocked,
  isEnemyUnlocked,
} from './bestiaryData';
import {
  STAGE_ROUTES,
  advanceEnemyAlongRoute,
  applyDamageToBase,
  applyDamageToEnemy,
  applyDamageToUnit,
  applyHeroXpGain,
  applyMergeUpgrade,
  applyUnitXpGain,
  buildArenaForStage,
  buildArenaSlots,
  canMergeUnits,
  circlesCollide,
  computeCastlePetPosition,
  computeEnemyEssenceReward,
  computeRadialKnockbackVector,
  computeRouteSpawnPoint,
  computeRouteTotalLength,
  computeViewportTransform,
  computeWaveConfig,
  crossedHeroUpgradeMilestone,
  findBlockingUnitForEnemy,
  findEnemiesInSlashArc,
  findNearestEnemyInRange,
  findSlotAtPoint,
  formatSurvivalTime,
  getEnemyResistanceMultiplier,
  getHeroEvolutionCost,
  getHeroLevelFromXp,
  getHeroRankTitle,
  getHeroStatsForLevel,
  getStageConfig,
  getUnitLevelFromXp,
  getUnitStatsForLevel,
  getUnitXpBounds,
  isValidFreeHeroPosition,
  isEliteEnemy,
  pointToSegmentDistance,
  pushEnemyBackAlongRoute,
  rollCriticalHit,
  unlockNextStage,
} from './engineMath';
import { GameSimulation } from './simulation';
import { generateConvergenceStages } from './storage';
import {
  DEFAULT_ARENA,
  EnemyEntity,
  HERO_XP_THRESHOLDS,
  HeroEntity,
  MAX_HERO_LEVEL,
  MAX_UNIT_LEVEL,
  PET_ORDER,
  PET_SPECS,
  TOTAL_STAGES,
  UNIT_SPECS,
  UNIT_XP_THRESHOLDS,
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
    routeIndex: 0,
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

test('all 150 stages (including Convergence) have valid 1-4 routes and non-overlapping slots clear of all roads', () => {
  assert.equal(STAGE_ROUTES.length, 16);
  assert.equal(TOTAL_STAGES, 150);

  const routeCounts = new Set(STAGE_ROUTES.map((r) => r.routes.length));
  assert.deepEqual([...routeCounts].sort((a, b) => a - b), [1, 2, 3, 4]);

  const stage1Sig = buildArenaForStage(1).waypoints.map((w) => `${w.x},${w.y}`).join('->');
  const stage2Sig = buildArenaForStage(2).waypoints.map((w) => `${w.x},${w.y}`).join('->');
  assert.notEqual(stage1Sig, stage2Sig);

  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    for (const isConv of [false, true]) {
      const arena = buildArenaForStage(stage, isConv);
      const slots = buildArenaSlots(arena, isConv);
      assert.ok(slots.length >= 12, `Stage ${stage} should have >= 12 tactical slots`);
      assert.ok(arena.routes.length >= 1 && arena.routes.length <= 4);
      if (isConv) {
        assert.ok(arena.routes.length >= 3, `Convergence stage ${stage} must have >= 3 routes`);
      }

      for (const s of slots) {
        let minRoadDist = Infinity;
        for (const branch of arena.routes) {
          for (let i = 0; i < branch.waypoints.length - 1; i++) {
            const d = pointToSegmentDistance(
              s.x,
              s.y,
              branch.waypoints[i].x,
              branch.waypoints[i].y,
              branch.waypoints[i + 1].x,
              branch.waypoints[i + 1].y
            );
            if (d < minRoadDist) minRoadDist = d;
          }
        }
        assert.ok(
          minRoadDist >= arena.roadHalfWidth + 24,
          `Stage ${stage} (conv=${isConv}) slot ${s.id} too close to road (${minRoadDist.toFixed(1)}px)`
        );
        assert.ok(
          s.x >= 90 && s.x <= 1080 && s.y >= 145 && s.y <= 665,
          `Stage ${stage} slot ${s.id} out of safe HUD bounds (${s.x}, ${s.y})`
        );
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
  }
});

test('Enemy Album (50) unlocks every 2-5 stages and Ally Album (10) unlocks every 5-10 stages', () => {
  assert.equal(ENEMY_ALBUM.length, 50);
  assert.equal(ENEMY_ALBUM[0].name, 'Rato de Esgoto');
  assert.equal(ENEMY_ALBUM[0].hp, 50);
  assert.equal(ENEMY_ALBUM[0].unlockStage, 1);
  assert.equal(ENEMY_ALBUM[49].name, 'O Deus Esquecido (Chefe Final)');
  assert.equal(ENEMY_ALBUM[49].hp, 25000);
  assert.equal(ENEMY_ALBUM[49].unlockStage, 150);

  for (let i = 1; i < ENEMY_ALBUM.length; i++) {
    const gap = ENEMY_ALBUM[i].unlockStage - ENEMY_ALBUM[i - 1].unlockStage;
    assert.ok(
      gap >= 2 && gap <= 5,
      `Enemy ${ENEMY_ALBUM[i].code} gap ${gap} must be between 2 and 5 stages`
    );
  }

  assert.equal(ALLY_ALBUM.length, 10);
  assert.equal(ALLY_ALBUM[0].name, 'Batedor');
  assert.equal(ALLY_ALBUM[0].unlockStage, 1);
  assert.equal(ALLY_ALBUM[9].name, 'Paladino Supremo');

  for (let i = 1; i < ALLY_ALBUM.length; i++) {
    const gap = ALLY_ALBUM[i].unlockStage - ALLY_ALBUM[i - 1].unlockStage;
    assert.ok(
      gap >= 5 && gap <= 10,
      `Ally ${ALLY_ALBUM[i].code} gap ${gap} must be between 5 and 10 stages`
    );
  }

  assert.equal(isEnemyUnlocked(ENEMY_ALBUM[0], 1), true);
  assert.equal(isEnemyUnlocked(ENEMY_ALBUM[1], 1), false);
  assert.equal(getUnlockedEnemiesForStage(1).length, 1);
  assert.equal(getUnlockedEnemiesForStage(150).length, 50);

  assert.equal(isAllyUnlocked(ALLY_ALBUM[0], 1), true);
  assert.equal(isAllyUnlocked(ALLY_ALBUM[1], 5), false);
  assert.equal(isAllyUnlocked(ALLY_ALBUM[1], 6), true);
  assert.equal(getUnlockedAlliesForStage(1).length, 1);
  assert.equal(getUnlockedAlliesForStage(79).length, 10);
});

test('Hero levels up fast with XP thresholds, while combat power grows modestly so merged units are essential', () => {
  assert.equal(getHeroLevelFromXp(0), 1);
  assert.equal(getHeroLevelFromXp(HERO_XP_THRESHOLDS[1]), 2);
  assert.ok(HERO_XP_THRESHOLDS[4] <= 100, 'Lv5 should be reachable quickly via fast XP thresholds');
  assert.equal(getHeroLevelFromXp(9999), MAX_HERO_LEVEL);

  for (const heroClass of ['archer', 'swordsman', 'bomber'] as const) {
    const lv1 = getHeroStatsForLevel(heroClass, 1);
    const hitsForRat = Math.ceil(50 / lv1.damage);
    assert.ok(
      hitsForRat >= 4 && hitsForRat <= 8,
      `Lv1 ${heroClass} (dmg=${lv1.damage}) should take 4-8 hits vs 50 HP common enemy, got ${hitsForRat}`
    );
    const lv5 = getHeroStatsForLevel(heroClass, 5);
    const lv10 = getHeroStatsForLevel(heroClass, 10);
    const lv15 = getHeroStatsForLevel(heroClass, 15);
    assert.ok(lv5.damage > lv1.damage && lv5.damage < lv1.damage * 2, 'Lv5 hero power should rise modestly');
    assert.ok(lv10.damage > lv5.damage && lv10.damage < lv1.damage * 2.5, 'Lv10 hero should not solo waves');
    assert.ok(lv15.damage > lv10.damage && lv15.damage < lv1.damage * 3, 'Lv15 hero growth stays bounded');
    assert.ok(lv5.cooldown < lv1.cooldown);
    assert.ok(lv5.range > lv1.range);
  }

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

  const maxRes = applyHeroXpGain(hero, 12000);
  assert.equal(maxRes.isMaxReached, true);
  assert.equal(hero.level, MAX_HERO_LEVEL);
});

test('generateConvergenceStages schedules irregular 4-8 stage intervals, evolution cost scales, and free placement validates ground', () => {
  const schedule = generateConvergenceStages(4242);
  assert.ok(schedule.length >= 18);
  assert.ok(schedule[0] >= 4 && schedule[0] <= 8);
  for (let i = 1; i < schedule.length; i++) {
    const gap = schedule[i] - schedule[i - 1];
    assert.ok(gap >= 4 && gap <= 8, `Expected Convergence gap 4-8, got ${gap}`);
  }

  const convCfg = getStageConfig(schedule[0], schedule);
  assert.equal(convCfg.isConvergenceStage, true);
  assert.ok(convCfg.routeCount >= 3);

  assert.equal(getHeroEvolutionCost(1), 1);
  assert.ok(getHeroEvolutionCost(10) > getHeroEvolutionCost(1));
  assert.equal(getHeroRankTitle(1), 'Aprendiz');
  assert.equal(getHeroRankTitle(15), 'Mestre');
  assert.equal(getHeroRankTitle(25), 'Mítico');

  const arena = buildArenaForStage(8, true); // 4-route map
  // Valid open grass spot
  assert.equal(isValidFreeHeroPosition(215, 315, arena, []), true);
  // Blocked: on top of Castle
  assert.equal(isValidFreeHeroPosition(arena.castleX, arena.castleY, arena, []), false);
  // Blocked: directly on route 1 road
  assert.equal(isValidFreeHeroPosition(300, 410, arena, []), false);
  // Blocked: overlapping another hero
  assert.equal(isValidFreeHeroPosition(220, 320, arena, [{ x: 215, y: 315 }]), false);
});

test('getStageConfig scales difficulty from Stage 1 to Stage 150, flags boss wave, and unlocks album entries', () => {
  const s1 = getStageConfig(1);
  const s3 = getStageConfig(3);
  const s5 = getStageConfig(5);
  const s6 = getStageConfig(6);
  const s150 = getStageConfig(150);
  assert.ok(s150.hpMultiplier > s1.hpMultiplier);
  assert.ok(s150.bossHp > s1.bossHp);
  assert.equal(s150.bossHp, 25000);
  assert.ok(s150.spawnInterval < s1.spawnInterval);
  assert.equal(s1.isFiveLevelMilestone, false);
  assert.equal(s1.unlockedEnemyLabel, 'Rato de Esgoto');
  assert.equal(s1.unlockedAllyLabel, 'Batedor');
  assert.equal(s3.unlockedEnemyLabel, 'Slime Verde');
  assert.equal(s5.isFiveLevelMilestone, true);
  assert.equal(s5.unlockedEnemyLabel, 'Goblin Batedor');
  assert.equal(s6.unlockedAllyLabel, 'Sapo Lâmina');
  assert.equal(s150.unlockedEnemyLabel, 'O Deus Esquecido (Chefe Final)');

  const w1 = computeWaveConfig(1, 1);
  const wFinal = computeWaveConfig(s1.totalWaves, 1);
  assert.equal(w1.isBossWave, false);
  assert.equal(wFinal.isBossWave, true);
  assert.equal(w1.mix.stalker, 0);

  const w3 = computeWaveConfig(1, 3);
  assert.ok(w3.mix.stalker > 0);
  assert.equal(w3.mix.pyro, 0);

  const w5 = computeWaveConfig(1, 5);
  assert.ok(w5.mix.pyro > 0);
  assert.equal(w5.mix.titan, 0);

  const w8 = computeWaveConfig(1, 8);
  assert.ok(w8.mix.titan > 0);
  assert.equal(w8.mix.reaper, 0);

  const w10 = computeWaveConfig(1, 10);
  assert.ok(w10.mix.reaper > 0);
});

test('computeEnemyEssenceReward regulates essence per kill and crossedHeroUpgradeMilestone detects multiples of 5', () => {
  assert.equal(computeEnemyEssenceReward('walker', 1, false), 4);
  assert.equal(computeEnemyEssenceReward('walker', 10, false), 4);
  assert.equal(computeEnemyEssenceReward('shielded', 2, false), 6);
  assert.equal(computeEnemyEssenceReward('brute', 3, false), 9);
  assert.equal(computeEnemyEssenceReward('stalker', 3, false), 10);
  assert.equal(computeEnemyEssenceReward('pyro', 5, false), 11);
  assert.equal(computeEnemyEssenceReward('titan', 8, false), 14);
  assert.equal(computeEnemyEssenceReward('reaper', 10, false), 16);
  assert.equal(computeEnemyEssenceReward('walker', 1, true), 6);
  assert.equal(computeEnemyEssenceReward('boss', 1, false), 26);

  assert.equal(crossedHeroUpgradeMilestone(1, 2), null);
  assert.equal(crossedHeroUpgradeMilestone(4, 5), 5);
  assert.equal(crossedHeroUpgradeMilestone(8, 10), 10);
  assert.equal(crossedHeroUpgradeMilestone(14, 15), 15);
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

test('applyDamageToEnemy differentiates resistance across common, armored, titan, and boss enemies', () => {
  const walker = makeEnemy({ kind: 'walker', hp: 50, maxHp: 50 });
  const brute = makeEnemy({ kind: 'brute', hp: 120, maxHp: 120 });
  const shielded = makeEnemy({ kind: 'shielded', hp: 80, maxHp: 80, bracingTimer: 0.5 });
  const titan = makeEnemy({ kind: 'titan', hp: 200, maxHp: 200, bracingTimer: 0 });
  const boss = makeEnemy({ kind: 'boss', hp: 400, maxHp: 400 });

  assert.equal(getEnemyResistanceMultiplier(walker, true), 1);
  assert.ok(getEnemyResistanceMultiplier(brute, true) < 0.7);
  assert.ok(getEnemyResistanceMultiplier(titan, true) < 0.5);
  assert.ok(getEnemyResistanceMultiplier(boss, true) < 0.5);

  const hitBraced = applyDamageToEnemy(shielded, 20);
  assert.equal(hitBraced.actualDamage, 8);
  assert.equal(shielded.hp, 72);
  assert.equal(hitBraced.killed, false);

  const hitBossByHero = applyDamageToEnemy(boss, 20, { byHero: true });
  assert.equal(hitBossByHero.actualDamage, 6);

  shielded.corrosionTimer = 2;
  const corrodedHit = applyDamageToEnemy(shielded, 10, { byHero: true });
  assert.equal(corrodedHit.actualDamage, 12);
  assert.equal(shielded.hp, 60);

  const hitKill = applyDamageToEnemy(shielded, 100);
  assert.equal(hitKill.killed, true);
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

test('GameSimulation spawns floating damage numbers on enemy hits', () => {
  const sim = new GameSimulation();
  sim.resetWorld('playing', 1, 'archer');
  const enemy = makeEnemy({ x: 500, y: 410, hp: 50, maxHp: 50 });
  sim.enemies.push(enemy);

  sim.projectiles.push({
    id: 999,
    x: 500,
    y: 410,
    vx: 0,
    vy: 0,
    radius: 8,
    damage: 25,
    critChance: 0,
    color: '#00D4FF',
    trailColor: '#BAE6FD',
    targetEnemyId: enemy.id,
    life: 1,
    isShockwave: false,
  });

  sim.update(0.1);

  assert.ok(sim.floatingTexts.length > 0, 'Should spawn floating damage text on enemy hit');
  const dmgText = sim.floatingTexts.find((ft) => ft.text.includes('-'));
  assert.ok(dmgText, 'Floating text should contain damage value');
});

test('isEliteEnemy classifies elite enemy kinds and flags accurately', () => {
  assert.equal(isEliteEnemy({ kind: 'titan' }), true);
  assert.equal(isEliteEnemy({ kind: 'reaper' }), true);
  assert.equal(isEliteEnemy({ kind: 'brute' }), true);
  assert.equal(isEliteEnemy({ kind: 'walker', isElite: true }), true);
  assert.equal(isEliteEnemy({ kind: 'walker' }), false);
  assert.equal(isEliteEnemy({ kind: 'boss', isBoss: true }), false);
});

test('defeating an elite enemy triggers subtle screenshake cameraTrauma and combat feedback', () => {
  const sim = new GameSimulation();
  sim.resetWorld('playing', 1, 'archer');
  sim.cameraTrauma = 0;

  const eliteEnemy = makeEnemy({
    id: 888,
    kind: 'titan',
    isElite: true,
    hp: 10,
    maxHp: 200,
    x: 500,
    y: 410,
  });
  sim.enemies.push(eliteEnemy);

  // Directly land a lethal blow on elite enemy
  sim.projectiles.push({
    id: 998,
    x: 500,
    y: 410,
    vx: 0,
    vy: 0,
    radius: 8,
    damage: 30,
    critChance: 0,
    color: '#00D4FF',
    trailColor: '#BAE6FD',
    targetEnemyId: eliteEnemy.id,
    life: 1,
    isShockwave: false,
  });

  sim.update(0.1);

  assert.equal(eliteEnemy.isDead, true, 'Elite enemy should be defeated');
  assert.ok(sim.cameraTrauma >= 0.35, `cameraTrauma should have subtle screenshake, got ${sim.cameraTrauma}`);
  const eliteFeedback = sim.floatingTexts.find((ft) => ft.text.includes('ELITE DERROTADO'));
  assert.ok(eliteFeedback, 'Should display ELITE DERROTADO feedback');
});

test('all UNIT_SPECS define valid damage, range, and attack speed for tooltip overlays', () => {
  const kinds = Object.keys(UNIT_SPECS) as (keyof typeof UNIT_SPECS)[];
  assert.ok(kinds.length >= 10, 'Should have all unlocked ally unit specs');

  for (const kind of kinds) {
    const spec = UNIT_SPECS[kind];
    assert.ok(spec.name.length > 0, `${kind} must have a name`);
    assert.ok(spec.damage > 0, `${kind} damage must be greater than 0, got ${spec.damage}`);
    assert.ok(spec.range > 0, `${kind} range must be greater than 0, got ${spec.range}`);
    assert.ok(spec.cooldown > 0, `${kind} cooldown must be greater than 0, got ${spec.cooldown}`);
    const attackSpeed = 1 / spec.cooldown;
    assert.ok(Number.isFinite(attackSpeed) && attackSpeed > 0, `${kind} attack speed must be finite and positive`);
    assert.ok(spec.shortRole.length > 0, `${kind} shortRole must be non-empty`);
    assert.ok(spec.role.length > 0, `${kind} role must be non-empty`);
  }

  // Verify specific tooltip values
  const scoutSpec = UNIT_SPECS.scout;
  assert.equal(scoutSpec.damage, 11);
  assert.equal(scoutSpec.range, 265);
  assert.equal((1 / scoutSpec.cooldown).toFixed(1), '1.7');

  const sniperSpec = UNIT_SPECS.sniper;
  assert.equal(sniperSpec.damage, 78);
  assert.equal(sniperSpec.range, 460);
  assert.equal((1 / sniperSpec.cooldown).toFixed(1), '0.8');

  // Verify Paladin aura bonus damage calculation (+25% / +20% simulation aura)
  const boostedScoutDamage = Math.round(scoutSpec.damage * 1.25);
  assert.equal(boostedScoutDamage, 14);
});

test('applyMergeUpgrade and getHeroStatsForLevel scale strength linearly at 50% slower pace', () => {
  // Allies: strictly linear +47.5% damage and +37.5% HP per merge level (half of old +95%/+75% exponential)
  const lv1 = getUnitStatsForLevel('sniper', 1);
  const lv2 = getUnitStatsForLevel('sniper', 2);
  const lv3 = getUnitStatsForLevel('sniper', 3);
  const lv4 = getUnitStatsForLevel('sniper', 4);

  const step12 = lv2.damage - lv1.damage;
  const step23 = lv3.damage - lv2.damage;
  const step34 = lv4.damage - lv3.damage;
  assert.ok(Math.abs(step12 - step23) <= 1 && Math.abs(step23 - step34) <= 1, 'Ally damage progression must be linear');
  assert.equal(lv2.damage, Math.round(UNIT_SPECS.sniper.damage * 1.475));
  assert.equal(lv3.damage, Math.round(UNIT_SPECS.sniper.damage * 1.95));
  assert.equal(lv4.damage, Math.round(UNIT_SPECS.sniper.damage * 2.425));

  const unit = makeUnit({
    id: 20,
    kind: 'scout',
    level: 1,
    damage: UNIT_SPECS.scout.damage,
    maxHp: UNIT_SPECS.scout.maxHp,
  });
  const lv1Dmg = unit.damage;
  applyMergeUpgrade(unit); // Lv.2
  applyMergeUpgrade(unit); // Lv.3
  assert.equal(unit.level, 3);
  assert.equal(unit.damage, Math.round(lv1Dmg * 1.95));

  // Main Hero: strictly linear +4.25% damage per level (half of old +8.5%)
  const h1 = getHeroStatsForLevel('swordsman', 1);
  const h11 = getHeroStatsForLevel('swordsman', 11);
  const h21 = getHeroStatsForLevel('swordsman', 21);
  const hStep1 = h11.damage - h1.damage;
  const hStep2 = h21.damage - h11.damage;
  assert.ok(Math.abs(hStep1 - hStep2) <= 1, 'Hero damage progression must be linear');
  assert.equal(h11.damage, Math.round(h1.damage * (1 + 10 * 0.0425)));
  assert.equal(h21.damage, Math.round(h1.damage * (1 + 20 * 0.0425)));
});

test('GameSimulation supports Ember Soul talents, Pact choices, and 360-degree Ring rotation', () => {
  const sim = new GameSimulation();
  sim.resetWorld('playing', 1, 'archer');

  // No free starter unit on board — player must recruit & merge
  assert.equal(sim.units.length, 0);

  // Talent upgrade consumes emberSouls and increments talent level
  sim.emberSouls = 20;
  const startCrit = sim.talents.critMastery ?? 0;
  const upgraded = sim.upgradeTalent('critMastery');
  assert.equal(upgraded, true);
  assert.equal(sim.talents.critMastery, startCrit + 1);
  assert.ok(sim.emberSouls < 20);

  // Rotate ring shifts slot positions and increases ringHeat
  const firstSlotBefore = { x: sim.slots[0].x, y: sim.slots[0].y };
  sim.rotateRing(Math.PI * 0.25);
  assert.ok(sim.ringHeat > 0);
  assert.ok(sim.slots[0].x !== firstSlotBefore.x || sim.slots[0].y !== firstSlotBefore.y);

  // Pact selection updates activePacts and applies Iron Pact +50 HP
  sim.pendingPactChoices = [
    { id: 'iron', title: 'Pacto de Ferro', description: '+50 HP máximo', tone: 'gold' },
  ];
  const prevMaxHp = sim.baseMaxHp;
  assert.equal(sim.selectPact('iron'), true);
  assert.equal(sim.pendingPactChoices, null);
  assert.ok(sim.activePacts.includes('iron'));
  assert.equal(sim.baseMaxHp, prevMaxHp + 50);
});

test('PET_SPECS defines all 5 passive castle guardian pets with distinct bonuses', () => {
  assert.deepEqual(PET_ORDER, ['turtle', 'tiger', 'rabbit', 'owl', 'cat']);
  assert.equal(PET_SPECS.turtle.castleHpBonusPct, 0.35);
  assert.equal(PET_SPECS.turtle.castleRegenPerSec, 2);
  assert.equal(PET_SPECS.tiger.damageBonusPct, 0.18);
  assert.equal(PET_SPECS.rabbit.attackSpeedBonusPct, 0.2);
  assert.equal(PET_SPECS.owl.manaCostReductionPct, 0.2);
  assert.equal(PET_SPECS.owl.spellCooldownReductionPct, 0.15);
  assert.equal(PET_SPECS.cat.itemDropLuckBonusPct, 35);
});

test('computeCastlePetPosition places the pet beside the Castle safely across all 150 stages', () => {
  for (let stage = 1; stage <= TOTAL_STAGES; stage++) {
    const arena = buildArenaForStage(stage, false);
    const pos = computeCastlePetPosition(arena);
    const distFromCastle = Math.hypot(pos.x - arena.castleX, pos.y - arena.castleY);

    assert.ok(
      pos.x >= 50 && pos.x <= arena.worldWidth - 50 && pos.y >= 70 && pos.y <= arena.worldHeight - 100,
      `Stage ${stage}: pet position (${pos.x}, ${pos.y}) must stay inside safe viewport bounds`
    );
    assert.ok(
      distFromCastle >= 60 && distFromCastle <= 125,
      `Stage ${stage}: pet must stand beside Castle (dist ${distFromCastle.toFixed(1)})`
    );

    // Ensure pet does not sit directly on top of any route centerline
    for (const route of arena.routes) {
      for (let i = 0; i < route.waypoints.length - 1; i++) {
        const a = route.waypoints[i];
        const b = route.waypoints[i + 1];
        const segDist = pointToSegmentDistance(pos.x, pos.y, a.x, a.y, b.x, b.y);
        assert.ok(
          segDist >= 30,
          `Stage ${stage}: pet (${pos.x}, ${pos.y}) too close to route ${route.id} (dist ${segDist.toFixed(1)})`
        );
      }
    }
  }
});

test('GameSimulation.setSelectedPet instantly updates all 5 passive guardian bonuses', () => {
  const sim = new GameSimulation();
  sim.setSelectedPet('cat');
  sim.resetWorld('playing', 1, 'archer');

  const baseCastleMaxHp = sim.baseMaxHp;
  const baseHeroDamage = sim.hero.damage;
  const baseHeroCooldown = sim.hero.cooldown;
  const baseUnitCost = sim.getEffectiveUnitCost('scout');
  const baseSpellMult = sim.getSpellCooldownMultiplier();

  // Cat exposes +35% item drop luck ready for item drops
  assert.equal(sim.getHudSnapshot().selectedPet, 'cat');
  assert.equal(sim.getHudSnapshot().petDropLuckBonus, 35);

  // Recruit a unit so we verify unit passives update live too
  sim.essence = 500;
  assert.equal(sim.quickRecruitUnit('scout'), true);
  const unit = sim.units[0];
  const baseUnitDamage = unit.damage;
  const baseUnitCooldown = unit.cooldown;

  // Turtle: +35% Castle Max HP & +2 HP/s Castle regeneration
  sim.setSelectedPet('turtle');
  assert.equal(sim.baseMaxHp, Math.round(baseCastleMaxHp * 1.35));
  sim.baseHp = sim.baseMaxHp - 10;
  for (let i = 0; i < 20; i++) {
    sim.update(0.05);
  }
  assert.ok(sim.baseHp >= sim.baseMaxHp - 8.05, `Turtle should regenerate +2 HP/s, got ${sim.baseHp}`);

  // Tiger: +18% Hero & Ally damage
  sim.setSelectedPet('tiger');
  assert.equal(sim.baseMaxHp, baseCastleMaxHp);
  assert.ok(sim.hero.damage > baseHeroDamage, 'Tiger should boost Hero damage');
  assert.ok(unit.damage > baseUnitDamage, 'Tiger should boost Ally damage');

  // Rabbit: +20% Hero & Ally attack speed (lower cooldown)
  sim.setSelectedPet('rabbit');
  assert.ok(sim.hero.cooldown < baseHeroCooldown, 'Rabbit should reduce Hero attack cooldown');
  assert.ok(unit.cooldown < baseUnitCooldown, 'Rabbit should reduce Ally attack cooldown');

  // Owl: -20% Ally recruitment cost & -15% Spell cooldown multiplier
  sim.setSelectedPet('owl');
  assert.ok(sim.getEffectiveUnitCost('scout') < baseUnitCost, 'Owl should reduce Ally recruitment cost');
  assert.ok(sim.getSpellCooldownMultiplier() < baseSpellMult, 'Owl should reduce spell cooldown multiplier');
  assert.equal(sim.getHudSnapshot().petDropLuckBonus, 0);
});

test('Allied units earn XP from their own kills, level up linearly, and reset to scratch on new stage while Heroes persist', () => {
  // Pure XP helper checks
  assert.equal(getUnitLevelFromXp(0), 1);
  assert.equal(getUnitLevelFromXp(UNIT_XP_THRESHOLDS[1]), 2);
  assert.equal(getUnitLevelFromXp(99999), MAX_UNIT_LEVEL);
  const boundsLv1 = getUnitXpBounds(1);
  assert.equal(boundsLv1.currentFloor, 0);
  assert.equal(boundsLv1.nextThreshold, UNIT_XP_THRESHOLDS[1]);

  const u = makeUnit({
    id: 99,
    kind: 'scout',
    level: 1,
    damage: UNIT_SPECS.scout.damage,
    maxHp: UNIT_SPECS.scout.maxHp,
    hp: UNIT_SPECS.scout.maxHp,
    xp: 0,
    kills: 0,
  });
  const baseDmg = u.damage;
  const r1 = applyUnitXpGain(u, UNIT_XP_THRESHOLDS[1] - 5);
  assert.equal(r1.leveledUp, false);
  assert.equal(u.level, 1);

  const r2 = applyUnitXpGain(u, 10);
  assert.equal(r2.leveledUp, true);
  assert.equal(r2.newLevel, 2);
  assert.ok(u.damage > baseDmg, 'Allied unit damage should increase upon leveling up from XP');

  // Full simulation: an ally kills enemies -> earns XP & levels up; then starting a new stage resets allies while Hero persists
  const sim = new GameSimulation();
  sim.resetWorld('playing', 1, 'archer');
  sim.essence = 500;
  assert.equal(sim.quickRecruitUnit('swordsman_ally'), true);
  const ally = sim.units[0];
  assert.equal(ally.level, 1);
  assert.equal(ally.xp, 0);

  // Boost hero XP so hero levels up above Lv.1
  sim.hero.xp = HERO_XP_THRESHOLDS[3] + 5;
  sim.hero.level = 4;
  sim.heroRoster.archer.level = 4;
  sim.heroRoster.archer.xp = sim.hero.xp;

  // Place low-HP enemies right next to the allied swordsman so the ally scores the kills
  const killsNeeded = 4;
  for (let k = 0; k < killsNeeded; k++) {
    sim.enemies.push({
      id: 9000 + k,
      kind: 'walker',
      x: ally.x + 25,
      y: ally.y,
      vx: 0,
      vy: 0,
      radius: 16,
      hp: 1,
      maxHp: 1,
      speed: 0,
      damage: 1,
      attackCooldown: 10,
      attackTimer: 10,
      attackAnim: 0,
      rewardEssence: 10,
      rewardScore: 20,
      xpReward: 20,
      walkPhase: 0,
      distanceTraveled: 0,
      routeIndex: 0,
      waypointIndex: 1,
      laneOffset: 0,
      pathProgress: 0.5,
      hitFlash: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      stunTimer: 0,
      koTimer: 0,
      isDead: false,
      bracingTimer: 0,
      lungeTimer: 0,
      lungeCooldown: 0,
    });
  }
  // Keep hero on cooldown so the ally definitely gets the kills
  sim.hero.cooldownTimer = 10;
  ally.cooldownTimer = 0;
  const allyDmgBefore = ally.damage;

  sim.update(0.05);

  assert.ok((ally.kills ?? 0) >= 4, `Ally should be credited for kills, got ${ally.kills}`);
  assert.ok((ally.xp ?? 0) >= 80, `Ally should earn XP from kills, got ${ally.xp}`);
  assert.ok(ally.level >= 2, `Ally should level up from kill XP, got Lv.${ally.level}`);
  assert.ok(ally.damage > allyDmgBefore, 'Ally should grow stronger after leveling up from kills');

  const persistedHeroLevel = sim.hero.level;
  assert.ok(persistedHeroLevel >= 4, 'Hero should have persistent level before stage change');

  // Start a new stage: allies reset completely to scratch, while Hero keeps its level!
  sim.resetWorld('playing', 2, 'archer');
  assert.equal(sim.units.length, 0, 'Allied units must be cleared at start of new stage');
  assert.equal(sim.maxUnitLevelReached, 1, 'Max allied unit level resets on new stage');
  assert.equal(sim.hero.level, persistedHeroLevel, 'Hero must retain its level on the new stage');

  sim.essence = 500;
  assert.equal(sim.quickRecruitUnit('swordsman_ally'), true);
  assert.equal(sim.units[0].level, 1, 'Newly deployed ally in new stage must start back at Level 1');
  assert.equal(sim.units[0].xp, 0, 'Newly deployed ally in new stage must start back at 0 XP');
});

test('Match start assigns a random pet by default, while watching simulated ad unlocks manual choice for that match', () => {
  const sim = new GameSimulation();
  assert.equal(sim.petChoiceUnlocked, false);

  // Start without watching ad -> pet is assigned randomly from PET_ORDER
  sim.resetWorld('playing', 1, 'archer');
  assert.equal(sim.petWasRandom, true);
  assert.ok(PET_ORDER.includes(sim.selectedPet));
  assert.equal(sim.getHudSnapshot().petWasRandom, true);
  assert.equal(sim.getHudSnapshot().petChoiceUnlocked, false);

  // Return to title, watch simulated ad, pick Owl -> next match uses Owl and consumes unlock
  sim.resetWorld('title', 1, 'archer');
  sim.unlockPetChoiceViaAd();
  assert.equal(sim.getHudSnapshot().petChoiceUnlocked, true);
  sim.setSelectedPet('owl');
  sim.resetWorld('playing', 2, 'archer');
  assert.equal(sim.selectedPet, 'owl');
  assert.equal(sim.petWasRandom, false);
  assert.equal(sim.petChoiceUnlocked, false, 'Ad unlock must be consumed after match starts');

  // Starting another match without watching a new ad rolls randomly again
  sim.resetWorld('playing', 3, 'archer');
  assert.equal(sim.petWasRandom, true);
  assert.ok(PET_ORDER.includes(sim.selectedPet));
});




