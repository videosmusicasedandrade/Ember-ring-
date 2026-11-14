import {
  ArenaConfig,
  ArenaSlot,
  DEFAULT_ARENA,
  EnemyEntity,
  EnemyKind,
  MAX_UNIT_LEVEL,
  StageConfig,
  TOTAL_STAGES,
  UNIT_SPECS,
  UnitEntity,
} from './types';

const STAGE_TITLES = [
  'Clareira Inicial',
  'Trilha Dourada',
  'Orla dos Pinheiros',
  'Cerco do Vale',
  'Acampamento Sombrio',
  'Anel de Brasas',
  'Fronteira Selvagem',
  'Noite da Horda',
  'Bastião da Floresta',
  'Cidadela Final',
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
    spawnInterval: Math.max(0.42, 1.3 - (stage - 1) * 0.08),
    bossHp: Math.round(260 + (stage - 1) * 140),
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
    const scale = Math.min(safeW / 720, safeH / 940);
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

export function buildArenaSlots(arena: ArenaConfig = DEFAULT_ARENA): ArenaSlot[] {
  const slots: ArenaSlot[] = [];
  const ringConfigs = [
    { ring: 1, radius: 102, count: 6, angleOffset: -Math.PI / 6 },
    { ring: 2, radius: 184, count: 10, angleOffset: 0 },
  ];

  for (const cfg of ringConfigs) {
    for (let i = 0; i < cfg.count; i++) {
      const angle = cfg.angleOffset + (i / cfg.count) * Math.PI * 2;
      slots.push({
        id: `r${cfg.ring}-${i}`,
        x: Math.round(arena.centerX + Math.cos(angle) * cfg.radius),
        y: Math.round(arena.centerY + Math.sin(angle) * cfg.radius),
        ring: cfg.ring,
        angle,
        radius: 28,
        unitId: null,
      });
    }
  }

  return slots;
}

export function computePerimeterSpawnPoint(
  angleRadians: number,
  arena: ArenaConfig = DEFAULT_ARENA,
  jitterRadius = 0
): { x: number; y: number } {
  const r = arena.spawnRadius + jitterRadius;
  return {
    x: arena.centerX + Math.cos(angleRadians) * r,
    y: arena.centerY + Math.sin(angleRadians) * r,
  };
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
  arena: ArenaConfig = DEFAULT_ARENA
): EnemyEntity | null {
  let bestEnemy: EnemyEntity | null = null;
  let bestScore = Infinity;

  for (const enemy of enemies) {
    if (enemy.isDead || enemy.hp <= 0) continue;
    const distFromUnit = distanceBetween(unit.x, unit.y, enemy.x, enemy.y);
    if (distFromUnit > unit.range + enemy.radius) continue;

    const distToCore = distanceBetween(enemy.x, enemy.y, arena.centerX, arena.centerY);
    const priorityScore = distToCore * 0.75 + distFromUnit * 0.25;
    if (priorityScore < bestScore) {
      bestScore = priorityScore;
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
