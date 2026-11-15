import {
  ArenaConfig,
  ArenaSlot,
  DEFAULT_ARENA,
  EnemyEntity,
  EnemyKind,
  MAX_UNIT_LEVEL,
  RouteWaypoint,
  StageConfig,
  TOTAL_STAGES,
  UNIT_SPECS,
  UnitEntity,
} from './types';

const STAGE_TITLES = [
  'Trilha da Clareira',
  'Estrada Dourada',
  'Curva dos Pinheiros',
  'Desfiladeiro Verde',
  'Passo da Fronteira',
  'Rota das Brasas',
  'Colina do Vigia',
  'Marcha da Horda',
  'Muralha do Vale',
  'Cerco ao Castelo',
];

export function getStageConfig(stageNumber: number): StageConfig {
  const stage = Math.max(1, Math.min(TOTAL_STAGES, Math.floor(stageNumber)));
  const totalWaves = stage === 1 ? 2 : stage <= 4 ? 3 : stage <= 8 ? 4 : 5;
  return {
    stage,
    title: STAGE_TITLES[stage - 1] ?? `Fase ${stage}`,
    totalWaves,
    baseEnemiesPerWave: 6 + stage * 2,
    hpMultiplier: 1 + (stage - 1) * 0.22,
    speedMultiplier: Math.min(1.52, 1 + (stage - 1) * 0.05),
    spawnInterval: Math.max(0.45, 1.32 - (stage - 1) * 0.08),
    bossHp: Math.round(280 + (stage - 1) * 145),
  };
}

export function computeViewportTransform(
  cssWidth: number,
  cssHeight: number,
  arena: ArenaConfig = DEFAULT_ARENA
): { scale: number; offsetX: number; offsetY: number } {
  const safeW = Math.max(240, cssWidth);
  const safeH = Math.max(240, cssHeight);
  const isPortrait = safeH > safeW;
  if (isPortrait) {
    const scale = Math.min(safeW / 1140, safeH / 840);
    return {
      scale,
      offsetX: safeW * 0.5 - arena.centerX * scale,
      offsetY: safeH * 0.5 - arena.centerY * scale,
    };
  }
  const scale = Math.min(safeW / arena.worldWidth, safeH / arena.worldHeight);
  return {
    scale,
    offsetX: (safeW - arena.worldWidth * scale) * 0.5,
    offsetY: (safeH - arena.worldHeight * scale) * 0.5,
  };
}

export function unlockNextStage(completedStage: number, currentHighest: number): number {
  const next = Math.min(TOTAL_STAGES, completedStage + 1);
  return Math.max(currentHighest, next);
}

export function formatSurvivalTime(totalSeconds: number): string {
  const secs = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export function buildArenaSlots(_arena: ArenaConfig = DEFAULT_ARENA): ArenaSlot[] {
  const coords: Array<{ id: string; x: number; y: number; zone: number; angle: number }> = [
    { id: 's-1', x: 195, y: 195, zone: 1, angle: Math.PI * 0.45 },
    { id: 's-2', x: 195, y: 365, zone: 1, angle: 0 },
    { id: 's-3', x: 195, y: 485, zone: 1, angle: 0 },
    { id: 's-4', x: 385, y: 345, zone: 2, angle: Math.PI },
    { id: 's-5', x: 385, y: 465, zone: 2, angle: Math.PI * 0.5 },
    { id: 's-6', x: 475, y: 395, zone: 2, angle: 0 },
    { id: 's-7', x: 440, y: 640, zone: 2, angle: -Math.PI * 0.5 },
    { id: 's-8', x: 480, y: 185, zone: 2, angle: Math.PI * 0.25 },
    { id: 's-9', x: 670, y: 325, zone: 3, angle: -Math.PI * 0.5 },
    { id: 's-10', x: 670, y: 445, zone: 3, angle: Math.PI },
    { id: 's-11', x: 755, y: 385, zone: 3, angle: 0 },
    { id: 's-12', x: 715, y: 630, zone: 3, angle: -Math.PI * 0.45 },
    { id: 's-13', x: 950, y: 330, zone: 4, angle: Math.PI },
    { id: 's-14', x: 950, y: 455, zone: 4, angle: Math.PI * 0.6 },
    { id: 's-15', x: 955, y: 625, zone: 4, angle: -Math.PI * 0.5 },
  ];

  return coords.map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    ring: c.zone,
    angle: c.angle,
    radius: 28,
    unitId: null,
  }));
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq <= 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

