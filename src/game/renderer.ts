import { canMergeUnits, pointToSegmentDistance } from './engineMath';
import { GameSimulation } from './simulation';
import {
  ArenaConfig,
  EnemyEntity,
  HERO_SPECS,
  HeroClass,
  HeroEntity,
  MAX_HERO_LEVEL,
  MAX_UNIT_LEVEL,
  UNIT_SPECS,
  UnitEntity,
  UnitKind,
} from './types';

export class ArenaRenderer {
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticArenaKey = '';

  private ensureStaticLayer(arena: ArenaConfig): HTMLCanvasElement {
    const key = `stage-${arena.stage}-${arena.worldWidth}x${arena.worldHeight}-dark-v3`;
    if (this.staticCanvas && this.staticArenaKey === key) {
      return this.staticCanvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = arena.worldWidth;
    canvas.height = arena.worldHeight;
    const ctx = canvas.getContext('2d')!;
    this.drawStaticWorld(ctx, arena);
    this.staticCanvas = canvas;
    this.staticArenaKey = key;
    return canvas;
  }

  private traceRoutePath(ctx: CanvasRenderingContext2D, arena: ArenaConfig) {
    const wps = arena.waypoints;
    if (wps.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(wps[0].x, wps[0].y);
    for (let i = 1; i < wps.length; i++) {
      ctx.lineTo(wps[i].x, wps[i].y);
    }
  }

  private minDistanceToRoute(x: number, y: number, arena: ArenaConfig): number {
    let minD = Infinity;
    const wps = arena.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const d = pointToSegmentDistance(x, y, wps[i].x, wps[i].y, wps[i + 1].x, wps[i + 1].y);
      if (d < minD) minD = d;
    }
    return minD;
  }

  private drawStaticWorld(ctx: CanvasRenderingContext2D, arena: ArenaConfig) {
    const { worldWidth: w, worldHeight: h, centerX: cx, centerY: cy } = arena;

    // 1. Deep High-Contrast Dark Obsidian & Twilight Slate Backdrop
    const bgGrad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 740);
    bgGrad.addColorStop(0, '#16223A');
    bgGrad.addColorStop(0.55, '#0F172A');
    bgGrad.addColorStop(1, '#080D1A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle tactical grid lines for crisp spatial readability
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.045)';
    ctx.lineWidth = 1;
    for (let gx = 40; gx < w; gx += 60) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    for (let gy = 40; gy < h; gy += 60) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Soft ambient dark-teal/indigo contour plateaus
    const plateaus = [
      { x: 250, y: 390, rx: 170, ry: 115 },
      { x: 610, y: 400, rx: 220, ry: 155 },
      { x: 960, y: 410, rx: 150, ry: 135 },
    ];
    ctx.fillStyle = 'rgba(30, 58, 95, 0.22)';
    for (const p of plateaus) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Dynamic Winding Obsidian Stone Route with Glowing Gold & Electric Edge Guides
    const roadW = arena.roadHalfWidth * 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Outer ambient road shadow
    ctx.save();
    ctx.translate(0, 8);
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = 'rgba(2, 6, 23, 0.65)';
    ctx.lineWidth = roadW + 18;
    ctx.stroke();
    ctx.restore();

    // Warm Amber-Gold outer border rim (high contrast against dark ground)
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#92400E';
    ctx.lineWidth = roadW + 12;
    ctx.stroke();

    // Saturated gold inner trim
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = roadW + 6;
    ctx.stroke();

    // Dark carved slate road surface (makes red/gold/blue enemies pop vividly!)
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = roadW;
    ctx.stroke();

    // Inner worn center lane
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#273549';
    ctx.lineWidth = roadW * 0.56;
    ctx.stroke();

    // Glowing directional chevrons & stone seams
    const wps = arena.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const a = wps[i];
      const b = wps[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      if (segLen < 32) continue;

      const steps = Math.max(1, Math.floor(segLen / 54));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const px = a.x + dx * t;
        const py = a.y + dy * t;

        if (s % 2 === 1) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.strokeStyle = 'rgba(250, 204, 21, 0.36)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-5, -7);
          ctx.lineTo(4, 0);
          ctx.lineTo(-5, 7);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
    ctx.restore();

    // 3. Perimeter Twilight Crystals & Dark Pines (strictly clear of the stage's route)
    const props = [
      { x: 52, y: 120, s: 0.95, type: 'tree' },
      { x: 52, y: 360, s: 0.86, type: 'tree' },
      { x: 58, y: 715, s: 1.0, type: 'tree' },
      { x: 210, y: 745, s: 0.85, type: 'crystal' },
      { x: 430, y: 735, s: 0.9, type: 'tree' },
      { x: 750, y: 740, s: 0.92, type: 'crystal' },
      { x: 1138, y: 125, s: 1.0, type: 'tree' },
      { x: 1142, y: 270, s: 0.85, type: 'crystal' },
      { x: 1136, y: 690, s: 1.02, type: 'tree' },
      { x: 1020, y: 745, s: 0.9, type: 'tree' },
      { x: 230, y: 78, s: 0.82, type: 'crystal' },
      { x: 960, y: 78, s: 0.86, type: 'tree' },
    ];
    for (const p of props) {
      if (this.minDistanceToRoute(p.x, p.y, arena) < 70) continue;
      if (p.type === 'crystal') {
        this.drawGlowCrystal(ctx, p.x, p.y, p.s);
      } else {
        this.drawTwilightPine(ctx, p.x, p.y, p.s);
      }
    }
  }

  private drawGlowCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(0, 212, 255, 0.14)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 24, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0284C7';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(13, -4);
    ctx.lineTo(8, 12);
    ctx.lineTo(-8, 12);
    ctx.lineTo(-13, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#38BDF8';
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(5, -4);
    ctx.lineTo(0, 10);
    ctx.lineTo(-7, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawTwilightPine(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 26, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(-5, 4, 10, 15, 3);
    ctx.fill();
    ctx.stroke();

    const layers = [
      { y: 6, w: 28, h: 34, fill: '#1E3A5F' },
      { y: -13, w: 21, h: 30, fill: '#254E7B' },
    ];
    for (const l of layers) {
      ctx.fillStyle = l.fill;
      ctx.strokeStyle = '#0B1120';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, l.y - l.h);
      ctx.lineTo(l.w, l.y);
      ctx.quadraticCurveTo(0, l.y + 5, -l.w, l.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  public render(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
    const { arena } = sim;
    const staticLayer = this.ensureStaticLayer(arena);

    ctx.save();

    if (sim.cameraTrauma > 0) {
      const shake = sim.cameraTrauma * sim.cameraTrauma * 11;
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    ctx.drawImage(staticLayer, 0, 0);

    // 1. Tactical Defender Pad Slots
    const drag = sim.dragState;
    const draggedUnit =
      drag && drag.source === 'unit' && drag.unitId
        ? sim.units.find((u) => u.id === drag.unitId)
        : undefined;

    for (const slot of sim.slots) {
      const isHovered = sim.hoveredSlotId === slot.id && sim.phase === 'playing';
      const isEmpty = slot.unitId === null && !slot.hasHero;
      const occupant =
        slot.unitId !== null ? sim.units.find((u) => u.id === slot.unitId) : undefined;
      const isMergeCandidate = Boolean(
        drag &&
          drag.hasMoved &&
          draggedUnit &&
          occupant &&
          canMergeUnits(draggedUnit, occupant)
      );
      const isHeroMoveCandidate =
        sim.phase === 'playing' &&
        (sim.heroRepositionMode || (drag?.source === 'hero' && drag.hasMoved)) &&
        !slot.hasHero;

      ctx.save();
      ctx.fillStyle = 'rgba(2, 6, 23, 0.5)';
      ctx.beginPath();
      ctx.ellipse(slot.x, slot.y + 4, slot.radius + 2, slot.radius * 0.88 + 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);

      if (slot.hasHero) {
        ctx.fillStyle = 'rgba(250, 204, 21, 0.18)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FACC15';
        ctx.stroke();
      } else if (isHeroMoveCandidate) {
        const pulse = 0.25 + Math.sin(sim.time * 10) * 0.12;
        ctx.fillStyle = `rgba(0, 212, 255, ${pulse})`;
        ctx.fill();
        ctx.lineWidth = isHovered ? 4 : 2.8;
        ctx.strokeStyle = '#00D4FF';
        ctx.stroke();
      } else if (isMergeCandidate) {
        const pulse = 0.34 + Math.sin(sim.time * 10) * 0.14;
        ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
        ctx.fill();
        ctx.lineWidth = isHovered ? 4 : 3;
        ctx.strokeStyle = '#FACC15';
        ctx.stroke();
      } else {
        ctx.fillStyle = isHovered
          ? 'rgba(0, 212, 255, 0.28)'
          : isEmpty
            ? 'rgba(15, 23, 42, 0.72)'
            : 'rgba(30, 41, 59, 0.82)';
        ctx.fill();

        ctx.lineWidth = isHovered ? 3 : 2.2;
        ctx.strokeStyle = isHovered
          ? '#FACC15'
          : isEmpty
            ? 'rgba(56, 189, 248, 0.65)'
            : 'rgba(148, 163, 184, 0.55)';
        if (isEmpty && !isHovered) {
          ctx.setLineDash([6, 5]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (isEmpty) {
          ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
          ctx.fillRect(slot.x - 6, slot.y - 1.5, 12, 3);
          ctx.fillRect(slot.x - 1.5, slot.y - 6, 3, 12);
        }
      }

      if (isHovered && isEmpty && !drag && !sim.spells.targetingSpell && !sim.heroRepositionMode) {
        const spec = UNIT_SPECS[sim.selectedUnit];
        this.drawRangeRing(ctx, slot.x, slot.y, spec.range, 'rgba(0, 212, 255, 0.55)');
      }
      if ((slot.hasHero && isHovered) || (sim.heroRepositionMode && isHovered)) {
        this.drawRangeRing(ctx, slot.x, slot.y, sim.hero.range, 'rgba(250, 204, 21, 0.65)');
      }
      ctx.restore();
    }

    // 2. Shockwave Ring Effects
    for (const sw of sim.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = sw.color ?? '#00D4FF';
      ctx.lineWidth = 12 * alpha;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, Math.max(10, sw.currentRadius - 10), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 2.5 Explosive AoE Blasts
    for (const exp of sim.explosions) {
      const progress = 1 - Math.max(0, exp.life / exp.maxLife);
      const alpha = Math.max(0, 1 - progress);
      const r = exp.radius * (0.45 + progress * 0.6);
      ctx.save();
      ctx.globalAlpha = alpha;
      const grad = ctx.createRadialGradient(exp.x, exp.y, 4, exp.x, exp.y, r);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.35, 'rgba(250, 204, 21, 0.85)');
      grad.addColorStop(0.75, 'rgba(255, 46, 76, 0.55)');
      grad.addColorStop(1, 'rgba(255, 46, 76, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 4 * alpha;
      ctx.beginPath();
      ctx.arc(exp.x, exp.y, exp.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Portal & Castle
    this.drawSpawnPortal(ctx, sim);
    this.drawCastleBase(ctx, sim);

    // 4. Depth-sorted actors (Hero + Units + Enemies)
    type RenderItem =
      | { kind: 'hero'; y: number; entity: HeroEntity }
      | { kind: 'unit'; y: number; entity: UnitEntity }
      | { kind: 'enemy'; y: number; entity: EnemyEntity };

    const actors: RenderItem[] = [];
    if (!(drag?.source === 'hero' && drag.hasMoved)) {
      actors.push({ kind: 'hero', y: sim.hero.y, entity: sim.hero });
    }
    for (const u of sim.units) {
      if (drag?.source === 'unit' && drag.hasMoved && drag.unitId === u.id) continue;
      actors.push({ kind: 'unit', y: u.y, entity: u });
    }
    for (const e of sim.enemies) actors.push({ kind: 'enemy', y: e.y, entity: e });
    actors.sort((a, b) => a.y - b.y);

    for (const item of actors) {
      if (item.kind === 'hero') {
        this.drawHero(ctx, item.entity, sim.time);
      } else if (item.kind === 'unit') {
        this.drawUnit(ctx, item.entity, sim.time);
      } else {
        this.drawEnemy(ctx, item.entity);
      }
    }

    // 5. Spinning Blade Spell Hazards
    for (const blade of sim.spinningBlades) {
      this.drawSpinningBladeHazard(ctx, blade);
    }

    // 5.5 Blade Spell Targeting Reticle
    if (sim.phase === 'playing' && sim.spells.targetingSpell === 'blade') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sim.pointerWorldX, sim.pointerWorldY, 126, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 212, 255, 0.16)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#00D4FF';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 6. Dragged Hero / Unit / Card preview
    if (drag && drag.hasMoved) {
      if (drag.source === 'hero') {
        this.drawRangeRing(ctx, drag.worldX, drag.worldY, sim.hero.range, 'rgba(250, 204, 21, 0.7)');
        ctx.save();
        ctx.globalAlpha = 0.9;
        this.drawHeroSprite(
          ctx,
          sim.hero.heroClass,
          drag.worldX,
          drag.worldY - 8,
          sim.hero.level,
          sim.hero.facingAngle,
          0,
          0,
          0,
          sim.time
        );
        ctx.restore();
      } else {
        const spec = UNIT_SPECS[drag.kind];
        const range = draggedUnit ? draggedUnit.range : spec.range;
        this.drawRangeRing(ctx, drag.worldX, drag.worldY, range, 'rgba(0, 212, 255, 0.65)');

        ctx.save();
        ctx.globalAlpha = 0.88;
        this.drawUnitSprite(
          ctx,
          drag.kind,
          drag.worldX,
          drag.worldY - 8,
          drag.level,
          0,
          0,
          0,
          false,
          sim.time,
          1
        );
        ctx.restore();
      }
    }

    // 7. Crescent Slash Arcs
    for (const slash of sim.slashes) {
      const progress = 1 - slash.life / slash.maxLife;
      const alpha = Math.max(0, 1 - progress);
      ctx.save();
      ctx.translate(slash.x, slash.y);
      ctx.rotate(slash.angle);
      ctx.globalAlpha = alpha;

      ctx.strokeStyle = slash.color;
      ctx.lineWidth = 16 * (1 - progress * 0.45);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, slash.radius * (0.76 + progress * 0.24), -1.05, 1.05);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5 * (1 - progress * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, slash.radius * (0.78 + progress * 0.22), -0.9, 0.9);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Projectiles & Bombs
    for (const proj of sim.projectiles) {
      ctx.save();
      if (proj.isBomb) {
        // Ground target ring
        if (proj.targetX !== undefined && proj.targetY !== undefined) {
          ctx.strokeStyle = 'rgba(255, 46, 76, 0.55)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(proj.targetX, proj.targetY, (proj.blastRadius ?? 95) * 0.55, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // Bomb sphere with glowing gold fuse spark
        ctx.fillStyle = '#0F172A';
        ctx.strokeStyle = '#FACC15';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#FF2E4C';
        ctx.beginPath();
        ctx.arc(proj.x + 3, proj.y - 4, proj.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      } else if (proj.isShockwave) {
        ctx.fillStyle = 'rgba(0, 212, 255, 0.36)';
        ctx.strokeStyle = '#E0F2FE';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = proj.trailColor;
        ctx.beginPath();
        ctx.arc(
          proj.x - proj.vx * 0.015,
          proj.y - proj.vy * 0.015,
          proj.radius * 0.78,
          0,
          Math.PI * 2
        );
        ctx.fill();

        ctx.fillStyle = proj.color;
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 9. Pooled Typed Particles
    for (let i = 0; i < sim.particles.length; i++) {
      const p = sim.particles[i];
      if (!p.active) continue;
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = p.kind === 'smoke' ? alpha * 0.65 : alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;

      if (p.kind === 'grass') {
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size * 1.15, p.size * 0.38, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'spark') {
        ctx.beginPath();
        ctx.roundRect(-p.size * 1.25, -1.7, p.size * 2.5, 3.4, 1.5);
        ctx.fill();
      } else if (p.kind === 'smoke') {
        const grow = 1 + (1 - alpha) * 0.8;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * grow, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.5 + 0.5 * alpha), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 10. Route Entrance Warning Arrow
    for (const warn of sim.hordeWarnings) {
      this.drawHordeWarningArrow(
        ctx,
        warn.x + 36,
        warn.y,
        warn.angle,
        warn.timer,
        sim.time,
        Boolean(warn.isBoss)
      );
    }

    // 11. Floating Combat, Critical & XP Numbers
    for (const ft of sim.floatingTexts) {
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(16 * ft.scale)}px "Fredoka", "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = ft.isCrit ? 5 : 4;
      ctx.strokeStyle = ft.isCrit ? '#450A0A' : '#020617';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawHero(ctx: CanvasRenderingContext2D, hero: HeroEntity, time: number) {
    this.drawHeroSprite(
      ctx,
      hero.heroClass,
      hero.x,
      hero.y,
      hero.level,
      hero.facingAngle,
      hero.attackAnim,
      hero.recoil,
      hero.levelUpFlash,
      time
    );
  }

  private drawHeroSprite(
    ctx: CanvasRenderingContext2D,
    heroClass: HeroClass,
    x: number,
    y: number,
    level: number,
    facingAngle: number,
    attackAnim: number,
    recoil: number,
    levelUpFlash: number,
    time: number
  ) {
    const spec = HERO_SPECS[heroClass];
    const idleBob = Math.sin(time * 4.2) * 1.8;
    // Dynamic visual size increase per level!
    const levelScale = 1.08 + (level - 1) * 0.12;
    const scaleX = (1 + recoil * 0.14) * levelScale;
    const scaleY = (1 - recoil * 0.12) * levelScale;
    const faceRight = Math.cos(facingAngle) >= 0;

    ctx.save();
    ctx.translate(x, y + idleBob);

    // Shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 19 - idleBob, 22 * levelScale, 8 * levelScale, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dynamic Level-Up & Evolution Glow Rings
    const pulse = 1 + Math.sin(time * 6) * 0.06;
    ctx.fillStyle = spec.glowColor;
    ctx.beginPath();
    ctx.ellipse(0, 14 - idleBob, 26 * levelScale * pulse, 11 * levelScale * pulse, 0, 0, Math.PI * 2);
    ctx.fill();

    if (level >= 2 || levelUpFlash > 0) {
      ctx.strokeStyle = level >= MAX_HERO_LEVEL ? '#FACC15' : spec.color;
      ctx.lineWidth = level >= 4 ? 3 : 2.2;
      ctx.beginPath();
      ctx.ellipse(0, 14 - idleBob, 28 * levelScale * pulse, 12 * levelScale * pulse, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Orbiting Mastery Runes for Lv.3+
    if (level >= 3) {
      const orbCount = level >= MAX_HERO_LEVEL ? 4 : level >= 5 ? 3 : 2;
      for (let i = 0; i < orbCount; i++) {
        const ang = time * 2.6 + (i * Math.PI * 2) / orbCount;
        const ox = Math.cos(ang) * 28 * levelScale;
        const oy = Math.sin(ang) * 11 * levelScale + 4;
        ctx.fillStyle = level >= MAX_HERO_LEVEL ? '#FACC15' : '#00D4FF';
        ctx.beginPath();
        ctx.arc(ox, oy, 3.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.scale(scaleX, scaleY);

    if (heroClass === 'archer') {
      ctx.save();
      if (!faceRight) ctx.scale(-1, 1);

      // Electric Cape & Quiver
      ctx.fillStyle = '#0284C7';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-16, -8, 12, 20, 4);
      ctx.fill();
      ctx.stroke();

      // Tunic
      ctx.fillStyle = level >= 4 ? '#00D4FF' : '#0EA5E9';
      ctx.beginPath();
      ctx.roundRect(-10, -6, 20, 20, 6);
      ctx.fill();
      ctx.stroke();

      // Head & Hood
      ctx.fillStyle = '#FDE68A';
      ctx.beginPath();
      ctx.arc(0, -14, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = level >= 5 ? '#FACC15' : '#0369A1';
      ctx.beginPath();
      ctx.arc(-1, -17, 11.5, Math.PI * 0.9, Math.PI * 2.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing Energy Bow
      const drawBack = attackAnim * 5;
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.arc(9, -2, 15, -Math.PI * 0.45, Math.PI * 0.45);
      ctx.stroke();

      ctx.strokeStyle = '#BAE6FD';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(11, -16);
      ctx.lineTo(7 - drawBack, -2);
      ctx.lineTo(11, 12);
      ctx.stroke();
      ctx.restore();
    } else if (heroClass === 'swordsman') {
      ctx.save();
      if (!faceRight) ctx.scale(-1, 1);

      // Crimson Heroic Cape
      ctx.fillStyle = '#DC2626';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-10, -4);
      ctx.lineTo(-20, 14);
      ctx.lineTo(-4, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Heavy Armored Body
      ctx.fillStyle = level >= 4 ? '#FF2E4C' : '#E11D48';
      ctx.beginPath();
      ctx.roundRect(-12, -7, 24, 22, 7);
      ctx.fill();
      ctx.stroke();

      // Gold Chest Emblem
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(2, 2, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // Knight Helmet + Gold Crest Plume
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(0, -15, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(-4, -24);
      ctx.lineTo(0, -34);
      ctx.lineTo(6, -24);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Visor
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(1, -17, 9, 4);

      // Massive Glowing Greatsword
      ctx.save();
      ctx.translate(10, 0);
      ctx.rotate(-0.6 + attackAnim * 1.45);
      ctx.fillStyle = level >= 4 ? '#FACC15' : '#F8FAFC';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-3, 2);
      ctx.lineTo(-4, -30);
      ctx.lineTo(0, -37);
      ctx.lineTo(4, -30);
      ctx.lineTo(3, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(-7, 0, 14, 4);
      ctx.restore();

      ctx.restore();
    } else {
      // Bombardeiro
      ctx.save();
      if (!faceRight) ctx.scale(-1, 1);

      // Brass Powder Backpack
      ctx.fillStyle = '#B45309';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-18, -8, 12, 20, 4);
      ctx.fill();
      ctx.stroke();

      // Amber-Gold Coat
      ctx.fillStyle = level >= 4 ? '#FACC15' : '#F59E0B';
      ctx.beginPath();
      ctx.roundRect(-11, -6, 22, 21, 7);
      ctx.fill();
      ctx.stroke();

      // Head & Brass Goggles
      ctx.fillStyle = '#FED7AA';
      ctx.beginPath();
      ctx.arc(0, -14, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.roundRect(-10, -23, 20, 9, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#00D4FF';
      ctx.beginPath();
      ctx.arc(-2, -18, 3.6, 0, Math.PI * 2);
      ctx.arc(6, -18, 3.6, 0, Math.PI * 2);
      ctx.fill();

      // Heavy Hand Cannon
      const kick = attackAnim * 4;
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.roundRect(4 - kick, -6, 20, 11, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FF2E4C';
      ctx.beginPath();
      ctx.arc(23 - kick, -0.5, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }

    // Crisp Gold Level Crown Tag
    ctx.font = '800 11.5px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#020617';
    const tag = level >= MAX_HERO_LEVEL ? 'HERÓI MÁX' : `HERÓI Nv.${level}`;
    ctx.strokeText(tag, 0, -34);
    ctx.fillStyle = level >= MAX_HERO_LEVEL ? '#FACC15' : '#00D4FF';
    ctx.fillText(tag, 0, -34);

    ctx.restore();
  }

  private drawSpawnPortal(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
    const start = sim.arena.waypoints[0] ?? { x: 96, y: 410 };
    const pulse = Math.sin(sim.time * 4.5) * 2.5;

    ctx.save();
    ctx.translate(start.x, start.y);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, -32, 56, 56, 18);
    ctx.fill();
    ctx.stroke();

    const riftGrad = ctx.createRadialGradient(0, -2, 4, 0, -2, 24 + pulse);
    riftGrad.addColorStop(0, '#FEF08A');
    riftGrad.addColorStop(0.55, '#FF2E4C');
    riftGrad.addColorStop(1, '#7F1D1D');
    ctx.fillStyle = riftGrad;
    ctx.beginPath();
    ctx.ellipse(0, -1, 18, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#450A0A';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#020617';
    ctx.strokeText('HORDA', 0, -40);
    ctx.fillStyle = '#FCA5A5';
    ctx.fillText('HORDA', 0, -40);

    ctx.restore();
  }

  private drawCastleBase(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
    const { castleX: cx, castleY: cy } = sim.arena;
    const hitFlash = sim.baseHitFlash > 0;
    const overcharged = sim.spells.overchargeTimer > 0;
    const waveFlag = Math.sin(sim.time * 5.2) * 3;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    ctx.beginPath();
    ctx.ellipse(0, 40, 62, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    if (overcharged || hitFlash) {
      ctx.strokeStyle = hitFlash ? '#FF2E4C' : '#FACC15';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 12, 66 + Math.sin(sim.time * 10) * 3, 52, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const wallColor = hitFlash ? '#FCA5A5' : '#CBD5E1';
    const wallShade = hitFlash ? '#EF4444' : '#64748B';
    const roofColor = hitFlash ? '#DC2626' : '#0284C7';
    const outline = '#020617';

    ctx.fillStyle = wallShade;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-24, -46, 48, 56, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(0, -76);
    ctx.lineTo(29, -42);
    ctx.lineTo(-29, -42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -76);
    ctx.lineTo(0, -94);
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(1, -93);
    ctx.quadraticCurveTo(13, -95 + waveFlag, 24, -88 + waveFlag * 0.6);
    ctx.lineTo(18, -84 + waveFlag * 0.4);
    ctx.lineTo(24, -80 + waveFlag * 0.6);
    ctx.lineTo(1, -82);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = wallColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-42, -16, 84, 52, 8);
    ctx.fill();
    ctx.stroke();

    for (const mx of [-32, -14, 4, 22]) {
      ctx.fillStyle = wallColor;
      ctx.beginPath();
      ctx.roundRect(mx, -24, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
    }

    for (const tx of [-44, 44]) {
      ctx.fillStyle = wallShade;
      ctx.beginPath();
      ctx.roundRect(tx - 13, -24, 26, 60, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = roofColor;
      ctx.beginPath();
      ctx.moveTo(tx, -46);
      ctx.lineTo(tx + 17, -22);
      ctx.lineTo(tx - 17, -22);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = '#78350F';
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(0, 14, 15, Math.PI, 0);
    ctx.lineTo(15, 36);
    ctx.lineTo(-15, 36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, -8, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = '800 13px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#020617';
    const lvlText = `Castelo Nv.${sim.baseLevel}`;
    ctx.strokeText(lvlText, 0, -104);
    ctx.fillStyle = '#FACC15';
    ctx.fillText(lvlText, 0, -104);

    ctx.restore();
  }

  private drawHordeWarningArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    timer: number,
    time: number,
    isBoss: boolean
  ) {
    const nudge = Math.sin(time * 9) * 5;
    const pulse = 0.65 + Math.sin(time * (isBoss ? 14 : 11)) * 0.35;

    ctx.save();
    ctx.translate(x + Math.cos(angle) * nudge, y + Math.sin(angle) * nudge);
    ctx.rotate(angle);
    ctx.globalAlpha = Math.min(1, pulse * Math.min(1, timer * 1.4));
    if (isBoss) ctx.scale(1.4, 1.4);

    ctx.fillStyle = '#FF2E4C';
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = isBoss ? 3 : 2.5;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, -13);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawSpinningBladeHazard(
    ctx: CanvasRenderingContext2D,
    blade: { x: number; y: number; radius: number; rotation: number; life: number; maxLife: number }
  ) {
    const fade = Math.min(1, blade.life * 2.5);
    ctx.save();
    ctx.translate(blade.x, blade.y);
    ctx.globalAlpha = fade;

    ctx.strokeStyle = 'rgba(0, 212, 255, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, blade.radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(blade.rotation);

    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI);
      ctx.fillStyle = '#00D4FF';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(blade.radius * 0.85, -14);
      ctx.lineTo(blade.radius * 0.98, 0);
      ctx.lineTo(blade.radius * 0.85, 14);
      ctx.lineTo(0, 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#E0F2FE';
      ctx.fillRect(10, -4, blade.radius * 0.72, 8);
      ctx.restore();
    }

    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawRangeRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    range: number,
    strokeColor = 'rgba(0, 212, 255, 0.65)'
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 212, 255, 0.08)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = strokeColor;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawUnit(ctx: CanvasRenderingContext2D, unit: UnitEntity, time: number) {
    this.drawUnitSprite(
      ctx,
      unit.kind,
      unit.x,
      unit.y,
      unit.level,
      unit.facingAngle,
      unit.attackAnim,
      unit.recoil,
      unit.hitFlash > 0,
      time,
      unit.id
    );
  }

  private drawUnitSprite(
    ctx: CanvasRenderingContext2D,
    kind: UnitKind,
    x: number,
    y: number,
    level: number,
    facingAngle: number,
    attackAnim: number,
    recoil: number,
    flash: boolean,
    time: number,
    seed: number
  ) {
    const idleBob = Math.sin(time * 3.8 + seed) * 1.4;
    const levelScale = 1 + (level - 1) * 0.09;
    const scaleX = (1 + recoil * 0.16) * levelScale;
    const scaleY = (1 - recoil * 0.14) * levelScale;
    const faceRight = Math.cos(facingAngle) >= 0;

    ctx.save();
    ctx.translate(x, y + idleBob);

    ctx.fillStyle = 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 17 - idleBob, 18 * levelScale, 7 * levelScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (level >= 2) {
      const auraColor =
        level >= MAX_UNIT_LEVEL
          ? 'rgba(255, 46, 76, 0.36)'
          : level === 3
            ? 'rgba(250, 204, 21, 0.34)'
            : 'rgba(0, 212, 255, 0.3)';
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.ellipse(0, 14 - idleBob, 24 * levelScale, 10 * levelScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = level >= 3 ? '#FACC15' : '#00D4FF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.scale(scaleX, scaleY);

    if (kind === 'scout') {
      ctx.save();
      if (!faceRight) ctx.scale(-1, 1);

      ctx.fillStyle = flash ? '#FFFFFF' : '#FF2E4C';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-16, -6, 10, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#00D4FF';
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 18, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#FED7AA';
      ctx.beginPath();
      ctx.arc(0, -13, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#020617';
      ctx.beginPath();
      ctx.arc(4, -13, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = level >= 2 ? '#FACC15' : '#2563EB';
      ctx.beginPath();
      ctx.arc(0, -17, 11.5, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(-3, -21, 16, 5, 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else if (kind === 'shield') {
      ctx.save();
      if (!faceRight) ctx.scale(-1, 1);

      ctx.fillStyle = flash ? '#FFFFFF' : '#1D4ED8';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-12, -8, 22, 22, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : level >= 2 ? '#00D4FF' : '#3B82F6';
      ctx.beginPath();
      ctx.arc(-1, -14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const bashOffset = attackAnim * 7;
      ctx.fillStyle = flash ? '#FFFFFF' : level >= 3 ? '#00D4FF' : '#60A5FA';
      ctx.beginPath();
      ctx.roundRect(0 + bashOffset, -14, 17, 26, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(8.5 + bashOffset, -1, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (kind === 'frog') {
      ctx.scale(1.16, 1.16);

      ctx.save();
      ctx.rotate(-0.95 - attackAnim * 0.4);
      ctx.fillStyle = level >= 2 ? '#FACC15' : '#34D399';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, -2.5);
      ctx.lineTo(34, -4.5);
      ctx.lineTo(38, 0);
      ctx.lineTo(34, 4.5);
      ctx.lineTo(10, 2.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = flash ? '#FFFFFF' : '#4ADE80';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      for (const side of [-1, 1]) {
        ctx.fillStyle = '#FF2E4C';
        ctx.strokeStyle = '#020617';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(side * 12, -13, 6.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.arc(side * 7, -6, 3.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(side * 7 - 1, -7.2, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      const swing = attackAnim * 1.15;
      ctx.save();
      ctx.rotate(facingAngle - 0.5 + swing);
      ctx.fillStyle = level >= 2 ? '#FACC15' : '#34D399';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(12, -3);
      ctx.lineTo(42, -5);
      ctx.lineTo(46, 0);
      ctx.lineTo(42, 5);
      ctx.lineTo(12, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (level > 1) {
      ctx.font = '800 12px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#020617';
      const label = `Nv.${level}`;
      ctx.strokeText(label, 0, -29);
      ctx.fillStyle = '#FACC15';
      ctx.fillText(label, 0, -29);
    }

    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyEntity) {
    const isBoss = enemy.kind === 'boss';
    const waddle = enemy.isDead ? 0 : Math.sin(enemy.walkPhase) * (isBoss ? 0.08 : 0.12);
    const bounce = enemy.isDead ? 0 : Math.abs(Math.sin(enemy.walkPhase)) * (isBoss ? 4.2 : 3.2);
    const koDuration = isBoss ? 0.55 : 0.32;
    const koAlpha = enemy.isDead ? Math.max(0, enemy.koTimer / koDuration) : 1;
    const koTilt = enemy.isDead ? (1 - koAlpha) * 1.1 : 0;
    const flash = enemy.hitFlash > 0;
    const biteOffset = enemy.attackAnim * 4;

    ctx.save();
    ctx.globalAlpha = koAlpha;
    ctx.translate(enemy.x, enemy.y);

    ctx.fillStyle = isBoss ? 'rgba(255, 46, 76, 0.38)' : 'rgba(2, 6, 23, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, enemy.radius - 2, enemy.radius * 0.9, isBoss ? 11 : 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isBoss && !enemy.isDead) {
      ctx.strokeStyle = '#FACC15';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, enemy.radius - 4, enemy.radius * 1.08, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (enemy.kind === 'brute' && enemy.lungeTimer > 0.32) {
      ctx.strokeStyle = '#FF2E4C';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(0, -bounce - biteOffset);
    ctx.rotate(waddle + koTilt);

    if (enemy.kind === 'walker') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#E2E8F0';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 18, 5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#38BDF8';
      ctx.beginPath();
      ctx.arc(0, -12, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -12);
    } else if (enemy.kind === 'shielded') {
      // Special Shielded Enemy: Electric Blue + Gold trim popping on dark road
      ctx.fillStyle = flash ? '#FFFFFF' : '#1E40AF';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-12, -5, 24, 20, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#00D4FF';
      ctx.beginPath();
      ctx.arc(0, -14, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -14);

      const shieldRaise = enemy.bracingTimer > 0 ? -4 : 0;
      ctx.fillStyle = flash ? '#FFFFFF' : '#2563EB';
      ctx.beginPath();
      ctx.roundRect(-14, -8 + shieldRaise, 16, 22, 4);
      ctx.fill();
      ctx.stroke();

      if (!flash) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-10, 0 + shieldRaise, 8, 5);
      }
    } else if (enemy.kind === 'boss') {
      // Special Boss: Vivid Crimson & Gold Crown
      ctx.fillStyle = flash ? '#FFFFFF' : '#991B1B';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 38, 10);
      ctx.fill();
      ctx.stroke();

      if (!flash) {
        ctx.fillStyle = '#FF2E4C';
        ctx.beginPath();
        ctx.roundRect(-28, -14, 14, 16, 5);
        ctx.roundRect(14, -14, 14, 16, 5);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = flash ? '#FFFFFF' : '#EF4444';
      ctx.beginPath();
      ctx.arc(0, -24, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -24);

      ctx.fillStyle = flash ? '#FFFFFF' : '#FACC15';
      ctx.strokeStyle = '#422006';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, -39);
      ctx.lineTo(-16, -52);
      ctx.lineTo(-6, -45);
      ctx.lineTo(0, -56);
      ctx.lineTo(6, -45);
      ctx.lineTo(16, -52);
      ctx.lineTo(14, -39);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // Brute Special: Hot Crimson Armor
      ctx.fillStyle = flash ? '#FFFFFF' : '#B91C1C';
      ctx.strokeStyle = '#020617';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(-14, -6, 28, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#FF2E4C';
      ctx.beginPath();
      ctx.arc(0, -15, 12.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -15);
    }

    ctx.restore();

    if (!enemy.isDead && enemy.hp > 0) {
      ctx.save();
      const yPos = enemy.y - enemy.radius - (isBoss ? 30 : 13) - bounce;

      if (isBoss) {
        const barW = 66;
        const barH = 7;
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#020617';
        ctx.beginPath();
        ctx.roundRect(enemy.x - barW / 2, yPos - 2, barW, barH, 3.5);
        ctx.fill();
        ctx.fillStyle = '#FF2E4C';
        ctx.beginPath();
        ctx.roundRect(enemy.x - barW / 2 + 1, yPos - 1, (barW - 2) * ratio, barH - 2, 2.5);
        ctx.fill();

        ctx.font = '800 12px "Fredoka", "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#020617';
        ctx.strokeText(`CHEFE · ${enemy.hp}`, enemy.x, yPos - 5);
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`CHEFE · ${enemy.hp}`, enemy.x, yPos - 5);
      } else {
        ctx.font = '800 14px "Fredoka", "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#020617';
        const hpText = String(enemy.hp);
        ctx.strokeText(hpText, enemy.x, yPos);
        ctx.fillStyle = enemy.bracingTimer > 0 ? '#00D4FF' : '#FFFFFF';
        ctx.fillText(hpText, enemy.x, yPos);
      }
      ctx.restore();
    }
  }

  private drawZombieFace(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(cx - 3.8, cy - 1, 2.7, 0, Math.PI * 2);
    ctx.arc(cx + 3.8, cy - 1, 2.7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.arc(cx - 3.6, cy - 0.8, 1.3, 0, Math.PI * 2);
    ctx.arc(cx + 3.6, cy - 0.8, 1.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#7F1D1D';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5.2, 3.6, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
