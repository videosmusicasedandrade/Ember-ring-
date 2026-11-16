export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'gameover';

export type HeroClass = 'archer' | 'swordsman' | 'bomber';

export type UnitKind =
  | 'scout'
  | 'frog'
  | 'swordsman_ally'
  | 'fire_mage'
  | 'cleric'
  | 'shadow_assassin'
  | 'sniper'
  | 'golem'
  | 'spore_witch'
  | 'paladin'
  | 'shield';

export type EnemyKind =
  | 'walker'
  | 'shielded'
  | 'brute'
  | 'stalker'
  | 'pyro'
  | 'titan'
  | 'reaper'
  | 'boss'
  | 'shield_bearer'
  | 'corruptor';

export type EnemyArchetype =
  | 'beast'
  | 'slime'
  | 'goblin'
  | 'undead'
  | 'arachnid'
  | 'demon'
  | 'construct'
  | 'spirit'
  | 'orc'
  | 'mythic'
  | 'boss';

export interface EnemyCatalogEntry {
  id: number;
  code: string;
  name: string;
  hp: number;
  unlockStage: number;
  story: string;
  mysteryPreview: string;
  specialty: string;
  counterAllyId: number;
  engineKind: EnemyKind;
  archetype: EnemyArchetype;
  visualVariant: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  baseSpeed: number;
  radius: number;
  damage: number;
  isBoss?: boolean;
  isElite?: boolean;
}

export interface AllyCatalogEntry {
  id: number;
  code: string;
  unitKind: UnitKind;
  name: string;
  title: string;
  colorName: string;
  colorHex: string;
  accentHex: string;
  bgHex: string;
  unlockStage: number;
  specialty: string;
  story: string;
  mysteryPreview: string;
  hotkey: string;
}

export type SpellKind = 'blade' | 'shockwave' | 'overcharge';

export type ParticleKind = 'circle' | 'smoke' | 'grass' | 'spark';

export type RewardTone = 'gold' | 'electric' | 'crimson';

export type HeroUpgradeId = 'power' | 'haste' | 'fortress' | 'area';

export interface HeroUpgradeOption {
  id: HeroUpgradeId;
  title: string;
  effectText: string;
  accent: RewardTone;
}

export const HERO_UPGRADE_CATALOG: Record<HeroUpgradeId, HeroUpgradeOption> = {
  power: {
    id: 'power',
    title: 'Poder Bruto',
    effectText: '+28% Dano do Herói e +6% Crítico',
    accent: 'crimson',
  },
  haste: {
    id: 'haste',
    title: 'Ritmo Veloz',
    effectText: '+22% Cadência e +10% Alcance',
    accent: 'electric',
  },
  fortress: {
    id: 'fortress',
    title: 'Muralha & Tropas',
    effectText: '+25 HP Máx., cura +30 HP e +18% Dano Tropas',
    accent: 'gold',
  },
  area: {
    id: 'area',
    title: 'Impacto Amplo',
    effectText: '+24% Área/Recuo e +15% Dano Especial',
    accent: 'gold',
  },
};

export const MAX_UNIT_LEVEL = 4;
export const MAX_HERO_LEVEL = 30;
export const TOTAL_STAGES = 150;

export const HERO_XP_THRESHOLDS: ReadonlyArray<number> = [
  0, 35, 75, 125, 190, 270, 365, 475, 600, 740,
  900, 1080, 1280, 1500, 1750, 2030, 2340, 2680, 3050, 3450,
  3880, 4340, 4830, 5350, 5900, 6480, 7090, 7730, 8400, 9100,
];

export interface HeroSaveData {
  level: number;
  xp: number;
  kills: number;
  upgradeChoices: HeroUpgradeId[];
}

export interface RouteWaypoint {
  x: number;
  y: number;
}

export interface RouteBranch {
  id: string;
  gateIndex: number;
  label: string;
  unlockRouteLevel: number;
  color: string;
  waypoints: ReadonlyArray<RouteWaypoint>;
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
  routes: ReadonlyArray<RouteBranch>;
  initialRouteLevel: number;
  castleX: number;
  castleY: number;
  slots: ReadonlyArray<SlotCoord>;
  heroStartSlotId: string;
  trioStartSlotIds?: ReadonlyArray<string>;
}

