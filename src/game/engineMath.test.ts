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
  buildArenaForStage,
  buildArenaSlots,
  canMergeUnits,
  circlesCollide,
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

test('applyMergeUpgrade scales fighter power drastically faster than Hero levels', () => {
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
  assert.ok(
    unit.damage >= lv1Dmg * 3.5,
    `Merged Lv.3 unit dmg (${unit.damage}) should be >= 3.5x Lv.1 (${lv1Dmg})`
  );
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

