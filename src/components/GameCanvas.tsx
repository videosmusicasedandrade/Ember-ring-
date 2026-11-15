import React, { useEffect, useRef } from 'react';
import { Plus, Minus } from 'lucide-react';
import { findSlotAtPoint } from '../game/engineMath';
import { GameSimulation } from '../game/simulation';
import { ThreeSceneManager } from '../game/threeScene';
import { HudSnapshot } from '../game/types';

interface GameCanvasProps {
  simRef: React.MutableRefObject<GameSimulation>;
  screenToWorldRef: React.MutableRefObject<(clientX: number, clientY: number) => { x: number; y: number }>;
  onHudSync: (snapshot: HudSnapshot) => void;
}

interface PointerRecord {
  x: number;
  y: number;
  startX: number;
  startY: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  simRef,
  screenToWorldRef,
  onHudSync,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const threeManagerRef = useRef<ThreeSceneManager | null>(null);
  const onHudSyncRef = useRef(onHudSync);
  onHudSyncRef.current = onHudSync;

  const activePointersRef = useRef<Map<number, PointerRecord>>(new Map());
  const lastTwoFingerAngleRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const manager = new ThreeSceneManager(container);
    threeManagerRef.current = manager;

    // Ensure canvas touch behavior is non-interfering
    if (manager.renderer.domElement) {
      manager.renderer.domElement.style.touchAction = 'none';
      manager.renderer.domElement.style.userSelect = 'none';
    }

