export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type UnitKind = 'scout' | 'shield' | 'frog';

export type EnemyKind = 'walker' | 'shielded' | 'brute' | 'boss';

export type SpellKind = 'blade' | 'shockwave' | 'overcharge';

export type ParticleKind = 'circle' | 'smoke' | 'grass' | 'spark';

export const MAX_UNIT_LEVEL = 4;
export const TOTAL_STAGES = 10;

export interface RouteWaypoint {
  x: number;
  y: number;
}

export interface StageConfig {
  stage: number;
  title: string;
  totalWaves: number;
  baseEnemiesPerWave: number;
  hpMultiplier: number;
  speedMultiplier: number;
  spawnInterval: number;
  bossHp: number;
}

export interface ArenaConfig {
  worldWidth: number;
  worldHeight: number;
  centerX: number;
  centerY: number;
  castleX: number;
  castleY: number;
  castleRadius: number;
  roadHalfWidth: number;
  waypoints: ReadonlyArray<RouteWaypoint>;
}

export interface ArenaSlot {
  id: string;
  x: number;
  y: number;
  ring: number;
  angle: number;
  radius: number;
  unitId: number | null;
}

export interface UnitSpec {
  kind: UnitKind;
  name: string;
  shortRole: string;
  role: string;
  cost: number;
  maxHp: number;
  range: number;
  damage: number;
  cooldown: number;
  critChance: number;
  color: string;
  accentColor: string;
  hotkey: string;
}

export interface UnitEntity {
  id: number;
  kind: UnitKind;
  slotId: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  cooldown: number;
  cooldownTimer: number;
  critChance: number;
  facingAngle: number;
  attackAnim: number;
  recoil: number;
  hitFlash: number;
  level: number;
}

export interface EnemyEntity {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackCooldown: number;
  attackTimer: number;
  attackAnim: number;
  rewardEssence: number;
  rewardScore: number;
  walkPhase: number;
  distanceTraveled: number;
  waypointIndex: number;
  laneOffset: number;
  pathProgress: number;
  hitFlash: number;
  knockbackVx: number;
  knockbackVy: number;
  stunTimer: number;
  koTimer: number;
  isDead: boolean;
  bracingTimer: number;
  lungeTimer: number;
  lungeCooldown: number;
}

export interface ProjectileEntity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  critChance: number;
  color: string;
  trailColor: string;
  targetEnemyId: number;
  life: number;
  isShockwave: boolean;
}

export interface SlashEffect {
  x: number;
  y: number;
  angle: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface SpinningBladeHazard {
  x: number;
  y: number;
  radius: number;
  damagePerTick: number;
  life: number;
  maxLife: number;
  tickTimer: number;
  rotation: number;
}

export interface ShockwaveRingEffect {
  x: number;
  y: number;
  currentRadius: number;
  maxRadius: number;
  life: number;
  maxLife: number;
}

export interface HordeWarningIndicator {
  x: number;
  y: number;
  angle: number;
  timer: number;
  maxTimer: number;
  spawnCount: number;
  spawned: boolean;
  isBoss?: boolean;
}

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vRot: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  scale: number;
  life: number;
  maxLife: number;
  isCrit?: boolean;
}

export interface DragState {
  source: 'unit' | 'card';
  unitId?: number;
  fromSlotId?: string;
  kind: UnitKind;
  level: number;
  worldX: number;
  worldY: number;
  startedAtX: number;
  startedAtY: number;
  hasMoved: boolean;
}

export interface SpellState {
  cooldowns: Record<SpellKind, number>;
  maxCooldowns: Record<SpellKind, number>;
  targetingSpell: SpellKind | null;
  overchargeTimer: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  stage: number;
  totalWavesInStage: number;
  highestUnlockedStage: number;
  baseHp: number;
  baseMaxHp: number;
  baseLevel: number;
  essence: number;
  essenceCollected: number;
  score: number;
  bestScore: number;
  wave: number;
  kills: number;
  survivalSeconds: number;
  selectedUnit: UnitKind;
  unitCount: number;
  maxUnitLevelReached: number;
  mergesPerformed: number;
  hoveredSlotId: string | null;
  mutedMusic: boolean;
  mutedSfx: boolean;
  spellCooldowns: Record<SpellKind, number>;
  spellMaxCooldowns: Record<SpellKind, number>;
  targetingSpell: SpellKind | null;
  overchargeTimer: number;
  bossActive: boolean;
}

/**
 * Smooth S-curve path from the West Invasion Portal (x=100, y=260)
 * through three tactical switchbacks to the East Castle Gate (x=1065, y=455).
 */
export const DEFAULT_ROUTE_WAYPOINTS: ReadonlyArray<RouteWaypoint> = [
  { x: 96, y: 265 },
  { x: 245, y: 265 },
  { x: 285, y: 285 },
  { x: 295, y: 330 },
  { x: 295, y: 500 },
  { x: 315, y: 545 },
  { x: 365, y: 560 },
  { x: 515, y: 560 },
  { x: 560, y: 540 },
  { x: 575, y: 495 },
  { x: 575, y: 295 },
  { x: 595, y: 250 },
  { x: 645, y: 235 },
  { x: 785, y: 235 },
  { x: 830, y: 255 },
  { x: 845, y: 300 },
  { x: 845, y: 490 },
  { x: 865, y: 535 },
  { x: 915, y: 550 },
  { x: 1015, y: 540 },
  { x: 1065, y: 495 },
  { x: 1065, y: 445 },
];

export const DEFAULT_ARENA: ArenaConfig = {
  worldWidth: 1200,
  worldHeight: 820,
  centerX: 580,
  centerY: 410,
  castleX: 1065,
  castleY: 415,
  castleRadius: 42,
  roadHalfWidth: 30,
  waypoints: DEFAULT_ROUTE_WAYPOINTS,
};

export const SPELL_SPECS: Record<
  SpellKind,
  { name: string; hotkey: string; cooldown: number; description: string }
> = {
  blade: {
    name: 'Lâmina Giratória',
    hotkey: 'Q',
    cooldown: 12,
    description: 'Corte em área no alvo',
  },
  shockwave: {
    name: 'Onda de Choque',
    hotkey: 'W',
    cooldown: 15,
    description: 'Recua toda a horda',
  },
  overcharge: {
    name: 'SuperCarga',
    hotkey: 'E',
    cooldown: 20,
    description: '+Essência por 10s',
  },
};

export const UNIT_SPECS: Record<UnitKind, UnitSpec> = {
  scout: {
    kind: 'scout',
    name: 'Batedor',
    shortRole: 'Tiro rápido',
    role: 'Tiro rápido à distância',
    cost: 30,
    maxHp: 75,
    range: 255,
    damage: 14,
    cooldown: 0.62,
    critChance: 0.18,
    color: '#3B82F6',
    accentColor: '#EF4444',
    hotkey: '1',
  },
  shield: {
    kind: 'shield',
    name: 'Escudeiro',
    shortRole: 'Onda azul',
    role: 'Onda de escudo & impacto',
    cost: 45,
    maxHp: 175,
    range: 185,
    damage: 24,
    cooldown: 1.0,
    critChance: 0.15,
    color: '#2563EB',
    accentColor: '#FACC15',
    hotkey: '2',
  },
  frog: {
    kind: 'frog',
    name: 'Sapo Lâmina',
    shortRole: 'Corte área',
    role: 'Corte esmeralda em área',
    cost: 70,
    maxHp: 130,
    range: 170,
    damage: 42,
    cooldown: 0.84,
    critChance: 0.26,
    color: '#22C55E',
    accentColor: '#2DD4BF',
    hotkey: '3',
  },
};
