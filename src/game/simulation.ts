import { soundEngine } from './audio';
import {
  ENEMY_ALBUM,
  getAllyUnlockForStage,
  getEnemyUnlockForStage,
  getUnlockedEnemiesForStage,
} from './bestiaryData';
import {
  advanceEnemyAlongRoute,
  applyDamageToBase,
  applyDamageToEnemy,
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
  computeWaveConfig,
  crossedHeroUpgradeMilestone,
  distanceBetween,
  findEnemiesInSlashArc,
  findNearestEnemyInRange,
  findSlotAtPoint,
  getHeroEvolutionCost,
  getHeroStatsForLevel,
  getHeroXpBounds,
  getStageConfig,
  getStageRouteDefinition,
  isEliteEnemy,
  isValidFreeHeroPosition,
  pushEnemyBackAlongRoute,
  rollCriticalHit,
  unlockNextStage,
} from './engineMath';
import { createDefaultHeroRoster, loadProgress, saveProgress } from './storage';
import {
  ArenaConfig,
  ArenaSlot,
  DEFAULT_ARENA,
  DragState,
  EnemyCatalogEntry,
  EnemyEntity,
  EnemyKind,
  ExplosionEffect,
  FloatingText,
  GamePhase,
  HERO_SPECS,
  HERO_UPGRADE_CATALOG,
  HERO_XP_THRESHOLDS,
  HeroClass,
  HeroEntity,
  HeroSaveData,
  HeroUpgradeId,
  HeroUpgradeOption,
  HordeWarningIndicator,
  HudSnapshot,
  MAX_HERO_LEVEL,
  Particle,
  ParticleKind,
  ProjectileEntity,
  RewardBanner,
  RewardTone,
  SPELL_SPECS,
  ShockwaveRingEffect,
  SlashEffect,
  SpellKind,
  SpellState,
  SpinningBladeHazard,
  TOTAL_STAGES,
  UNIT_SPECS,
  UnitEntity,
  UnitKind,
} from './types';

const PARTICLE_POOL_SIZE = 340;
const HERO_ORDER: HeroClass[] = ['archer', 'swordsman', 'bomber'];

export class GameSimulation {
  public arena: ArenaConfig = DEFAULT_ARENA;
  public routeTotalLength = 0;
  public routeTotalLengths: number[] = [];
  public phase: GamePhase = 'title';
  public currentStage = 1;
  public routeArchetype = '1 Rota · Trilha Reta';
  public stageTitle = 'Trilha da Clareira';
  public totalWavesInStage = 2;
  public highestUnlockedStage = 1;
  public selectedHeroClass: HeroClass = 'archer';

  // Persistent Campaign Roster & Convergence Schedule
  public heroRoster: Record<HeroClass, HeroSaveData> = createDefaultHeroRoster();
  public evolutionPoints = 2;
  public lastEarnedEvolutionPoints = 0;
  public convergenceStages: number[] = [];
  public isConvergenceStage = false;

  // Deployed Main Heroes (1 in normal stages, all 3 in Convergence stages)
  public heroes: HeroEntity[] = [];
  public activeHeroIndex = 0;
  public heroRepositionMode = false;

  // Dynamic Route Level & Gates (1..4)
  public routeLevel = 1;
  public maxRouteLevel = 1;
  private gateSpawnCursor = 0;

  public slots: ArenaSlot[] = [];
  public units: UnitEntity[] = [];
  public enemies: EnemyEntity[] = [];
  public projectiles: ProjectileEntity[] = [];
  public explosions: ExplosionEffect[] = [];
  public slashes: SlashEffect[] = [];
  public spinningBlades: SpinningBladeHazard[] = [];
  public shockwaves: ShockwaveRingEffect[] = [];
  public hordeWarnings: HordeWarningIndicator[] = [];
  public floatingTexts: FloatingText[] = [];
  public activeBanner: RewardBanner | null = null;
  public readonly particles: Particle[] = [];
  private particleCursor = 0;

  public baseHp = 100;
  public baseMaxHp = 100;
  public baseLevel = 1;
  public essence = 85;
  public essenceCollected = 0;
  public score = 0;
  public bestScore = 0;
  public wave = 1;
  public kills = 0;
  public survivalSeconds = 0;
  public selectedUnit: UnitKind = 'scout';
  public hoveredSlotId: string | null = null;
  public pointerWorldX = DEFAULT_ARENA.centerX;
  public pointerWorldY = DEFAULT_ARENA.centerY;
  public dragState: DragState | null = null;
  public mergesPerformed = 0;
  public maxUnitLevelReached = 1;

  public comboCount = 0;
  private comboTimer = 0;
  private lastComboTier = 0;
  private nextBannerId = 1;
  private lastExcellenceBannerTime = -10;

  private unitUpgradeDamageMult = 1;
  public heroUpgradesCount = 0;
  public pendingUpgradeChoices: HeroUpgradeOption[] | null = null;
  public pendingUpgradeMilestoneLevel: number | null = null;
  public pendingUpgradeHeroClass: HeroClass | null = null;

  public spells: SpellState = {
    cooldowns: { blade: 0, shockwave: 0, overcharge: 0 },
    maxCooldowns: {
      blade: SPELL_SPECS.blade.cooldown,
      shockwave: SPELL_SPECS.shockwave.cooldown,
      overcharge: SPELL_SPECS.overcharge.cooldown,
    },
    targetingSpell: null,
    overchargeTimer: 0,
  };

  public time = 0;
  public hitstopTimer = 0;
  public cameraTrauma = 0;
  public baseHitFlash = 0;

  private nextEntityId = 1;
  private waveRemainingToSpawn = 0;
  private waveTotalInWave = 1;
  private waveSpawnTimer = 0;
  private waveBreakTimer = 0;
  private waveSpawnInterval = 1.15;
  private waveHpMult = 1;
  private waveSpeedMult = 1;
  private isBossWave = false;
  private waveBossHp = 360;
  private bossSpawnedInWave = false;
  private waveMix: Record<Exclude<EnemyKind, 'boss'>, number> = {
    walker: 0.74,
    shielded: 0.2,
    brute: 0.06,
    stalker: 0,
    pyro: 0,
    titan: 0,
    reaper: 0,
  };
  private surgeScheduleTimer = 4.2;
  private overchargeTickTimer = 0;
  private lowHpAlarmTimer = 0;

