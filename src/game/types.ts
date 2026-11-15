export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type HeroClass = 'archer' | 'swordsman' | 'bomber';

export type UnitKind = 'scout' | 'shield' | 'frog';

export type EnemyKind = 'walker' | 'shielded' | 'brute' | 'boss';

export type SpellKind = 'blade' | 'shockwave' | 'overcharge';

export type ParticleKind = 'circle' | 'smoke' | 'grass' | 'spark';

export type RewardTone = 'gold' | 'electric' | 'crimson';

export const MAX_UNIT_LEVEL = 4;
export const MAX_HERO_LEVEL = 6;
export const TOTAL_STAGES = 10;

export const HERO_XP_THRESHOLDS: ReadonlyArray<number> = [0, 45, 110, 200, 320, 480];

export interface RouteWaypoint {
  x: number;
  y: number;
}

export interface SlotCoord {
  id: string;
  x: number;
  y: number;
  zone: number;
  angle: number;
}

export interface StageRouteDefinition {
  stage: number;
  title: string;
  routeArchetype: string;
  waypoints: ReadonlyArray<RouteWaypoint>;
  castleX: number;
  castleY: number;
  slots: ReadonlyArray<SlotCoord>;
  heroStartSlotId: string;
}

export interface StageConfig {
  stage: number;
  title: string;
  routeArchetype: string;
  totalWaves: number;
  baseEnemiesPerWave: number;
  hpMultiplier: number;
  speedMultiplier: number;
  spawnInterval: number;
  bossHp: number;
}

export interface ArenaConfig {
  stage: number;
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
  hasHero: boolean;
}

export interface HeroSpec {
  heroClass: HeroClass;
  name: string;
  title: string;
  shortRole: string;
  description: string;
  range: number;
  damage: number;
  cooldown: number;
  critChance: number;
  blastRadius: number;
  cleaveHalfAngle: number;
  color: string;
  accentColor: string;
  glowColor: string;
  statPower: number;
  statSpeed: number;
  statArea: number;
}

export interface HeroEntity {
  heroClass: HeroClass;
  slotId: string;
  x: number;
  y: number;
  level: number;
  xp: number;
  kills: number;
  range: number;
  damage: number;
  cooldown: number;
  cooldownTimer: number;
  critChance: number;
  blastRadius: number;
  facingAngle: number;
  attackAnim: number;
  recoil: number;
  levelUpFlash: number;
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
  xpReward: number;
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
  isHeroAttack?: boolean;
  isBomb?: boolean;
  blastRadius?: number;
  startX?: number;
  startY?: number;
  targetX?: number;
  targetY?: number;
  arcDuration?: number;
  arcElapsed?: number;
}

export interface ExplosionEffect {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
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
  color?: string;
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

export interface RewardBanner {
  id: number;
  text: string;
  subtext?: string;
  tone: RewardTone;
  life: number;
  maxLife: number;
}

export interface DragState {
  source: 'unit' | 'card' | 'hero';
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
  routeArchetype: string;
  stageTitle: string;
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
  selectedHeroClass: HeroClass;
  heroLevel: number;
  heroXp: number;
  heroCurrentLevelXp: number;
  heroNextLevelXp: number;
  heroKills: number;
  heroRepositionMode: boolean;
  selectedUnit: UnitKind;
  unitCount: number;
  maxUnitLevelReached: number;
  mergesPerformed: number;
  comboCount: number;
  activeBanner: RewardBanner | null;
  hoveredSlotId: string | null;
  mutedMusic: boolean;
  mutedSfx: boolean;
  spellCooldowns: Record<SpellKind, number>;
  spellMaxCooldowns: Record<SpellKind, number>;
  targetingSpell: SpellKind | null;
  overchargeTimer: number;
  bossActive: boolean;
}

export const HERO_SPECS: Record<HeroClass, HeroSpec> = {
  archer: {
    heroClass: 'archer',
    name: 'Arqueiro',
    title: 'Mestre da Precisão',
    shortRole: 'Alta velocidade à distância',
    description: 'Disparos elétricos velozes, longo alcance e rajadas múltiplas ao evoluir.',
    range: 345,
    damage: 24,
    cooldown: 0.42,
    critChance: 0.28,
    blastRadius: 0,
    cleaveHalfAngle: 0,
    color: '#00D4FF',
    accentColor: '#FACC15',
    glowColor: 'rgba(0, 212, 255, 0.45)',
    statPower: 78,
    statSpeed: 98,
    statArea: 42,
  },
  swordsman: {
    heroClass: 'swordsman',
    name: 'Espadachim',
    title: 'Lâmina Carmesim',
    shortRole: 'Dano corpo a corpo massivo',
    description: 'Golpes em arco devastadores com dano crítico alto e recuo de inimigos próximos.',
    range: 195,
    damage: 58,
    cooldown: 0.72,
    critChance: 0.34,
    blastRadius: 0,
    cleaveHalfAngle: Math.PI * 0.68,
    color: '#FF2E4C',
    accentColor: '#FACC15',
    glowColor: 'rgba(255, 46, 76, 0.45)',
    statPower: 98,
    statSpeed: 74,
    statArea: 76,
  },
  bomber: {
    heroClass: 'bomber',
    name: 'Bombardeiro',
    title: 'Artífice Explosivo',
    shortRole: 'Explosões em área de grupo',
    description: 'Lança bombas de impacto que pulverizam grupos inteiros na rota.',
    range: 290,
    damage: 44,
    cooldown: 1.08,
    critChance: 0.22,
    blastRadius: 102,
    cleaveHalfAngle: 0,
    color: '#F59E0B',
    accentColor: '#EF4444',
    glowColor: 'rgba(250, 204, 21, 0.45)',
    statPower: 90,
    statSpeed: 56,
    statArea: 98,
  },
};

export const DEFAULT_ROUTE_WAYPOINTS: ReadonlyArray<RouteWaypoint> = [
  { x: 96, y: 410 },
  { x: 460, y: 410 },
  { x: 640, y: 375 },
  { x: 1045, y: 410 },
];

export const DEFAULT_ARENA: ArenaConfig = {
  stage: 1,
  worldWidth: 1200,
  worldHeight: 820,
  centerX: 580,
  centerY: 410,
  castleX: 1045,
  castleY: 410,
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
    cooldown: 11,
    description: 'Corte em área no alvo',
  },
  shockwave: {
    name: 'Onda de Choque',
    hotkey: 'W',
    cooldown: 14,
    description: 'Recua toda a horda',
  },
  overcharge: {
    name: 'SuperCarga',
    hotkey: 'E',
    cooldown: 18,
    description: '+50% Essência e XP',
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
    damage: 15,
    cooldown: 0.6,
    critChance: 0.18,
    color: '#00D4FF',
    accentColor: '#FF2E4C',
    hotkey: '1',
  },
  shield: {
    kind: 'shield',
    name: 'Escudeiro',
    shortRole: 'Onda azul',
    role: 'Onda de escudo & impacto',
    cost: 45,
    maxHp: 175,
    range: 195,
    damage: 25,
    cooldown: 0.96,
    critChance: 0.16,
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
    range: 175,
    damage: 44,
    cooldown: 0.82,
    critChance: 0.26,
    color: '#22C55E',
    accentColor: '#FACC15',
    hotkey: '3',
  },
};
