import {
  ArenaConfig,
  ArenaSlot,
  DEFAULT_ARENA,
  EnemyEntity,
  EnemyKind,
  HERO_SPECS,
  HERO_XP_THRESHOLDS,
  HeroClass,
  HeroEntity,
  MAX_HERO_LEVEL,
  MAX_UNIT_LEVEL,
  RouteWaypoint,
  StageConfig,
  StageRouteDefinition,
  TOTAL_STAGES,
  UNIT_SPECS,
  UnitEntity,
} from './types';

export const STAGE_ROUTES: ReadonlyArray<StageRouteDefinition> = [
  {
    stage: 1,
    title: 'Trilha da Clareira',
    routeArchetype: 'Trilha Reta',
    castleX: 1055,
    castleY: 410,
    waypoints: [
      { x: 96, y: 410 },
      { x: 380, y: 410 },
      { x: 580, y: 390 },
      { x: 780, y: 410 },
      { x: 1055, y: 410 },
    ],
    heroStartSlotId: 's1-5',
    slots: [
      { id: 's1-1', x: 215, y: 315, zone: 1, angle: Math.PI * 0.5 },
      { id: 's1-2', x: 215, y: 505, zone: 1, angle: -Math.PI * 0.5 },
      { id: 's1-3', x: 380, y: 310, zone: 2, angle: Math.PI * 0.5 },
      { id: 's1-4', x: 380, y: 510, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's1-5', x: 545, y: 295, zone: 2, angle: Math.PI * 0.5 },
      { id: 's1-6', x: 545, y: 495, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's1-7', x: 710, y: 300, zone: 3, angle: Math.PI * 0.5 },
      { id: 's1-8', x: 710, y: 505, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's1-9', x: 875, y: 315, zone: 4, angle: Math.PI * 0.5 },
      { id: 's1-10', x: 875, y: 505, zone: 4, angle: -Math.PI * 0.5 },
      { id: 's1-11', x: 465, y: 215, zone: 2, angle: Math.PI * 0.5 },
      { id: 's1-12', x: 635, y: 585, zone: 3, angle: -Math.PI * 0.5 },
    ],
  },
  {
    stage: 2,
    title: 'Curva das Brasas',
    routeArchetype: 'Curva em S',
    castleX: 1055,
    castleY: 360,
    waypoints: [
      { x: 96, y: 255 },
      { x: 365, y: 255 },
      { x: 420, y: 295 },
      { x: 420, y: 515 },
      { x: 475, y: 555 },
      { x: 725, y: 555 },
      { x: 780, y: 515 },
      { x: 780, y: 325 },
      { x: 835, y: 285 },
      { x: 1010, y: 295 },
      { x: 1055, y: 360 },
    ],
    heroStartSlotId: 's2-5',
    slots: [
      { id: 's2-1', x: 215, y: 170, zone: 1, angle: Math.PI * 0.5 },
      { id: 's2-2', x: 215, y: 345, zone: 1, angle: -Math.PI * 0.5 },
      { id: 's2-3', x: 325, y: 385, zone: 2, angle: 0 },
      { id: 's2-4', x: 325, y: 495, zone: 2, angle: 0 },
      { id: 's2-5', x: 525, y: 445, zone: 2, angle: Math.PI * 0.5 },
      { id: 's2-6', x: 600, y: 345, zone: 3, angle: 0 },
      { id: 's2-7', x: 675, y: 445, zone: 3, angle: 0 },
      { id: 's2-8', x: 595, y: 635, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's2-9', x: 880, y: 385, zone: 4, angle: Math.PI },
      { id: 's2-10', x: 880, y: 500, zone: 4, angle: Math.PI },
      { id: 's2-11', x: 925, y: 205, zone: 4, angle: Math.PI * 0.5 },
      { id: 's2-12', x: 515, y: 210, zone: 2, angle: Math.PI },
    ],
  },
  {
    stage: 3,
    title: 'Labirinto Sinuoso',
    routeArchetype: 'Labirinto Sinuoso',
    castleX: 1055,
    castleY: 435,
    waypoints: [
      { x: 96, y: 245 },
      { x: 255, y: 245 },
      { x: 295, y: 290 },
      { x: 295, y: 515 },
      { x: 340, y: 560 },
      { x: 505, y: 560 },
      { x: 550, y: 515 },
      { x: 550, y: 270 },
      { x: 595, y: 225 },
      { x: 765, y: 225 },
      { x: 810, y: 270 },
      { x: 810, y: 520 },
      { x: 855, y: 565 },
      { x: 1005, y: 555 },
      { x: 1055, y: 495 },
      { x: 1055, y: 435 },
    ],
    heroStartSlotId: 's3-6',
    slots: [
      { id: 's3-1', x: 195, y: 165, zone: 1, angle: Math.PI * 0.5 },
      { id: 's3-2', x: 195, y: 350, zone: 1, angle: 0 },
      { id: 's3-3', x: 195, y: 475, zone: 1, angle: 0 },
      { id: 's3-4', x: 390, y: 345, zone: 2, angle: Math.PI },
      { id: 's3-5', x: 390, y: 465, zone: 2, angle: 0 },
      { id: 's3-6', x: 465, y: 395, zone: 2, angle: 0 },
      { id: 's3-7', x: 435, y: 640, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's3-8', x: 645, y: 325, zone: 3, angle: Math.PI },
      { id: 's3-9', x: 645, y: 445, zone: 3, angle: Math.PI },
      { id: 's3-10', x: 720, y: 385, zone: 3, angle: 0 },
      { id: 's3-11', x: 705, y: 635, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's3-12', x: 915, y: 335, zone: 4, angle: Math.PI },
      { id: 's3-13', x: 915, y: 455, zone: 4, angle: Math.PI },
    ],
  },
  {
    stage: 4,
    title: 'Zigue-Zague Carmesim',
    routeArchetype: 'Zigue-Zague',
    castleX: 1055,
    castleY: 405,
    waypoints: [
      { x: 96, y: 245 },
      { x: 245, y: 245 },
      { x: 410, y: 555 },
      { x: 580, y: 245 },
      { x: 750, y: 555 },
      { x: 910, y: 265 },
      { x: 1055, y: 405 },
    ],
    heroStartSlotId: 's4-6',
    slots: [
      { id: 's4-1', x: 185, y: 345, zone: 1, angle: 0 },
      { id: 's4-2', x: 335, y: 215, zone: 1, angle: Math.PI * 0.5 },
      { id: 's4-3', x: 255, y: 475, zone: 2, angle: 0 },
      { id: 's4-4', x: 410, y: 405, zone: 2, angle: Math.PI * 0.5 },
      { id: 's4-5', x: 410, y: 640, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's4-6', x: 580, y: 395, zone: 3, angle: 0 },
      { id: 's4-7', x: 580, y: 525, zone: 3, angle: 0 },
      { id: 's4-8', x: 750, y: 405, zone: 3, angle: Math.PI * 0.5 },
      { id: 's4-9', x: 750, y: 640, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's4-10', x: 725, y: 215, zone: 3, angle: Math.PI * 0.5 },
      { id: 's4-11', x: 910, y: 430, zone: 4, angle: -Math.PI * 0.5 },
      { id: 's4-12', x: 935, y: 185, zone: 4, angle: Math.PI * 0.5 },
    ],
  },
  {
    stage: 5,
    title: 'Passo da Ferradura',
    routeArchetype: 'Arco em Ferradura',
    castleX: 1055,
    castleY: 565,
    waypoints: [
      { x: 96, y: 565 },
      { x: 245, y: 565 },
      { x: 245, y: 235 },
      { x: 905, y: 235 },
      { x: 905, y: 425 },
      { x: 540, y: 425 },
      { x: 540, y: 565 },
      { x: 1055, y: 565 },
    ],
    heroStartSlotId: 's5-5',
    slots: [
      { id: 's5-1', x: 155, y: 445, zone: 1, angle: 0 },
      { id: 's5-2', x: 155, y: 325, zone: 1, angle: 0 },
      { id: 's5-3', x: 340, y: 330, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's5-4', x: 340, y: 485, zone: 2, angle: Math.PI },
      { id: 's5-5', x: 445, y: 330, zone: 2, angle: 0 },
      { id: 's5-6', x: 635, y: 330, zone: 3, angle: 0 },
      { id: 's5-7', x: 795, y: 330, zone: 3, angle: 0 },
      { id: 's5-8', x: 435, y: 585, zone: 2, angle: 0 },
      { id: 's5-9', x: 685, y: 495, zone: 3, angle: Math.PI * 0.5 },
      { id: 's5-10', x: 830, y: 495, zone: 4, angle: Math.PI * 0.5 },
      { id: 's5-11', x: 995, y: 340, zone: 4, angle: Math.PI },
      { id: 's5-12', x: 540, y: 160, zone: 2, angle: Math.PI * 0.5 },
    ],
  },
  {
    stage: 6,
    title: 'Ondas Gêmeas',
    routeArchetype: 'Onda Dupla',
    castleX: 1055,
    castleY: 465,
    waypoints: [
      { x: 96, y: 485 },
      { x: 225, y: 485 },
      { x: 325, y: 245 },
      { x: 485, y: 245 },
      { x: 580, y: 500 },
      { x: 680, y: 245 },
      { x: 845, y: 245 },
      { x: 935, y: 465 },
      { x: 1055, y: 465 },
    ],
    heroStartSlotId: 's6-6',
    slots: [
      { id: 's6-1', x: 175, y: 385, zone: 1, angle: 0 },
      { id: 's6-2', x: 240, y: 575, zone: 1, angle: -Math.PI * 0.5 },
      { id: 's6-3', x: 395, y: 365, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's6-4', x: 410, y: 485, zone: 2, angle: 0 },
      { id: 's6-5', x: 405, y: 165, zone: 2, angle: Math.PI * 0.5 },
      { id: 's6-6', x: 580, y: 290, zone: 3, angle: Math.PI * 0.5 },
      { id: 's6-7', x: 580, y: 595, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's6-8', x: 760, y: 365, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's6-9', x: 750, y: 495, zone: 3, angle: 0 },
      { id: 's6-10', x: 765, y: 165, zone: 3, angle: Math.PI * 0.5 },
      { id: 's6-11', x: 940, y: 315, zone: 4, angle: Math.PI * 0.7 },
      { id: 's6-12', x: 935, y: 565, zone: 4, angle: -Math.PI * 0.5 },
    ],
  },
  {
    stage: 7,
    title: 'Serpente Dourada',
    routeArchetype: 'Serpente',
    castleX: 1055,
    castleY: 515,
    waypoints: [
      { x: 96, y: 540 },
      { x: 220, y: 540 },
      { x: 220, y: 245 },
      { x: 425, y: 245 },
      { x: 425, y: 540 },
      { x: 630, y: 540 },
      { x: 630, y: 245 },
      { x: 835, y: 245 },
      { x: 835, y: 515 },
      { x: 1055, y: 515 },
    ],
    heroStartSlotId: 's7-6',
    slots: [
      { id: 's7-1', x: 135, y: 420, zone: 1, angle: 0 },
      { id: 's7-2', x: 135, y: 300, zone: 1, angle: 0 },
      { id: 's7-3', x: 322, y: 335, zone: 2, angle: 0 },
      { id: 's7-4', x: 322, y: 455, zone: 2, angle: 0 },
      { id: 's7-5', x: 322, y: 575, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's7-6', x: 528, y: 335, zone: 3, angle: 0 },
      { id: 's7-7', x: 528, y: 455, zone: 3, angle: 0 },
      { id: 's7-8', x: 528, y: 215, zone: 3, angle: Math.PI * 0.5 },
      { id: 's7-9', x: 732, y: 335, zone: 3, angle: 0 },
      { id: 's7-10', x: 732, y: 455, zone: 3, angle: 0 },
      { id: 's7-11', x: 732, y: 575, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's7-12', x: 930, y: 340, zone: 4, angle: Math.PI },
      { id: 's7-13', x: 930, y: 430, zone: 4, angle: Math.PI * 0.5 },
    ],
  },
  {
    stage: 8,
    title: 'Desfiladeiro Sombrio',
    routeArchetype: 'Desfiladeiro',
    castleX: 1055,
    castleY: 405,
    waypoints: [
      { x: 96, y: 225 },
      { x: 660, y: 225 },
      { x: 705, y: 270 },
      { x: 505, y: 425 },
      { x: 265, y: 565 },
      { x: 795, y: 565 },
      { x: 865, y: 405 },
      { x: 1055, y: 405 },
    ],
    heroStartSlotId: 's8-5',
    slots: [
      { id: 's8-1', x: 215, y: 315, zone: 1, angle: -Math.PI * 0.5 },
      { id: 's8-2', x: 375, y: 315, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's8-3', x: 530, y: 305, zone: 2, angle: 0 },
      { id: 's8-4', x: 230, y: 455, zone: 2, angle: 0 },
      { id: 's8-5', x: 545, y: 490, zone: 3, angle: Math.PI * 0.5 },
      { id: 's8-6', x: 705, y: 475, zone: 3, angle: 0 },
      { id: 's8-7', x: 785, y: 325, zone: 3, angle: Math.PI },
      { id: 's8-8', x: 405, y: 640, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's8-9', x: 675, y: 640, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's8-10', x: 935, y: 315, zone: 4, angle: Math.PI * 0.5 },
      { id: 's8-11', x: 935, y: 500, zone: 4, angle: -Math.PI * 0.5 },
      { id: 's8-12', x: 405, y: 150, zone: 2, angle: Math.PI * 0.5 },
    ],
  },
  {
    stage: 9,
    title: 'Escadaria Real',
    routeArchetype: 'Escadaria',
    castleX: 1055,
    castleY: 395,
    waypoints: [
      { x: 96, y: 575 },
      { x: 275, y: 575 },
      { x: 275, y: 470 },
      { x: 475, y: 470 },
      { x: 475, y: 365 },
      { x: 680, y: 365 },
      { x: 680, y: 255 },
      { x: 905, y: 255 },
      { x: 905, y: 395 },
      { x: 1055, y: 395 },
    ],
    heroStartSlotId: 's9-6',
    slots: [
      { id: 's9-1', x: 185, y: 485, zone: 1, angle: Math.PI * 0.5 },
      { id: 's9-2', x: 365, y: 555, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's9-3', x: 375, y: 380, zone: 2, angle: Math.PI * 0.5 },
      { id: 's9-4', x: 565, y: 455, zone: 2, angle: -Math.PI * 0.5 },
      { id: 's9-5', x: 580, y: 275, zone: 3, angle: Math.PI * 0.5 },
      { id: 's9-6', x: 775, y: 345, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's9-7', x: 775, y: 465, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's9-8', x: 790, y: 175, zone: 3, angle: Math.PI * 0.5 },
      { id: 's9-9', x: 990, y: 300, zone: 4, angle: Math.PI },
      { id: 's9-10', x: 935, y: 495, zone: 4, angle: -Math.PI * 0.5 },
      { id: 's9-11', x: 265, y: 370, zone: 1, angle: Math.PI * 0.5 },
      { id: 's9-12', x: 475, y: 265, zone: 2, angle: Math.PI * 0.5 },
    ],
  },
  {
    stage: 10,
    title: 'Cerco do Imperador',
    routeArchetype: 'Cerco Final',
    castleX: 1055,
    castleY: 435,
    waypoints: [
      { x: 96, y: 395 },
      { x: 220, y: 395 },
      { x: 220, y: 225 },
      { x: 450, y: 225 },
      { x: 450, y: 565 },
      { x: 665, y: 565 },
      { x: 665, y: 230 },
      { x: 870, y: 230 },
      { x: 870, y: 545 },
      { x: 1005, y: 530 },
      { x: 1055, y: 435 },
    ],
    heroStartSlotId: 's10-6',
    slots: [
      { id: 's10-1', x: 135, y: 295, zone: 1, angle: 0 },
      { id: 's10-2', x: 145, y: 495, zone: 1, angle: -Math.PI * 0.5 },
      { id: 's10-3', x: 335, y: 315, zone: 2, angle: 0 },
      { id: 's10-4', x: 335, y: 435, zone: 2, angle: 0 },
      { id: 's10-5', x: 335, y: 565, zone: 2, angle: 0 },
      { id: 's10-6', x: 558, y: 325, zone: 3, angle: 0 },
      { id: 's10-7', x: 558, y: 455, zone: 3, angle: 0 },
      { id: 's10-8', x: 558, y: 215, zone: 3, angle: Math.PI * 0.5 },
      { id: 's10-9', x: 768, y: 325, zone: 3, angle: 0 },
      { id: 's10-10', x: 768, y: 455, zone: 3, angle: 0 },
      { id: 's10-11', x: 768, y: 575, zone: 3, angle: -Math.PI * 0.5 },
      { id: 's10-12', x: 960, y: 320, zone: 4, angle: Math.PI },
      { id: 's10-13', x: 955, y: 430, zone: 4, angle: Math.PI },
    ],
  },
];