  constructor() {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      this.particles.push({
        active: false,
        kind: 'circle',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        rotation: 0,
        vRot: 0,
        color: '#FFFFFF',
        life: 0,
        maxLife: 0.4,
        gravity: 0,
      });
    }
    const saved = loadProgress();
    this.highestUnlockedStage = saved.highestUnlockedStage;
    this.bestScore = saved.bestScore;
    this.selectedHeroClass = saved.selectedHeroClass;
    this.evolutionPoints = saved.evolutionPoints;
    this.heroRoster = saved.heroes;
    this.convergenceStages = saved.convergenceStages;
    this.heroes = [this.createHeroFromRoster(this.selectedHeroClass, 's1-5', 545, 295)];
    this.resetWorld('title', 1, this.selectedHeroClass);
  }

  public get hero(): HeroEntity {
    return this.heroes[this.activeHeroIndex] ?? this.heroes[0];
  }

  private persistProgress() {
    for (const h of this.heroes) {
      this.heroRoster[h.heroClass] = {
        level: h.level,
        xp: h.xp,
        kills: h.kills,
        upgradeChoices: [...(h.upgradeChoices ?? this.heroRoster[h.heroClass].upgradeChoices)],
      };
    }
    saveProgress({
      highestUnlockedStage: this.highestUnlockedStage,
      bestScore: this.bestScore,
      selectedHeroClass: this.selectedHeroClass,
      evolutionPoints: this.evolutionPoints,
      heroes: this.heroRoster,
      convergenceStages: this.convergenceStages,
    });
  }

  private createHeroFromRoster(
    heroClass: HeroClass,
    slotId: string | null,
    x: number,
    y: number
  ): HeroEntity {
    const saved = this.heroRoster[heroClass];
    const entity: HeroEntity = {
      heroClass,
      slotId,
      x,
      y,
      level: saved.level,
      xp: saved.xp,
      kills: saved.kills,
      upgradeChoices: [...saved.upgradeChoices],
      range: 200,
      damage: 10,
      cooldown: 0.8,
      cooldownTimer: 0.1,
      critChance: 0.14,
      blastRadius: 0,
      facingAngle: 0,
      attackAnim: 0,
      recoil: 0,
      levelUpFlash: 0,
    };
    this.applySavedStatsToHero(entity);
    return entity;
  }

  private applySavedStatsToHero(hero: HeroEntity) {
    const base = getHeroStatsForLevel(hero.heroClass, hero.level);
    let dmgMult = 1;
    let cdMult = 1;
    let rangeMult = 1;
    let critBonus = 0;
    let blastMult = 1;

    for (const upg of hero.upgradeChoices ?? []) {
      if (upg === 'power') {
        dmgMult *= 1.28;
        critBonus += 0.06;
      } else if (upg === 'haste') {
        cdMult *= 0.82;
        rangeMult *= 1.1;
      } else if (upg === 'area') {
        blastMult *= 1.24;
        dmgMult *= 1.15;
      }
    }

    hero.damage = Math.round(base.damage * dmgMult);
    hero.cooldown = Math.max(0.14, Number((base.cooldown * cdMult).toFixed(3)));
    hero.range = Math.round(base.range * rangeMult);
    hero.critChance = Math.min(0.84, base.critChance + critBonus);
    hero.blastRadius = base.blastRadius > 0 ? Math.round(base.blastRadius * blastMult) : 0;
  }

  public setHeroClass(heroClass: HeroClass) {
    this.selectedHeroClass = heroClass;
    if (!this.isConvergenceStage && this.heroes.length > 0 && this.phase === 'title') {
      const current = this.heroes[0];
      const replacement = this.createHeroFromRoster(heroClass, current.slotId, current.x, current.y);
      this.heroes = [replacement];
      this.activeHeroIndex = 0;
    }
    this.persistProgress();
  }

  /**
   * Player chooses which hero (`archer`, `swordsman`, or `bomber`) to evolve persistently from Menu!
   */
  public evolveHeroInMenu(heroClass: HeroClass): boolean {
    const entry = this.heroRoster[heroClass];
    if (!entry || entry.level >= MAX_HERO_LEVEL) return false;
    const cost = getHeroEvolutionCost(entry.level);
    if (this.evolutionPoints < cost) return false;

    const prevLevel = entry.level;
    this.evolutionPoints -= cost;
    entry.level = Math.min(MAX_HERO_LEVEL, entry.level + 1);
    entry.xp = Math.max(entry.xp, HERO_XP_THRESHOLDS[entry.level - 1] ?? entry.xp);

    // Sync live preview hero if currently displayed on backdrop
    const live = this.heroes.find((h) => h.heroClass === heroClass);
    if (live) {
      live.level = entry.level;
      live.xp = entry.xp;
      live.levelUpFlash = 1.4;
      live.attackAnim = 1;
      this.applySavedStatsToHero(live);
    }

    soundEngine.playHeroEvolve();

    const milestone = crossedHeroUpgradeMilestone(prevLevel, entry.level);
    if (milestone !== null) {
      this.openUpgradeMilestone(milestone, heroClass);
    }

    this.persistProgress();
    return true;
  }

  public selectActiveHero(index: number) {
    if (index < 0 || index >= this.heroes.length) return;
    if (this.activeHeroIndex === index && this.phase === 'playing') {
      this.heroRepositionMode = !this.heroRepositionMode;
    } else {
      this.activeHeroIndex = index;
      if (this.phase === 'playing') {
        this.heroRepositionMode = true;
      }
    }
    this.spells.targetingSpell = null;
  }

  public toggleHeroRepositionMode() {
    if (this.phase !== 'playing') return;
    this.spells.targetingSpell = null;
    this.heroRepositionMode = !this.heroRepositionMode;
  }

  private triggerRewardBanner(text: string, subtext: string | undefined, tone: RewardTone, duration = 1.1) {
    this.activeBanner = {
      id: this.nextBannerId++,
      text,
      subtext,
      tone,
      life: duration,
      maxLife: duration,
    };
  }

  private openUpgradeMilestone(milestoneLevel: number, heroClass: HeroClass) {
    const thirdChoice: HeroUpgradeId = heroClass === 'archer' ? 'haste' : 'area';
    this.pendingUpgradeMilestoneLevel = milestoneLevel;
    this.pendingUpgradeHeroClass = heroClass;
    this.pendingUpgradeChoices = [
      HERO_UPGRADE_CATALOG.power,
      HERO_UPGRADE_CATALOG[thirdChoice],
      HERO_UPGRADE_CATALOG.fortress,
    ];
    this.dragState = null;
    this.heroRepositionMode = false;
    this.spells.targetingSpell = null;
  }

  public applyHeroUpgradeChoice(upgradeId: HeroUpgradeId): boolean {
    if (!this.pendingUpgradeChoices) return false;
    const milestone = this.pendingUpgradeMilestoneLevel ?? 5;
    const targetClass = this.pendingUpgradeHeroClass ?? this.hero.heroClass;

    // Persist upgrade choice on that specific hero
    this.heroRoster[targetClass].upgradeChoices.push(upgradeId);
    const targetHero = this.heroes.find((h) => h.heroClass === targetClass);
    if (targetHero) {
      if (!targetHero.upgradeChoices) targetHero.upgradeChoices = [];
      targetHero.upgradeChoices.push(upgradeId);
      this.applySavedStatsToHero(targetHero);
    }

    if (upgradeId === 'fortress' && this.phase === 'playing') {
      this.baseMaxHp += 25;
      this.baseHp = Math.min(this.baseMaxHp, this.baseHp + 30);
      this.unitUpgradeDamageMult *= 1.18;
      for (const unit of this.units) {
        unit.damage = Math.round(unit.damage * 1.18);
      }
    }

    this.heroUpgradesCount += 1;
    this.pendingUpgradeChoices = null;
    this.pendingUpgradeMilestoneLevel = null;
    this.pendingUpgradeHeroClass = null;

    soundEngine.playLevelUp(false);
    const fxHero = targetHero ?? this.hero;
    this.spawnTypedParticles(fxHero.x, fxHero.y, 20, 'spark', '#FACC15', 190, 0.5);
    this.persistProgress();

    if (this.phase === 'playing') {
      if (milestone >= 15) {
        this.spawnEnemyAlongRoute('reaper', 0.02);
        this.triggerRewardBanner(
          `${HERO_SPECS[targetClass].name.toUpperCase()} Nv.${milestone}!`,
          'Novo Ceifador entrou na rota',
          'crimson',
          1.2
        );
      } else if (milestone >= 10) {
        this.spawnEnemyAlongRoute('titan', 0.02);
        this.triggerRewardBanner(
          `${HERO_SPECS[targetClass].name.toUpperCase()} Nv.${milestone}!`,
          'Novo Titã entrou na rota',
          'crimson',
          1.2
        );
      } else {
        const firstNew: EnemyKind = this.currentStage >= 3 ? 'pyro' : 'stalker';
        const newLabel = firstNew === 'pyro' ? 'Espectro Ígneo' : 'Sombra Veloz';
        this.spawnEnemyAlongRoute(firstNew, 0.02);
        this.triggerRewardBanner(
          `${HERO_SPECS[targetClass].name.toUpperCase()} Nv.${milestone}!`,
          `${newLabel} entrou na rota`,
          'electric',
          1.2
        );
      }
    }

    return true;
  }

  public resetWorld(targetPhase: GamePhase, stageNumber?: number, heroClassOverride?: HeroClass) {
    const saved = loadProgress();
    this.highestUnlockedStage = Math.max(this.highestUnlockedStage, saved.highestUnlockedStage);
    this.bestScore = Math.max(this.bestScore, saved.bestScore);
    this.evolutionPoints = Math.max(this.evolutionPoints, saved.evolutionPoints);
    if (this.convergenceStages.length === 0) {
      this.convergenceStages = saved.convergenceStages;
    }

    if (heroClassOverride) {
      this.selectedHeroClass = heroClassOverride;
    }

    this.currentStage = Math.max(
      1,
      Math.min(TOTAL_STAGES, stageNumber ?? this.currentStage)
    );

    const stageCfg = getStageConfig(this.currentStage, this.convergenceStages);
    this.isConvergenceStage = stageCfg.isConvergenceStage;
    this.arena = buildArenaForStage(this.currentStage, this.isConvergenceStage);
    this.routeTotalLengths = this.arena.routes.map((r) => computeRouteTotalLength(r.waypoints));
    this.routeTotalLength = this.routeTotalLengths[0] ?? computeRouteTotalLength(this.arena.waypoints);

    const routeDef = getStageRouteDefinition(this.currentStage, this.isConvergenceStage);
    this.routeArchetype = stageCfg.routeArchetype;
    this.stageTitle = stageCfg.title;
    this.totalWavesInStage = stageCfg.totalWaves;
    this.maxRouteLevel = this.arena.routes.length;
    this.routeLevel = Math.min(this.maxRouteLevel, stageCfg.initialRouteLevel);
    this.gateSpawnCursor = 0;

    this.phase = targetPhase;
    this.slots = buildArenaSlots(this.arena, this.isConvergenceStage);
    this.units = [];
    this.enemies = [];
    this.projectiles = [];
    this.explosions = [];
    this.slashes = [];
    this.spinningBlades = [];
    this.shockwaves = [];
    this.hordeWarnings = [];
    this.floatingTexts = [];
    this.activeBanner = null;
    for (const p of this.particles) p.active = false;

    this.baseHp = this.isConvergenceStage ? 130 : 100;
    this.baseMaxHp = this.baseHp;
    this.baseLevel = 1;
    this.essence = this.isConvergenceStage ? 110 : 85;
    this.essenceCollected = 0;
    this.lastEarnedEvolutionPoints = 0;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.survivalSeconds = 0;
    this.selectedUnit = 'scout';
    this.hoveredSlotId = null;
    this.dragState = null;
    this.heroRepositionMode = false;
    this.mergesPerformed = 0;
    this.maxUnitLevelReached = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.lastComboTier = 0;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.baseHitFlash = 0;
    this.nextEntityId = 1;
    this.surgeScheduleTimer = 4.6;
    this.overchargeTickTimer = 0;
    this.lowHpAlarmTimer = 0;
    this.bossSpawnedInWave = false;

    this.unitUpgradeDamageMult = 1;
    this.heroUpgradesCount = 0;
    this.pendingUpgradeChoices = null;
    this.pendingUpgradeMilestoneLevel = null;
    this.pendingUpgradeHeroClass = null;

    this.spells = {
      cooldowns: { blade: 0, shockwave: 0, overcharge: 0 },
      maxCooldowns: {
        blade: SPELL_SPECS.blade.cooldown,
        shockwave: SPELL_SPECS.shockwave.cooldown,
        overcharge: SPELL_SPECS.overcharge.cooldown,
      },
      targetingSpell: null,
      overchargeTimer: 0,
    };

    // Deploy persistent hero(es): ALL 3 on Convergence stages, or the chosen Main Hero on regular stages!
    this.heroes = [];
    this.activeHeroIndex = 0;
    if (this.isConvergenceStage) {
      const slotIds = routeDef.trioStartSlotIds ?? [routeDef.heroStartSlotId];
      HERO_ORDER.forEach((cls, idx) => {
        const preferredId = slotIds[idx];
        const slot =
          this.slots.find((s) => s.id === preferredId && !s.hasHero) ??
          this.slots.find((s) => !s.hasHero) ??
          this.slots[0];
        const heroEntity = this.createHeroFromRoster(cls, slot.id, slot.x, slot.y);
        slot.hasHero = true;
        this.heroes.push(heroEntity);
      });
    } else {
      const heroSlot =
        this.slots.find((s) => s.id === routeDef.heroStartSlotId) ??
        this.slots[Math.floor(this.slots.length / 2)] ??
        this.slots[0];
      const heroEntity = this.createHeroFromRoster(
        this.selectedHeroClass,
        heroSlot.id,
        heroSlot.x,
        heroSlot.y
      );
      heroSlot.hasHero = true;
      this.heroes.push(heroEntity);
    }

    // Apply fortress/castle milestone resilience on 5-stage milestones
    if (this.currentStage % 5 === 0) {
      this.baseMaxHp += 20;
      this.baseHp = this.baseMaxHp;
      this.unitUpgradeDamageMult *= 1.12;
      this.heroUpgradesCount += 1;
    }

    // Place 1 starter support defender near the Castle defense zone
    const unlockedSecondary: UnitKind =
      this.highestUnlockedStage >= 12
        ? 'swordsman_ally'
        : this.highestUnlockedStage >= 6
          ? 'frog'
          : 'scout';
    const lateEmpty = [...this.slots].reverse().find((s) => !s.hasHero && s.unitId === null);
    if (lateEmpty) this.deployUnitToSlotId(lateEmpty.id, unlockedSecondary, true);

    this.startWave(1);

    if (targetPhase === 'playing') {
      const stageEnemyUnlock = getEnemyUnlockForStage(this.currentStage);
      const stageAllyUnlock = getAllyUnlockForStage(this.currentStage);
      const unlockedPool = getUnlockedEnemiesForStage(this.currentStage).filter((e) => !e.isBoss);
      const vanguardEntry =
        stageEnemyUnlock && !stageEnemyUnlock.isBoss
          ? stageEnemyUnlock
          : unlockedPool[unlockedPool.length - 1] ?? ENEMY_ALBUM[0];

      // Vanguard along active Gate(s)
      const activeGates = this.getActiveRouteIndices();
      activeGates.forEach((rIdx, idx) => {
        this.spawnEnemyAlongRoute(undefined, idx === 0 ? 0.12 : 0.05, vanguardEntry, rIdx);
        this.queueHordeWarning(2, false, rIdx);
      });
      this.waveRemainingToSpawn = Math.max(4, this.waveRemainingToSpawn - activeGates.length);

      if (this.isConvergenceStage) {
        soundEngine.playConvergenceAlert();
        this.triggerRewardBanner(
          `CONVERGÊNCIA TRIO · FASE ${this.currentStage}!`,
          `Os 3 Heróis em campo · ${this.maxRouteLevel} rotas · Posicione onde quiser`,
          'gold',
          1.6
        );
      } else if (stageAllyUnlock && stageAllyUnlock.unlockStage > 1) {
        this.triggerRewardBanner(
          `ALIADO LIBERADO: ${stageAllyUnlock.name.toUpperCase()}!`,
          `${stageAllyUnlock.specialty}`,
          'gold',
          1.3
        );
      } else if (stageEnemyUnlock) {
        this.triggerRewardBanner(
          `FASE ${this.currentStage} · ${stageEnemyUnlock.code} ${stageEnemyUnlock.name.toUpperCase()}!`,
          `${this.maxRouteLevel > 1 ? `${this.maxRouteLevel} Rotas nesta fase` : 'Novo inimigo no Álbum!'}`,
          this.currentStage % 5 === 0 ? 'gold' : 'crimson',
          1.25
        );
      } else if (this.maxRouteLevel >= 2) {
        this.triggerRewardBanner(
          `FASE ${this.currentStage} · ${this.maxRouteLevel} PORTÕES!`,
          `Nível de Rota ${this.routeLevel}/${this.maxRouteLevel} · Portões abrirão no combate`,
          'electric',
          1.2
        );
      } else {
        this.triggerRewardBanner(
          `${HERO_SPECS[this.selectedHeroClass].name.toUpperCase()} Nv.${this.hero.level}!`,
          `${this.stageTitle}`,
          'gold',
          1.05
        );
      }
    }
  }

  private getActiveRouteIndices(): number[] {
    const indices: number[] = [];
    this.arena.routes.forEach((route, idx) => {
      if (route.unlockRouteLevel <= this.routeLevel) {
        indices.push(idx);
      }
    });
    return indices.length > 0 ? indices : [0];
  }

  private escalateRouteLevelTo(targetLevel: number) {
    const clamped = Math.min(this.maxRouteLevel, targetLevel);
    if (clamped <= this.routeLevel) return;

    for (let lvl = this.routeLevel + 1; lvl <= clamped; lvl++) {
      this.routeLevel = lvl;
      const openedIndices = this.arena.routes
        .map((r, idx) => ({ r, idx }))
        .filter((x) => x.r.unlockRouteLevel === lvl);

      soundEngine.playGateOpen();
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);

      for (const { r, idx } of openedIndices) {
        const portal = r.waypoints[0];
        if (portal) {
          this.shockwaves.push({
            x: portal.x,
            y: portal.y,
            currentRadius: 16,
            maxRadius: 130,
            life: 0.6,
            maxLife: 0.6,
            color: r.color,
          });
          this.spawnTypedParticles(portal.x, portal.y, 24, 'spark', r.color, 210, 0.55);
          this.spawnTypedParticles(portal.x, portal.y, 16, 'spark', '#FACC15', 160, 0.5);
          this.floatingTexts.push({
            x: portal.x,
            y: portal.y - 36,
            vy: -24,
            text: `PORTÃO ${r.gateIndex} ABERTO!`,
            color: '#FACC15',
            scale: 1.25,
            life: 1.35,
            maxLife: 1.35,
            isCrit: true,
          });
        }
        this.queueHordeWarning(2, false, idx);
        this.triggerRewardBanner(
          `NÍVEL DE ROTA ${lvl}/${this.maxRouteLevel} · PORTÃO ${r.gateIndex}!`,
          `${r.label} aberto — defenda o novo flanco!`,
          'crimson',
          1.45
        );
      }
    }
  }

  private queueHordeWarning(spawnCount: number, isBoss = false, forcedRouteIndex?: number) {
    const activeRoutes = this.getActiveRouteIndices();
    const routeIndex =
      forcedRouteIndex !== undefined && forcedRouteIndex < this.arena.routes.length
        ? forcedRouteIndex
        : activeRoutes[this.gateSpawnCursor % activeRoutes.length];
    const branch = this.arena.routes[routeIndex] ?? this.arena.routes[0];
    const start = branch.waypoints[0] ?? { x: 96, y: 410 };
    const next = branch.waypoints[1] ?? { x: 380, y: 410 };
    this.hordeWarnings.push({
      x: start.x,
      y: start.y,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      routeIndex,
      timer: isBoss ? 2.2 : 1.7,
      maxTimer: isBoss ? 2.2 : 1.7,
      spawnCount,
      spawned: false,
      isBoss,
    });
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    const cfg = computeWaveConfig(waveNum, this.currentStage, this.convergenceStages);
    this.waveRemainingToSpawn = cfg.totalEnemies;
    this.waveTotalInWave = Math.max(1, cfg.totalEnemies);
    this.waveSpawnInterval = cfg.spawnInterval;
    this.waveHpMult = cfg.hpMultiplier;
    this.waveSpeedMult = cfg.speedMultiplier;
    this.isBossWave = cfg.isBossWave;
    this.waveBossHp = cfg.bossHp;
    this.bossSpawnedInWave = false;
    this.waveMix = cfg.mix;
    this.waveSpawnTimer = 0.65;
    this.waveBreakTimer = 0;

    // Escalate Route Level as waves advance so gates 2, 3, and 4 crack open progressively!
    if (waveNum >= 2 && this.maxRouteLevel > this.routeLevel) {
      const targetRouteLevel = Math.min(
        this.maxRouteLevel,
        Math.max(this.routeLevel, Math.min(this.maxRouteLevel, waveNum))
      );
      if (targetRouteLevel > this.routeLevel) {
        this.escalateRouteLevelTo(targetRouteLevel);
      } else {
        this.queueHordeWarning(
          Math.min(4, 2 + Math.floor((waveNum + this.currentStage) / 2)),
          false
        );
      }
    } else if (waveNum >= 2) {
      this.queueHordeWarning(
        Math.min(4, 2 + Math.floor((waveNum + this.currentStage) / 2)),
        false
      );
    }

    const nextLevel = 1 + Math.floor((waveNum - 1) / 2);
    if (nextLevel > this.baseLevel) {
      this.baseLevel = nextLevel;
      this.floatingTexts.push({
        x: this.arena.castleX,
        y: this.arena.castleY - 72,
        vy: -28,
        text: `Castelo Nv.${this.baseLevel}!`,
        color: '#FDE047',
        scale: 1.2,
        life: 1.15,
        maxLife: 1.15,
      });
    }
  }

  public activateSpell(kind: SpellKind): boolean {
    if (this.phase !== 'playing') return false;
    if (this.spells.cooldowns[kind] > 0) return false;

    this.heroRepositionMode = false;

    if (kind === 'blade') {
      this.spells.targetingSpell = this.spells.targetingSpell === 'blade' ? null : 'blade';
      return true;
    }

    if (kind === 'shockwave') {
      this.castShockwave();
      return true;
    }

    if (kind === 'overcharge') {
      this.castOvercharge();
      return true;
    }

    return false;
  }

  public cancelSpellTargeting() {
    this.spells.targetingSpell = null;
    this.heroRepositionMode = false;
  }

  private castSpinningBlade(x: number, y: number) {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.blade = this.spells.maxCooldowns.blade;
    const highestHeroLvl = Math.max(...this.heroes.map((h) => h.level));

    this.spinningBlades.push({
      x,
      y,
      radius: 126,
      damagePerTick: 30 + (highestHeroLvl - 1) * 9,
      life: 2.7,
      maxLife: 2.7,
      tickTimer: 0,
      rotation: 0,
    });

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
    this.hitstopTimer = 0.04;
    soundEngine.playSpellBlade();
    this.spawnTypedParticles(x, y, 16, 'spark', '#00D4FF', 195, 0.48);
    this.spawnTypedParticles(x, y, 14, 'spark', '#FACC15', 220, 0.42);
    this.floatingTexts.push({
      x,
      y: y - 34,
      vy: -30,
      text: 'Lâmina Giratória!',
      color: '#00D4FF',
      scale: 1.18,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private castShockwave() {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.shockwave = this.spells.maxCooldowns.shockwave;

    this.shockwaves.push({
      x: this.arena.castleX,
      y: this.arena.castleY,
      currentRadius: this.arena.castleRadius,
      maxRadius: 980,
      life: 0.65,
      maxLife: 0.65,
      color: '#00D4FF',
    });

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const pushDist = enemy.kind === 'boss' ? 80 : 155;
      const route = this.arena.routes[enemy.routeIndex] ?? this.arena.routes[0];
      const totalLen = this.routeTotalLengths[enemy.routeIndex] ?? this.routeTotalLength;
      pushEnemyBackAlongRoute(enemy, route.waypoints, pushDist, totalLen);
      enemy.stunTimer = Math.max(enemy.stunTimer, 0.7);
      this.handleEnemyDamaged(enemy, 22, 0, 0, true, false, undefined);
    }

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.62);
    this.hitstopTimer = 0.05;
    soundEngine.playSpellShockwave();
    this.spawnTypedParticles(this.arena.castleX, this.arena.castleY, 24, 'spark', '#00D4FF', 250, 0.52);
    this.spawnTypedParticles(this.arena.castleX, this.arena.castleY, 16, 'smoke', '#E2E8F0', 140, 0.6);
    this.triggerRewardBanner('ONDA DE CHOQUE!', 'Horda empurrada para trás', 'electric', 1.3);
  }

  private castOvercharge() {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.overcharge = this.spells.maxCooldowns.overcharge;
    this.spells.overchargeTimer = 10;
    this.overchargeTickTimer = 0.5;

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.28);
    soundEngine.playSpellOvercharge();
    for (const h of this.heroes) {
      this.spawnTypedParticles(h.x, h.y, 14, 'spark', '#FACC15', 180, 0.55);
    }
    this.triggerRewardBanner('SUPERCARGA ATIVA!', '+50% Essência e XP por 10s', 'gold', 1.4);
  }

  public deployUnitToSlotId(slotId: string, kind: UnitKind, free = false): boolean {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot || slot.unitId !== null || slot.hasHero) return false;
    const spec = UNIT_SPECS[kind];
    if (!free && this.essence < spec.cost) return false;

    if (!free) {
      this.essence -= spec.cost;
      soundEngine.playDeploy();
    }

    const unit: UnitEntity = {
      id: this.nextEntityId++,
      kind,
      slotId: slot.id,
      x: slot.x,
      y: slot.y,
      hp: spec.maxHp,
      maxHp: spec.maxHp,
      range: spec.range,
      damage: Math.round(spec.damage * this.unitUpgradeDamageMult),
      cooldown: spec.cooldown,
      cooldownTimer: Math.random() * 0.15,
      critChance: spec.critChance,
      facingAngle: slot.angle,
      attackAnim: 0,
      recoil: 0,
      hitFlash: 0,
      level: 1,
    };

    slot.unitId = unit.id;
    this.units.push(unit);

    if (!free) {
      this.spawnTypedParticles(slot.x, slot.y, 10, 'spark', spec.color, 110, 0.38);
      this.floatingTexts.push({
        x: slot.x,
        y: slot.y - 28,
        vy: -32,
        text: `${spec.name}`,
        color: '#FFFFFF',
        scale: 0.95,
        life: 0.75,
        maxLife: 0.75,
      });
    }
    return true;
  }

  private moveHeroToSlot(heroIdx: number, targetSlot: ArenaSlot): boolean {
    const hero = this.heroes[heroIdx];
    if (!hero) {
      this.heroRepositionMode = false;
      return false;
    }
    if (hero.slotId === targetSlot.id) {
      this.heroRepositionMode = false;
      return false;
    }

    // Check if another hero already occupies targetSlot -> swap!
    const otherHeroIdx = this.heroes.findIndex(
      (h, idx) => idx !== heroIdx && h.slotId === targetSlot.id
    );
    const oldSlot = hero.slotId ? this.slots.find((s) => s.id === hero.slotId) : undefined;

    if (otherHeroIdx >= 0) {
      const otherHero = this.heroes[otherHeroIdx];
      const prevX = hero.x;
      const prevY = hero.y;
      const prevSlotId = hero.slotId;

      hero.slotId = targetSlot.id;
      hero.x = targetSlot.x;
      hero.y = targetSlot.y;

      otherHero.slotId = prevSlotId;
      otherHero.x = prevX;
      otherHero.y = prevY;
    } else if (targetSlot.unitId !== null) {
      const occupant = this.units.find((u) => u.id === targetSlot.unitId);
      if (occupant && oldSlot) {
        oldSlot.hasHero = false;
        oldSlot.unitId = occupant.id;
        occupant.slotId = oldSlot.id;
        occupant.x = oldSlot.x;
        occupant.y = oldSlot.y;

        targetSlot.unitId = null;
        targetSlot.hasHero = true;
        hero.slotId = targetSlot.id;
        hero.x = targetSlot.x;
        hero.y = targetSlot.y;
      } else {
        // Hero was freely placed — move unit to nearest open slot or deny swap cleanly
        const freeSlot = this.slots.find((s) => !s.hasHero && s.unitId === null);
        if (!freeSlot || !occupant) {
          this.heroRepositionMode = false;
          return false;
        }
        freeSlot.unitId = occupant.id;
        occupant.slotId = freeSlot.id;
        occupant.x = freeSlot.x;
        occupant.y = freeSlot.y;

        targetSlot.unitId = null;
        targetSlot.hasHero = true;
        hero.slotId = targetSlot.id;
        hero.x = targetSlot.x;
        hero.y = targetSlot.y;
      }
    } else {
      if (oldSlot) oldSlot.hasHero = false;
      targetSlot.hasHero = true;
      hero.slotId = targetSlot.id;
      hero.x = targetSlot.x;
      hero.y = targetSlot.y;
    }

    this.heroRepositionMode = false;
    soundEngine.playDeploy();
    this.spawnTypedParticles(
      targetSlot.x,
      targetSlot.y,
      14,
      'spark',
      HERO_SPECS[hero.heroClass].color,
      135,
      0.42
    );
    this.floatingTexts.push({
      x: targetSlot.x,
      y: targetSlot.y - 34,
      vy: -30,
      text: `${HERO_SPECS[hero.heroClass].name}!`,
      color: '#FACC15',
      scale: 1.05,
      life: 0.8,
      maxLife: 0.8,
    });
    return true;
  }

  private moveHeroToFreePoint(heroIdx: number, worldX: number, worldY: number): boolean {
    const hero = this.heroes[heroIdx];
    if (!hero) {
      this.heroRepositionMode = false;
      return false;
    }
    const others = this.heroes.filter((_, idx) => idx !== heroIdx);
    if (!isValidFreeHeroPosition(worldX, worldY, this.arena, others)) {
      this.floatingTexts.push({
        x: worldX,
        y: worldY - 22,
        vy: -24,
        text: 'Fora da área tática',
        color: '#FF2E4C',
        scale: 0.85,
        life: 0.7,
        maxLife: 0.7,
      });
      this.heroRepositionMode = false;
      return false;
    }

    if (hero.slotId) {
      const oldSlot = this.slots.find((s) => s.id === hero.slotId);
      if (oldSlot) oldSlot.hasHero = false;
    }
    hero.slotId = null;
    hero.x = Math.round(worldX);
    hero.y = Math.round(worldY);
    this.heroRepositionMode = false;
    soundEngine.playDeploy();
    this.spawnTypedParticles(
      hero.x,
      hero.y,
      14,
      'spark',
      HERO_SPECS[hero.heroClass].color,
      135,
      0.42
    );
    this.floatingTexts.push({
      x: hero.x,
      y: hero.y - 34,
      vy: -30,
      text: `${HERO_SPECS[hero.heroClass].name}!`,
      color: '#FACC15',
      scale: 1.05,
      life: 0.8,
      maxLife: 0.8,
    });
    return true;
  }

  public quickRecruitUnit(kind: UnitKind): boolean {
    if (this.phase !== 'playing') return false;
    this.heroRepositionMode = false;
    this.selectedUnit = kind;
    const freeSlot = this.slots.find((s) => !s.hasHero && s.unitId === null);
    if (!freeSlot) {
      this.floatingTexts.push({
        x: this.arena.centerX,
        y: this.arena.centerY - 40,
        vy: -24,
        text: 'Mapa cheio! Funda tropas iguais',
        color: '#FACC15',
        scale: 0.95,
        life: 0.9,
        maxLife: 0.9,
      });
      return false;
    }
    const ok = this.deployUnitToSlotId(freeSlot.id, kind, false);
    if (!ok) {
      this.floatingTexts.push({
        x: freeSlot.x,
        y: freeSlot.y - 24,
        vy: -24,
        text: 'Sem essência',
        color: '#FF2E4C',
        scale: 0.85,
        life: 0.7,
        maxLife: 0.7,
      });
    }
    return ok;
  }

  public startCardDrag(kind: UnitKind, worldX: number, worldY: number) {
    if (this.phase !== 'playing') return;
    this.spells.targetingSpell = null;
    this.heroRepositionMode = false;
    this.selectedUnit = kind;
    this.dragState = {
      source: 'card',
      kind,
      level: 1,
      worldX,
      worldY,
      startedAtX: worldX,
      startedAtY: worldY,
      hasMoved: true,
    };
    this.hoveredSlotId = findSlotAtPoint(worldX, worldY, this.slots)?.id ?? null;
  }

  public handlePointerDown(worldX: number, worldY: number): boolean {
    if (this.phase !== 'playing') return false;

    if (this.spells.targetingSpell === 'blade') {
      this.castSpinningBlade(worldX, worldY);
      return true;
    }

    // Check if repositioning the active hero directly to a slot or free tactical position
    if (this.heroRepositionMode) {
      const targetSlot = findSlotAtPoint(worldX, worldY, this.slots);
      if (targetSlot) {
        return this.moveHeroToSlot(this.activeHeroIndex, targetSlot);
      }
      return this.moveHeroToFreePoint(this.activeHeroIndex, worldX, worldY);
    }

    // Check if clicking/dragging ANY deployed hero (whether on a slot or freely placed!)
    for (let i = 0; i < this.heroes.length; i++) {
      const h = this.heroes[i];
      if (distanceBetween(worldX, worldY, h.x, h.y) <= 32) {
        this.activeHeroIndex = i;
        this.dragState = {
          source: 'hero',
          heroIndex: i,
          heroClass: h.heroClass,
          fromSlotId: h.slotId,
          kind: 'scout',
          level: h.level,
          worldX,
          worldY,
          startedAtX: worldX,
          startedAtY: worldY,
          hasMoved: false,
        };
        return true;
      }
    }

    const slot = findSlotAtPoint(worldX, worldY, this.slots);
    if (!slot) {
      this.heroRepositionMode = false;
      return false;
    }

    if (slot.unitId !== null) {
      const unit = this.units.find((u) => u.id === slot.unitId);
      if (unit) {
        this.dragState = {
          source: 'unit',
          unitId: unit.id,
          fromSlotId: slot.id,
          kind: unit.kind,
          level: unit.level,
          worldX,
          worldY,
          startedAtX: worldX,
          startedAtY: worldY,
          hasMoved: false,
        };
        return true;
      }
    }

    const ok = this.deployUnitToSlotId(slot.id, this.selectedUnit, false);
    if (!ok) {
      this.floatingTexts.push({
        x: slot.x,
        y: slot.y - 24,
        vy: -24,
        text: 'Sem essência',
        color: '#FF2E4C',
        scale: 0.85,
        life: 0.7,
        maxLife: 0.7,
      });
    }
    return ok;
  }

  public handlePointerMove(worldX: number, worldY: number) {
    this.pointerWorldX = worldX;
    this.pointerWorldY = worldY;
    const slot = findSlotAtPoint(worldX, worldY, this.slots);
    this.hoveredSlotId = slot ? slot.id : null;

    if (this.dragState) {
      this.dragState.worldX = worldX;
      this.dragState.worldY = worldY;
      if (
        !this.dragState.hasMoved &&
        distanceBetween(worldX, worldY, this.dragState.startedAtX, this.dragState.startedAtY) > 7
      ) {
        this.dragState.hasMoved = true;
      }
    }
  }

  public handlePointerUp(worldX: number, worldY: number): boolean {
    if (!this.dragState) return false;
    const drag = this.dragState;
    this.dragState = null;

    if (this.phase !== 'playing') return false;

    if (drag.source === 'hero') {
      const heroIdx = drag.heroIndex ?? this.activeHeroIndex;
      if (!drag.hasMoved) {
        this.activeHeroIndex = heroIdx;
        this.heroRepositionMode = true;
        return true;
      }
      const targetSlot = findSlotAtPoint(worldX, worldY, this.slots);
      if (targetSlot) {
        return this.moveHeroToSlot(heroIdx, targetSlot);
      }
      return this.moveHeroToFreePoint(heroIdx, worldX, worldY);
    }

    const targetSlot = findSlotAtPoint(worldX, worldY, this.slots);
    if (!targetSlot) return false;

    if (drag.source === 'card') {
      if (targetSlot.unitId === null && !targetSlot.hasHero) {
        const ok = this.deployUnitToSlotId(targetSlot.id, drag.kind, false);
        if (!ok) {
          this.floatingTexts.push({
            x: targetSlot.x,
            y: targetSlot.y - 24,
            vy: -24,
            text: 'Sem essência',
            color: '#FF2E4C',
            scale: 0.85,
            life: 0.7,
            maxLife: 0.7,
          });
        }
        return ok;
      }
      return false;
    }

    if (!drag.hasMoved || !drag.unitId || !drag.fromSlotId) return false;
    if (targetSlot.id === drag.fromSlotId || targetSlot.hasHero) return false;

    const fromSlot = this.slots.find((s) => s.id === drag.fromSlotId);
    const draggedUnit = this.units.find((u) => u.id === drag.unitId);
    if (!fromSlot || !draggedUnit) return false;

    if (targetSlot.unitId === null) {
      fromSlot.unitId = null;
      targetSlot.unitId = draggedUnit.id;
      draggedUnit.slotId = targetSlot.id;
      draggedUnit.x = targetSlot.x;
      draggedUnit.y = targetSlot.y;
      soundEngine.playDeploy();
      this.spawnTypedParticles(targetSlot.x, targetSlot.y, 8, 'spark', '#00D4FF', 90, 0.32);
      return true;
    }

    const targetUnit = this.units.find((u) => u.id === targetSlot.unitId);
    if (targetUnit && canMergeUnits(draggedUnit, targetUnit)) {
      fromSlot.unitId = null;
      this.units = this.units.filter((u) => u.id !== draggedUnit.id);
      applyMergeUpgrade(targetUnit);

      this.mergesPerformed += 1;
      this.maxUnitLevelReached = Math.max(this.maxUnitLevelReached, targetUnit.level);
      this.score += 35 * targetUnit.level;
      this.bestScore = Math.max(this.bestScore, this.score);
      this.hitstopTimer = 0.045;
      this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.28);

      soundEngine.playMerge();
      this.spawnTypedParticles(targetUnit.x, targetUnit.y, 18, 'spark', '#FACC15', 165, 0.55);
      this.spawnTypedParticles(targetUnit.x, targetUnit.y, 10, 'smoke', '#FEF08A', 95, 0.48);
      this.floatingTexts.push({
        x: targetUnit.x,
        y: targetUnit.y - 34,
        vy: -38,
        text: `Fusão Nv.${targetUnit.level}!`,
        color: '#FACC15',
        scale: 1.2,
        life: 0.95,
        maxLife: 0.95,
      });
      return true;
    }

    return false;
  }

  private pickCatalogEnemyEntry(isBoss = false): EnemyCatalogEntry {
    const unlocked = getUnlockedEnemiesForStage(this.currentStage);
    if (isBoss) {
      const bosses = unlocked.filter((e) => e.isBoss);
      if (this.currentStage >= TOTAL_STAGES) {
        return ENEMY_ALBUM[ENEMY_ALBUM.length - 1];
      }
      if (bosses.length > 0) {
        return bosses[bosses.length - 1];
      }
      return unlocked[unlocked.length - 1] ?? ENEMY_ALBUM[0];
    }

    const nonBosses = unlocked.filter((e) => !e.isBoss);
    if (nonBosses.length === 0) return ENEMY_ALBUM[0];

    const recentSlice = nonBosses.slice(Math.max(0, nonBosses.length - 6));
    if (Math.random() < 0.72) {
      const idx = Math.floor(Math.pow(Math.random(), 0.7) * recentSlice.length);
      return recentSlice[Math.min(recentSlice.length - 1, idx)];
    }
    return nonBosses[Math.floor(Math.random() * nonBosses.length)];
  }

  private pickEnemyKind(): EnemyKind {
    const r = Math.random();
    const w1 = this.waveMix.walker;
    const w2 = w1 + this.waveMix.shielded;
    const w3 = w2 + this.waveMix.brute;
    const w4 = w3 + this.waveMix.stalker;
    const w5 = w4 + this.waveMix.pyro;
    const w6 = w5 + this.waveMix.titan;
    if (r < w1) return 'walker';
    if (r < w2) return 'shielded';
    if (r < w3) return 'brute';
    if (r < w4) return 'stalker';
    if (r < w5) return 'pyro';
    if (r < w6) return 'titan';
    return 'reaper';
  }

  private spawnEnemyAlongRoute(
    forcedKind?: EnemyKind,
    initialProgressFrac = 0,
    forcedCatalogEntry?: EnemyCatalogEntry,
    forcedRouteIndex?: number
  ) {
    const activeRoutes = this.getActiveRouteIndices();
    const routeIndex =
      forcedRouteIndex !== undefined && forcedRouteIndex < this.arena.routes.length
        ? forcedRouteIndex
        : activeRoutes[this.gateSpawnCursor++ % activeRoutes.length];
    const branch = this.arena.routes[routeIndex] ?? this.arena.routes[0];
    const totalLen = this.routeTotalLengths[routeIndex] ?? this.routeTotalLength;

    const catalogEntry =
      forcedCatalogEntry ??
      (forcedKind === 'boss'
        ? this.pickCatalogEnemyEntry(true)
        : forcedKind
          ? undefined
          : this.pickCatalogEnemyEntry(false));

    const kind: EnemyKind =
      forcedKind ?? (catalogEntry ? catalogEntry.engineKind : this.pickEnemyKind());
    const laneOffset =
      kind === 'boss' || kind === 'titan' || kind === 'reaper'
        ? 0
        : (Math.random() - 0.5) * 18;
    const spawn = computeRouteSpawnPoint(branch.waypoints, laneOffset);

    let baseHp = catalogEntry ? catalogEntry.hp : 50;
    let baseSpeed = catalogEntry ? catalogEntry.baseSpeed : 53;
    let radius = catalogEntry ? catalogEntry.radius : 17;
    let damage = catalogEntry ? catalogEntry.damage : 12;
    let attackCooldown = 1.05;
    let rewardScore = catalogEntry ? 15 + catalogEntry.id * 4 : 15;
    let xpReward = catalogEntry ? 10 + Math.floor(catalogEntry.id * 1.1) : 10;

    if (!catalogEntry) {
      if (kind === 'shielded') {
        baseHp = 75;
        baseSpeed = 42;
        radius = 20;
        damage = 16;
        attackCooldown = 1.15;
        rewardScore = 25;
        xpReward = 15;
      } else if (kind === 'brute') {
        baseHp = 115;
        baseSpeed = 46;
        radius = 22;
        damage = 22;
        attackCooldown = 1.2;
        rewardScore = 40;
        xpReward = 22;
      } else if (kind === 'stalker') {
        baseHp = 65;
        baseSpeed = 82;
        radius = 16;
        damage = 15;
        attackCooldown = 0.9;
        rewardScore = 45;
        xpReward = 24;
      } else if (kind === 'pyro') {
        baseHp = 95;
        baseSpeed = 64;
        radius = 18;
        damage = 20;
        attackCooldown = 1.0;
        rewardScore = 55;
        xpReward = 28;
      } else if (kind === 'titan') {
        baseHp = 220;
        baseSpeed = 34;
        radius = 27;
        damage = 28;
        attackCooldown = 1.3;
        rewardScore = 80;
        xpReward = 42;
      } else if (kind === 'reaper') {
        baseHp = 260;
        baseSpeed = 48;
        radius = 25;
        damage = 32;
        attackCooldown = 1.1;
        rewardScore = 95;
        xpReward = 50;
      } else if (kind === 'boss') {
        baseHp = this.waveBossHp;
        baseSpeed = 33;
        radius = 34;
        damage = 32 + Math.round(this.currentStage * 1.2);
        attackCooldown = 1.25;
        rewardScore = 220 + this.currentStage * 20;
        xpReward = 85;
      }
    } else if (kind === 'boss') {
      baseHp =
        this.currentStage >= TOTAL_STAGES
          ? 25000
          : Math.max(this.waveBossHp, catalogEntry.hp);
      radius = Math.max(30, catalogEntry.radius);
      xpReward = 85 + Math.floor(catalogEntry.id * 1.5);
    }

    const rewardEssence = computeEnemyEssenceReward(kind, this.currentStage, false);
    const waveScale =
      kind === 'boss'
        ? 1
        : (1 + (this.wave - 1) * 0.14 + Math.max(0, this.currentStage - (catalogEntry?.unlockStage ?? 1)) * 0.025) *
          (this.isConvergenceStage ? 1.28 : 1);
    const hp = Math.round(baseHp * waveScale);
    const speed =
      baseSpeed *
      Math.min(1.45, 1 + (this.wave - 1) * 0.04 + this.currentStage * 0.003) *
      (this.isConvergenceStage ? 1.06 : 1);

    const isBoss = kind === 'boss' || Boolean(catalogEntry?.isBoss);
    const isElite = isEliteEnemy({ kind, isElite: Boolean(catalogEntry?.isElite), isBoss });

    const enemy: EnemyEntity = {
      id: this.nextEntityId++,
      kind,
      isBoss,
      isElite,
      catalogId: catalogEntry?.id,
      displayName: catalogEntry?.name,
      primaryColor: catalogEntry?.primaryColor,
      secondaryColor: catalogEntry?.secondaryColor,
      accentColor: catalogEntry?.accentColor,
      x: spawn.x,
      y: spawn.y,
      vx: Math.cos(spawn.angle) * speed,
      vy: Math.sin(spawn.angle) * speed,
      radius,
      hp,
      maxHp: hp,
      speed,
      damage,
      attackCooldown,
      attackTimer: 0.35,
      attackAnim: 0,
      rewardEssence,
      rewardScore,
      xpReward,
      walkPhase: Math.random() * Math.PI * 2,
      distanceTraveled: 0,
      routeIndex,
      waypointIndex: 1,
      laneOffset,
      pathProgress: 0,
      hitFlash: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      stunTimer: 0,
      slowTimer: 0,
      corrosionTimer: 0,
      koTimer: 0,
      isDead: false,
      bracingTimer: 0,
      lungeTimer: 0,
      lungeCooldown: 2.2 + Math.random() * 2.5,
    };

    if (initialProgressFrac > 0) {
      advanceEnemyAlongRoute(
        enemy,
        branch.waypoints,
        totalLen * initialProgressFrac,
        speed,
        totalLen
      );
    }

    this.enemies.push(enemy);
  }

  public spawnParticles(
    x: number,
    y: number,
    count: number,
    color: string,
    maxSpeed: number,
    maxLife: number
  ) {
    this.spawnTypedParticles(x, y, count, 'circle', color, maxSpeed, maxLife);
  }

  public spawnTypedParticles(
    x: number,
    y: number,
    count: number,
    kind: ParticleKind,
    color: string,
    maxSpeed: number,
    maxLife: number
  ) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % PARTICLE_POOL_SIZE;
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * maxSpeed;
      p.active = true;
      p.kind = kind;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd - (kind === 'smoke' ? 35 : 15);
      p.size =
        kind === 'smoke'
          ? 6 + Math.random() * 6
          : kind === 'grass'
            ? 4 + Math.random() * 3.5
            : 3.2 + Math.random() * 3.8;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 10;
      p.color = color;
      p.life = maxLife * (0.7 + Math.random() * 0.3);
      p.maxLife = p.life;
      p.gravity = kind === 'smoke' ? -30 : kind === 'spark' ? 30 : 140;
    }
  }

  public update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;

    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    this.baseHitFlash = Math.max(0, this.baseHitFlash - dt);

    if (this.phase === 'title') {
      const activeBranches = this.arena.routes.filter((r) => r.unlockRouteLevel <= this.routeLevel);
      for (const b of activeBranches) {
        const gate = b.waypoints[0];
        if (gate && Math.random() < dt * 5) {
          this.spawnTypedParticles(
            gate.x + (Math.random() - 0.5) * 18,
            gate.y + (Math.random() - 0.5) * 18,
            1,
            'spark',
            b.color,
            40,
            0.8
          );
        }
      }
      for (const h of this.heroes) {
        h.attackAnim = Math.max(0, h.attackAnim - dt * 3);
        h.recoil = Math.max(0, h.recoil - dt * 5);
        h.levelUpFlash = Math.max(0, h.levelUpFlash - dt);
      }
      for (const unit of this.units) {
        unit.attackAnim = Math.max(0, unit.attackAnim - dt * 3);
        unit.recoil = Math.max(0, unit.recoil - dt * 5);
      }
      this.updateVisualEffects(dt);
      return;
    }

    if (this.phase !== 'playing') return;

    if (this.pendingUpgradeChoices) {
      this.updateVisualEffects(dt);
      return;
    }

    this.survivalSeconds += dt;

    if (this.activeBanner) {
      this.activeBanner.life -= dt;
      if (this.activeBanner.life <= 0) {
        this.activeBanner = null;
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.lastComboTier = 0;
      }
    }

    if (this.baseHp > 0 && this.baseHp / this.baseMaxHp <= 0.3) {
      this.lowHpAlarmTimer -= dt;
      if (this.lowHpAlarmTimer <= 0) {
        this.lowHpAlarmTimer = 2.5;
        soundEngine.playLowHpAlarm();
      }
    } else {
      this.lowHpAlarmTimer = 0;
    }

    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
      this.updateVisualEffects(dt);
      return;
    }

    // Spell cooldowns & SuperCarga resource tick
    (Object.keys(this.spells.cooldowns) as SpellKind[]).forEach((k) => {
      if (this.spells.cooldowns[k] > 0) {
        this.spells.cooldowns[k] = Math.max(0, this.spells.cooldowns[k] - dt);
      }
    });

    if (this.spells.overchargeTimer > 0) {
      this.spells.overchargeTimer = Math.max(0, this.spells.overchargeTimer - dt);
      this.overchargeTickTimer -= dt;
      if (this.overchargeTickTimer <= 0) {
        this.overchargeTickTimer = 0.5;
        this.essence += 2;
        this.essenceCollected += 2;
        this.spawnTypedParticles(this.hero.x, this.hero.y - 10, 3, 'spark', '#FACC15', 70, 0.45);
      }
    }

    // Route Entrance Horde Surge Warnings
    this.surgeScheduleTimer -= dt;
    if (this.surgeScheduleTimer <= 0 && this.waveRemainingToSpawn >= 3) {
      this.surgeScheduleTimer = Math.max(5.0, 8.2 - this.wave * 0.4);
      this.queueHordeWarning(Math.min(4, 2 + Math.floor(this.wave / 2)), false);
    }

    for (let i = this.hordeWarnings.length - 1; i >= 0; i--) {
      const w = this.hordeWarnings[i];
      w.timer -= dt;
      if (w.timer <= 0 && !w.spawned) {
        w.spawned = true;
        if (w.isBoss) {
          this.spawnEnemyAlongRoute('boss', 0, undefined, w.routeIndex);
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
          this.triggerRewardBanner('CHEFE NA ROTA!', 'Concentre seu fogo!', 'crimson', 1.35);
        } else {
          for (let k = 0; k < w.spawnCount; k++) {
            this.spawnEnemyAlongRoute(undefined, k * 0.015, undefined, w.routeIndex);
          }
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.14);
        }
        this.hordeWarnings.splice(i, 1);
      }
    }

    // Spinning Blade Active Spell Hazards
    for (let i = this.spinningBlades.length - 1; i >= 0; i--) {
      const blade = this.spinningBlades[i];
      blade.life -= dt;
      blade.rotation += dt * 16;
      blade.tickTimer -= dt;

      if (Math.random() < dt * 24) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * blade.radius * 0.85;
        this.spawnTypedParticles(
          blade.x + Math.cos(a) * r,
          blade.y + Math.sin(a) * r,
          1,
          'spark',
          '#00D4FF',
          120,
          0.35
        );
      }

      if (blade.tickTimer <= 0) {
        blade.tickTimer = 0.28;
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (enemy.isDead) continue;
          if (distanceBetween(blade.x, blade.y, enemy.x, enemy.y) <= blade.radius + enemy.radius) {
            const roll = rollCriticalHit(blade.damagePerTick, 0.28);
            const kb = computeRadialKnockbackVector(blade.x, blade.y, enemy.x, enemy.y, 45);
            this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, this.hero.heroClass);
            hitAny = true;
          }
        }
        if (hitAny) {
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.1);
        }
      }

      if (blade.life <= 0) {
        this.spawnTypedParticles(blade.x, blade.y, 12, 'smoke', '#CBD5E1', 90, 0.45);
        this.spinningBlades.splice(i, 1);
      }
    }

    // 1. Multi-Route Wave Spawner & Escalation Gate Trigger
    if (this.waveRemainingToSpawn > 0) {
      // Mid-wave Route Level escalation when a 4-route map needs to crack open faster!
      if (
        this.maxRouteLevel > this.routeLevel &&
        this.waveTotalInWave > 0 &&
        this.waveRemainingToSpawn <= Math.floor(this.waveTotalInWave * 0.45) &&
        this.wave >= this.totalWavesInStage - 1
      ) {
        this.escalateRouteLevelTo(this.maxRouteLevel);
      }

      if (this.isBossWave && !this.bossSpawnedInWave && this.waveRemainingToSpawn <= 3) {
        this.bossSpawnedInWave = true;
        this.queueHordeWarning(1, true);
      }

      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        this.spawnEnemyAlongRoute();
        this.waveRemainingToSpawn -= 1;
        this.waveSpawnTimer = this.waveSpawnInterval * (0.82 + Math.random() * 0.36);
      }
    } else if (this.enemies.length === 0 && this.hordeWarnings.length === 0) {
      if (this.wave >= this.totalWavesInStage) {
        this.phase = 'victory';
        this.highestUnlockedStage = unlockNextStage(this.currentStage, this.highestUnlockedStage);
        this.bestScore = Math.max(this.bestScore, this.score);
        this.persistProgress();
        soundEngine.stopMusic();
        soundEngine.playVictory();
        return;
      }
      this.waveBreakTimer += dt;
      if (this.waveBreakTimer >= 1.25) {
        this.persistProgress();
        this.startWave(this.wave + 1);
      }
    }

    // 2A. Main Hero(es) Auto-Combat (supports 1 Hero OR all 3 Heroes in Convergence!)
    for (const hero of this.heroes) {
      hero.cooldownTimer = Math.max(0, hero.cooldownTimer - dt);
      hero.attackAnim = Math.max(0, hero.attackAnim - dt * 4.2);
      hero.recoil = Math.max(0, hero.recoil - dt * 6);
      hero.levelUpFlash = Math.max(0, hero.levelUpFlash - dt);

      if (hero.cooldownTimer <= 0) {
        const target = findNearestEnemyInRange(hero, this.enemies, this.arena);
        if (target) {
          hero.facingAngle = Math.atan2(target.y - hero.y, target.x - hero.x);
          hero.cooldownTimer = hero.cooldown;
          hero.attackAnim = 1;
          hero.recoil = 1;
          this.performHeroAttack(hero, target);
        }
      }
    }

    // 2B. Support Defenders Auto-Combat
    for (const unit of this.units) {
      unit.cooldownTimer = Math.max(0, unit.cooldownTimer - dt);
      unit.attackAnim = Math.max(0, unit.attackAnim - dt * 4);
      unit.recoil = Math.max(0, unit.recoil - dt * 6);
      unit.hitFlash = Math.max(0, unit.hitFlash - dt);

      if (unit.cooldownTimer <= 0) {
        const target = findNearestEnemyInRange(unit, this.enemies, this.arena);
        if (target) {
          unit.facingAngle = Math.atan2(target.y - unit.y, target.x - unit.x);
          unit.cooldownTimer = unit.cooldown;
          unit.attackAnim = 1;
          unit.recoil = 1;
          this.performUnitAttack(unit, target);
        }
      }
    }

    // 3. Projectiles & Bomb Arcs
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      if (
        proj.isBomb &&
        proj.startX !== undefined &&
        proj.startY !== undefined &&
        proj.targetX !== undefined &&
        proj.targetY !== undefined &&
        proj.arcDuration
      ) {
        proj.arcElapsed = (proj.arcElapsed ?? 0) + dt;
        const t = Math.min(1, proj.arcElapsed / proj.arcDuration);
        const arcLift = Math.sin(t * Math.PI) * 58;
        proj.x = proj.startX + (proj.targetX - proj.startX) * t;
        proj.y = proj.startY + (proj.targetY - proj.startY) * t - arcLift;

        if (Math.random() < dt * 28) {
          this.spawnTypedParticles(proj.x, proj.y, 1, 'spark', '#FACC15', 45, 0.22);
        }

        if (t >= 1) {
          this.detonateBomb(proj);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      proj.life -= dt;
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      let hit = false;
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        if (proj.hitIds && proj.hitIds.includes(enemy.id)) continue;
        if (circlesCollide(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.radius)) {
          if (proj.appliesSlow) {
            enemy.slowTimer = Math.max(enemy.slowTimer ?? 0, 3.2);
          }
          if (proj.appliesCorrosion) {
            enemy.corrosionTimer = Math.max(enemy.corrosionTimer ?? 0, 4.5);
          }
          const roll = rollCriticalHit(proj.damage, proj.critChance);
          const ownerHeroClass: HeroClass | undefined = proj.isHeroAttack
            ? proj.color === '#FACC15' || proj.color === '#00D4FF'
              ? 'archer'
              : undefined
            : undefined;
          this.handleEnemyDamaged(
            enemy,
            roll.damage,
            proj.vx * 0.04,
            proj.vy * 0.04,
            proj.isShockwave || Boolean(proj.isPiercing),
            roll.isCrit,
            ownerHeroClass ?? (proj.isHeroAttack ? this.hero.heroClass : undefined)
          );
          hit = true;
          if (proj.isPiercing) {
            if (!proj.hitIds) proj.hitIds = [];
            proj.hitIds.push(enemy.id);
          } else if (!proj.isShockwave) {
            break;
          }
        }
      }

      if (hit && !proj.isShockwave && !proj.isPiercing) {
        this.spawnTypedParticles(proj.x, proj.y, 6, 'spark', proj.color, 115, 0.28);
        this.projectiles.splice(i, 1);
      } else if (proj.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Enemies March Along Their Assigned Route & Castle Breach
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackAnim = Math.max(0, enemy.attackAnim - dt * 4);
      enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);
      if (enemy.slowTimer && enemy.slowTimer > 0) {
        enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
      }
      if (enemy.corrosionTimer && enemy.corrosionTimer > 0) {
        enemy.corrosionTimer = Math.max(0, enemy.corrosionTimer - dt);
      }

      if (enemy.isDead) {
        enemy.koTimer -= dt;
        enemy.x += enemy.knockbackVx * dt;
        enemy.y += enemy.knockbackVy * dt;
        enemy.knockbackVx *= 0.88;
        enemy.knockbackVy *= 0.88;
        if (enemy.koTimer <= 0) {
          this.enemies.splice(i, 1);
        }
        continue;
      }

      if (enemy.stunTimer > 0) {
        enemy.knockbackVx *= 0.86;
        enemy.knockbackVy *= 0.86;
        continue;
      }

      let speedMult = enemy.slowTimer && enemy.slowTimer > 0 ? 0.56 : 1;
      if (enemy.kind === 'shielded' || enemy.kind === 'titan') {
        enemy.bracingTimer = Math.max(0, enemy.bracingTimer - dt);
        enemy.lungeCooldown -= dt;
        if (enemy.lungeCooldown <= 0) {
          enemy.bracingTimer = enemy.kind === 'titan' ? 1.15 : 0.9;
          enemy.lungeCooldown = enemy.kind === 'titan' ? 3.8 + Math.random() : 4.2 + Math.random() * 1.5;
        }
        if (enemy.bracingTimer > 0) speedMult *= enemy.kind === 'titan' ? 0.72 : 0.6;
      } else if (enemy.kind === 'brute') {
        enemy.lungeCooldown -= dt;
        if (enemy.lungeTimer > 0) {
          enemy.lungeTimer = Math.max(0, enemy.lungeTimer - dt);
          speedMult *= enemy.lungeTimer > 0.32 ? 0.35 : 2.05;
        } else if (enemy.lungeCooldown <= 0 && enemy.pathProgress > 0.15 && enemy.pathProgress < 0.88) {
          enemy.lungeTimer = 0.65;
          enemy.lungeCooldown = 3.8 + Math.random() * 1.5;
        }
      } else if (enemy.kind === 'stalker' || enemy.kind === 'pyro') {
        enemy.lungeCooldown -= dt;
        if (enemy.lungeTimer > 0) {
          enemy.lungeTimer = Math.max(0, enemy.lungeTimer - dt);
          speedMult *= enemy.kind === 'stalker' ? 1.95 : 1.65;
          if (enemy.kind === 'pyro' && Math.random() < dt * 16) {
            this.spawnTypedParticles(enemy.x, enemy.y, 1, 'spark', '#FACC15', 75, 0.25);
          }
        } else if (enemy.lungeCooldown <= 0 && enemy.pathProgress > 0.08 && enemy.pathProgress < 0.9) {
          enemy.lungeTimer = 0.55;
          enemy.lungeCooldown = (enemy.kind === 'pyro' ? 3.4 : 3.0) + Math.random() * 1.2;
        }
      } else if (enemy.kind === 'reaper') {
        if (enemy.hp < enemy.maxHp * 0.55) {
          speedMult *= 1.38;
        }
      }

      const branch = this.arena.routes[enemy.routeIndex] ?? this.arena.routes[0];
      const totalLen = this.routeTotalLengths[enemy.routeIndex] ?? this.routeTotalLength;
      const moveStep = enemy.speed * speedMult * dt;
      const stepRes = advanceEnemyAlongRoute(
        enemy,
        branch.waypoints,
        moveStep,
        enemy.speed * speedMult,
        totalLen
      );

      if (stepRes.reachedCastle) {
        const result = applyDamageToBase(this.baseHp, enemy.damage);
        this.baseHp = result.nextHp;
        this.baseHitFlash = 0.28;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
        this.hitstopTimer = 0.045;
        soundEngine.playBaseHit();
        this.spawnTypedParticles(this.arena.castleX, this.arena.castleY + 12, 12, 'smoke', '#FCA5A5', 110, 0.45);
        this.spawnTypedParticles(this.arena.castleX, this.arena.castleY + 12, 10, 'spark', '#FF2E4C', 155, 0.4);
        this.floatingTexts.push({
          x: this.arena.castleX - 10,
          y: this.arena.castleY - 58,
          vy: -36,
          text: `-${enemy.damage} HP`,
          color: '#FF2E4C',
          scale: 1.24,
          life: 0.9,
          maxLife: 0.9,
        });
        this.enemies.splice(i, 1);

        if (result.isGameOver) {
          this.phase = 'gameover';
          this.bestScore = Math.max(this.bestScore, this.score);
          this.persistProgress();
          soundEngine.stopMusic();
          soundEngine.playDefeat();
          return;
        }
      }
    }

    this.updateVisualEffects(dt);
  }

  private performHeroAttack(hero: HeroEntity, target: EnemyEntity) {
    if (hero.heroClass === 'archer') {
      const baseAngle = Math.atan2(target.y - hero.y, target.x - hero.x);
      const speed = 640;
      const volleyAngles =
        hero.level >= 12
          ? [-0.16, -0.055, 0.055, 0.16]
          : hero.level >= 8
            ? [-0.14, 0, 0.14]
            : hero.level >= 4
              ? [-0.08, 0.08]
              : [0];
      const arrowDamageMult =
        volleyAngles.length >= 3 ? 0.75 : volleyAngles.length === 2 ? 0.8 : 1;
      const arrowDamage = Math.max(1, Math.round(hero.damage * arrowDamageMult));

      for (const offsetAngle of volleyAngles) {
        const ang = baseAngle + offsetAngle;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: hero.x + Math.cos(ang) * 20,
          y: hero.y + Math.sin(ang) * 20,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          radius: 7 + Math.min(8, (hero.level - 1) * 0.55),
          damage: arrowDamage,
          critChance: hero.critChance,
          color: hero.level >= 4 ? '#FACC15' : '#00D4FF',
          trailColor: '#7DD3FC',
          targetEnemyId: target.id,
          life: 0.95,
          isShockwave: false,
          isHeroAttack: true,
        });
      }
      soundEngine.playArcherShot();
      this.spawnTypedParticles(
        hero.x + Math.cos(baseAngle) * 22,
        hero.y + Math.sin(baseAngle) * 22,
        5,
        'spark',
        '#00D4FF',
        110,
        0.24
      );
    } else if (hero.heroClass === 'swordsman') {
      const cleaveRadius = hero.range * 0.96;
      const spec = HERO_SPECS.swordsman;
      this.slashes.push({
        x: hero.x,
        y: hero.y,
        angle: hero.facingAngle,
        radius: cleaveRadius,
        life: 0.25,
        maxLife: 0.25,
        color: hero.level >= 4 ? '#FACC15' : '#FF2E4C',
      });
      soundEngine.playSwordCleave();

      const hitEnemies = findEnemiesInSlashArc(
        hero.x,
        hero.y,
        hero.facingAngle,
        cleaveRadius,
        spec.cleaveHalfAngle,
        this.enemies
      );
      for (const enemy of hitEnemies) {
        const roll = rollCriticalHit(hero.damage, hero.critChance);
        const kb = computeRadialKnockbackVector(hero.x, hero.y, enemy.x, enemy.y, 65);
        if (roll.isCrit) {
          enemy.stunTimer = Math.max(enemy.stunTimer, 0.22);
        }
        this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, 'swordsman');
      }

      if (hitEnemies.length >= 3 && this.time - this.lastExcellenceBannerTime > 6) {
        this.lastExcellenceBannerTime = this.time;
        this.triggerRewardBanner('EXCELENTE!', `${hitEnemies.length} alvos`, 'crimson', 0.95);
      }

      this.spawnTypedParticles(
        hero.x + Math.cos(hero.facingAngle) * 48,
        hero.y + Math.sin(hero.facingAngle) * 48,
        9,
        'spark',
        '#FACC15',
        155,
        0.34
      );
    } else if (hero.heroClass === 'bomber') {
      const duration = Math.max(
        0.34,
        Math.min(0.56, distanceBetween(hero.x, hero.y, target.x, target.y) / 560)
      );
      this.projectiles.push({
        id: this.nextEntityId++,
        x: hero.x,
        y: hero.y - 8,
        vx: 0,
        vy: 0,
        radius: 11 + Math.min(6, (hero.level - 1) * 0.5),
        damage: hero.damage,
        critChance: hero.critChance,
        color: '#FACC15',
        trailColor: '#FF2E4C',
        targetEnemyId: target.id,
        life: duration + 0.1,
        isShockwave: false,
        isHeroAttack: true,
        isBomb: true,
        blastRadius: hero.blastRadius,
        startX: hero.x,
        startY: hero.y - 8,
        targetX: target.x,
        targetY: target.y,
        arcDuration: duration,
        arcElapsed: 0,
      });
      soundEngine.playBombLaunch();
    }
  }

  private detonateBomb(proj: ProjectileEntity) {
    const bx = proj.x;
    const by = proj.y;
    const radius = proj.blastRadius ?? 100;

    this.explosions.push({
      x: bx,
      y: by,
      radius,
      life: 0.36,
      maxLife: 0.36,
      color: '#FACC15',
    });

    soundEngine.playExplosion();
    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.24);
    this.spawnTypedParticles(bx, by, 16, 'spark', '#FACC15', 210, 0.42);
    this.spawnTypedParticles(bx, by, 10, 'spark', '#FF2E4C', 175, 0.38);
    this.spawnTypedParticles(bx, by, 8, 'smoke', '#94A3B8', 90, 0.5);

    let hitCount = 0;
    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      if (distanceBetween(bx, by, enemy.x, enemy.y) <= radius + enemy.radius) {
        hitCount += 1;
        const roll = rollCriticalHit(proj.damage, proj.critChance);
        const kb = computeRadialKnockbackVector(bx, by, enemy.x, enemy.y, 70);
        this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, 'bomber');
      }
    }

    if (hitCount >= 3 && this.time - this.lastExcellenceBannerTime > 6) {
      this.lastExcellenceBannerTime = this.time;
      this.triggerRewardBanner('EXCELENTE!', `${hitCount} atingidos`, 'gold', 0.95);
    }
  }

  private performUnitAttack(unit: UnitEntity, target: EnemyEntity) {
    const hasPaladinAura = this.units.some((u) => u.kind === 'paladin' && u.hp > 0);
    const auraMult = hasPaladinAura ? 1.2 : 1;
    const effectiveDamage = Math.round(unit.damage * auraMult);

    if (unit.kind === 'scout') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 580;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 18,
        y: unit.y + (dy / dist) * 18,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 6 + (unit.level - 1) * 1.2,
        damage: effectiveDamage,
        critChance: unit.critChance,
        color: unit.level >= 2 ? '#FACC15' : '#00D4FF',
        trailColor: '#BAE6FD',
        targetEnemyId: target.id,
        life: 0.9,
        isShockwave: false,
      });
      soundEngine.playShoot();
    } else if (unit.kind === 'shield') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 360;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 20,
        y: unit.y + (dy / dist) * 20,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 16 + (unit.level - 1) * 3,
        damage: effectiveDamage,
        critChance: unit.critChance,
        color: unit.level >= 2 ? '#00D4FF' : '#60A5FA',
        trailColor: '#DBEAFE',
        targetEnemyId: target.id,
        life: 0.55,
        isShockwave: true,
      });
      soundEngine.playShieldBash();
      this.spawnTypedParticles(unit.x + (dx / dist) * 18, unit.y + (dy / dist) * 18, 6, 'spark', '#00D4FF', 95, 0.3);
    } else if (unit.kind === 'frog') {
      const slashRadius = unit.range * 0.92;
      this.slashes.push({
        x: unit.x,
        y: unit.y,
        angle: unit.facingAngle,
        radius: slashRadius,
        life: 0.24,
        maxLife: 0.24,
        color: unit.level >= 2 ? '#A3E635' : '#10B981',
      });
      soundEngine.playSlash();

      const hitEnemies = findEnemiesInSlashArc(
        unit.x,
        unit.y,
        unit.facingAngle,
        slashRadius,
        Math.PI * 0.62,
        this.enemies
      );
      for (const enemy of hitEnemies) {
        enemy.corrosionTimer = Math.max(enemy.corrosionTimer ?? 0, 4.5);
        const roll = rollCriticalHit(effectiveDamage, unit.critChance);
        this.handleEnemyDamaged(enemy, roll.damage, 0, 0, true, roll.isCrit, undefined);
      }
      this.spawnTypedParticles(
        unit.x + Math.cos(unit.facingAngle) * 44,
        unit.y + Math.sin(unit.facingAngle) * 44,
        8,
        'spark',
        '#4ADE80',
        125,
        0.38
      );
    } else if (unit.kind === 'swordsman_ally') {
      const slashRadius = unit.range * 0.95;
      this.slashes.push({
        x: unit.x,
        y: unit.y,
        angle: unit.facingAngle,
        radius: slashRadius,
        life: 0.25,
        maxLife: 0.25,
        color: unit.level >= 2 ? '#FACC15' : '#DC2626',
      });
      soundEngine.playSwordCleave();

      const hitEnemies = findEnemiesInSlashArc(
        unit.x,
        unit.y,
        unit.facingAngle,
        slashRadius,
        Math.PI * 0.65,
        this.enemies
      );
      for (const enemy of hitEnemies) {
        const bossMult = enemy.kind === 'boss' || enemy.kind === 'titan' ? 1.35 : 1;
        const roll = rollCriticalHit(Math.round(effectiveDamage * bossMult), unit.critChance);
        const kb = computeRadialKnockbackVector(unit.x, unit.y, enemy.x, enemy.y, 48);
        this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, undefined);
      }
      this.spawnTypedParticles(unit.x + Math.cos(unit.facingAngle) * 40, unit.y + Math.sin(unit.facingAngle) * 40, 7, 'spark', '#FF2E4C', 135, 0.34);
    } else if (unit.kind === 'fire_mage') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 520;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 20,
        y: unit.y + (dy / dist) * 20,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 14 + (unit.level - 1) * 2,
        damage: effectiveDamage,
        critChance: unit.critChance,
        color: '#F97316',
        trailColor: '#FACC15',
        targetEnemyId: target.id,
        life: 0.72,
        isShockwave: false,
        isPiercing: true,
        hitIds: [],
      });
      soundEngine.playBombLaunch();
      this.spawnTypedParticles(unit.x + (dx / dist) * 18, unit.y + (dy / dist) * 18, 7, 'spark', '#F97316', 110, 0.3);
    } else if (unit.kind === 'cleric') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 500;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 18,
        y: unit.y + (dy / dist) * 18,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 8 + (unit.level - 1) * 1.2,
        damage: effectiveDamage,
        critChance: unit.critChance,
        color: '#FEF3C7',
        trailColor: '#FACC15',
        targetEnemyId: target.id,
        life: 0.85,
        isShockwave: false,
      });
      if (this.baseHp < this.baseMaxHp) {
        const healAmount = 2 + unit.level;
        this.baseHp = Math.min(this.baseMaxHp, this.baseHp + healAmount);
        this.spawnTypedParticles(this.arena.castleX, this.arena.castleY - 12, 4, 'spark', '#FEF08A', 80, 0.4);
      }
      soundEngine.playShoot();
    } else if (unit.kind === 'shadow_assassin') {
      const neighbors = this.enemies.filter(
        (e) => !e.isDead && e.id !== target.id && distanceBetween(e.x, e.y, target.x, target.y) < 75
      ).length;
      const isolatedMult = neighbors === 0 ? 1.45 : 1;
      const roll = rollCriticalHit(Math.round(effectiveDamage * isolatedMult), unit.critChance);
      this.slashes.push({
        x: target.x,
        y: target.y,
        angle: unit.facingAngle,
        radius: 46,
        life: 0.18,
        maxLife: 0.18,
        color: '#A855F7',
      });
      this.handleEnemyDamaged(target, roll.damage, 0, 0, true, roll.isCrit, undefined);
      soundEngine.playSlash();
      this.spawnTypedParticles(target.x, target.y, 8, 'spark', '#C084FC', 140, 0.3);
    } else if (unit.kind === 'sniper') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 920;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 20,
        y: unit.y + (dy / dist) * 20,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 8 + (unit.level - 1),
        damage: effectiveDamage,
        critChance: unit.critChance,
        color: '#06B6D4',
        trailColor: '#E0F2FE',
        targetEnemyId: target.id,
        life: 0.75,
        isShockwave: false,
        isPiercing: true,
        hitIds: [],
      });
      soundEngine.playArcherShot();
      this.spawnTypedParticles(unit.x + (dx / dist) * 22, unit.y + (dy / dist) * 22, 6, 'spark', '#06B6D4', 150, 0.25);
    } else if (unit.kind === 'golem') {
      this.shockwaves.push({
        x: unit.x,
        y: unit.y,
        currentRadius: 20,
        maxRadius: unit.range,
        life: 0.32,
        maxLife: 0.32,
        color: '#94A3B8',
      });
      soundEngine.playShieldBash();
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        if (distanceBetween(unit.x, unit.y, enemy.x, enemy.y) <= unit.range + enemy.radius) {
          const branch = this.arena.routes[enemy.routeIndex] ?? this.arena.routes[0];
          const totalLen = this.routeTotalLengths[enemy.routeIndex] ?? this.routeTotalLength;
          pushEnemyBackAlongRoute(enemy, branch.waypoints, 48, totalLen);
          const roll = rollCriticalHit(effectiveDamage, unit.critChance);
          this.handleEnemyDamaged(enemy, roll.damage, 0, 0, true, roll.isCrit, undefined);
        }
      }
      this.spawnTypedParticles(unit.x, unit.y, 10, 'smoke', '#CBD5E1', 95, 0.4);
    } else if (unit.kind === 'spore_witch') {
      this.shockwaves.push({
        x: unit.x,
        y: unit.y,
        currentRadius: 24,
        maxRadius: unit.range * 1.15,
        life: 0.42,
        maxLife: 0.42,
        color: '#84CC16',
      });
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        enemy.slowTimer = Math.max(enemy.slowTimer ?? 0, 3.2);
        if (distanceBetween(unit.x, unit.y, enemy.x, enemy.y) <= unit.range + enemy.radius) {
          const roll = rollCriticalHit(effectiveDamage, unit.critChance);
          this.handleEnemyDamaged(enemy, roll.damage, 0, 0, false, roll.isCrit, undefined);
        }
      }
      soundEngine.playSlash();
      this.spawnTypedParticles(unit.x, unit.y, 10, 'spark', '#BEF264', 110, 0.45);
    } else if (unit.kind === 'paladin') {
      const slashRadius = unit.range * 0.94;
      this.slashes.push({
        x: unit.x,
        y: unit.y,
        angle: unit.facingAngle,
        radius: slashRadius,
        life: 0.25,
        maxLife: 0.25,
        color: '#FACC15',
      });
      soundEngine.playSwordCleave();
      const hitEnemies = findEnemiesInSlashArc(
        unit.x,
        unit.y,
        unit.facingAngle,
        slashRadius,
        Math.PI * 0.72,
        this.enemies
      );
      for (const enemy of hitEnemies) {
        const roll = rollCriticalHit(effectiveDamage, unit.critChance);
        const kb = computeRadialKnockbackVector(unit.x, unit.y, enemy.x, enemy.y, 55);
        this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, undefined);
      }
      this.spawnTypedParticles(unit.x, unit.y, 10, 'spark', '#FEF08A', 150, 0.36);
    }
  }

  private handleEnemyDamaged(
    enemy: EnemyEntity,
    damage: number,
    knockX: number,
    knockY: number,
    heavy: boolean,
    isCrit: boolean,
    attackerHeroClass: HeroClass | undefined
  ) {
    const byHero = attackerHeroClass !== undefined;
    const res = applyDamageToEnemy(enemy, damage, { byHero });
    if (res.actualDamage <= 0) return;

    enemy.knockbackVx += knockX * (enemy.kind === 'boss' ? 0.22 : 1);
    enemy.knockbackVy += knockY * (enemy.kind === 'boss' ? 0.22 : 1);

    if (isCrit) {
      this.spawnTypedParticles(enemy.x, enemy.y, 8, 'spark', '#FACC15', 165, 0.34);
    }

    this.floatingTexts.push({
      x: enemy.x + (Math.random() - 0.5) * 12,
      y: enemy.y - enemy.radius - 16,
      vy: isCrit ? -54 : -36,
      text: isCrit ? `CRÍTICO! -${res.actualDamage}` : `-${res.actualDamage}`,
      color: isCrit ? '#FF3355' : heavy ? '#00D4FF' : '#FFFFFF',
      scale: isCrit ? 1.6 : heavy ? 1.05 : 0.9,
      life: isCrit ? 0.78 : 0.5,
      maxLife: isCrit ? 0.78 : 0.5,
      isCrit,
    });

    if (res.killed) {
      this.kills += 1;

      const gainedEssence = computeEnemyEssenceReward(
        enemy.kind,
        this.currentStage,
        this.spells.overchargeTimer > 0
      );
      this.essence += gainedEssence;
      this.essenceCollected += gainedEssence;

      this.comboCount += 1;
      this.comboTimer = 1.85;
      const comboBonus = Math.min(30, this.comboCount * 3);
      this.score += enemy.rewardScore + comboBonus;
      this.bestScore = Math.max(this.bestScore, this.score);

      const isElite = isEliteEnemy(enemy);
      const isBoss = enemy.kind === 'boss' || Boolean(enemy.isBoss);

      this.hitstopTimer = Math.max(
        this.hitstopTimer,
        isBoss ? 0.07 : isElite ? 0.048 : isCrit ? 0.038 : 0.022
      );
      // Subtle screenshake on elite defeat (+0.38 camera trauma) vs boss (+0.65) vs regular (+0.14)
      const shakeTrauma = isBoss ? 0.65 : isElite ? 0.38 : isCrit ? 0.24 : 0.14;
      this.cameraTrauma = Math.min(
        1,
        this.cameraTrauma + shakeTrauma
      );
      soundEngine.playKill();

      // Persistent XP gain for all deployed heroes (killer gets 100%, other heroes get assist XP)
      const overchargeMult = this.spells.overchargeTimer > 0 ? 1.5 : 1;
      let anyLeveledUp = false;
      for (const h of this.heroes) {
        const isDirectKiller = h.heroClass === attackerHeroClass;
        if (isDirectKiller) {
          h.kills += 1;
        }
        const share = isDirectKiller ? 1 : attackerHeroClass ? 0.35 : 0.7;
        const gainedXp = Math.max(3, Math.round(enemy.xpReward * share * overchargeMult));
        const lvlRes = applyHeroXpGain(h, gainedXp);
        if (lvlRes.leveledUp) {
          anyLeveledUp = true;
          this.applySavedStatsToHero(h);
          soundEngine.playLevelUp(lvlRes.isMaxReached);
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.4);
          this.hitstopTimer = 0.055;
          this.shockwaves.push({
            x: h.x,
            y: h.y,
            currentRadius: 24,
            maxRadius: 175,
            life: 0.48,
            maxLife: 0.48,
            color: '#FACC15',
          });
          this.spawnTypedParticles(h.x, h.y, 24, 'spark', '#FACC15', 220, 0.55);
          this.spawnTypedParticles(h.x, h.y, 12, 'spark', '#00D4FF', 180, 0.5);

          const milestoneLevel = crossedHeroUpgradeMilestone(
            lvlRes.previousLevel,
            lvlRes.newLevel
          );
          if (milestoneLevel !== null && !this.pendingUpgradeChoices) {
            this.openUpgradeMilestone(milestoneLevel, h.heroClass);
          } else if (lvlRes.isMaxReached) {
            this.triggerRewardBanner(
              `${HERO_SPECS[h.heroClass].name.toUpperCase()} MÁXIMO · Nv.${MAX_HERO_LEVEL}!`,
              undefined,
              'gold',
              1.2
            );
          } else {
            this.triggerRewardBanner(
              `${HERO_SPECS[h.heroClass].name.toUpperCase()} Nv.${lvlRes.newLevel}!`,
              'Evolução permanente salva',
              'electric',
              1.0
            );
          }
        }
      }

      if (!anyLeveledUp) {
        if (this.comboCount >= 6 && this.lastComboTier < 3) {
          this.lastComboTier = 3;
          soundEngine.playCombo(this.comboCount);
          this.triggerRewardBanner(`DOMÍNIO ${this.comboCount}x!`, undefined, 'crimson', 0.9);
        } else if (this.comboCount >= 4 && this.lastComboTier < 2) {
          this.lastComboTier = 2;
          soundEngine.playCombo(this.comboCount);
          this.triggerRewardBanner(`COMBO TRIPLO ${this.comboCount}x!`, undefined, 'gold', 0.85);
        } else if (this.comboCount >= 2 && this.lastComboTier < 1) {
          this.lastComboTier = 1;
          soundEngine.playCombo(this.comboCount);
          this.triggerRewardBanner('COMBO DUPLO!', undefined, 'electric', 0.8);
        }
      }

      this.persistProgress();

      const burstScale = isBoss ? 2 : isElite ? 1.5 : 1;
      this.spawnTypedParticles(enemy.x, enemy.y, 8 * burstScale, 'smoke', '#64748B', 95, 0.48);
      this.spawnTypedParticles(
        enemy.x,
        enemy.y,
        9 * burstScale,
        'spark',
        isCrit || isBoss || isElite ? '#FF2E4C' : '#FACC15',
        185,
        0.38
      );

      if (isElite && !isBoss) {
        this.shockwaves.push({
          x: enemy.x,
          y: enemy.y,
          currentRadius: 10,
          maxRadius: 72,
          life: 0.28,
          maxLife: 0.28,
          color: '#FACC15',
        });
        this.floatingTexts.push({
          x: enemy.x,
          y: enemy.y - enemy.radius - 42,
          vy: -32,
          text: 'ELITE DERROTADO!',
          color: '#FACC15',
          scale: 1.15,
          life: 0.85,
          maxLife: 0.85,
          isCrit: true,
        });
      }

      this.floatingTexts.push({
        x: enemy.x,
        y: enemy.y - enemy.radius - 28,
        vy: -44,
        text: `+${Math.round(enemy.xpReward * (attackerHeroClass ? 1 : 0.7) * overchargeMult)} XP · +${enemy.rewardScore}`,
        color: '#FACC15',
        scale: isBoss ? 1.28 : isElite ? 1.08 : 0.96,
        life: 0.72,
        maxLife: 0.72,
      });
    }
  }

  private updateVisualEffects(dt: number) {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      this.explosions[i].life -= dt;
      if (this.explosions[i].life <= 0) this.explosions.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1 - Math.max(0, sw.life / sw.maxLife);
      sw.currentRadius = 26 + (sw.maxRadius - 26) * progress;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life -= dt;
      ft.y += ft.vy * dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
    if (this.floatingTexts.length > 48) {
      this.floatingTexts.splice(0, this.floatingTexts.length - 48);
    }
    if (this.projectiles.length > 80) {
      this.projectiles.splice(0, this.projectiles.length - 80);
    }

    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.vRot * dt;
    }
  }

  public getHudSnapshot(): HudSnapshot {
    const active = this.hero;
    const xpBounds = getHeroXpBounds(active.level);
    const nextConvergenceStage =
      this.convergenceStages.find((s) => s >= Math.max(this.currentStage, this.highestUnlockedStage)) ??
      this.convergenceStages[this.convergenceStages.length - 1] ??
      6;

    return {
      phase: this.phase,
      stage: this.currentStage,
      routeArchetype: this.routeArchetype,
      stageTitle: this.stageTitle,
      totalWavesInStage: this.totalWavesInStage,
      highestUnlockedStage: this.highestUnlockedStage,
      isConvergenceStage: this.isConvergenceStage,
      nextConvergenceStage,
      routeLevel: this.routeLevel,
      maxRouteLevel: this.maxRouteLevel,
      openGatesCount: this.getActiveRouteIndices().length,
      baseHp: this.baseHp,
      baseMaxHp: this.baseMaxHp,
      baseLevel: this.baseLevel,
      essence: this.essence,
      essenceCollected: this.essenceCollected,
      evolutionPoints: this.evolutionPoints,
      lastEarnedEvolutionPoints: this.lastEarnedEvolutionPoints,
      score: this.score,
      bestScore: this.bestScore,
      wave: this.wave,
      kills: this.kills,
      survivalSeconds: this.survivalSeconds,
      selectedHeroClass: this.selectedHeroClass,
      heroRoster: {
        archer: { ...this.heroRoster.archer, upgradeChoices: [...this.heroRoster.archer.upgradeChoices] },
        swordsman: { ...this.heroRoster.swordsman, upgradeChoices: [...this.heroRoster.swordsman.upgradeChoices] },
        bomber: { ...this.heroRoster.bomber, upgradeChoices: [...this.heroRoster.bomber.upgradeChoices] },
      },
      activeHeroes: this.heroes.map((h) => {
        const b = getHeroXpBounds(h.level);
        return {
          heroClass: h.heroClass,
          level: h.level,
          xp: h.xp,
          currentLevelXp: b.currentFloor,
          nextLevelXp: b.nextThreshold,
          kills: h.kills,
          x: h.x,
          y: h.y,
          isFreePlaced: h.slotId === null,
        };
      }),
      activeHeroIndex: this.activeHeroIndex,
      heroLevel: active.level,
      heroXp: active.xp,
      heroCurrentLevelXp: xpBounds.currentFloor,
      heroNextLevelXp: xpBounds.nextThreshold,
      heroKills: active.kills,
      heroRepositionMode: this.heroRepositionMode,
      selectedUnit: this.selectedUnit,
      unitCount: this.units.length,
      maxUnitLevelReached: this.maxUnitLevelReached,
      mergesPerformed: this.mergesPerformed,
      comboCount: this.comboCount,
      activeBanner: this.activeBanner ? { ...this.activeBanner } : null,
      hoveredSlotId: this.hoveredSlotId,
      mutedMusic: soundEngine.mutedMusic,
      mutedSfx: soundEngine.mutedSfx,
      spellCooldowns: { ...this.spells.cooldowns },
      spellMaxCooldowns: { ...this.spells.maxCooldowns },
      targetingSpell: this.spells.targetingSpell,
      overchargeTimer: this.spells.overchargeTimer,
      bossActive: this.enemies.some((e) => e.kind === 'boss' && !e.isDead),
      pendingUpgradeChoices: this.pendingUpgradeChoices ? [...this.pendingUpgradeChoices] : null,
      pendingUpgradeMilestoneLevel: this.pendingUpgradeMilestoneLevel,
      pendingUpgradeHeroClass: this.pendingUpgradeHeroClass,
      heroUpgradesCount: this.heroUpgradesCount,
      paladinAuraActive: this.units.some((u) => u.kind === 'paladin' && u.hp > 0),
    };
  }
}
