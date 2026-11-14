export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type UnitKind = 'scout' | 'shield' | 'frog';

export type EnemyKind = 'walker' | 'shielded' | 'brute' | 'boss';

export type SpellKind = 'blade' | 'shockwave' | 'overcharge';

export type ParticleKind = 'circle' | 'smoke' | 'grass' | 'spark';

export const MAX_UNIT_LEVEL = 4;
export const TOTAL_STAGES = 10;

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
  outerTrackRadius: number;
  innerGrassRadius: number;
  coreRadius: number;
  spawnRadius: number;
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

export const DEFAULT_ARENA: ArenaConfig = {
  worldWidth: 1200,
  worldHeight: 820,
  centerX: 600,
  centerY: 420,
  outerTrackRadius: 315,
  innerGrassRadius: 235,
  coreRadius: 46,
  spawnRadius: 430,
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
    description: 'Empurra toda a horda',
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
    role: 'Tanque azul & impacto',
    cost: 45,
    maxHp: 175,
    range: 175,
    damage: 24,
    cooldown: 1.05,
    critChance: 0.15,
    color: '#2563EB',
    accentColor: '#FACC15',
    hotkey: '2',
  },
  frog: {
    kind: 'frog',
    name: 'Sapo Lâmina',
    role: 'Corte esmeralda em área',
    cost: 70,
    maxHp: 130,
    range: 160,
    damage: 42,
    cooldown: 0.85,
    critChance: 0.26,
    color: '#22C55E',
    accentColor: '#2DD4BF',
    hotkey: '3',
  },
};