export function computeRouteTotalLength(waypoints: ReadonlyArray<RouteWaypoint>): number {
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    total += distanceBetween(waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y);
  }
  return total;
}

export function computeRouteSpawnPoint(
  waypoints: ReadonlyArray<RouteWaypoint>,
  laneOffset = 0
): { x: number; y: number; angle: number } {
  const start = waypoints[0] ?? { x: 96, y: 265 };
  const next = waypoints[1] ?? { x: 245, y: 265 };
  const dx = next.x - start.x;
  const dy = next.y - start.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  return {
    x: start.x + nx * laneOffset,
    y: start.y + ny * laneOffset,
    angle: Math.atan2(dy, dx),
  };
}

export function computeRemainingPathDistance(
  enemy: Pick<EnemyEntity, 'x' | 'y' | 'waypointIndex'>,
  waypoints: ReadonlyArray<RouteWaypoint>
): number {
  if (waypoints.length === 0) return 0;
  const idx = Math.max(1, Math.min(waypoints.length - 1, enemy.waypointIndex));
  let dist = distanceBetween(enemy.x, enemy.y, waypoints[idx].x, waypoints[idx].y);
  for (let i = idx; i < waypoints.length - 1; i++) {
    dist += distanceBetween(waypoints[i].x, waypoints[i].y, waypoints[i + 1].x, waypoints[i + 1].y);
  }
  return dist;
}

export function advanceEnemyAlongRoute(
  enemy: Pick<
    EnemyEntity,
    'x' | 'y' | 'vx' | 'vy' | 'waypointIndex' | 'laneOffset' | 'distanceTraveled' | 'pathProgress' | 'walkPhase'
  >,
  waypoints: ReadonlyArray<RouteWaypoint>,
  stepDist: number,
  speedScalar: number,
  totalLength: number
): { reachedCastle: boolean; remainingPathDistance: number } {
  if (waypoints.length < 2) {
    return { reachedCastle: true, remainingPathDistance: 0 };
  }

  let remainingMove = Math.max(0, stepDist);
  let wpIdx = Math.max(1, Math.min(waypoints.length - 1, enemy.waypointIndex));
  let curX = enemy.x;
  let curY = enemy.y;
  let lastDirX = 1;
  let lastDirY = 0;

  while (remainingMove > 0 && wpIdx < waypoints.length) {
    const prev = waypoints[wpIdx - 1];
    const target = waypoints[wpIdx];
    const segDx = target.x - prev.x;
    const segDy = target.y - prev.y;
    const segLen = Math.hypot(segDx, segDy) || 1;
    const perpX = -segDy / segLen;
    const perpY = segDx / segLen;
    const isFinalNode = wpIdx === waypoints.length - 1;
    const offset = isFinalNode ? 0 : enemy.laneOffset;
    const tx = target.x + perpX * offset;
    const ty = target.y + perpY * offset;

    const dx = tx - curX;
    const dy = ty - curY;
    const distToWp = Math.hypot(dx, dy);

    if (distToWp <= remainingMove) {
      curX = tx;
      curY = ty;
      remainingMove -= distToWp;
      lastDirX = distToWp > 0.01 ? dx / distToWp : segDx / segLen;
      lastDirY = distToWp > 0.01 ? dy / distToWp : segDy / segLen;
      if (isFinalNode) {
        enemy.x = curX;
        enemy.y = curY;
        enemy.vx = lastDirX * speedScalar;
        enemy.vy = lastDirY * speedScalar;
        enemy.waypointIndex = wpIdx;
        enemy.distanceTraveled += stepDist;
        enemy.walkPhase = enemy.distanceTraveled * 0.14;
        enemy.pathProgress = 1;
        return { reachedCastle: true, remainingPathDistance: 0 };
      }
      wpIdx += 1;
    } else {
      const nx = dx / (distToWp || 1);
      const ny = dy / (distToWp || 1);
      curX += nx * remainingMove;
      curY += ny * remainingMove;
      lastDirX = nx;
      lastDirY = ny;
      remainingMove = 0;
    }
  }

  enemy.x = curX;
  enemy.y = curY;
  enemy.vx = lastDirX * speedScalar;
  enemy.vy = lastDirY * speedScalar;
  enemy.waypointIndex = wpIdx;
  enemy.distanceTraveled += stepDist;
  enemy.walkPhase = enemy.distanceTraveled * 0.14;

  const remDist = computeRemainingPathDistance(enemy, waypoints);
  enemy.pathProgress = totalLength > 0 ? Math.max(0, Math.min(1, 1 - remDist / totalLength)) : 0;

  return {
    reachedCastle: wpIdx >= waypoints.length - 1 && remDist <= 14,
    remainingPathDistance: remDist,
  };
}

