import { canMergeUnits } from './engineMath';
import { GameSimulation } from './simulation';
import { ArenaConfig, EnemyEntity, MAX_UNIT_LEVEL, UNIT_SPECS, UnitEntity, UnitKind } from './types';

export class ArenaRenderer {
  private staticCanvas: HTMLCanvasElement | null = null;
  private staticArenaKey = '';

  private ensureStaticLayer(arena: ArenaConfig): HTMLCanvasElement {
    const key = `${arena.worldWidth}x${arena.worldHeight}-route-v2`;
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

  private drawStaticWorld(ctx: CanvasRenderingContext2D, arena: ArenaConfig) {
    const { worldWidth: w, worldHeight: h, centerX: cx, centerY: cy } = arena;

    // 1. Clean layered modern meadow gradient
    const bgGrad = ctx.createRadialGradient(cx, cy, 90, cx, cy, 690);
    bgGrad.addColorStop(0, '#78C94D');
    bgGrad.addColorStop(0.58, '#61AF39');
    bgGrad.addColorStop(1, '#4A8E29');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle sunlit grass terraces for depth without clutter
    const meadows = [
      { x: 240, y: 390, rx: 160, ry: 110 },
      { x: 640, y: 380, rx: 190, ry: 145 },
      { x: 960, y: 420, rx: 145, ry: 130 },
      { x: 430, y: 580, rx: 140, ry: 85 },
    ];
    ctx.fillStyle = 'rgba(170, 232, 102, 0.2)';
    for (const m of meadows) {
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, m.rx, m.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scenic decorative pond in calm bottom-left meadow
    this.drawScenicPond(ctx, 130, 660);

    // Subtle grass tufts & wildflowers outside road
    const tufts = [
      [145, 135], [325, 135], [630, 135], [885, 145],
      [115, 420], [115, 550], [295, 665], [585, 675],
      [830, 675], [1085, 645], [1110, 225], [755, 130],
    ];
    for (const [tx, ty] of tufts) {
      this.drawGrassTuft(ctx, tx, ty);
    }

    // Pebbles & wooden trail signpost near portal
    this.drawPebble(ctx, 250, 675, 15, 9, '#CBD5E1');
    this.drawPebble(ctx, 278, 690, 10, 6, '#94A3B8');
    this.drawSignpost(ctx, 146, 336);

    // 2. Winding Cobblestone / Sandstone Route
    const roadW = arena.roadHalfWidth * 2;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Ground drop shadow
    ctx.save();
    ctx.translate(0, 7);
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = 'rgba(20, 48, 12, 0.24)';
    ctx.lineWidth = roadW + 14;
    ctx.stroke();
    ctx.restore();

    // Dark stone border outline
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#8F703B';
    ctx.lineWidth = roadW + 12;
    ctx.stroke();

    // Warm sandstone curb trim
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#C7A35A';
    ctx.lineWidth = roadW + 6;
    ctx.stroke();

    // Main sunlit path surface
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#EBD082';
    ctx.lineWidth = roadW;
    ctx.stroke();

    // Inner worn center track
    this.traceRoutePath(ctx, arena);
    ctx.strokeStyle = '#F5E19E';
    ctx.lineWidth = roadW * 0.56;
    ctx.stroke();

    // Stylized stepping stones & subtle directional chevrons along each segment
    const wps = arena.waypoints;
    for (let i = 0; i < wps.length - 1; i++) {
      const a = wps[i];
      const b = wps[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const segLen = Math.hypot(dx, dy);
      const ang = Math.atan2(dy, dx);
      if (segLen < 35) continue;

      const steps = Math.max(1, Math.floor(segLen / 54));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 1);
        const px = a.x + dx * t;
        const py = a.y + dy * t;

        // Subtle stone speckle
        const perpX = (-dy / segLen) * ((s % 2 === 0 ? 1 : -1) * 14);
        const perpY = (dx / segLen) * ((s % 2 === 0 ? 1 : -1) * 14);
        ctx.fillStyle = 'rgba(181, 141, 68, 0.25)';
        ctx.beginPath();
        ctx.ellipse(px + perpX, py + perpY, 6, 4, ang, 0, Math.PI * 2);
        ctx.fill();

        // Subtle inlaid chevron arrow pointing along route
        if (s % 2 === 1) {
          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(ang);
          ctx.strokeStyle = 'rgba(161, 118, 44, 0.34)';
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

    // 3. Perimeter foliage & minimalist pine trees framing the map edges
    const shrubs = [
      { x: 64, y: 180, r: 22 },
      { x: 380, y: 98, r: 24 },
      { x: 770, y: 95, r: 22 },
      { x: 1135, y: 205, r: 24 },
      { x: 1140, y: 580, r: 22 },
      { x: 560, y: 720, r: 24 },
      { x: 840, y: 715, r: 22 },
    ];
    for (const s of shrubs) {
      this.drawRoundedBush(ctx, s.x, s.y, s.r);
    }

    const trees = [
      { x: 52, y: 120, s: 0.98 },
      { x: 52, y: 380, s: 0.88 },
      { x: 55, y: 515, s: 0.94 },
      { x: 72, y: 745, s: 1.05 },
      { x: 210, y: 760, s: 0.86 },
      { x: 1142, y: 130, s: 1.02 },
      { x: 1145, y: 320, s: 0.85 },
      { x: 1138, y: 660, s: 1.05 },
      { x: 1030, y: 745, s: 0.92 },
      { x: 220, y: 62, s: 0.82 },
      { x: 960, y: 68, s: 0.86 },
    ];
    for (const t of trees) {
      this.drawPineTree(ctx, t.x, t.y, t.s);
    }
  }

  private drawScenicPond(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20, 48, 14, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 5, 58, 30, -0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#B8AD96';
    ctx.strokeStyle = '#4B5563';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 54, 27, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const waterGrad = ctx.createLinearGradient(-40, -18, 40, 18);
    waterGrad.addColorStop(0, '#38BDF8');
    waterGrad.addColorStop(1, '#0284C7');
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 21, -0.15, 0, Math.PI * 2);
    ctx.fill();

    // Lilypad
    ctx.fillStyle = '#4ADE80';
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(16, 4, 8, 0.4, Math.PI * 2 - 0.3);
    ctx.lineTo(16, 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(-18, -7, 13, 3.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawRoundedBush(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(20, 46, 14, 0.24)';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.52, r * 1.15, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#2F7D32';
    ctx.strokeStyle = '#18441B';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(-r * 0.45, 2, r * 0.62, 0, Math.PI * 2);
    ctx.arc(r * 0.45, 2, r * 0.62, 0, Math.PI * 2);
    ctx.arc(0, -r * 0.24, r * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#4ADE80';
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.34, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawGrassTuft(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    ctx.strokeStyle = '#3B781C';
    ctx.lineWidth = 2.4;
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
    ctx.arc(x + 15, y - 4, 3.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.arc(x + 15, y - 4, 1.5, 0, Math.PI * 2);
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
    ctx.strokeStyle = '#475569';
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
    ctx.ellipse(x, y + 25, 16, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8B5A2B';
    ctx.strokeStyle = '#3B2313';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(x - 4, y - 22, 8, 46, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#E0A153';
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 17);
    ctx.lineTo(x + 16, y - 17);
    ctx.lineTo(x + 24, y - 10);
    ctx.lineTo(x + 16, y - 3);
    ctx.lineTo(x - 18, y - 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawPineTree(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(20, 46, 14, 0.26)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 28, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#6D4325';
    ctx.strokeStyle = '#2B1A0D';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(-6, 4, 12, 16, 3);
    ctx.fill();
    ctx.stroke();

    const layers = [
      { y: 6, w: 30, h: 36, fill: '#286C3D' },
      { y: -14, w: 23, h: 32, fill: '#35884E' },
    ];
    for (const l of layers) {
      ctx.fillStyle = l.fill;
      ctx.strokeStyle = '#173E23';
      ctx.lineWidth = 2.4;
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

  public render(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
    const { arena } = sim;
    const staticLayer = this.ensureStaticLayer(arena);

    ctx.save();

    if (sim.cameraTrauma > 0) {
      const shake = sim.cameraTrauma * sim.cameraTrauma * 11;
      ctx.translate((Math.random() - 0.5) * shake * 2, (Math.random() - 0.5) * shake * 2);
    }

    ctx.drawImage(staticLayer, 0, 0);

    // 2. Strategic Tactical Defender Pad Slots beside the route
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
      // Subtle plinth drop shadow
      ctx.fillStyle = 'rgba(20, 42, 14, 0.22)';
      ctx.beginPath();
      ctx.ellipse(slot.x, slot.y + 4, slot.radius + 2, slot.radius * 0.88 + 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(slot.x, slot.y, slot.radius, 0, Math.PI * 2);

      if (isMergeCandidate) {
        const pulse = 0.34 + Math.sin(sim.time * 10) * 0.14;
        ctx.fillStyle = `rgba(250, 204, 21, ${pulse})`;
        ctx.fill();
        ctx.lineWidth = isHovered ? 4 : 3;
        ctx.strokeStyle = '#FDE047';
        ctx.stroke();
      } else {
        ctx.fillStyle = isHovered
          ? 'rgba(217, 249, 157, 0.42)'
          : isEmpty
            ? 'rgba(54, 98, 28, 0.32)'
            : 'rgba(42, 76, 22, 0.45)';
        ctx.fill();

        ctx.lineWidth = isHovered ? 3 : 2.2;
        ctx.strokeStyle = isHovered
          ? '#FEF08A'
          : isEmpty
            ? 'rgba(217, 249, 157, 0.85)'
            : 'rgba(163, 230, 53, 0.55)';
        if (isEmpty && !isHovered) {
          ctx.setLineDash([6, 5]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        if (isEmpty) {
          ctx.fillStyle = 'rgba(236, 252, 203, 0.45)';
          ctx.fillRect(slot.x - 6, slot.y - 1.5, 12, 3);
          ctx.fillRect(slot.x - 1.5, slot.y - 6, 3, 12);
        }
      }

      if (isHovered && isEmpty && !drag && !sim.spells.targetingSpell) {
        const spec = UNIT_SPECS[sim.selectedUnit];
        this.drawRangeRing(ctx, slot.x, slot.y, spec.range);
      }
      ctx.restore();
    }

    // 2.5 Shockwave Ring Effects (radiating from Castle)
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

    // 3. West Invasion Portal Gate & East Fortress Castle
    this.drawSpawnPortal(ctx, sim);
    this.drawCastleBase(ctx, sim);

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
        ctx.fillStyle = 'rgba(96, 165, 250, 0.38)';
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

  private drawSpawnPortal(ctx: CanvasRenderingContext2D, sim: GameSimulation) {
    const start = sim.arena.waypoints[0] ?? { x: 96, y: 265 };
    const pulse = Math.sin(sim.time * 4.5) * 2.5;

    ctx.save();
    ctx.translate(start.x, start.y);

    // Shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 26, 36, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stone archway pillars
    ctx.fillStyle = '#475569';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-28, -32, 56, 56, 18);
    ctx.fill();
    ctx.stroke();

    // Inner glowing rift
    const riftGrad = ctx.createRadialGradient(0, -2, 4, 0, -2, 24 + pulse);
    riftGrad.addColorStop(0, '#F5D0FE');
    riftGrad.addColorStop(0.55, '#A855F7');
    riftGrad.addColorStop(1, '#4C1D95');
    ctx.fillStyle = riftGrad;
    ctx.beginPath();
    ctx.ellipse(0, -1, 18, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3B0764';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Label
    ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0F172A';
    ctx.strokeText('HORDA', 0, -40);
    ctx.fillStyle = '#E9D5FF';
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

    // Soft castle ground shadow
    ctx.fillStyle = 'rgba(18, 36, 12, 0.34)';
    ctx.beginPath();
    ctx.ellipse(0, 40, 62, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // Overcharge aura or Hit warning glow
    if (overcharged || hitFlash) {
      ctx.strokeStyle = hitFlash ? 'rgba(239, 68, 68, 0.85)' : '#FDE047';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 12, 66 + Math.sin(sim.time * 10) * 3, 52, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const wallColor = hitFlash ? '#FCA5A5' : '#E2E8F0';
    const wallShade = hitFlash ? '#EF4444' : '#94A3B8';
    const roofColor = hitFlash ? '#DC2626' : '#2563EB';
    const outline = '#1E293B';

    // Rear central keep tower
    ctx.fillStyle = wallShade;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-24, -46, 48, 56, 6);
    ctx.fill();
    ctx.stroke();

    // Keep conical roof
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(0, -76);
    ctx.lineTo(29, -42);
    ctx.lineTo(-29, -42);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fluttering golden banner on keep spire
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

    // Main stone curtain wall & battlements
    ctx.fillStyle = wallColor;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-42, -16, 84, 52, 8);
    ctx.fill();
    ctx.stroke();

    // Battlement merlons
    for (const mx of [-32, -14, 4, 22]) {
      ctx.fillStyle = wallColor;
      ctx.beginPath();
      ctx.roundRect(mx, -24, 12, 10, 2);
      ctx.fill();
      ctx.stroke();
    }

    // Twin front flanking watchtowers
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

    // Arched oak-and-iron Castle Gate
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

    // Gate iron studs & golden crest
    ctx.strokeStyle = '#451A03';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, 36);
    ctx.stroke();

    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.arc(0, -8, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Castle Level Badge above keep
    ctx.font = '800 13px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0F172A';
    const lvlText = `Castelo Nv.${sim.baseLevel}`;
    ctx.strokeText(lvlText, 0, -104);
    ctx.fillStyle = '#FEF08A';
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

    ctx.strokeStyle = 'rgba(52, 211, 153, 0.55)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, blade.radius * 0.9, 0, Math.PI * 2);
    ctx.stroke();

    ctx.rotate(blade.rotation);

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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
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
    const idleBob = Math.sin(time * 3.8 + seed) * 1.5;
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
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.65)';
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
      ctx.fillStyle = flash ? '#FFFFFF' : '#581C87';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.roundRect(-24, -12, 48, 38, 10);
      ctx.fill();
      ctx.stroke();

      if (!flash) {
        ctx.fillStyle = '#991B1B';
        ctx.beginPath();
        ctx.roundRect(-28, -14, 14, 16, 5);
        ctx.roundRect(14, -14, 14, 16, 5);
        ctx.fill();
        ctx.stroke();
      }

      ctx.fillStyle = flash ? '#FFFFFF' : '#A855F7';
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
        ctx.font = '800 14px "Fredoka", "Plus Jakarta Sans", sans-serif';
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