export function getStageRouteDefinition(stageNumber: number): StageRouteDefinition {
  const stage = Math.max(1, Math.min(TOTAL_STAGES, Math.floor(stageNumber)));
  return STAGE_ROUTES[stage - 1] ?? STAGE_ROUTES[0];
}

export function buildArenaForStage(stageNumber: number): ArenaConfig {
  const route = getStageRouteDefinition(stageNumber);
  return {
    stage: route.stage,
    worldWidth: DEFAULT_ARENA.worldWidth,
    worldHeight: DEFAULT_ARENA.worldHeight,
    centerX: DEFAULT_ARENA.centerX,
    centerY: DEFAULT_ARENA.centerY,
    castleX: route.castleX,
    castleY: route.castleY,
    castleRadius: DEFAULT_ARENA.castleRadius,
    roadHalfWidth: DEFAULT_ARENA.roadHalfWidth,
    waypoints: route.waypoints,
  };
}

export function getStageConfig(stageNumber: number): StageConfig {
  const stage = Math.max(1, Math.min(TOTAL_STAGES, Math.floor(stageNumber)));
  const route = getStageRouteDefinition(stage);
  const totalWaves = stage === 1 ? 2 : stage <= 4 ? 3 : stage <= 8 ? 4 : 5;
  return {
    stage,
    title: route.title,
    routeArchetype: route.routeArchetype,
    totalWaves,
    baseEnemiesPerWave: 6 + stage * 2,
    hpMultiplier: 1 + (stage - 1) * 0.21,
    speedMultiplier: Math.min(1.48, 1 + (stage - 1) * 0.045),
    spawnInterval: Math.max(0.46, 1.3 - (stage - 1) * 0.075),
    bossHp: Math.round(280 + (stage - 1) * 140),
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

export function buildArenaSlots(arena: ArenaConfig = DEFAULT_ARENA): ArenaSlot[] {
  const route = getStageRouteDefinition(arena.stage);
  return route.slots.map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    ring: c.zone,
    angle: c.angle,
    radius: 28,
    unitId: null,
    hasHero: false,
  }));
}