export function pushEnemyBackAlongRoute(
  enemy: Pick<EnemyEntity, 'x' | 'y' | 'waypointIndex' | 'laneOffset' | 'pathProgress'>,
  waypoints: ReadonlyArray<RouteWaypoint>,
  pushDist: number,
  totalLength: number
) {
  if (waypoints.length < 2 || pushDist <= 0) return;

  let remainingPush = pushDist;
  let wpIdx = Math.max(1, Math.min(waypoints.length - 1, enemy.waypointIndex));
  let curX = enemy.x;
  let curY = enemy.y;

  while (remainingPush > 0 && wpIdx >= 1) {
    const prev = waypoints[wpIdx - 1];
    const target = waypoints[wpIdx];
    const segDx = target.x - prev.x;
    const segDy = target.y - prev.y;
    const segLen = Math.hypot(segDx, segDy) || 1;
    const perpX = -segDy / segLen;
    const perpY = segDx / segLen;
    const prevOffset = wpIdx - 1 === 0 ? 0 : enemy.laneOffset;
    const backX = prev.x + perpX * prevOffset;
    const backY = prev.y + perpY * prevOffset;

    const dx = backX - curX;
    const dy = backY - curY;
    const distToPrev = Math.hypot(dx, dy);

    if (distToPrev <= remainingPush) {
      curX = backX;
      curY = backY;
      remainingPush -= distToPrev;
      if (wpIdx === 1) {
        remainingPush = 0;
      } else {
        wpIdx -= 1;
      }
    } else {
      curX += (dx / (distToPrev || 1)) * remainingPush;
      curY += (dy / (distToPrev || 1)) * remainingPush;
      remainingPush = 0;
    }
  }

  enemy.x = curX;
  enemy.y = curY;
  enemy.waypointIndex = wpIdx;
  const remDist = computeRemainingPathDistance(enemy, waypoints);
  enemy.pathProgress = totalLength > 0 ? Math.max(0, Math.min(1, 1 - remDist / totalLength)) : 0;
}

export function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function circlesCollide(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const minSum = r1 + r2;
  return dx * dx + dy * dy <= minSum * minSum;
}

export function rollCriticalHit(
  baseDamage: number,
  critChance: number,
  rngValue: number = Math.random()
): { damage: number; isCrit: boolean } {
  const isCrit = rngValue < critChance;
  return {
    damage: isCrit ? Math.round(baseDamage * 1.75) : baseDamage,
    isCrit,
  };
}

