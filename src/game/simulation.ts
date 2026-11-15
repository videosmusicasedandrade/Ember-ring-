import { soundEngine } from './audio';
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
  computeRadialKnockbackVector,
  computeRouteSpawnPoint,
  computeRouteTotalLength,
  computeWaveConfig,
  distanceBetween,
  findEnemiesInSlashArc,
  findNearestEnemyInRange,
  findSlotAtPoint,
  getHeroStatsForLevel,
  getHeroXpBounds,
  getStageConfig,
  getStageRouteDefinition,
  pushEnemyBackAlongRoute,
  rollCriticalHit,
  unlockNextStage,
} from './engineMath';
import { loadProgress, saveProgress } from './storage';
import {
  ArenaConfig,
  ArenaSlot,
  DEFAULT_ARENA,
  DragState,
  EnemyEntity,
  EnemyKind,
  ExplosionEffect,
  FloatingText,
  GamePhase,
  HERO_SPECS,
  HeroClass,
  HeroEntity,
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

export class GameSimulation {
  public arena: ArenaConfig = DEFAULT_ARENA;
  public routeTotalLength = 0;
  public phase: GamePhase = 'title';
  public currentStage = 1;
  public routeArchetype = 'Trilha Reta';
  public stageTitle = 'Trilha da Clareira';
  public totalWavesInStage = 2;
  public highestUnlockedStage = 1;
  public selectedHeroClass: HeroClass = 'archer';
  public hero: HeroEntity;
  public heroRepositionMode = false;

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
  public essence = 110;
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
  private waveSpawnTimer = 0;
  private waveBreakTimer = 0;
  private waveSpawnInterval = 1.25;
  private waveHpMult = 1;
  private waveSpeedMult = 1;
  private isBossWave = false;
  private waveBossHp = 280;
  private bossSpawnedInWave = false;
  private waveMix: Record<Exclude<EnemyKind, 'boss'>, number> = {
    walker: 0.72,
    shielded: 0.2,
    brute: 0.08,
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
    this.hero = this.createHeroEntity(this.selectedHeroClass, 's1-5', 545, 295);
    this.resetWorld('title', 1, this.selectedHeroClass);
  }

  private createHeroEntity(heroClass: HeroClass, slotId: string, x: number, y: number): HeroEntity {
    const stats = getHeroStatsForLevel(heroClass, 1);
    return {
      heroClass,
      slotId,
      x,
      y,
      level: 1,
      xp: 0,
      kills: 0,
      range: stats.range,
      damage: stats.damage,
      cooldown: stats.cooldown,
      cooldownTimer: 0.1,
      critChance: stats.critChance,
      blastRadius: stats.blastRadius,
      facingAngle: 0,
      attackAnim: 0,
      recoil: 0,
      levelUpFlash: 0,
    };
  }

  public setHeroClass(heroClass: HeroClass) {
    this.selectedHeroClass = heroClass;
    const stats = getHeroStatsForLevel(heroClass, 1);
    this.hero.heroClass = heroClass;
    this.hero.damage = stats.damage;
    this.hero.cooldown = stats.cooldown;
    this.hero.range = stats.range;
    this.hero.critChance = stats.critChance;
    this.hero.blastRadius = stats.blastRadius;
    saveProgress({
      highestUnlockedStage: this.highestUnlockedStage,
      bestScore: this.bestScore,
      selectedHeroClass: this.selectedHeroClass,
    });
  }

  public toggleHeroRepositionMode() {
    if (this.phase !== 'playing') return;
    this.spells.targetingSpell = null;
    this.heroRepositionMode = !this.heroRepositionMode;
  }

  private triggerRewardBanner(text: string, subtext: string | undefined, tone: RewardTone, duration = 1.7) {
    this.activeBanner = {
      id: this.nextBannerId++,
      text,
      subtext,
      tone,
      life: duration,
      maxLife: duration,
    };
  }

  public resetWorld(targetPhase: GamePhase, stageNumber?: number, heroClassOverride?: HeroClass) {
    const saved = loadProgress();
    this.highestUnlockedStage = Math.max(this.highestUnlockedStage, saved.highestUnlockedStage);
    this.bestScore = Math.max(this.bestScore, saved.bestScore);

    if (heroClassOverride) {
      this.selectedHeroClass = heroClassOverride;
    }

    this.currentStage = Math.max(
      1,
      Math.min(TOTAL_STAGES, stageNumber ?? this.currentStage)
    );
    this.arena = buildArenaForStage(this.currentStage);
    this.routeTotalLength = computeRouteTotalLength(this.arena.waypoints);

    const routeDef = getStageRouteDefinition(this.currentStage);
    const stageCfg = getStageConfig(this.currentStage);
    this.routeArchetype = stageCfg.routeArchetype;
    this.stageTitle = stageCfg.title;
    this.totalWavesInStage = stageCfg.totalWaves;

    this.phase = targetPhase;
    this.slots = buildArenaSlots(this.arena);
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

    this.baseHp = 100;
    this.baseMaxHp = 100;
    this.baseLevel = 1;
    this.essence = 110;
    this.essenceCollected = 0;
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

    // Place Chosen Main Hero on the stage's prime tactical slot
    const heroSlot =
      this.slots.find((s) => s.id === routeDef.heroStartSlotId) ??
      this.slots[Math.floor(this.slots.length / 2)] ??
      this.slots[0];
    this.hero = this.createHeroEntity(this.selectedHeroClass, heroSlot.id, heroSlot.x, heroSlot.y);
    heroSlot.hasHero = true;

    // Place 2 tactical starter support units at early & late bends
    const earlyEmpty = this.slots.find((s) => !s.hasHero && s.unitId === null);
    if (earlyEmpty) this.deployUnitToSlotId(earlyEmpty.id, 'scout', true);

    const lateEmpty = [...this.slots].reverse().find((s) => !s.hasHero && s.unitId === null);
    if (lateEmpty) this.deployUnitToSlotId(lateEmpty.id, 'shield', true);

    this.startWave(1);

    if (targetPhase === 'playing') {
      // Initial vanguard spaced cleanly on early route
      this.spawnEnemyAlongRoute('walker', 0.12);
      this.spawnEnemyAlongRoute('walker', 0.04);
      this.waveRemainingToSpawn = Math.max(3, this.waveRemainingToSpawn - 2);
      this.queueHordeWarning(2, false);

      if (this.currentStage >= 2) {
        this.triggerRewardBanner(
          'NOVA ROTA DESBLOQUEADA!',
          `Fase ${this.currentStage} · ${this.routeArchetype}`,
          'electric',
          2.0
        );
      } else {
        this.triggerRewardBanner(
          `${HERO_SPECS[this.selectedHeroClass].name.toUpperCase()} EM CAMPO!`,
          `${this.stageTitle} · ${this.routeArchetype}`,
          'gold',
          1.7
        );
      }
    }
  }

  private queueHordeWarning(spawnCount: number, isBoss = false) {
    const start = this.arena.waypoints[0] ?? { x: 96, y: 410 };
    const next = this.arena.waypoints[1] ?? { x: 380, y: 410 };
    this.hordeWarnings.push({
      x: start.x,
      y: start.y,
      angle: Math.atan2(next.y - start.y, next.x - start.x),
      timer: isBoss ? 2.3 : 1.8,
      maxTimer: isBoss ? 2.3 : 1.8,
      spawnCount,
      spawned: false,
      isBoss,
    });
  }

  private startWave(waveNum: number) {
    this.wave = waveNum;
    const cfg = computeWaveConfig(waveNum, this.currentStage);
    this.waveRemainingToSpawn = cfg.totalEnemies;
    this.waveSpawnInterval = cfg.spawnInterval;
    this.waveHpMult = cfg.hpMultiplier;
    this.waveSpeedMult = cfg.speedMultiplier;
    this.isBossWave = cfg.isBossWave;
    this.waveBossHp = cfg.bossHp;
    this.bossSpawnedInWave = false;
    this.waveMix = cfg.mix;
    this.waveSpawnTimer = 0.65;
    this.waveBreakTimer = 0;

    if (waveNum >= 2) {
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

    this.spinningBlades.push({
      x,
      y,
      radius: 126,
      damagePerTick: 30 + (this.hero.level - 1) * 9,
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
      pushEnemyBackAlongRoute(enemy, this.arena.waypoints, pushDist, this.routeTotalLength);
      enemy.stunTimer = Math.max(enemy.stunTimer, 0.7);
      this.handleEnemyDamaged(enemy, 22, 0, 0, true, false, true);
    }

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.62);
    this.hitstopTimer = 0.05;
    soundEngine.playSpellShockwave();
    this.spawnTypedParticles(this.arena.castleX, this.arena.castleY, 24, 'spark', '#00D4FF', 250, 0.52);
    this.spawnTypedParticles(this.arena.castleX, this.arena.castleY, 16, 'smoke', '#E2E8F0', 140, 0.6);
    this.triggerRewardBanner('ONDA DE CHOQUE!', 'Horda empurrada para trás', 'electric', 1.45);
  }

  private castOvercharge() {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.overcharge = this.spells.maxCooldowns.overcharge;
    this.spells.overchargeTimer = 10;
    this.overchargeTickTimer = 0.5;

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.28);
    soundEngine.playSpellOvercharge();
    this.spawnTypedParticles(this.hero.x, this.hero.y, 22, 'spark', '#FACC15', 180, 0.55);
    this.triggerRewardBanner('SUPERCARGA ATIVA!', '+50% Essência e XP por 10s', 'gold', 1.5);
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
      damage: spec.damage,
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

  private moveHeroToSlot(targetSlot: ArenaSlot): boolean {
    const oldSlot = this.slots.find((s) => s.id === this.hero.slotId);
    if (!oldSlot || oldSlot.id === targetSlot.id) {
      this.heroRepositionMode = false;
      return false;
    }

    if (targetSlot.unitId !== null) {
      // Clean swap between Hero and occupying troop!
      const occupant = this.units.find((u) => u.id === targetSlot.unitId);
      if (occupant) {
        oldSlot.hasHero = false;
        oldSlot.unitId = occupant.id;
        occupant.slotId = oldSlot.id;
        occupant.x = oldSlot.x;
        occupant.y = oldSlot.y;

        targetSlot.unitId = null;
        targetSlot.hasHero = true;
        this.hero.slotId = targetSlot.id;
        this.hero.x = targetSlot.x;
        this.hero.y = targetSlot.y;
      }
    } else {
      oldSlot.hasHero = false;
      targetSlot.hasHero = true;
      this.hero.slotId = targetSlot.id;
      this.hero.x = targetSlot.x;
      this.hero.y = targetSlot.y;
    }

    this.heroRepositionMode = false;
    soundEngine.playDeploy();
    this.spawnTypedParticles(
      targetSlot.x,
      targetSlot.y,
      14,
      'spark',
      HERO_SPECS[this.hero.heroClass].color,
      135,
      0.42
    );
    this.floatingTexts.push({
      x: targetSlot.x,
      y: targetSlot.y - 34,
      vy: -30,
      text: `${HERO_SPECS[this.hero.heroClass].name}!`,
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

    const slot = findSlotAtPoint(worldX, worldY, this.slots);
    if (!slot) {
      this.heroRepositionMode = false;
      return false;
    }

    if (this.heroRepositionMode) {
      return this.moveHeroToSlot(slot);
    }

    if (slot.hasHero) {
      this.dragState = {
        source: 'hero',
        fromSlotId: slot.id,
        kind: 'scout',
        level: this.hero.level,
        worldX,
        worldY,
        startedAtX: worldX,
        startedAtY: worldY,
        hasMoved: false,
      };
      return true;
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
    const targetSlot = findSlotAtPoint(worldX, worldY, this.slots);
    if (!targetSlot) return false;

    if (drag.source === 'hero') {
      if (!drag.hasMoved) {
        this.heroRepositionMode = true;
        return true;
      }
      return this.moveHeroToSlot(targetSlot);
    }

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

  private pickEnemyKind(): EnemyKind {
    const r = Math.random();
    if (r < this.waveMix.walker) return 'walker';
    if (r < this.waveMix.walker + this.waveMix.shielded) return 'shielded';
    return 'brute';
  }

  private spawnEnemyAlongRoute(forcedKind?: EnemyKind, initialProgressFrac = 0) {
    const kind = forcedKind ?? this.pickEnemyKind();
    const laneOffset = kind === 'boss' ? 0 : (Math.random() - 0.5) * 18;
    const spawn = computeRouteSpawnPoint(this.arena.waypoints, laneOffset);

    let baseHp = 24;
    let baseSpeed = 48;
    let radius = 17;
    let damage = 10;
    let attackCooldown = 1.05;
    let rewardEssence = 9;
    let rewardScore = 15;
    let xpReward = 10;

    if (kind === 'shielded') {
      baseHp = 50;
      baseSpeed = 38;
      radius = 20;
      damage = 14;
      attackCooldown = 1.15;
      rewardEssence = 13;
      rewardScore = 25;
      xpReward = 16;
    } else if (kind === 'brute') {
      baseHp = 92;
      baseSpeed = 42;
      radius = 22;
      damage = 18;
      attackCooldown = 1.2;
      rewardEssence = 18;
      rewardScore = 40;
      xpReward = 26;
    } else if (kind === 'boss') {
      baseHp = this.waveBossHp;
      baseSpeed = 30;
      radius = 34;
      damage = 28 + this.currentStage * 4;
      attackCooldown = 1.25;
      rewardEssence = 50 + this.currentStage * 5;
      rewardScore = 200 + this.currentStage * 40;
      xpReward = 95;
    }

    const hp = kind === 'boss' ? baseHp : Math.round(baseHp * this.waveHpMult);
    const speed = baseSpeed * this.waveSpeedMult;

    const enemy: EnemyEntity = {
      id: this.nextEntityId++,
      kind,
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
      waypointIndex: 1,
      laneOffset,
      pathProgress: 0,
      hitFlash: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      stunTimer: 0,
      koTimer: 0,
      isDead: false,
      bracingTimer: 0,
      lungeTimer: 0,
      lungeCooldown: 2.2 + Math.random() * 2.5,
    };

    if (initialProgressFrac > 0) {
      advanceEnemyAlongRoute(
        enemy,
        this.arena.waypoints,
        this.routeTotalLength * initialProgressFrac,
        speed,
        this.routeTotalLength
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
      const gate = this.arena.waypoints[0];
      if (gate && Math.random() < dt * 7) {
        this.spawnTypedParticles(
          gate.x + (Math.random() - 0.5) * 20,
          gate.y + (Math.random() - 0.5) * 20,
          1,
          'spark',
          Math.random() > 0.45 ? '#00D4FF' : '#FF2E4C',
          42,
          0.85
        );
      }
      this.hero.attackAnim = Math.max(0, this.hero.attackAnim - dt * 3);
      this.hero.recoil = Math.max(0, this.hero.recoil - dt * 5);
      for (const unit of this.units) {
        unit.attackAnim = Math.max(0, unit.attackAnim - dt * 3);
        unit.recoil = Math.max(0, unit.recoil - dt * 5);
      }
      this.updateVisualEffects(dt);
      return;
    }

    if (this.phase !== 'playing') return;

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
        this.essence += 3;
        this.essenceCollected += 3;
        this.spawnTypedParticles(this.hero.x, this.hero.y - 10, 3, 'spark', '#FACC15', 70, 0.45);
      }
    }

    // Route Entrance Horde Surge Warnings
    this.surgeScheduleTimer -= dt;
    if (this.surgeScheduleTimer <= 0 && this.waveRemainingToSpawn >= 3) {
      this.surgeScheduleTimer = Math.max(5.5, 8.8 - this.wave * 0.4);
      this.queueHordeWarning(Math.min(4, 2 + Math.floor(this.wave / 2)), false);
    }

    for (let i = this.hordeWarnings.length - 1; i >= 0; i--) {
      const w = this.hordeWarnings[i];
      w.timer -= dt;
      if (w.timer <= 0 && !w.spawned) {
        w.spawned = true;
        if (w.isBoss) {
          this.spawnEnemyAlongRoute('boss', 0);
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
          this.triggerRewardBanner('CHEFE NA ROTA!', 'Concentre seu poder de fogo!', 'crimson', 1.8);
        } else {
          for (let k = 0; k < w.spawnCount; k++) {
            this.spawnEnemyAlongRoute(undefined, k * 0.015);
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
            this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, true);
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

    // 1. Route Wave Spawner & Boss Trigger
    if (this.waveRemainingToSpawn > 0) {
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
        saveProgress({
          highestUnlockedStage: this.highestUnlockedStage,
          bestScore: this.bestScore,
          selectedHeroClass: this.selectedHeroClass,
        });
        soundEngine.stopMusic();
        soundEngine.playVictory();
        return;
      }
      this.waveBreakTimer += dt;
      if (this.waveBreakTimer >= 1.3) {
        this.startWave(this.wave + 1);
      }
    }

    // 2A. Main Hero Auto-Combat
    this.hero.cooldownTimer = Math.max(0, this.hero.cooldownTimer - dt);
    this.hero.attackAnim = Math.max(0, this.hero.attackAnim - dt * 4.2);
    this.hero.recoil = Math.max(0, this.hero.recoil - dt * 6);
    this.hero.levelUpFlash = Math.max(0, this.hero.levelUpFlash - dt);

    if (this.hero.cooldownTimer <= 0) {
      const target = findNearestEnemyInRange(this.hero, this.enemies, this.arena);
      if (target) {
        this.hero.facingAngle = Math.atan2(target.y - this.hero.y, target.x - this.hero.x);
        this.hero.cooldownTimer = this.hero.cooldown;
        this.hero.attackAnim = 1;
        this.hero.recoil = 1;
        this.performHeroAttack(target);
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
      if (proj.isBomb && proj.startX !== undefined && proj.startY !== undefined && proj.targetX !== undefined && proj.targetY !== undefined && proj.arcDuration) {
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
        if (circlesCollide(proj.x, proj.y, proj.radius, enemy.x, enemy.y, enemy.radius)) {
          const roll = rollCriticalHit(proj.damage, proj.critChance);
          this.handleEnemyDamaged(
            enemy,
            roll.damage,
            proj.vx * 0.04,
            proj.vy * 0.04,
            proj.isShockwave,
            roll.isCrit,
            Boolean(proj.isHeroAttack)
          );
          hit = true;
          if (!proj.isShockwave) break;
        }
      }

      if (hit && !proj.isShockwave) {
        this.spawnTypedParticles(proj.x, proj.y, 6, 'spark', proj.color, 115, 0.28);
        this.projectiles.splice(i, 1);
      } else if (proj.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Enemies March Along Route & Castle Breach
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.attackAnim = Math.max(0, enemy.attackAnim - dt * 4);
      enemy.stunTimer = Math.max(0, enemy.stunTimer - dt);

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

      let speedMult = 1;
      if (enemy.kind === 'shielded') {
        enemy.bracingTimer = Math.max(0, enemy.bracingTimer - dt);
        enemy.lungeCooldown -= dt;
        if (enemy.lungeCooldown <= 0) {
          enemy.bracingTimer = 0.9;
          enemy.lungeCooldown = 4.2 + Math.random() * 1.5;
        }
        if (enemy.bracingTimer > 0) speedMult = 0.6;
      } else if (enemy.kind === 'brute') {
        enemy.lungeCooldown -= dt;
        if (enemy.lungeTimer > 0) {
          enemy.lungeTimer = Math.max(0, enemy.lungeTimer - dt);
          speedMult = enemy.lungeTimer > 0.32 ? 0.35 : 2.05;
        } else if (enemy.lungeCooldown <= 0 && enemy.pathProgress > 0.15 && enemy.pathProgress < 0.88) {
          enemy.lungeTimer = 0.65;
          enemy.lungeCooldown = 3.8 + Math.random() * 1.5;
        }
      }

      const moveStep = enemy.speed * speedMult * dt;
      const stepRes = advanceEnemyAlongRoute(
        enemy,
        this.arena.waypoints,
        moveStep,
        enemy.speed * speedMult,
        this.routeTotalLength
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
          saveProgress({
            highestUnlockedStage: this.highestUnlockedStage,
            bestScore: this.bestScore,
            selectedHeroClass: this.selectedHeroClass,
          });
          soundEngine.stopMusic();
          soundEngine.playDefeat();
          return;
        }
      }
    }

    this.updateVisualEffects(dt);
  }

  private performHeroAttack(target: EnemyEntity) {
    const hero = this.hero;

    if (hero.heroClass === 'archer') {
      const baseAngle = Math.atan2(target.y - hero.y, target.x - hero.x);
      const speed = 640;
      const volleyAngles =
        hero.level >= 5 ? [-0.14, 0, 0.14] : hero.level >= 3 ? [-0.08, 0.08] : [0];

      for (const offsetAngle of volleyAngles) {
        const ang = baseAngle + offsetAngle;
        this.projectiles.push({
          id: this.nextEntityId++,
          x: hero.x + Math.cos(ang) * 20,
          y: hero.y + Math.sin(ang) * 20,
          vx: Math.cos(ang) * speed,
          vy: Math.sin(ang) * speed,
          radius: 7 + (hero.level - 1) * 0.8,
          damage: hero.damage,
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
        this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, true);
      }

      if (hitEnemies.length >= 3 && this.time - this.lastExcellenceBannerTime > 5) {
        this.lastExcellenceBannerTime = this.time;
        this.triggerRewardBanner('EXCELENTE!', `Corte múltiplo (${hitEnemies.length} alvos)`, 'crimson', 1.45);
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
        radius: 11 + (hero.level - 1) * 1.1,
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
        this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit, true);
      }
    }

    if (hitCount >= 3 && this.time - this.lastExcellenceBannerTime > 5) {
      this.lastExcellenceBannerTime = this.time;
      this.triggerRewardBanner('EXCELENTE!', `Explosão atingiu ${hitCount} inimigos!`, 'gold', 1.45);
    }
  }

  private performUnitAttack(unit: UnitEntity, target: EnemyEntity) {
    if (unit.kind === 'scout') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 560;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 18,
        y: unit.y + (dy / dist) * 18,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 6 + (unit.level - 1) * 1.2,
        damage: unit.damage,
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
        damage: unit.damage,
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
      const slashRadius = unit.range * 0.9;
      this.slashes.push({
        x: unit.x,
        y: unit.y,
        angle: unit.facingAngle,
        radius: slashRadius,
        life: 0.24,
        maxLife: 0.24,
        color: unit.level >= 2 ? '#FACC15' : '#34D399',
      });
      soundEngine.playSlash();

      const hitEnemies = findEnemiesInSlashArc(
        unit.x,
        unit.y,
        unit.facingAngle,
        slashRadius,
        Math.PI * 0.58,
        this.enemies
      );
      for (const enemy of hitEnemies) {
        const roll = rollCriticalHit(unit.damage, unit.critChance);
        this.handleEnemyDamaged(enemy, roll.damage, 0, 0, true, roll.isCrit, false);
      }
      this.spawnTypedParticles(
        unit.x + Math.cos(unit.facingAngle) * 44,
        unit.y + Math.sin(unit.facingAngle) * 44,
        7,
        'spark',
        '#4ADE80',
        125,
        0.38
      );
    }
  }

  private handleEnemyDamaged(
    enemy: EnemyEntity,
    damage: number,
    knockX: number,
    knockY: number,
    heavy: boolean,
    isCrit: boolean,
    byHero: boolean
  ) {
    const res = applyDamageToEnemy(enemy, damage);
    if (res.actualDamage <= 0) return;

    enemy.knockbackVx += knockX * (enemy.kind === 'boss' ? 0.22 : 1);
    enemy.knockbackVy += knockY * (enemy.kind === 'boss' ? 0.22 : 1);

    if (isCrit) {
      this.spawnTypedParticles(enemy.x, enemy.y, 8, 'spark', '#FACC15', 165, 0.34);
    }

    this.floatingTexts.push({
      x: enemy.x + (Math.random() - 0.5) * 10,
      y: enemy.y - enemy.radius - 14,
      vy: isCrit ? -48 : -36,
      text: isCrit ? `-${res.actualDamage}!` : `-${res.actualDamage}`,
      color: isCrit ? '#FACC15' : heavy ? '#00D4FF' : '#FFFFFF',
      scale: isCrit ? 1.35 : heavy ? 1.05 : 0.9,
      life: isCrit ? 0.68 : 0.5,
      maxLife: isCrit ? 0.68 : 0.5,
      isCrit,
    });

    if (res.killed) {
      this.kills += 1;
      if (byHero) {
        this.hero.kills += 1;
      }

      const overchargeMult = this.spells.overchargeTimer > 0 ? 1.5 : 1;
      const gainedEssence = Math.ceil(enemy.rewardEssence * overchargeMult);
      this.essence += gainedEssence;
      this.essenceCollected += gainedEssence;

      // Combo tracker
      this.comboCount += 1;
      this.comboTimer = 1.85;
      const comboBonus = Math.min(30, this.comboCount * 3);
      this.score += enemy.rewardScore + comboBonus;
      this.bestScore = Math.max(this.bestScore, this.score);

      this.hitstopTimer = Math.max(
        this.hitstopTimer,
        enemy.kind === 'boss' ? 0.08 : isCrit ? 0.04 : 0.025
      );
      this.cameraTrauma = Math.min(
        1,
        this.cameraTrauma + (enemy.kind === 'boss' ? 0.65 : isCrit ? 0.24 : 0.14)
      );
      soundEngine.playKill();

      // Hero XP progression in real time!
      const xpShare = byHero ? 1 : 0.72;
      const gainedXp = Math.max(4, Math.round(enemy.xpReward * xpShare * overchargeMult));
      const lvlRes = applyHeroXpGain(this.hero, gainedXp);
      if (lvlRes.leveledUp) {
        soundEngine.playLevelUp(lvlRes.isMaxReached);
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.45);
        this.hitstopTimer = 0.06;
        this.shockwaves.push({
          x: this.hero.x,
          y: this.hero.y,
          currentRadius: 24,
          maxRadius: 175,
          life: 0.48,
          maxLife: 0.48,
          color: '#FACC15',
        });
        this.spawnTypedParticles(this.hero.x, this.hero.y, 26, 'spark', '#FACC15', 220, 0.6);
        this.spawnTypedParticles(this.hero.x, this.hero.y, 14, 'spark', '#00D4FF', 180, 0.55);

        if (lvlRes.isMaxReached) {
          this.triggerRewardBanner(
            'EVOLUÇÃO MÁXIMA!',
            `${HERO_SPECS[this.hero.heroClass].name} atingiu Nv.${MAX_HERO_LEVEL}!`,
            'gold',
            2.1
          );
        } else {
          this.triggerRewardBanner(
            `HERÓI Nv.${lvlRes.newLevel}!`,
            'Poder de ataque e tamanho aumentados!',
            'electric',
            1.75
          );
        }
      } else {
        // Combo callouts (only when not overriding a fresh level-up banner)
        if (this.comboCount >= 6 && this.lastComboTier < 3) {
          this.lastComboTier = 3;
          soundEngine.playCombo(this.comboCount);
          this.triggerRewardBanner('IMPARÁVEL!', `${this.comboCount}x abates seguidos!`, 'crimson', 1.45);
        } else if (this.comboCount >= 4 && this.lastComboTier < 2) {
          this.lastComboTier = 2;
          soundEngine.playCombo(this.comboCount);
          this.triggerRewardBanner('COMBO TRIPLO!', `${this.comboCount}x em sequência!`, 'gold', 1.35);
        } else if (this.comboCount >= 2 && this.lastComboTier < 1) {
          this.lastComboTier = 1;
          soundEngine.playCombo(this.comboCount);
          this.triggerRewardBanner('COMBO DUPLO!', '+Bônus de Pontuação', 'electric', 1.25);
        }
      }

      const burstScale = enemy.kind === 'boss' ? 2 : 1;
      this.spawnTypedParticles(enemy.x, enemy.y, 8 * burstScale, 'smoke', '#64748B', 95, 0.48);
      this.spawnTypedParticles(
        enemy.x,
        enemy.y,
        9 * burstScale,
        'spark',
        isCrit || enemy.kind === 'boss' ? '#FF2E4C' : '#FACC15',
        185,
        0.38
      );

      this.floatingTexts.push({
        x: enemy.x,
        y: enemy.y - enemy.radius - 28,
        vy: -44,
        text: `+${gainedXp} XP · +${enemy.rewardScore}`,
        color: '#FACC15',
        scale: enemy.kind === 'boss' ? 1.28 : 0.98,
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
    const xpBounds = getHeroXpBounds(this.hero.level);
    return {
      phase: this.phase,
      stage: this.currentStage,
      routeArchetype: this.routeArchetype,
      stageTitle: this.stageTitle,
      totalWavesInStage: this.totalWavesInStage,
      highestUnlockedStage: this.highestUnlockedStage,
      baseHp: this.baseHp,
      baseMaxHp: this.baseMaxHp,
      baseLevel: this.baseLevel,
      essence: this.essence,
      essenceCollected: this.essenceCollected,
      score: this.score,
      bestScore: this.bestScore,
      wave: this.wave,
      kills: this.kills,
      survivalSeconds: this.survivalSeconds,
      selectedHeroClass: this.selectedHeroClass,
      heroLevel: this.hero.level,
      heroXp: this.hero.xp,
      heroCurrentLevelXp: xpBounds.currentFloor,
      heroNextLevelXp: xpBounds.nextThreshold,
      heroKills: this.hero.kills,
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
    };
  }
}
