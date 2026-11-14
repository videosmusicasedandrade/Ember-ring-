import { canMergeUnits } from './engineMath';
import { GameSimulation } from './simulation';
import { ArenaConfig, EnemyEntity, MAX_UNIT_LEVEL, UNIT_SPECS, UnitEntity, UnitKind } from './types';

export class ArenaRenderer {
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticArenaKey = '';

  private ensureStaticLayer(arena: ArenaConfig): HTMLCanvasElement {
    const key = `${arena.worldWidth}x${arena.worldHeight}`;
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

  private drawStaticWorld(ctx: CanvasRenderingContext2D, arena: ArenaConfig) {
    const { worldWidth: w, worldHeight: h, centerX: cx, centerY: cy } = arena;

    const bgGrad = ctx.createRadialGradient(cx, cy, 80, cx, cy, 405);
    bgGrad.addColorStop(0, '#85CC47');
    bgGrad.addColorStop(0.65, '#72B93B');
    bgGrad.addColorStop(1, '#5DA430');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    const grassPatches = [
      { x: 180, y: 220, r: 58 },
      { x: 980, y: 260, r: 64 },
      { x: 210, y: 650, r: 54 },
      { x: 1010, y: 610, r: 68 },
      { x: 420, y: 120, r: 44 },
      { x: 820, y: 720, r: 52 },
    ];
    ctx.fillStyle = 'rgba(155, 224, 84, 0.28)';
    for (const p of grassPatches) {
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * 0.68, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    const tufts = [
      [140, 310], [260, 175], [960, 195], [1075, 420],
      [145, 510], [280, 720], [925, 675], [1065, 545],
      [360, 75], [845, 95], [475, 765], [755, 745],
    ];
    for (const [tx, ty] of tufts) {
      this.drawGrassTuft(ctx, tx, ty);
    }

    this.drawPebble(ctx, 250, 710, 16, 10, '#D6D3C9');
    this.drawPebble(ctx, 282, 724, 11, 7, '#C5C2B7');
    this.drawSignpost(ctx, 200, 668);

    ctx.save();
    ctx.fillStyle = 'rgba(35, 68, 18, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy + 7, arena.outerTrackRadius + 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#C9A84C';
    ctx.beginPath();
    const lobes = 44;
    for (let i = 0; i <= lobes * 4; i++) {
      const a = (i / (lobes * 4)) * Math.PI * 2;
      const wobble = Math.sin(a * lobes) * 4.5 + Math.cos(a * 17) * 2;
      const r = arena.outerTrackRadius + 4 + wobble;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();

    const trackGrad = ctx.createRadialGradient(cx, cy, arena.innerGrassRadius, cx, cy, arena.outerTrackRadius);
    trackGrad.addColorStop(0, '#E8C762');
    trackGrad.addColorStop(0.6, '#F4DB80');
    trackGrad.addColorStop(1, '#E2BE57');
    ctx.fillStyle = trackGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, arena.outerTrackRadius - 2, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.2;
      const r = arena.innerGrassRadius + 24 + ((i * 37) % 42);
      ctx.fillStyle = i % 2 === 0 ? 'rgba(180, 140, 48, 0.28)' : 'rgba(255, 248, 210, 0.35)';
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 6, 3.5, a, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#B8973D';
    ctx.beginPath();
    ctx.arc(cx, cy, arena.innerGrassRadius + 3, 0, Math.PI * 2);
    ctx.fill();

    const innerGrad = ctx.createRadialGradient(cx, cy, 30, cx, cy, arena.innerGrassRadius);
    innerGrad.addColorStop(0, '#6EB03C');
    innerGrad.addColorStop(1, '#58972D');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, arena.innerGrassRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(182, 232, 102, 0.24)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    for (const ringR of [102, 184]) {
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();

    this.drawCamperVan(ctx, 132, 82);
    this.drawCampChairs(ctx, cx - 210, 82);
    this.drawStoneHut(ctx, w - 135, 86);

    const trees = [
      { x: 48, y: 175, s: 1.0 },
      { x: 75, y: 270, s: 0.85 },
      { x: 45, y: 585, s: 0.92 },
      { x: 86, y: 745, s: 1.1 },
      { x: 162, y: 780, s: 0.86 },
      { x: w - 55, y: 205, s: 1.05 },
      { x: w - 65, y: 590, s: 0.95 },
      { x: w - 105, y: 745, s: 1.12 },
      { x: w - 210, y: 775, s: 0.88 },
      { x: 265, y: 52, s: 0.82 },
      { x: w - 285, y: 48, s: 0.85 },
    ];
    for (const t of trees) {
      this.drawPineTree(ctx, t.x, t.y, t.s);
    }
  }

  private drawGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.strokeStyle = '#4A8924';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.quadraticCurveTo(x - 9, y - 9, x - 12, y - 12);
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x, y - 11, x + 2, y - 15);
    ctx.moveTo(x + 6, y);
    ctx.quadraticCurveTo(x + 9, y - 8, x + 12, y - 11);
    ctx.stroke();

    ctx.fillStyle = '#FEF9C3';
    ctx.beginPath();
    ctx.arc(x + 16, y - 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(x + 16, y - 4, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawPebble(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string) {
    ctx.save();
    ctx.fillStyle = 'rgba(28, 48, 16, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 3, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#52524B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawSignpost(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(28, 48, 16, 0.25)';
    ctx.beginPath();
    ctx.ellipse(x, y + 26, 18, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8B5A2B';
    ctx.strokeStyle = '#3B2313';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 24, 8, 50, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#D99B52';
    ctx.beginPath();
    ctx.moveTo(x - 20, y - 18);
    ctx.lineTo(x + 16, y - 18);
    ctx.lineTo(x + 25, y - 11);
    ctx.lineTo(x + 16, y - 4);
    ctx.lineTo(x - 20, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawPineTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(20, 46, 14, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 28, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6D4325';
    ctx.strokeStyle = '#2B1A0D';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-6, 4, 12, 16, 3);
    ctx.fill();
    ctx.stroke();

    const layers = [
      { y: 6, w: 30, h: 36, fill: '#2B6E3F' },
      { y: -14, w: 23, h: 32, fill: '#37874D' },
    ];
    for (const l of layers) {
      ctx.fillStyle = l.fill;
      ctx.strokeStyle = '#194025';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, l.y - l.h);
      ctx.lineTo(l.w, l.y);
      ctx.quadraticCurveTo(0, l.y + 6, -l.w, l.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawCamperVan(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.14);

    ctx.fillStyle = 'rgba(20, 46, 14, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 48, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#DC2626';
    ctx.strokeStyle = '#271717';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-42, -18, 84, 42, 12);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FEF3C7';
    ctx.beginPath();
    ctx.roundRect(-38, -28, 76, 24, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#60A5FA';
    ctx.beginPath();
    ctx.roundRect(-28, -22, 56, 14, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.roundRect(-20, -40, 40, 14, 5);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawCampChairs(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#8B5A2B';
    ctx.strokeStyle = '#2C1B0E';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-14, -8, 28, 18, 5);
    ctx.fill();
    ctx.stroke();
    for (const ox of [-34, 34]) {
      ctx.fillStyle = '#2563EB';
      ctx.beginPath();
      ctx.roundRect(ox - 12, -12, 24, 22, 6);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawStoneHut(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20, 46, 14, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 48, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#D6D3D1';
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 12, 42, Math.PI, 0);
    ctx.lineTo(42, 24);
    ctx.lineTo(-42, 24);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#EA580C';
    ctx.beginPath();
    ctx.arc(0, 22, 14, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(0, 20, 7, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
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

    // 2. Dotted Transparent Circular Positioning Slots
    const drag = sim.dragState;
    const draggedUnit =
      drag && drag.source === 'unit' && drag.unitId
        ? sim.units.find((u) => u.id === drag.unitId)
        : undefined;

    for (const slot of sim.slots) {
      const isHovered = sim.hoveredSlotId === slot.id && sim.phase === 'playing';
      const isEmpty = slot.unitId === null;
      const occupant = !isEmpty ? sim.units.find((u) => u.id === slot.unitId) : undefined;
      const isMergeCandidate = Boolean(
        drag &&
          drag.hasMoved &&
          draggedUnit &&
          occupant &&
          canMergeUnits(draggedUnit, occupant)
      );

      ctx.save();
      ctx.beginPath();
      ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);

      if (isMergeCandidate) {
        const pulse = 0.32 + Math.sin(sim.time * 10) * 0.14;
        ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
        ctx.fill();
        ctx.lineWidth = isHovered ? 4 : 3;
        ctx.strokeStyle = '#FDE047';
        ctx.stroke();
      } else {
        ctx.fillStyle = isHovered
          ? 'rgba(217, 249, 157, 0.32)'
          : isEmpty
            ? 'rgba(155, 218, 72, 0.18)'
            : 'rgba(84, 150, 38, 0.25)';
        ctx.fill();

        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.strokeStyle = isHovered ? '#FEF08A' : 'rgba(190, 242, 100, 0.78)';
        if (isEmpty && !isHovered) {
          ctx.setLineDash([5, 5]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isHovered && isEmpty && !drag && !sim.spells.targetingSpell) {
        const spec = UNIT_SPECS[sim.selectedUnit];
        this.drawRangeRing(ctx, slot.x, slot.y, spec.range);
      }
      ctx.restore();
    }

    // 2.5 Shockwave Ring Effects (behind actors)
    for (const sw of sim.shockwaves) {
      const alpha = Math.max(0, sw.life / sw.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 12 * alpha;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.currentRadius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, Math.max(10, sw.currentRadius - 10), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Central Base (Campfire + Glowing Flame Egg / Core)
    this.drawCentralBase(ctx, sim);

    // 4. Depth-sorted actors
    type RenderItem =
      | { kind: 'unit'; y: number; entity: UnitEntity }
      | { kind: 'enemy'; y: number; entity: EnemyEntity };

    const actors: RenderItem[] = [];
    for (const u of sim.units) {
      if (drag?.source === 'unit' && drag.hasMoved && drag.unitId === u.id) continue;
      actors.push({ kind: 'unit', y: u.y, entity: u });
    }
    for (const e of sim.enemies) actors.push({ kind: 'enemy', y: e.y, entity: e });
    actors.sort((a, b) => a.y - b.y);

    for (const item of actors) {
      if (item.kind === 'unit') {
        this.drawUnit(ctx, item.entity, sim.time);
      } else {
        this.drawEnemy(ctx, item.entity);
      }
    }

    // 5. Spinning Giant Emerald Sword Spell Hazard
    for (const blade of sim.spinningBlades) {
      this.drawSpinningBladeHazard(ctx, blade);
    }

    // 5.5 Blade Spell Targeting Reticle
    if (sim.phase === 'playing' && sim.spells.targetingSpell === 'blade') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(sim.pointerWorldX, sim.pointerWorldY, 122, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(52, 211, 153, 0.16)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = '#6EE7B7';
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 6. Dragged unit / card preview
    if (drag && drag.hasMoved) {
      const spec = UNIT_SPECS[drag.kind];
      const range = draggedUnit ? draggedUnit.range : spec.range;
      this.drawRangeRing(ctx, drag.worldX, drag.worldY, range);

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

    // 7. Crescent Slash Arcs
    for (const slash of sim.slashes) {
      const progress = 1 - slash.life / slash.maxLife;
      const alpha = Math.max(0, 1 - progress);
      ctx.save();
      ctx.translate(slash.x, slash.y);
      ctx.rotate(slash.angle);
      ctx.globalAlpha = alpha;

      ctx.strokeStyle = slash.color;
      ctx.lineWidth = 14 * (1 - progress * 0.5);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, slash.radius * (0.76 + progress * 0.24), -0.95, 0.95);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 5 * (1 - progress * 0.6);
      ctx.beginPath();
      ctx.arc(0, 0, slash.radius * (0.78 + progress * 0.22), -0.82, 0.82);
      ctx.stroke();
      ctx.restore();
    }

    // 8. Projectiles
    for (const proj of sim.projectiles) {
      ctx.save();
      if (proj.isShockwave) {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.35)';
        ctx.strokeStyle = '#EFF6FF';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.fillStyle = proj.trailColor;
        ctx.beginPath();
        ctx.arc(proj.x - proj.vx * 0.014, proj.y - proj.vy * 0.014, proj.radius * 0.75, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = proj.color;
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // 9. Pooled Typed Particles (smoke, cut grass, metallic sparks, circles)
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
        ctx.roundRect(-p.size * 1.2, -1.6, p.size * 2.4, 3.2, 1.5);
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

    // 10. Subtle Directional Horde Warning Arrows along perimeter
    for (const warn of sim.hordeWarnings) {
      this.drawHordeWarningArrow(
        ctx,
        arena.centerX,
        arena.centerY,
        warn.angle,
        warn.timer,
        sim.time,
        Boolean(warn.isBoss)
      );
    }

    // 11. Floating Combat, Critical & Merge Numbers
    for (const ft of sim.floatingTexts) {
      const alpha = Math.min(1, (ft.life / ft.maxLife) * 1.4);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = `800 ${Math.round(16 * ft.scale)}px "Fredoka", "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = ft.isCrit ? 5 : 4;
      ctx.strokeStyle = ft.isCrit ? '#431407' : '#182014';
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }

    ctx.restore();
  }

  private drawHordeWarningArrow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    angle: number,
    timer: number,
    time: number,
    isBoss: boolean
  ) {
    const r = (isBoss ? 336 : 344) + Math.sin(time * 9) * 4;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const pulse = 0.65 + Math.sin(time * (isBoss ? 14 : 11)) * 0.35;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI); // Point inward toward arena center
    ctx.globalAlpha = Math.min(1, pulse * Math.min(1, timer * 1.4));
    if (isBoss) ctx.scale(1.45, 1.45);

    ctx.fillStyle = isBoss ? '#DC2626' : '#EF4444';
    ctx.strokeStyle = isBoss ? '#FACC15' : '#FEF08A';
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

    // Whirlwind slash ring
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, blade.radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(blade.rotation);

    // Twin giant spinning emerald blades
    for (let i = 0; i < 2; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI);
      ctx.fillStyle = '#10B981';
      ctx.strokeStyle = '#064E3B';
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

      ctx.fillStyle = '#A7F3D0';
      ctx.fillRect(10, -4, blade.radius * 0.72, 8);
      ctx.restore();
    }

    // Center golden hilt
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  private drawRangeRing(ctx: CanvasRenderingContext2D, x: number, y: number, range: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  private drawCentralBase(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
    const { centerX: cx, centerY: cy } = sim.arena;
    const pulse = Math.sin(sim.time * 4.2) * 2.5;
    const hitFlash = sim.baseHitFlash > 0;
    const overcharged = sim.spells.overchargeTimer > 0;

    ctx.save();
    ctx.translate(cx, cy);

    if (overcharged) {
      ctx.strokeStyle = '#FDE047';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 56 + Math.sin(sim.time * 12) * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    const aura = ctx.createRadialGradient(0, 0, 12, 0, 0, 74 + pulse);
    aura.addColorStop(
      0,
      hitFlash
        ? 'rgba(239, 68, 68, 0.65)'
        : overcharged
          ? 'rgba(250, 204, 21, 0.72)'
          : 'rgba(251, 146, 60, 0.55)'
    );
    aura.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, 0, 74 + pulse, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = Math.cos(a) * 34;
      const sy = Math.sin(a) * 28 + 8;
      ctx.fillStyle = i % 2 === 0 ? '#94A3B8' : '#78716C';
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(sx, sy, 9, 6.5, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.strokeStyle = '#451A03';
    ctx.fillStyle = '#92400E';
    ctx.lineWidth = 2.5;
    for (const ang of [-0.45, 0.45]) {
      ctx.save();
      ctx.translate(0, 14);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.roundRect(-24, -4, 48, 8, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    for (let i = -1; i <= 1; i++) {
      const flick = Math.sin(sim.time * 9 + i * 2.1) * 4;
      ctx.fillStyle = i === 0 ? '#F97316' : '#FACC15';
      ctx.beginPath();
      ctx.moveTo(i * 14 - 10, 12);
      ctx.quadraticCurveTo(i * 14, -18 + flick, i * 14 + 10, 12);
      ctx.closePath();
      ctx.fill();
    }

    const bob = Math.sin(sim.time * 3.1) * 2.5;
    ctx.save();
    ctx.translate(0, -6 + bob);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 22 - bob, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    const eggGrad = ctx.createLinearGradient(-16, -24, 16, 20);
    eggGrad.addColorStop(0, hitFlash ? '#FCA5A5' : '#FDE047');
    eggGrad.addColorStop(0.55, hitFlash ? '#EF4444' : '#F97316');
    eggGrad.addColorStop(1, '#C2410C');
    ctx.fillStyle = eggGrad;
    ctx.strokeStyle = '#271306';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -28);
    ctx.bezierCurveTo(20, -24, 24, 4, 18, 18);
    ctx.bezierCurveTo(10, 26, -10, 26, -18, 18);
    ctx.bezierCurveTo(-24, 4, -20, -24, 0, -28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 251, 214, 0.72)';
    ctx.beginPath();
    ctx.ellipse(-6, -8, 4.5, 9, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.font = '800 13px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#182014';
    const lvlText = `Nv.${sim.baseLevel}`;
    ctx.strokeText(lvlText, 0, -39 + bob);
    ctx.fillStyle = '#FEF08A';
    ctx.fillText(lvlText, 0, -39 + bob);

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

    if (unit.hp < unit.maxHp && unit.hp > 0) {
      const ratio = Math.max(0, unit.hp / unit.maxHp);
      ctx.save();
      ctx.fillStyle = '#182014';
      ctx.beginPath();
      ctx.roundRect(unit.x - 16, unit.y + 21, 32, 6, 3);
      ctx.fill();

      ctx.fillStyle = ratio > 0.4 ? '#4ADE80' : '#F43F5E';
      ctx.beginPath();
      ctx.roundRect(unit.x - 15, unit.y + 22, 30 * ratio, 4, 2);
      ctx.fill();
      ctx.restore();
    }
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
    const idleBob = Math.sin(time * 3.8 + seed) * 1.6;
    const levelScale = 1 + (level - 1) * 0.09;
    const scaleX = (1 + recoil * 0.16) * levelScale;
    const scaleY = (1 - recoil * 0.14) * levelScale;
    const faceRight = Math.cos(facingAngle) >= 0;

    ctx.save();
    ctx.translate(x, y + idleBob);

    ctx.fillStyle = 'rgba(18, 36, 12, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 17 - idleBob, 18 * levelScale, 7 * levelScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (level >= 2) {
      const auraColor =
        level >= MAX_UNIT_LEVEL
          ? 'rgba(251, 146, 60, 0.42)'
          : level === 3
            ? 'rgba(250, 204, 21, 0.38)'
            : 'rgba(56, 189, 248, 0.34)';
      ctx.fillStyle = auraColor;
      ctx.beginPath();
      ctx.ellipse(0, 14 - idleBob, 24 * levelScale, 10 * levelScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = level >= 3 ? '#FDE047' : '#7DD3FC';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.scale(scaleX, scaleY);

    if (kind === 'scout') {
      ctx.save();
      if (!faceRight) ctx.scale(-1, 1);

      ctx.fillStyle = flash ? '#FFFFFF' : '#EF4444';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-16, -6, 10, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#38BDF8';
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 18, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#FED7AA';
      ctx.beginPath();
      ctx.arc(0, -13, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(4, -13, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = level >= 2 ? '#F59E0B' : '#2563EB';
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
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-12, -8, 22, 22, 7);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : level >= 2 ? '#0EA5E9' : '#3B82F6';
      ctx.beginPath();
      ctx.arc(-1, -14, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const bashOffset = attackAnim * 7;
      ctx.fillStyle = flash ? '#FFFFFF' : level >= 3 ? '#38BDF8' : '#60A5FA';
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
      ctx.scale(1.18, 1.18);

      ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
      ctx.beginPath();
      ctx.ellipse(0, 12 - idleBob, 24, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.rotate(-0.95 - attackAnim * 0.4);
      ctx.fillStyle = level >= 2 ? '#FDE047' : '#34D399';
      ctx.strokeStyle = '#064E3B';
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
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(13, -1.2, 20, 2.4);
      ctx.restore();

      ctx.fillStyle = flash ? '#FFFFFF' : '#4ADE80';
      ctx.strokeStyle = '#14532D';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.ellipse(0, 2, 18, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FEF9C3';
      ctx.beginPath();
      ctx.ellipse(0, 6, 10, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const side of [-1, 1]) {
        ctx.fillStyle = '#FB7185';
        ctx.strokeStyle = '#881337';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(side * 12, -13, 6.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(side * 7, -6, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(side * 7 - 1, -7.2, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      const swing = attackAnim * 1.15;
      ctx.save();
      ctx.rotate(facingAngle - 0.5 + swing);
      ctx.fillStyle = level >= 2 ? '#FDE047' : '#34D399';
      ctx.strokeStyle = '#064E3B';
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

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(15, -1.5, 25, 3);
      ctx.restore();
    }

    if (level > 1) {
      ctx.font = '800 12px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#182014';
      const label = `Nv.${level}`;
      ctx.strokeText(label, 0, -29);
      ctx.fillStyle = '#FDE047';
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

    ctx.fillStyle = isBoss ? 'rgba(69, 10, 10, 0.36)' : 'rgba(18, 36, 12, 0.28)';
    ctx.beginPath();
    ctx.ellipse(0, enemy.radius - 2, enemy.radius * 0.9, isBoss ? 11 : 6.5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isBoss && !enemy.isDead) {
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, enemy.radius - 4, enemy.radius * 1.08, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (enemy.kind === 'brute' && enemy.lungeTimer > 0.32) {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(0, -bounce - biteOffset);
    ctx.rotate(waddle + koTilt);

    if (enemy.kind === 'walker') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#E2E8F0';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.roundRect(-10, -4, 20, 18, 5);
      ctx.fill();
      ctx.stroke();

      if (!flash) {
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 2);
        ctx.lineTo(8, 2);
        ctx.moveTo(-8, 8);
        ctx.lineTo(8, 8);
        ctx.stroke();
      }

      ctx.fillStyle = flash ? '#FFFFFF' : '#93C5FD';
      ctx.strokeStyle = '#1E293B';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(0, -12, 10.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      this.drawZombieFace(ctx, 0, -12);
    } else if (enemy.kind === 'shielded') {
      ctx.fillStyle = flash ? '#FFFFFF' : '#334155';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-12, -5, 24, 20, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#7DD3FC';
      ctx.beginPath();
      ctx.arc(0, -14, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -14);

      const shieldRaise = enemy.bracingTimer > 0 ? -4 : 0;
      ctx.fillStyle = flash ? '#FFFFFF' : '#3B82F6';
      ctx.beginPath();
      ctx.roundRect(-14, -8 + shieldRaise, 16, 22, 4);
      ctx.fill();
      ctx.stroke();

      if (!flash) {
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(-10, 0 + shieldRaise, 8, 5);
      }
    } else if (enemy.kind === 'boss') {
      // Giant Stage Boss Zombie King
      ctx.fillStyle = flash ? '#FFFFFF' : '#581C87';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 38, 10);
      ctx.fill();
      ctx.stroke();

      // Crimson chest plate & pauldrons
      if (!flash) {
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.roundRect(-28, -14, 14, 16, 5);
        ctx.roundRect(14, -14, 14, 16, 5);
        ctx.fill();
        ctx.stroke();
      }

      // Boss head
      ctx.fillStyle = flash ? '#FFFFFF' : '#A855F7';
      ctx.beginPath();
      ctx.arc(0, -24, 19, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -24);

      // Jagged golden crown
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

      // Giant broad cleaver
      ctx.save();
      ctx.translate(-26, -6);
      ctx.rotate(-0.45 - enemy.attackAnim * 0.65);
      ctx.fillStyle = flash ? '#FFFFFF' : '#E2E8F0';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      ctx.moveTo(-4, 4);
      ctx.lineTo(-10, -40);
      ctx.lineTo(4, -46);
      ctx.lineTo(8, -22);
      ctx.lineTo(4, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.fillStyle = flash ? '#FFFFFF' : '#475569';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.roundRect(-14, -6, 28, 22, 6);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = flash ? '#FFFFFF' : '#86EFAC';
      ctx.beginPath();
      ctx.arc(0, -15, 12.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      this.drawZombieFace(ctx, 0, -15);

      ctx.save();
      ctx.translate(-15, -4);
      ctx.rotate(-0.55 - enemy.attackAnim * 0.45);
      ctx.fillStyle = flash ? '#FFFFFF' : '#E2E8F0';
      ctx.beginPath();
      ctx.moveTo(-3, 0);
      ctx.lineTo(-4, -24);
      ctx.lineTo(0, -30);
      ctx.lineTo(4, -24);
      ctx.lineTo(3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    if (!enemy.isDead && enemy.hp > 0) {
      ctx.save();
      const yPos = enemy.y - enemy.radius - (isBoss ? 30 : 13) - bounce;

      if (isBoss) {
        const barW = 64;
        const barH = 7;
        const ratio = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = '#182014';
        ctx.beginPath();
        ctx.roundRect(enemy.x - barW / 2, yPos - 2, barW, barH, 3.5);
        ctx.fill();
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.roundRect(enemy.x - barW / 2 + 1, yPos - 1, (barW - 2) * ratio, barH - 2, 2.5);
        ctx.fill();

        ctx.font = '800 12px "Fredoka", "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#182014';
        ctx.strokeText(`CHEFE · ${enemy.hp}`, enemy.x, yPos - 5);
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`CHEFE · ${enemy.hp}`, enemy.x, yPos - 5);
      } else {
        ctx.font = '800 15px "Fredoka", "Plus Jakarta Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#182014';
        const hpText = String(enemy.hp);
        ctx.strokeText(hpText, enemy.x, yPos);
        ctx.fillStyle = enemy.bracingTimer > 0 ? '#93C5FD' : '#FFFFFF';
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

    ctx.fillStyle = '#0F172A';
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