export function computeRadialKnockbackVector(
  originX: number,
  originY: number,
  targetX: number,
  targetY: number,
  impulse: number
): { vx: number; vy: number } {
  const dx = targetX - originX;
  const dy = targetY - originY;
  const dist = Math.hypot(dx, dy) || 1;
  return {
    vx: (dx / dist) * impulse,
    vy: (dy / dist) * impulse,
  };
}

export function findNearestEnemyInRange(
  unit: Pick<UnitEntity, 'x' | 'y' | 'range'>,
  enemies: ReadonlyArray<EnemyEntity>,
  _arena: ArenaConfig = DEFAULT_ARENA
): EnemyEntity | null {
  let bestEnemy: EnemyEntity | null = null;
  let bestProgress = -1;
  let bestDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.isDead || enemy.hp <= 0) continue;
    const distFromUnit = distanceBetween(unit.x, unit.y, enemy.x, enemy.y);
    if (distFromUnit > unit.range + enemy.radius) continue;

    // Prioritize enemy furthest along the path toward the Castle
    if (
      enemy.pathProgress > bestProgress + 0.002 ||
      (Math.abs(enemy.pathProgress - bestProgress) <= 0.002 && distFromUnit < bestDist)
    ) {
      bestProgress = enemy.pathProgress;
      bestDist = distFromUnit;
      bestEnemy = enemy;
    }
  }

  return bestEnemy;
}

export function findEnemiesInSlashArc(
  originX: number,
  originY: number,
  slashAngle: number,
  slashRadius: number,
  arcHalfAngle: number,
  enemies: ReadonlyArray<EnemyEntity>
): EnemyEntity[] {
  const hit: EnemyEntity[] = [];
  for (const enemy of enemies) {
    if (enemy.isDead || enemy.hp <= 0) continue;
    const dx = enemy.x - originX;
    const dy = enemy.y - originY;
    const dist = Math.hypot(dx, dy);
    if (dist > slashRadius + enemy.radius) continue;

    const angleToEnemy = Math.atan2(dy, dx);
    let diff = angleToEnemy - slashAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) <= arcHalfAngle || dist <= enemy.radius + 16) {
      hit.push(enemy);
    }
  }
  return hit;
}

export function applyDamageToEnemy(
  enemy: EnemyEntity,
  rawDamage: number
): { actualDamage: number; killed: boolean } {
  if (enemy.isDead || enemy.hp <= 0) {
    return { actualDamage: 0, killed: false };
  }
  const mitigation = enemy.kind === 'shielded' && enemy.bracingTimer > 0 ? 0.55 : 1;
  const actualDamage = Math.max(1, Math.round(rawDamage * mitigation));
  enemy.hp = Math.max(0, enemy.hp - actualDamage);
  enemy.hitFlash = 0.08;

  if (enemy.hp <= 0) {
    enemy.isDead = true;
    enemy.koTimer = enemy.kind === 'boss' ? 0.55 : 0.32;
    return { actualDamage, killed: true };
  }
  return { actualDamage, killed: false };
}

export function applyDamageToUnit(
  unit: UnitEntity,
  damage: number
): { actualDamage: number; destroyed: boolean } {
  if (unit.hp <= 0) return { actualDamage: 0, destroyed: true };
  const actualDamage = Math.max(1, Math.round(damage));
  unit.hp = Math.max(0, unit.hp - actualDamage);
  unit.hitFlash = 0.1;
  return {
    actualDamage,
    destroyed: unit.hp <= 0,
  };
}

export function findBlockingUnitForEnemy(
  enemy: Pick<EnemyEntity, 'x' | 'y' | 'radius'>,
  units: ReadonlyArray<UnitEntity>
): UnitEntity | null {
  let closest: UnitEntity | null = null;
  let closestDist = Infinity;

  for (const unit of units) {
    if (unit.hp <= 0) continue;
    const blockRadius = unit.kind === 'shield' ? 30 : 24;
    const dist = distanceBetween(enemy.x, enemy.y, unit.x, unit.y);
    if (dist <= enemy.radius + blockRadius && dist < closestDist) {
      closestDist = dist;
      closest = unit;
    }
  }

  return closest;
}

