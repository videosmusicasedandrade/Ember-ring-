import { soundEngine } from './audio';
import {
  applyDamageToBase,
  applyDamageToEnemy,
  applyDamageToUnit,
  applyMergeUpgrade,
  buildArenaSlots,
  canMergeUnits,
  circlesCollide,
  computePerimeterSpawnPoint,
  computeRadialKnockbackVector,
  computeWaveConfig,
  distanceBetween,
  findBlockingUnitForEnemy,
  findEnemiesInSlashArc,
  findNearestEnemyInRange,
  findSlotAtPoint,
  getStageConfig,
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
  FloatingText,
  GamePhase,
  HordeWarningIndicator,
  HudSnapshot,
  Particle,
  ParticleKind,
  ProjectileEntity,
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

const PARTICLE_POOL_SIZE = 320;

export class GameSimulation {
  public readonly arena: ArenaConfig = DEFAULT_ARENA;
  public phase: GamePhase = 'title';
  public currentStage = 1;
  public totalWavesInStage = 2;
  public highestUnlockedStage = 1;
  public slots: ArenaSlot[] = [];
  public units: UnitEntity[] = [];
  public enemies: EnemyEntity[] = [];
  public projectiles: ProjectileEntity[] = [];
  public slashes: SlashEffect[] = [];
  public spinningBlades: SpinningBladeHazard[] = [];
  public shockwaves: ShockwaveRingEffect[] = [];
  public hordeWarnings: HordeWarningIndicator[] = [];
  public floatingTexts: FloatingText[] = [];
  public readonly particles: Particle[] = [];
  private particleCursor = 0;

  public baseHp = 100;
  public baseMaxHp = 100;
  public baseLevel = 1;
  public essence = 95;
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
  private waveMix: Record<Exclude<EnemyKind, 'boss'>, number> = { walker: 0.7, shielded: 0.22, brute: 0.08 };
  private spawnSectorIndex = 0;
  private surgeScheduleTimer = 3.2;
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
    this.resetWorld('title', 1);
  }

  public resetWorld(targetPhase: GamePhase, stageNumber?: number) {
    const saved = loadProgress();
    this.highestUnlockedStage = Math.max(this.highestUnlockedStage, saved.highestUnlockedStage);
    this.bestScore = Math.max(this.bestScore, saved.bestScore);

    this.currentStage = Math.max(
      1,
      Math.min(TOTAL_STAGES, stageNumber ?? this.currentStage)
    );
    const stageCfg = getStageConfig(this.currentStage);
    this.totalWavesInStage = stageCfg.totalWaves;

    this.phase = targetPhase;
    this.slots = buildArenaSlots(this.arena);
    this.units = [];
    this.enemies = [];
    this.projectiles = [];
    this.slashes = [];
    this.spinningBlades = [];
    this.shockwaves = [];
    this.hordeWarnings = [];
    this.floatingTexts = [];
    for (const p of this.particles) p.active = false;

    this.baseHp = 100;
    this.baseMaxHp = 100;
    this.baseLevel = 1;
    this.essence = 100;
    this.essenceCollected = 0;
    this.score = 0;
    this.wave = 1;
    this.kills = 0;
    this.survivalSeconds = 0;
    this.selectedUnit = 'scout';
    this.hoveredSlotId = null;
    this.dragState = null;
    this.mergesPerformed = 0;
    this.maxUnitLevelReached = 1;
    this.hitstopTimer = 0;
    this.cameraTrauma = 0;
    this.baseHitFlash = 0;
    this.nextEntityId = 1;
    this.spawnSectorIndex = 0;
    this.surgeScheduleTimer = 3.2;
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

    this.deployUnitToSlotId('r2-5', 'scout', true);
    this.deployUnitToSlotId('r2-4', 'shield', true);
    this.deployUnitToSlotId('r2-3', 'shield', true);
    this.deployUnitToSlotId('r1-0', 'frog', true);

    this.startWave(1);

    if (targetPhase === 'playing') {
      this.spawnEnemyAtAngle(-0.45, 'brute');
      this.spawnEnemyAtAngle(0.35, 'walker');
      this.spawnEnemyAtAngle(2.25, 'shielded');
      this.spawnEnemyAtAngle(4.1, 'walker');
      this.waveRemainingToSpawn = Math.max(2, this.waveRemainingToSpawn - 4);
      // Immediate subtle directional indicator for first surge
      this.queueHordeWarning(0.85, 3);
    }
  }

  private queueHordeWarning(angle: number, spawnCount: number, isBoss = false) {
    this.hordeWarnings.push({
      angle,
      timer: isBoss ? 2.4 : 2.1,
      maxTimer: isBoss ? 2.4 : 2.1,
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
    this.waveSpawnTimer = 0.6;
    this.waveBreakTimer = 0;

    if (waveNum >= 2) {
      for (const u of this.units) {
        if (u.hp > 0 && u.hp < u.maxHp) {
          u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.15));
        }
      }
      this.queueHordeWarning(
        Math.random() * Math.PI * 2,
        Math.min(5, 2 + Math.floor((waveNum + this.currentStage) / 2))
      );
    }

    const nextLevel = 1 + Math.floor((waveNum - 1) / 2);
    if (nextLevel > this.baseLevel) {
      this.baseLevel = nextLevel;
      this.floatingTexts.push({
        x: this.arena.centerX,
        y: this.arena.centerY - 58,
        vy: -28,
        text: `Núcleo Nv.${this.baseLevel}!`,
        color: '#FDE047',
        scale: 1.25,
        life: 1.15,
        maxLife: 1.15,
      });
    }
  }

  public activateSpell(kind: SpellKind): boolean {
    if (this.phase !== 'playing') return false;
    if (this.spells.cooldowns[kind] > 0) return false;

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
  }

  private castSpinningBlade(x: number, y: number) {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.blade = this.spells.maxCooldowns.blade;

    this.spinningBlades.push({
      x,
      y,
      radius: 122,
      damagePerTick: 28 + (this.baseLevel - 1) * 8,
      life: 2.6,
      maxLife: 2.6,
      tickTimer: 0,
      rotation: 0,
    });

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.42);
    this.hitstopTimer = 0.04;
    soundEngine.playSpellBlade();
    this.spawnTypedParticles(x, y, 16, 'grass', '#84CC16', 170, 0.5);
    this.spawnTypedParticles(x, y, 14, 'spark', '#6EE7B7', 210, 0.42);
    this.floatingTexts.push({
      x,
      y: y - 34,
      vy: -30,
      text: 'Lâmina Giratória!',
      color: '#6EE7B7',
      scale: 1.15,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private castShockwave() {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.shockwave = this.spells.maxCooldowns.shockwave;

    this.shockwaves.push({
      x: this.arena.centerX,
      y: this.arena.centerY,
      currentRadius: this.arena.coreRadius,
      maxRadius: 430,
      life: 0.55,
      maxLife: 0.55,
    });

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      const kb = computeRadialKnockbackVector(
        this.arena.centerX,
        this.arena.centerY,
        enemy.x,
        enemy.y,
        440
      );
      enemy.knockbackVx += kb.vx;
      enemy.knockbackVy += kb.vy;
      enemy.stunTimer = Math.max(enemy.stunTimer, 0.55);
      this.handleEnemyDamaged(enemy, 16, 0, 0, true, false);
    }

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.65);
    this.hitstopTimer = 0.05;
    soundEngine.playSpellShockwave();
    this.spawnTypedParticles(this.arena.centerX, this.arena.centerY, 22, 'spark', '#7DD3FC', 250, 0.52);
    this.spawnTypedParticles(this.arena.centerX, this.arena.centerY, 16, 'smoke', '#E2E8F0', 140, 0.6);
    this.floatingTexts.push({
      x: this.arena.centerX,
      y: this.arena.centerY - 58,
      vy: -30,
      text: 'Onda de Choque!',
      color: '#7DD3FC',
      scale: 1.2,
      life: 0.9,
      maxLife: 0.9,
    });
  }

  private castOvercharge() {
    this.spells.targetingSpell = null;
    this.spells.cooldowns.overcharge = this.spells.maxCooldowns.overcharge;
    this.spells.overchargeTimer = 10;
    this.overchargeTickTimer = 0.5;

    this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.25);
    soundEngine.playSpellOvercharge();
    this.spawnTypedParticles(this.arena.centerX, this.arena.centerY, 20, 'spark', '#FDE047', 165, 0.55);
    this.floatingTexts.push({
      x: this.arena.centerX,
      y: this.arena.centerY - 58,
      vy: -32,
      text: 'SuperCarga 10s!',
      color: '#FDE047',
      scale: 1.2,
      life: 1.0,
      maxLife: 1.0,
    });
  }

  public deployUnitToSlotId(slotId: string, kind: UnitKind, free = false): boolean {
    const slot = this.slots.find((s) => s.id === slotId);
    if (!slot || slot.unitId !== null) return false;
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
      this.spawnTypedParticles(slot.x, slot.y, 10, 'grass', '#84CC16', 95, 0.4);
      this.spawnParticles(slot.x, slot.y, 8, spec.accentColor, 95, 0.4);
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

  public quickRecruitUnit(kind: UnitKind): boolean {
    if (this.phase !== 'playing') return false;
    this.selectedUnit = kind;
    const freeSlot = this.slots.find((s) => s.unitId === null);
    if (!freeSlot) {
      this.floatingTexts.push({
        x: this.arena.centerX,
        y: this.arena.centerY - 64,
        vy: -24,
        text: 'Arena cheia! Funda tropas',
        color: '#FDE047',
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
        color: '#FCA5A5',
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
    if (!slot) return false;

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
        color: '#FCA5A5',
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

    if (drag.source === 'card') {
      if (targetSlot.unitId === null) {
        const ok = this.deployUnitToSlotId(targetSlot.id, drag.kind, false);
        if (!ok) {
          this.floatingTexts.push({
            x: targetSlot.x,
            y: targetSlot.y - 24,
            vy: -24,
            text: 'Sem essência',
            color: '#FCA5A5',
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
    if (targetSlot.id === drag.fromSlotId) return false;

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
      this.spawnTypedParticles(targetSlot.x, targetSlot.y, 8, 'grass', '#BEF264', 80, 0.32);
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
        color: '#FDE047',
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

  private spawnEnemyAtAngle(angle: number, forcedKind?: EnemyKind) {
    const kind = forcedKind ?? this.pickEnemyKind();
    const pos = computePerimeterSpawnPoint(angle, this.arena, (Math.random() - 0.5) * 24);
    const dx = this.arena.centerX - pos.x;
    const dy = this.arena.centerY - pos.y;
    const dist = Math.hypot(dx, dy) || 1;

    let baseHp = 20;
    let baseSpeed = 34;
    let radius = 17;
    let damage = 10;
    let attackCooldown = 1.05;
    let rewardEssence = 8;
    let rewardScore = 15;

    if (kind === 'shielded') {
      baseHp = 45;
      baseSpeed = 27;
      radius = 20;
      damage = 14;
      attackCooldown = 1.15;
      rewardEssence = 12;
      rewardScore = 25;
    } else if (kind === 'brute') {
      baseHp = 88;
      baseSpeed = 30;
      radius = 22;
      damage = 18;
      attackCooldown = 1.2;
      rewardEssence = 18;
      rewardScore = 40;
    } else if (kind === 'boss') {
      baseHp = this.waveBossHp;
      baseSpeed = 21;
      radius = 34;
      damage = 28 + this.currentStage * 4;
      attackCooldown = 1.25;
      rewardEssence = 45 + this.currentStage * 5;
      rewardScore = 180 + this.currentStage * 40;
    }

    const hp = kind === 'boss' ? baseHp : Math.round(baseHp * this.waveHpMult);
    const speed = baseSpeed * this.waveSpeedMult;

    this.enemies.push({
      id: this.nextEntityId++,
      kind,
      x: pos.x,
      y: pos.y,
      vx: (dx / dist) * speed,
      vy: (dy / dist) * speed,
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
      walkPhase: Math.random() * Math.PI * 2,
      distanceTraveled: 0,
      hitFlash: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      stunTimer: 0,
      koTimer: 0,
      isDead: false,
      bracingTimer: 0,
      lungeTimer: 0,
      lungeCooldown: 2.2 + Math.random() * 2.5,
    });
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
      p.size = kind === 'smoke' ? 6 + Math.random() * 6 : kind === 'grass' ? 4 + Math.random() * 3.5 : 3 + Math.random() * 3.5;
      p.rotation = Math.random() * Math.PI * 2;
      p.vRot = (Math.random() - 0.5) * 10;
      p.color = color;
      p.life = maxLife * (0.7 + Math.random() * 0.3);
      p.maxLife = p.life;
      p.gravity = kind === 'smoke' ? -30 : kind === 'spark' ? 40 : 140;
    }
  }

  public update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.time += dt;

    this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.9);
    this.baseHitFlash = Math.max(0, this.baseHitFlash - dt);

    if (this.phase === 'title') {
      if (Math.random() < dt * 8) {
        this.spawnTypedParticles(
          this.arena.centerX + (Math.random() - 0.5) * 26,
          this.arena.centerY - 10,
          1,
          'spark',
          Math.random() > 0.4 ? '#FDE047' : '#FB923C',
          42,
          0.9
        );
      }
      for (const unit of this.units) {
        unit.attackAnim = Math.max(0, unit.attackAnim - dt * 3);
        unit.recoil = Math.max(0, unit.recoil - dt * 5);
      }
      this.updateVisualEffects(dt);
      return;
    }

    if (this.phase !== 'playing') return;

    this.survivalSeconds += dt;

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
        this.spawnTypedParticles(this.arena.centerX, this.arena.centerY - 8, 3, 'spark', '#FDE047', 65, 0.45);
      }
    }

    // Directional Horde Surge Warnings
    this.surgeScheduleTimer -= dt;
    if (this.surgeScheduleTimer <= 0 && this.waveRemainingToSpawn >= 3) {
      this.surgeScheduleTimer = Math.max(5.5, 8.5 - this.wave * 0.4);
      const surgeAngle = Math.random() * Math.PI * 2;
      this.queueHordeWarning(surgeAngle, Math.min(4, 2 + Math.floor(this.wave / 2)));
    }

    for (let i = this.hordeWarnings.length - 1; i >= 0; i--) {
      const w = this.hordeWarnings[i];
      w.timer -= dt;
      if (w.timer <= 0 && !w.spawned) {
        w.spawned = true;
        if (w.isBoss) {
          this.spawnEnemyAtAngle(w.angle, 'boss');
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.35);
          this.floatingTexts.push({
            x: this.arena.centerX,
            y: this.arena.centerY - 72,
            vy: -24,
            text: 'Chefe da Fase!',
            color: '#F87171',
            scale: 1.35,
            life: 1.3,
            maxLife: 1.3,
          });
        } else {
          for (let k = 0; k < w.spawnCount; k++) {
            const spread = (k - (w.spawnCount - 1) / 2) * 0.14;
            this.spawnEnemyAtAngle(w.angle + spread);
          }
          this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.18);
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
          'grass',
          '#4ADE80',
          110,
          0.35
        );
      }

      if (blade.tickTimer <= 0) {
        blade.tickTimer = 0.28;
        let hitAny = false;
        for (const enemy of this.enemies) {
          if (enemy.isDead) continue;
          if (distanceBetween(blade.x, blade.y, enemy.x, enemy.y) <= blade.radius + enemy.radius) {
            const roll = rollCriticalHit(blade.damagePerTick, 0.25);
            const kb = computeRadialKnockbackVector(blade.x, blade.y, enemy.x, enemy.y, 95);
            this.handleEnemyDamaged(enemy, roll.damage, kb.vx, kb.vy, true, roll.isCrit);
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

    // 1. 360-degree Continuous Wave Spawner & Boss Wave Trigger
    if (this.waveRemainingToSpawn > 0) {
      if (this.isBossWave && !this.bossSpawnedInWave && this.waveRemainingToSpawn <= 3) {
        this.bossSpawnedInWave = true;
        this.queueHordeWarning(Math.random() * Math.PI * 2, 1, true);
      }

      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0) {
        const sectorAngle = (this.spawnSectorIndex / 8) * Math.PI * 2;
        this.spawnSectorIndex = (this.spawnSectorIndex + 3) % 8;
        const angle = sectorAngle + (Math.random() - 0.5) * 0.65;
        this.spawnEnemyAtAngle(angle);
        this.waveRemainingToSpawn -= 1;
        this.waveSpawnTimer = this.waveSpawnInterval * (0.8 + Math.random() * 0.4);
      }
    } else if (this.enemies.length === 0 && this.hordeWarnings.length === 0) {
      if (this.wave >= this.totalWavesInStage) {
        this.phase = 'victory';
        this.highestUnlockedStage = unlockNextStage(this.currentStage, this.highestUnlockedStage);
        this.bestScore = Math.max(this.bestScore, this.score);
        saveProgress({
          highestUnlockedStage: this.highestUnlockedStage,
          bestScore: this.bestScore,
        });
        soundEngine.stopMusic();
        soundEngine.playVictory();
        return;
      }
      this.waveBreakTimer += dt;
      if (this.waveBreakTimer >= 1.4) {
        this.startWave(this.wave + 1);
      }
    }

    // 2. Units Auto-Combat
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

    // 3. Projectiles & Collision
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
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
            proj.vx * 0.12,
            proj.vy * 0.12,
            proj.isShockwave,
            roll.isCrit
          );
          hit = true;
          if (!proj.isShockwave) break;
        }
      }

      if (hit && !proj.isShockwave) {
        this.spawnTypedParticles(proj.x, proj.y, 5, 'spark', proj.color, 95, 0.28);
        this.projectiles.splice(i, 1);
      } else if (proj.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Enemies March, Block Engagement & Core Breach
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
        enemy.x += enemy.knockbackVx * dt;
        enemy.y += enemy.knockbackVy * dt;
        enemy.knockbackVx *= 0.86;
        enemy.knockbackVy *= 0.86;
        continue;
      }

      const blocker = findBlockingUnitForEnemy(enemy, this.units);
      if (blocker) {
        enemy.x += enemy.knockbackVx * dt;
        enemy.y += enemy.knockbackVy * dt;
        enemy.knockbackVx *= 0.82;
        enemy.knockbackVy *= 0.82;

        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = enemy.attackCooldown;
          enemy.attackAnim = 1;
          const dmgRes = applyDamageToUnit(blocker, enemy.damage);
          soundEngine.playUnitHit();
          this.spawnTypedParticles(blocker.x, blocker.y, 4, 'spark', '#FCA5A5', 75, 0.25);

          if (dmgRes.destroyed) {
            const slot = this.slots.find((s) => s.id === blocker.slotId);
            if (slot) slot.unitId = null;
            this.units = this.units.filter((u) => u.id !== blocker.id);
            if (this.dragState?.unitId === blocker.id) {
              this.dragState = null;
            }
            this.spawnTypedParticles(blocker.x, blocker.y, 12, 'smoke', '#E2E8F0', 100, 0.48);
            this.spawnTypedParticles(blocker.x, blocker.y, 8, 'grass', '#4ADE80', 110, 0.4);
            this.floatingTexts.push({
              x: blocker.x,
              y: blocker.y - 24,
              vy: -30,
              text: 'Derrotado!',
              color: '#FCA5A5',
              scale: 0.95,
              life: 0.8,
              maxLife: 0.8,
            });
          }
        }
        continue;
      }

      const dx = this.arena.centerX - enemy.x;
      const dy = this.arena.centerY - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      let speedMult = 1;
      if (enemy.kind === 'shielded') {
        enemy.bracingTimer = Math.max(0, enemy.bracingTimer - dt);
        enemy.lungeCooldown -= dt;
        if (enemy.lungeCooldown <= 0) {
          enemy.bracingTimer = 0.9;
          enemy.lungeCooldown = 4.2 + Math.random() * 1.5;
        }
        if (enemy.bracingTimer > 0) speedMult = 0.55;
      } else if (enemy.kind === 'brute') {
        enemy.lungeCooldown -= dt;
        if (enemy.lungeTimer > 0) {
          enemy.lungeTimer = Math.max(0, enemy.lungeTimer - dt);
          speedMult = enemy.lungeTimer > 0.32 ? 0.25 : 2.2;
        } else if (enemy.lungeCooldown <= 0 && dist < 290 && dist > 90) {
          enemy.lungeTimer = 0.65;
          enemy.lungeCooldown = 3.8 + Math.random() * 1.5;
        }
      }

      const moveStep = enemy.speed * speedMult * dt;
      enemy.vx = nx * enemy.speed * speedMult;
      enemy.vy = ny * enemy.speed * speedMult;
      enemy.x += nx * moveStep + enemy.knockbackVx * dt;
      enemy.y += ny * moveStep + enemy.knockbackVy * dt;
      enemy.knockbackVx *= 0.85;
      enemy.knockbackVy *= 0.85;

      enemy.distanceTraveled += moveStep;
      enemy.walkPhase = enemy.distanceTraveled * 0.14;

      if (dist <= this.arena.coreRadius + enemy.radius - 4) {
        const result = applyDamageToBase(this.baseHp, enemy.damage);
        this.baseHp = result.nextHp;
        this.baseHitFlash = 0.22;
        this.cameraTrauma = Math.min(1, this.cameraTrauma + 0.55);
        this.hitstopTimer = 0.045;
        soundEngine.playBaseHit();
        this.spawnTypedParticles(enemy.x, enemy.y, 12, 'smoke', '#FCA5A5', 110, 0.45);
        this.spawnTypedParticles(enemy.x, enemy.y, 10, 'spark', '#EF4444', 150, 0.4);
        this.floatingTexts.push({
          x: this.arena.centerX,
          y: this.arena.centerY - 46,
          vy: -36,
          text: `-${enemy.damage}`,
          color: '#FCA5A5',
          scale: 1.2,
          life: 0.85,
          maxLife: 0.85,
        });
        this.enemies.splice(i, 1);

        if (result.isGameOver) {
          this.phase = 'gameover';
          this.bestScore = Math.max(this.bestScore, this.score);
          saveProgress({
            highestUnlockedStage: this.highestUnlockedStage,
            bestScore: this.bestScore,
          });
          soundEngine.stopMusic();
          soundEngine.playDefeat();
          return;
        }
      }
    }

    this.updateVisualEffects(dt);
  }

  private performUnitAttack(unit: UnitEntity, target: EnemyEntity) {
    if (unit.kind === 'scout') {
      const dx = target.x - unit.x;
      const dy = target.y - unit.y;
      const dist = Math.hypot(dx, dy) || 1;
      const speed = 520;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 18,
        y: unit.y + (dy / dist) * 18,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 6 + (unit.level - 1) * 1.2,
        damage: unit.damage,
        critChance: unit.critChance,
        color: unit.level >= 2 ? '#FACC15' : '#38BDF8',
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
      const speed = 340;
      this.projectiles.push({
        id: this.nextEntityId++,
        x: unit.x + (dx / dist) * 20,
        y: unit.y + (dy / dist) * 20,
        vx: (dx / dist) * speed,
        vy: (dy / dist) * speed,
        radius: 15 + (unit.level - 1) * 3,
        damage: unit.damage,
        critChance: unit.critChance,
        color: unit.level >= 2 ? '#38BDF8' : '#60A5FA',
        trailColor: '#DBEAFE',
        targetEnemyId: target.id,
        life: 0.48,
        isShockwave: true,
      });
      soundEngine.playShieldBash();
      this.spawnTypedParticles(unit.x + (dx / dist) * 18, unit.y + (dy / dist) * 18, 6, 'spark', '#93C5FD', 95, 0.3);
    } else if (unit.kind === 'frog') {
      const slashRadius = unit.range * 0.9;
      this.slashes.push({
        x: unit.x,
        y: unit.y,
        angle: unit.facingAngle,
        radius: slashRadius,
        life: 0.24,
        maxLife: 0.24,
        color: unit.level >= 2 ? '#FDE047' : '#34D399',
      });
      soundEngine.playSlash();

      const hitEnemies = findEnemiesInSlashArc(
        unit.x,
        unit.y,
        unit.facingAngle,
        slashRadius,
        Math.PI * 0.54,
        this.enemies
      );
      for (const enemy of hitEnemies) {
        const roll = rollCriticalHit(unit.damage, unit.critChance);
        const kx = Math.cos(unit.facingAngle) * 75;
        const ky = Math.sin(unit.facingAngle) * 75;
        this.handleEnemyDamaged(enemy, roll.damage, kx, ky, true, roll.isCrit);
      }
      this.spawnTypedParticles(
        unit.x + Math.cos(unit.facingAngle) * 44,
        unit.y + Math.sin(unit.facingAngle) * 44,
        7,
        'grass',
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
    isCrit: boolean
  ) {
    const res = applyDamageToEnemy(enemy, damage);
    if (res.actualDamage <= 0) return;

    enemy.knockbackVx += knockX * (enemy.kind === 'boss' ? 0.28 : 1);
    enemy.knockbackVy += knockY * (enemy.kind === 'boss' ? 0.28 : 1);

    if (isCrit) {
      this.spawnTypedParticles(enemy.x, enemy.y, 7, 'spark', '#FB923C', 145, 0.32);
    }

    this.floatingTexts.push({
      x: enemy.x + (Math.random() - 0.5) * 10,
      y: enemy.y - enemy.radius - 14,
      vy: isCrit ? -46 : -36,
      text: isCrit ? `-${res.actualDamage}!` : `-${res.actualDamage}`,
      color: isCrit ? '#FACC15' : heavy ? '#6EE7B7' : '#FFFFFF',
      scale: isCrit ? 1.32 : heavy ? 1.05 : 0.9,
      life: isCrit ? 0.68 : 0.52,
      maxLife: isCrit ? 0.68 : 0.52,
      isCrit,
    });

    if (res.killed) {
      this.kills += 1;
      const essenceMult = this.spells.overchargeTimer > 0 ? 1.5 : 1;
      const gainedEssence = Math.ceil(enemy.rewardEssence * essenceMult);
      this.essence += gainedEssence;
      this.essenceCollected += gainedEssence;
      this.score += enemy.rewardScore;
      this.bestScore = Math.max(this.bestScore, this.score);
      this.hitstopTimer = Math.max(this.hitstopTimer, enemy.kind === 'boss' ? 0.08 : isCrit ? 0.042 : 0.03);
      this.cameraTrauma = Math.min(1, this.cameraTrauma + (enemy.kind === 'boss' ? 0.65 : isCrit ? 0.24 : 0.14));
      soundEngine.playKill();

      // Smoke, cut grass, and metallic sparks on enemy destruction
      const burstScale = enemy.kind === 'boss' ? 2 : 1;
      this.spawnTypedParticles(enemy.x, enemy.y, 8 * burstScale, 'smoke', '#CBD5E1', 90, 0.52);
      this.spawnTypedParticles(enemy.x, enemy.y, 7 * burstScale, 'grass', '#84CC16', 135, 0.42);
      this.spawnTypedParticles(
        enemy.x,
        enemy.y,
        8 * burstScale,
        'spark',
        isCrit || enemy.kind === 'boss' ? '#FB923C' : '#FDE047',
        175,
        0.36
      );

      this.floatingTexts.push({
        x: enemy.x,
        y: enemy.y - enemy.radius - 28,
        vy: -42,
        text: `+${enemy.rewardScore}`,
        color: '#FDE047',
        scale: enemy.kind === 'boss' ? 1.3 : 1.02,
        life: 0.7,
        maxLife: 0.7,
      });
    }
  }

  private updateVisualEffects(dt: number) {
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      this.slashes[i].life -= dt;
      if (this.slashes[i].life <= 0) this.slashes.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= dt;
      const progress = 1 - Math.max(0, sw.life / sw.maxLife);
      sw.currentRadius = this.arena.coreRadius + (sw.maxRadius - this.arena.coreRadius) * progress;
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
    return {
      phase: this.phase,
      stage: this.currentStage,
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
      selectedUnit: this.selectedUnit,
      unitCount: this.units.length,
      maxUnitLevelReached: this.maxUnitLevelReached,
      mergesPerformed: this.mergesPerformed,
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