export function getHeroLevelFromXp(xp: number): number {
  const safeXp = Math.max(0, xp);
  let lvl = 1;
  for (let i = 1; i < HERO_XP_THRESHOLDS.length; i++) {
    if (safeXp >= HERO_XP_THRESHOLDS[i]) {
      lvl = i + 1;
    }
  }
  return Math.min(MAX_HERO_LEVEL, lvl);
}

export function getHeroXpBounds(level: number): { currentFloor: number; nextThreshold: number } {
  const clamped = Math.max(1, Math.min(MAX_HERO_LEVEL, level));
  const currentFloor = HERO_XP_THRESHOLDS[clamped - 1] ?? 0;
  const nextThreshold =
    clamped >= MAX_HERO_LEVEL
      ? currentFloor
      : HERO_XP_THRESHOLDS[clamped] ?? currentFloor + 100;
  return { currentFloor, nextThreshold };
}

export function getHeroStatsForLevel(
  heroClass: HeroClass,
  level: number
): {
  damage: number;
  cooldown: number;
  range: number;
  critChance: number;
  blastRadius: number;
} {
  const spec = HERO_SPECS[heroClass];
  const delta = Math.max(0, Math.min(MAX_HERO_LEVEL, level) - 1);
  return {
    damage: Math.round(spec.damage * Math.pow(1.34, delta)),
    cooldown: Math.max(0.2, Number((spec.cooldown * Math.pow(0.91, delta)).toFixed(3))),
    range: Math.round(spec.range * (1 + delta * 0.06)),
    critChance: Math.min(0.68, Number((spec.critChance + delta * 0.045).toFixed(3))),
    blastRadius:
      spec.blastRadius > 0 ? Math.round(spec.blastRadius * (1 + delta * 0.08)) : 0,
  };
}