export function canMergeUnits(
  source: Pick<UnitEntity, 'id' | 'kind' | 'level'>,
  target: Pick<UnitEntity, 'id' | 'kind' | 'level'>
): boolean {
  if (source.id === target.id) return false;
  if (source.kind !== target.kind) return false;
  if (source.level !== target.level) return false;
  if (target.level >= MAX_UNIT_LEVEL) return false;
  return true;
}

export function applyMergeUpgrade(target: UnitEntity): UnitEntity {
  const nextLevel = Math.min(MAX_UNIT_LEVEL, target.level + 1);
  const spec = UNIT_SPECS[target.kind];
  const levelDelta = nextLevel - 1;

  target.level = nextLevel;
  target.damage = Math.round(spec.damage * Math.pow(1.75, levelDelta));
  target.maxHp = Math.round(spec.maxHp * Math.pow(1.65, levelDelta));
  target.hp = target.maxHp;
  target.cooldown = Math.max(0.28, Number((spec.cooldown * Math.pow(0.86, levelDelta)).toFixed(3)));
  target.range = Math.round(spec.range * (1 + levelDelta * 0.08));
  target.critChance = Math.min(0.6, spec.critChance + levelDelta * 0.04);
  target.attackAnim = 1;
  return target;
}

export function applyDamageToBase(
  currentHp: number,
  damage: number
): { nextHp: number; isGameOver: boolean } {
  const nextHp = Math.max(0, Math.round(currentHp - Math.max(0, damage)));
  return {
    nextHp,
    isGameOver: nextHp <= 0,
  };
}

export function computeWaveConfig(
  wave: number,
  stage = 1
): {
  totalEnemies: number;
  spawnInterval: number;
  hpMultiplier: number;
  speedMultiplier: number;
  isBossWave: boolean;
  bossHp: number;
  mix: Record<Exclude<EnemyKind, 'boss'>, number>;
} {
  const stageCfg = getStageConfig(stage);
  const clampedWave = Math.max(1, wave);
  const totalEnemies = stageCfg.baseEnemiesPerWave + (clampedWave - 1) * 3;
  const spawnInterval = Math.max(0.36, stageCfg.spawnInterval - (clampedWave - 1) * 0.08);
  const hpMultiplier = stageCfg.hpMultiplier * (1 + (clampedWave - 1) * 0.18);
  const speedMultiplier = Math.min(1.6, stageCfg.speedMultiplier + (clampedWave - 1) * 0.04);

  const bruteWeight =
    stage >= 2 || clampedWave >= 2 ? Math.min(0.32, 0.08 + (stage - 1) * 0.03 + (clampedWave - 1) * 0.05) : 0.08;
  const shieldedWeight = Math.min(0.4, 0.22 + (stage - 1) * 0.02 + (clampedWave - 1) * 0.04);
  const walkerWeight = Math.max(0.28, 1 - bruteWeight - shieldedWeight);

  return {
    totalEnemies,
    spawnInterval,
    hpMultiplier,
    speedMultiplier,
    isBossWave: clampedWave >= stageCfg.totalWaves,
    bossHp: stageCfg.bossHp,
    mix: {
      walker: walkerWeight,
      shielded: shieldedWeight,
      brute: bruteWeight,
    },
  };
}

export function findSlotAtPoint(
  worldX: number,
  worldY: number,
  slots: ReadonlyArray<ArenaSlot>
): ArenaSlot | null {
  for (const slot of slots) {
    if (distanceBetween(worldX, worldY, slot.x, slot.y) <= slot.radius + 14) {
      return slot;
    }
  }
  return null;
}
