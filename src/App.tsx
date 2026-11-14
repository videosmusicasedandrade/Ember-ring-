import { useCallback, useEffect, useRef, useState } from 'react';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { GameModals } from './components/GameModals';
import { soundEngine } from './game/audio';
import { GameSimulation } from './game/simulation';
import { HudSnapshot, SpellKind, TOTAL_STAGES, UnitKind } from './game/types';

export default function App() {
  const simRef = useRef<GameSimulation | null>(null);
  if (!simRef.current) {
    const sim = new GameSimulation();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const stageParam = Number(params.get('stage'));
      const initialStage =
        Number.isFinite(stageParam) && stageParam >= 1 && stageParam <= TOTAL_STAGES
          ? stageParam
          : 1;
      if (params.get('autostart') === '1') {
        sim.resetWorld('playing', initialStage);
      }
    }
    simRef.current = sim;
  }

  const screenToWorldRef = useRef<(clientX: number, clientY: number) => { x: number; y: number }>(() => ({
    x: 0,
    y: 0,
  }));

  const [hud, setHud] = useState<HudSnapshot>(() => simRef.current!.getHudSnapshot());
  const [selectedStage, setSelectedStage] = useState<number>(
    () => simRef.current!.currentStage
  );

  const syncBodyDataset = useCallback((snap: HudSnapshot) => {
    document.body.dataset.state = snap.phase === 'victory' ? 'gameover' : snap.phase;
    document.body.dataset.outcome = snap.phase;
    document.body.dataset.stage = String(snap.stage);
    document.body.dataset.unlocked = String(snap.highestUnlockedStage);
    document.body.dataset.units = String(snap.unitCount);
    document.body.dataset.merges = String(snap.mergesPerformed);
    document.body.dataset.maxUnitLevel = String(snap.maxUnitLevelReached);
    document.body.dataset.targeting = snap.targetingSpell ?? '';
    document.body.dataset.overcharge = snap.overchargeTimer > 0 ? '1' : '0';
  }, []);

  const syncHud = useCallback(() => {
    if (simRef.current) {
      const snap = simRef.current.getHudSnapshot();
      setHud(snap);
      syncBodyDataset(snap);
    }
  }, [syncBodyDataset]);

  useEffect(() => {
    syncBodyDataset(hud);
  }, [hud, syncBodyDataset]);

  const handleStart = useCallback(
    (stage?: number) => {
      const sim = simRef.current;
      if (!sim) return;
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const targetStage = stage ?? selectedStage;
      setSelectedStage(targetStage);
      sim.resetWorld('playing', targetStage);
      soundEngine.startMusic();
      syncHud();
    },
    [selectedStage, syncHud]
  );

  const handleNextStage = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    const next = Math.min(TOTAL_STAGES, sim.currentStage + 1);
    setSelectedStage(next);
    sim.resetWorld('playing', next);
    soundEngine.startMusic();
    syncHud();
  }, [syncHud]);

  const handleResume = useCallback(() => {
    const sim = simRef.current;
    if (!sim || sim.phase !== 'paused') return;
    sim.phase = 'playing';
    soundEngine.startMusic();
    syncHud();
  }, [syncHud]);

  const handleTogglePause = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    if (sim.phase === 'playing') {
      sim.phase = 'paused';
      soundEngine.stopMusic();
      syncHud();
    } else if (sim.phase === 'paused') {
      sim.phase = 'playing';
      soundEngine.startMusic();
      syncHud();
    }
  }, [syncHud]);

  const handleReturnTitle = useCallback(() => {
    const sim = simRef.current;
    if (!sim) return;
    soundEngine.stopMusic();
    const target = Math.min(TOTAL_STAGES, sim.highestUnlockedStage);
    setSelectedStage(target);
    sim.resetWorld('title', target);
    syncHud();
  }, [syncHud]);

  const handleSelectUnit = useCallback(
    (kind: UnitKind) => {
      const sim = simRef.current;
      if (!sim) return;
      sim.selectedUnit = kind;
      syncHud();
    },
    [syncHud]
  );

  const handleQuickRecruit = useCallback(
    (kind: UnitKind) => {
      const sim = simRef.current;
      if (!sim) return;
      if (sim.quickRecruitUnit(kind)) {
        syncHud();
      }
    },
    [syncHud]
  );

  const handleStartCardDrag = useCallback((kind: UnitKind, clientX: number, clientY: number) => {
    const sim = simRef.current;
    if (!sim) return;
    const pt = screenToWorldRef.current(clientX, clientY);
    sim.startCardDrag(kind, pt.x, pt.y);
  }, []);

  const handleActivateSpell = useCallback(
    (kind: SpellKind) => {
      const sim = simRef.current;
      if (!sim) return;
      if (sim.activateSpell(kind)) {
        syncHud();
      }
    },
    [syncHud]
  );

  const handleToggleMuteMusic = useCallback(() => {
    const nextMuted = !soundEngine.mutedMusic;
    soundEngine.setMutedMusic(nextMuted);
    if (!nextMuted && simRef.current?.phase === 'playing') {
      soundEngine.startMusic();
    }
    syncHud();
  }, [syncHud]);

  const handleToggleMuteSfx = useCallback(() => {
    soundEngine.setMutedSfx(!soundEngine.mutedSfx);
    syncHud();
  }, [syncHud]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const sim = simRef.current;
      if (!sim) return;

      if (sim.phase === 'title' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleStart(selectedStage);
        return;
      }

      if (e.key === 'Escape' && sim.phase === 'playing' && sim.spells.targetingSpell) {
        sim.cancelSpellTargeting();
        syncHud();
        return;
      }

      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (sim.phase === 'playing' || sim.phase === 'paused') {
          e.preventDefault();
          handleTogglePause();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        handleToggleMuteSfx();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (
          sim.phase === 'playing' ||
          sim.phase === 'paused' ||
          sim.phase === 'gameover' ||
          sim.phase === 'victory'
        ) {
          handleStart(sim.currentStage);
        }
        return;
      }

      if (sim.phase === 'playing') {
        if (e.key === '1') handleSelectUnit('scout');
        else if (e.key === '2') handleSelectUnit('shield');
        else if (e.key === '3') handleSelectUnit('frog');
        else if (e.key === 'q' || e.key === 'Q') handleActivateSpell('blade');
        else if (e.key === 'w' || e.key === 'W') handleActivateSpell('shockwave');
        else if (e.key === 'e' || e.key === 'E') handleActivateSpell('overcharge');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleActivateSpell,
    handleSelectUnit,
    handleStart,
    handleToggleMuteSfx,
    handleTogglePause,
    selectedStage,
    syncHud,
  ]);

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <GameCanvas
        simRef={simRef as React.MutableRefObject<GameSimulation>}
        screenToWorldRef={screenToWorldRef}
        onHudSync={setHud}
      />
      <GameHUD
        hud={hud}
        onSelectUnit={handleSelectUnit}
        onQuickRecruit={handleQuickRecruit}
        onStartCardDrag={handleStartCardDrag}
        onActivateSpell={handleActivateSpell}
        onTogglePause={handleTogglePause}
        onToggleMuteMusic={handleToggleMuteMusic}
        onToggleMuteSfx={handleToggleMuteSfx}
        onRestart={() => handleStart(hud.stage)}
      />
      <GameModals
        hud={hud}
        selectedStage={selectedStage}
        onSelectStage={setSelectedStage}
        onStart={handleStart}
        onNextStage={handleNextStage}
        onResume={handleResume}
        onRestart={() => handleStart(hud.stage)}
        onReturnTitle={handleReturnTitle}
      />
    </main>
  );
}