export function applyHeroXpGain(
  hero: HeroEntity,
  gainedXp: number
): { leveledUp: boolean; previousLevel: number; newLevel: number; isMaxReached: boolean } {
  const prev = hero.level;
  hero.xp += Math.max(0, gainedXp);
  const nextLevel = getHeroLevelFromXp(hero.xp);
  if (nextLevel > prev) {
    hero.level = nextLevel;
    const stats = getHeroStatsForLevel(hero.heroClass, nextLevel);
    hero.damage = stats.damage;
    hero.cooldown = stats.cooldown;
    hero.range = stats.range;
    hero.critChance = stats.critChance;
    hero.blastRadius = stats.blastRadius;
    hero.levelUpFlash = 1.25;
    hero.attackAnim = 1;
    return {
      leveledUp: true,
      previousLevel: prev,
      newLevel: nextLevel,
      isMaxReached: nextLevel >= MAX_HERO_LEVEL,
    };
  }
  return {
    leveledUp: false,
    previousLevel: prev,
    newLevel: prev,
    isMaxReached: false,
  };
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
  const start = waypoints[0] ?? { x: 96, y: 410 };
  const next = waypoints[1] ?? { x: 380, y: 410 };
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
  const spawnInterval = Math.max(0.38, stageCfg.spawnInterval - (clampedWave - 1) * 0.075);
  const hpMultiplier = stageCfg.hpMultiplier * (1 + (clampedWave - 1) * 0.18);
  const speedMultiplier = Math.min(1.58, stageCfg.speedMultiplier + (clampedWave - 1) * 0.035);

  // Smooth spaced introduction of armored & brute enemies across waves and stages
  const bruteWeight =
    stage === 1 && clampedWave === 1
      ? 0
      : Math.min(0.32, 0.07 + (stage - 1) * 0.028 + (clampedWave - 1) * 0.045);
  const shieldedWeight =
    stage === 1 && clampedWave === 1
      ? 0.16
      : Math.min(0.38, 0.2 + (stage - 1) * 0.02 + (clampedWave - 1) * 0.04);
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