    screenToWorldRef.current = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return manager.getWorldCoordFromScreen(
        clientX - rect.left,
        clientY - rect.top,
        rect.width,
        rect.height
      );
    };

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(280, Math.floor(rect.height));
      manager.camera.aspect = w / h;
      manager.camera.updateProjectionMatrix();
      manager.renderer.setSize(w, h);
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let lastHudKey = '';

    const frame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;

      const sim = simRef.current;
      sim.update(rawDt);
      manager.updateScene(sim);
      manager.renderer.render(manager.scene, manager.camera);

      const snap = sim.getHudSnapshot();
      const cdKey = `${Math.ceil(snap.spellCooldowns.blade * 2)}|${Math.ceil(snap.spellCooldowns.shockwave * 2)}|${Math.ceil(snap.spellCooldowns.overcharge * 2)}|${snap.targetingSpell ?? ''}|${Math.ceil(snap.overchargeTimer * 2)}`;
      const hudKey = `${snap.phase}|${snap.stage}|${snap.highestUnlockedStage}|${snap.baseHp}|${snap.baseLevel}|${snap.essence}|${snap.score}|${snap.wave}|${snap.kills}|${snap.selectedUnit}|${snap.unitCount}|${snap.mergesPerformed}|${snap.maxUnitLevelReached}|${snap.mutedMusic}|${snap.mutedSfx}|${snap.bossActive}|${cdKey}`;
      if (hudKey !== lastHudKey) {
        lastHudKey = hudKey;
        onHudSyncRef.current(snap);
      }

      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    // Pointer Event Handlers: Unified for Touch, Mouse, and Pen
    const onPointerDown = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      activePointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
      });

      if (activePointersRef.current.size === 1) {
        lastTwoFingerAngleRef.current = null;
        const worldPt = manager.getWorldCoordFromScreen(
          e.clientX - rect.left,
          e.clientY - rect.top,
          rect.width,
          rect.height
        );

        // If spell targeting is active, cast immediately on tap
        if (simRef.current.spells.targetingSpell) {
          const acted = simRef.current.handlePointerDown(worldPt.x, worldPt.y);
          if (acted) onHudSyncRef.current(simRef.current.getHudSnapshot());
          return;
        }

        // If an existing defender was clicked, pick it up for dragging/merging
        const slot = findSlotAtPoint(worldPt.x, worldPt.y, simRef.current.slots);
        if (slot && slot.unitId !== null) {
          const acted = simRef.current.handlePointerDown(worldPt.x, worldPt.y);
          if (acted) onHudSyncRef.current(simRef.current.getHudSnapshot());
        }
      } else if (activePointersRef.current.size >= 2) {
        // Multi-touch: Cancel any unit drag to avoid drop conflicts
        simRef.current.dragState = null;
        const pointers = Array.from(activePointersRef.current.values());
        const p0 = pointers[0];
        const p1 = pointers[1];
        lastTwoFingerAngleRef.current = Math.atan2(p1.y - p0.y, p1.x - p0.x);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const record = activePointersRef.current.get(e.pointerId);
      const rect = container.getBoundingClientRect();

      if (activePointersRef.current.size >= 2) {
        // Multi-touch: Pure rotation strictly on vertical Y-axis. ZERO zoom.
        if (record) {
          record.x = e.clientX;
          record.y = e.clientY;
        }
        const pointers = Array.from(activePointersRef.current.values());
        const p0 = pointers[0];
        const p1 = pointers[1];
        const currentAngle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

        if (lastTwoFingerAngleRef.current !== null) {
          let delta = currentAngle - lastTwoFingerAngleRef.current;
          while (delta > Math.PI) delta -= 2 * Math.PI;
          while (delta < -Math.PI) delta += 2 * Math.PI;

          manager.rotateYaw(delta);
        }
        lastTwoFingerAngleRef.current = currentAngle;
      } else if (activePointersRef.current.size === 1 && record) {
        // 1-finger movement: Pan or Drag
        const dx = e.clientX - record.x;
        const dy = e.clientY - record.y;
        record.x = e.clientX;
        record.y = e.clientY;

        if (simRef.current.dragState) {
          // Move currently dragged unit or card
          const worldPt = manager.getWorldCoordFromScreen(
            e.clientX - rect.left,
            e.clientY - rect.top,
            rect.width,
            rect.height
          );
          simRef.current.handlePointerMove(worldPt.x, worldPt.y);
        } else {
          // Fluid lateral camera pan on the arena map
          manager.pan(dx, dy, rect.height);
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      const record = activePointersRef.current.get(e.pointerId);
      const rect = container.getBoundingClientRect();

      if (activePointersRef.current.size === 1 && record) {
        const totalDistance = Math.hypot(e.clientX - record.startX, e.clientY - record.startY);

        const worldPt = manager.getWorldCoordFromScreen(
          e.clientX - rect.left,
          e.clientY - rect.top,
          rect.width,
          rect.height
        );

        if (simRef.current.dragState) {
          // Complete unit move or merge
          const acted = simRef.current.handlePointerUp(worldPt.x, worldPt.y);
          if (acted) onHudSyncRef.current(simRef.current.getHudSnapshot());
        } else if (totalDistance < 9) {
          // Clean tap on empty slot to recruit unit
          const acted = simRef.current.handlePointerDown(worldPt.x, worldPt.y);
          if (acted) onHudSyncRef.current(simRef.current.getHudSnapshot());
        }
      }

      activePointersRef.current.delete(e.pointerId);
      if (activePointersRef.current.size < 2) {
        lastTwoFingerAngleRef.current = null;
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        manager.zoomIn();
      } else {
        manager.zoomOut();
      }
    };

    // Attach listeners to container & window to capture gestures anywhere
    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      manager.dispose();
      threeManagerRef.current = null;
    };
  }, [simRef, screenToWorldRef]);

  const handleZoomIn = () => {
    threeManagerRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    threeManagerRef.current?.zoomOut();
  };

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed inset-0 bg-[#4A8E29] touch-none select-none cursor-grab active:cursor-grabbing"
    >
      {/* 3D Zoom Controls Overlay */}
      <div className="pointer-events-auto absolute bottom-[150px] right-4 z-30 flex flex-col gap-2 sm:bottom-6 sm:right-6">
        <button
          type="button"
          tabIndex={-1}
          aria-label="Aproximar tela (Zoom In)"
          title="Aproximar tela"
          onClick={(e) => {
            e.currentTarget.blur();
            handleZoomIn();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#1B2C13] bg-[#1E3115]/95 text-[#FDE047] shadow-[0_4px_0_rgba(15,28,10,0.65)] transition-transform active:translate-y-0.5 hover:bg-[#2E4821]"
        >
          <Plus className="h-5 w-5 stroke-[3]" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          aria-label="Afastar tela (Zoom Out)"
          title="Afastar tela"
          onClick={(e) => {
            e.currentTarget.blur();
            handleZoomOut();
          }}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#1B2C13] bg-[#1E3115]/95 text-[#FDE047] shadow-[0_4px_0_rgba(15,28,10,0.65)] transition-transform active:translate-y-0.5 hover:bg-[#2E4821]"
        >
          <Minus className="h-5 w-5 stroke-[3]" />
        </button>
      </div>
    </div>
  );
};