export interface StageConfig {
  stage: number;
  title: string;
  routeArchetype: string;
  routeCount: number;
  initialRouteLevel: number;
  isConvergenceStage: boolean;
  totalWaves: number;
  baseEnemiesPerWave: number;
  hpMultiplier: number;
  speedMultiplier: number;
  spawnInterval: number;
  bossHp: number;
  isFiveLevelMilestone: boolean;
  unlockedEnemyLabel?: string;
  unlockedEnemyId?: number;
  unlockedAllyLabel?: string;
  unlockedAllyId?: number;
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
  routes: ReadonlyArray<RouteBranch>;
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
  slotId: string | null;
  x: number;
  y: number;
  level: number;
  xp: number;
  kills: number;
  upgradeChoices?: HeroUpgradeId[];
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
  isBoss?: boolean;
  isElite?: boolean;
  catalogId?: number;
  displayName?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
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
  routeIndex: number;
  waypointIndex: number;
  laneOffset: number;
  pathProgress: number;
  hitFlash: number;
  knockbackVx: number;
  knockbackVy: number;
  stunTimer: number;
  slowTimer?: number;
  corrosionTimer?: number;
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
  isPiercing?: boolean;
  hitIds?: number[];
  appliesSlow?: boolean;
  appliesCorrosion?: boolean;
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
  routeIndex: number;
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
  heroClass?: HeroClass;
  heroIndex?: number;
  fromSlotId?: string | null;
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

export interface ActiveHeroSummary {
  heroClass: HeroClass;
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number;
  kills: number;
  x: number;
  y: number;
  isFreePlaced: boolean;
}

export interface PactOption {
  id: string;
  title: string;
  description: string;
  tone: 'crimson' | 'gold' | 'electric';
}

export interface TalentNode {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  stage: number;
  routeArchetype: string;
  stageTitle: string;
  totalWavesInStage: number;
  highestUnlockedStage: number;
  isConvergenceStage: boolean;
  nextConvergenceStage: number;
  routeLevel: number;
  maxRouteLevel: number;
  openGatesCount: number;
  baseHp: number;
  baseMaxHp: number;
  baseLevel: number;
  essence: number;
  essenceCollected: number;
  evolutionPoints: number;
  lastEarnedEvolutionPoints: number;
  score: number;
  bestScore: number;
  wave: number;
  kills: number;
  survivalSeconds: number;
  selectedHeroClass: HeroClass;
  heroRoster: Record<HeroClass, HeroSaveData>;
  activeHeroes: ActiveHeroSummary[];
  activeHeroIndex: number;
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
  pendingUpgradeChoices: HeroUpgradeOption[] | null;
  pendingUpgradeMilestoneLevel: number | null;
  pendingUpgradeHeroClass: HeroClass | null;
  heroUpgradesCount: number;
  paladinAuraActive: boolean;
  emberSouls: number;
  talents: Record<string, number>;
  pendingPactChoices: PactOption[] | null;
  activePacts: string[];
  ringRotation: number;
  ringHeat: number;
}

export const HERO_SPECS: Record<HeroClass, HeroSpec> = {
  archer: {
    heroClass: 'archer',
    name: 'Arqueiro',
    title: 'Mestre da Precisão',
    shortRole: 'Alta velocidade à distância',
    description: 'Começa com disparos leves e rápidos; ganha poder e múltiplas flechas ao evoluir.',
    range: 345,
    damage: 9,
    cooldown: 0.48,
    critChance: 0.14,
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
    shortRole: 'Dano corpo a corpo firme',
    description: 'Cortes em arco equilibrados no início; escala para golpes críticos brutais com XP.',
    range: 195,
    damage: 16,
    cooldown: 0.8,
    critChance: 0.18,
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
    description: 'Bombas de impacto moderado no nível 1 que crescem em área e potência a cada nível.',
    range: 290,
    damage: 13,
    cooldown: 1.16,
    critChance: 0.12,
    blastRadius: 94,
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
  routes: [
    {
      id: 'r1',
      gateIndex: 1,
      label: 'Portão Oeste',
      unlockRouteLevel: 1,
      color: '#FF2E4C',
      waypoints: DEFAULT_ROUTE_WAYPOINTS,
    },
  ],
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
    role: 'Ataques rápidos de longo alcance contra alvos ágeis',
    cost: 30,
    maxHp: 80,
    range: 265,
    damage: 11,
    cooldown: 0.6,
    critChance: 0.16,
    color: '#00D4FF',
    accentColor: '#FACC15',
    hotkey: '1',
  },
  frog: {
    kind: 'frog',
    name: 'Sapo Lâmina',
    shortRole: 'Ácido em área',
    role: 'Dano de veneno em área e corrosão de armaduras pesadas',
    cost: 48,
    maxHp: 135,
    range: 185,
    damage: 34,
    cooldown: 0.82,
    critChance: 0.24,
    color: '#10B981',
    accentColor: '#A3E635',
    hotkey: '2',
  },
  swordsman_ally: {
    kind: 'swordsman_ally',
    name: 'Espadachim',
    shortRole: 'Corte brutal',
    role: 'Dano corpo a corpo massivo e resistência contra chefes',
    cost: 55,
    maxHp: 210,
    range: 170,
    damage: 48,
    cooldown: 0.88,
    critChance: 0.3,
    color: '#DC2626',
    accentColor: '#FCA5A5',
    hotkey: '3',
  },
  fire_mage: {
    kind: 'fire_mage',
    name: 'Mago de Fogo',
    shortRole: 'Chama reta',
    role: 'Queima hordas inteiras em linha reta na rota',
    cost: 65,
    maxHp: 110,
    range: 280,
    damage: 38,
    cooldown: 1.05,
    critChance: 0.2,
    color: '#F97316',
    accentColor: '#FACC15',
    hotkey: '4',
  },
  cleric: {
    kind: 'cleric',
    name: 'Clérigo Protetor',
    shortRole: 'Cura castelo',
    role: 'Restaura o HP do castelo e protege aliados próximos',
    cost: 70,
    maxHp: 160,
    range: 240,
    damage: 24,
    cooldown: 1.15,
    critChance: 0.16,
    color: '#FEF3C7',
    accentColor: '#FACC15',
    hotkey: '5',
  },
  shadow_assassin: {
    kind: 'shadow_assassin',
    name: 'Assassino de Sombras',
    shortRole: 'Crítico letal',
    role: 'Acertos críticos letais em inimigos isolados',
    cost: 80,
    maxHp: 125,
    range: 230,
    damage: 54,
    cooldown: 0.72,
    critChance: 0.58,
    color: '#581C87',
    accentColor: '#C084FC',
    hotkey: '6',
  },
  sniper: {
    kind: 'sniper',
    name: 'Atirador de Elite',
    shortRole: 'Alcance máx.',
    role: 'Alcance máximo absoluto com dano perfurante',
    cost: 90,
    maxHp: 105,
    range: 460,
    damage: 78,
    cooldown: 1.28,
    critChance: 0.35,
    color: '#06B6D4',
    accentColor: '#E0F2FE',
    hotkey: '7',
  },
  golem: {
    kind: 'golem',
    name: 'Golem Defensor',
    shortRole: 'Tanque peso',
    role: 'Tanque intransponível que bloqueia o avanço inimigo na rota',
    cost: 95,
    maxHp: 340,
    range: 165,
    damage: 42,
    cooldown: 1.12,
    critChance: 0.14,
    color: '#64748B',
    accentColor: '#CBD5E1',
    hotkey: '8',
  },
  spore_witch: {
    kind: 'spore_witch',
    name: 'Bruxa dos Esporos',
    shortRole: 'Lentidão global',
    role: 'Lenta o movimento de todos os inimigos na tela',
    cost: 105,
    maxHp: 130,
    range: 310,
    damage: 32,
    cooldown: 1.15,
    critChance: 0.2,
    color: '#65A30D',
    accentColor: '#BEF264',
    hotkey: '9',
  },
  paladin: {
    kind: 'paladin',
    name: 'Paladino Supremo',
    shortRole: 'Aura +20% dano',
    role: 'O herói definitivo com bônus de dano universal para toda a tropa',
    cost: 130,
    maxHp: 280,
    range: 245,
    damage: 85,
    cooldown: 0.85,
    critChance: 0.32,
    color: '#EAB308',
    accentColor: '#FEF08A',
    hotkey: '0',
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
};
