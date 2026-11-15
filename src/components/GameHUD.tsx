import React, { useEffect, useState } from 'react';
import { Music, Pause, Plus, RotateCcw, Shield, Volume2, VolumeX } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { HudSnapshot, SPELL_SPECS, SpellKind, UNIT_SPECS, UnitKind } from '../game/types';

interface GameHUDProps {
  hud: HudSnapshot;
  onSelectUnit: (kind: UnitKind) => void;
  onQuickRecruit: (kind: UnitKind) => void;
  onStartCardDrag: (kind: UnitKind, clientX: number, clientY: number) => void;
  onActivateSpell: (kind: SpellKind) => void;
  onTogglePause: () => void;
  onToggleMuteMusic: () => void;
  onToggleMuteSfx: () => void;
  onRestart: () => void;
}

const UNIT_ORDER: UnitKind[] = ['scout', 'shield', 'frog'];
const SPELL_ORDER: SpellKind[] = ['blade', 'shockwave', 'overcharge'];

function UnitIcon({ kind }: { kind: UnitKind }) {
  if (kind === 'scout') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <circle cx="12" cy="13" r="7" fill="#FED7AA" stroke="#1E293B" strokeWidth="2" />
        <path d="M5 11a7 7 0 0 1 14 0z" fill="#2563EB" stroke="#1E293B" strokeWidth="2" />
        <rect x="10" y="9" width="10" height="3.5" rx="1.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
        <rect x="5" y="4" width="14" height="16" rx="5" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" fill="#FACC15" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" aria-hidden="true">
      <ellipse cx="12" cy="14" rx="7.5" ry="6" fill="#4ADE80" stroke="#14532D" strokeWidth="2" />
      <circle cx="7.5" cy="7.5" r="3" fill="#FB7185" stroke="#881337" strokeWidth="1.5" />
      <circle cx="16.5" cy="7.5" r="3" fill="#FB7185" stroke="#881337" strokeWidth="1.5" />
      <path d="M17 17l5-5" stroke="#34D399" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SpellIcon({ kind }: { kind: SpellKind }) {
  if (kind === 'blade') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#6EE7B7" strokeWidth="2" strokeDasharray="5 3" />
        <path d="M5 19L19 5" stroke="#34D399" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M6 14l4 4" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'shockwave') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="#38BDF8" strokeWidth="2.2" />
        <circle cx="12" cy="12" r="5" fill="none" stroke="#BAE6FD" strokeWidth="2" />
        <circle cx="12" cy="12" r="2" fill="#FFFFFF" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
      <path d="M13 2L5 14h6l-1 8 9-12h-6z" fill="#FACC15" stroke="#422006" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export const GameHUD: React.FC<GameHUDProps> = ({
  hud,
  onSelectUnit,
  onQuickRecruit,
  onStartCardDrag,
  onActivateSpell,
  onTogglePause,
  onToggleMuteMusic,
  onToggleMuteSfx,
  onRestart,
}) => {
  const [ghostHp, setGhostHp] = useState(hud.baseHp);

  useEffect(() => {
    if (hud.baseHp < ghostHp) {
      const timer = setTimeout(() => setGhostHp(hud.baseHp), 280);
      return () => clearTimeout(timer);
    }
    setGhostHp(hud.baseHp);
  }, [hud.baseHp, ghostHp]);

  if (hud.phase === 'title') return null;

  const hpPercent = Math.max(0, Math.min(100, (hud.baseHp / hud.baseMaxHp) * 100));
  const ghostPercent = Math.max(hpPercent, Math.min(100, (ghostHp / hud.baseMaxHp) * 100));
  const hpFillClass =
    hpPercent > 60
      ? 'from-[#22C55E] to-[#4ADE80]'
      : hpPercent > 30
        ? 'from-[#F59E0B] to-[#FACC15]'
        : 'from-[#DC2626] to-[#FB7185]';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2.5 sm:p-4">
      {/* Top Unified HUD: Castle HP Bar + Stage/Economy + Controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {/* Top-Left / Full-width Top on Mobile: Visible Castle HP Bar */}
        <div
          aria-label="Vida do Castelo"
          className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border-2 border-[#1B2C13] bg-[#1E3115]/95 px-3 py-2 shadow-[0_4px_0_rgba(15,28,10,0.65)] sm:min-w-[270px] sm:gap-3"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#365424] bg-[#2D481E] text-[#FDE047]">
            <Shield className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold leading-none">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-white">
                <span className="uppercase tracking-wide text-[#FDE047]">Castelo</span>
                <span className="font-mono-tabular text-[11px] text-[#BEF264]" data-testid="hud-level">
                  Nv.{hud.baseLevel}
                </span>
              </span>
              <span className="font-mono-tabular whitespace-nowrap text-white" data-testid="hud-hp">
                {Math.round(hud.baseHp)}/{hud.baseMaxHp}
              </span>
            </div>
            <div className="relative h-3.5 w-full overflow-hidden rounded-full border border-[#121F0C] bg-[#0F180B]">
              <div
                className="absolute inset-0 origin-left bg-[#FCA5A5]/70 transition-transform duration-300"
                style={{ transform: `scaleX(${ghostPercent / 100})` }}
              />
              <div
                className={`relative h-full w-full origin-left rounded-full bg-gradient-to-r transition-transform duration-150 ${hpFillClass}`}
                style={{ transform: `scaleX(${hpPercent / 100})` }}
              />
            </div>
          </div>
        </div>

        {/* Center Plaque: Essence · Stage/Wave · Score */}
        <div
          aria-label="Recursos e progresso"
          className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl border-2 border-[#1B2C13] bg-[#1E3115]/95 px-3.5 py-1.5 shadow-[0_4px_0_rgba(15,28,10,0.65)] sm:justify-center sm:gap-5 sm:px-5 sm:py-2"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
              <polygon points="12,2 20,9 16,21 8,21 4,9" fill="#FACC15" stroke="#422006" strokeWidth="2" />
            </svg>
            <div className="leading-none">
              <div className="text-[10px] font-bold tracking-wider text-[#FDE047] uppercase">
                {hud.overchargeTimer > 0 ? 'Essência 1.5x' : 'Essência'}
              </div>
              <div
                className={`font-mono-tabular text-base font-bold sm:text-lg ${
                  hud.overchargeTimer > 0 ? 'text-[#FEF08A]' : 'text-white'
                }`}
                data-testid="hud-essence"
              >
                {Math.round(hud.essence)}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-white/15" />

          <div className="leading-none text-center">
            <div className="flex items-center justify-center gap-1 text-[10px] font-bold tracking-wider text-[#D9F99D] uppercase">
              <span>Fase {hud.stage}</span>
              {hud.bossActive && (
                <span className="rounded bg-[#DC2626] px-1 py-0.5 text-[9px] text-[#FEF08A]">CHEFE</span>
              )}
            </div>
            <div className="font-mono-tabular text-base font-bold text-white sm:text-lg" data-testid="hud-wave">
              Onda {hud.wave}/{hud.totalWavesInStage}
            </div>
          </div>

          <div className="h-6 w-px bg-white/15" />

          <div className="leading-none text-right">
            <div className="text-[10px] font-bold tracking-wider text-[#93C5FD] uppercase">Pontos</div>
            <div className="font-mono-tabular text-base font-bold text-white sm:text-lg" data-testid="hud-score">
              {Math.round(hud.score)}
            </div>
          </div>
        </div>

        {/* Top-Right Audio & Utility Controls */}
        <div className="pointer-events-auto flex items-center justify-end gap-1.5 sm:gap-2">
          <button
            type="button"
            tabIndex={-1}
            data-testid="btn-mute-music"
            aria-label={hud.mutedMusic ? 'Ativar música' : 'Silenciar música'}
            title={hud.mutedMusic ? 'Ativar música' : 'Silenciar música'}
            onClick={(e) => {
              e.currentTarget.blur();
              soundEngine.playClick();
              onToggleMuteMusic();
            }}
            className={`relative flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1B2C13] shadow-[0_3px_0_rgba(15,28,10,0.6)] transition-transform active:translate-y-0.5 ${
              hud.mutedMusic
                ? 'bg-[#1A2B12]/95 text-red-300 hover:bg-[#273E1C]'
                : 'bg-[#1E3115]/95 text-[#BEF264] hover:bg-[#2E4821]'
            }`}
          >
            <Music className="h-4.5 w-4.5" />
            {hud.mutedMusic && (
              <span className="pointer-events-none absolute h-0.5 w-5 rotate-45 rounded bg-red-400" />
            )}
          </button>
          <button
            type="button"
            tabIndex={-1}
            data-testid="btn-mute-sfx"
            aria-label={hud.mutedSfx ? 'Ativar efeitos sonoros (M)' : 'Silenciar efeitos sonoros (M)'}
            title={hud.mutedSfx ? 'Ativar efeitos sonoros (M)' : 'Silenciar efeitos sonoros (M)'}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMuteSfx();
            }}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1B2C13] shadow-[0_3px_0_rgba(15,28,10,0.6)] transition-transform active:translate-y-0.5 ${
              hud.mutedSfx
                ? 'bg-[#1A2B12]/95 text-red-300 hover:bg-[#273E1C]'
                : 'bg-[#1E3115]/95 text-white hover:bg-[#2E4821]'
            }`}
          >
            {hud.mutedSfx ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Pausar jogo (P)"
            onClick={(e) => {
              e.currentTarget.blur();
              soundEngine.playClick();
              onTogglePause();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1B2C13] bg-[#1E3115]/95 text-white shadow-[0_3px_0_rgba(15,28,10,0.6)] transition-transform active:translate-y-0.5 hover:bg-[#2E4821]"
          >
            <Pause className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Reiniciar partida (R)"
            onClick={(e) => {
              e.currentTarget.blur();
              soundEngine.playClick();
              onRestart();
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#1B2C13] bg-[#1E3115]/95 text-white shadow-[0_3px_0_rgba(15,28,10,0.6)] transition-transform active:translate-y-0.5 hover:bg-[#2E4821]"
          >
            <RotateCcw className="h-4.5 w-4.5" />
          </button>
        </div>
      </div>

      {/* Active Spells Panel */}
      <div
        className="pointer-events-auto fixed bottom-[152px] right-2.5 z-20 flex flex-row gap-1.5 sm:bottom-auto sm:right-4 sm:top-[74px] sm:translate-y-0 sm:flex-col sm:gap-2"
        aria-label="Habilidades especiais"
      >
        {SPELL_ORDER.map((kind) => {
          const spec = SPELL_SPECS[kind];
          const cd = hud.spellCooldowns[kind];
          const maxCd = hud.spellMaxCooldowns[kind];
          const isReady = cd <= 0;
          const isTargeting = hud.targetingSpell === kind;
          const isOverchargeActive = kind === 'overcharge' && hud.overchargeTimer > 0;
          const cdProgress = isReady ? 0 : Math.min(1, cd / maxCd);

          return (
            <button
              key={kind}
              type="button"
              tabIndex={-1}
              aria-label={`${spec.name} [${spec.hotkey}] — ${spec.description}`}
              onClick={(e) => {
                e.currentTarget.blur();
                onActivateSpell(kind);
              }}
              className={`relative flex items-center gap-2 overflow-hidden rounded-2xl border-2 px-2.5 py-1.5 text-left shadow-[0_4px_0_rgba(15,28,10,0.6)] transition-transform active:translate-y-0.5 sm:gap-2.5 sm:px-3 sm:py-2 ${
                isTargeting
                  ? 'border-[#6EE7B7] bg-[#16452E]'
                  : isOverchargeActive
                    ? 'border-[#FACC15] bg-[#4C4217]'
                    : isReady
                      ? 'border-[#1B2C13] bg-[#1E3115]/95 hover:bg-[#2B461F]'
                      : 'border-[#15220F] bg-[#172511]/90 opacity-85'
              }`}
            >
              {!isReady && (
                <div
                  className="pointer-events-none absolute inset-0 origin-bottom bg-black/50"
                  style={{ transform: `scaleY(${cdProgress})` }}
                />
              )}
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#13200D]">
                <SpellIcon kind={kind} />
              </div>
              <div className="relative z-10 hidden leading-tight sm:block">
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-white">
                  <span>{spec.name}</span>
                  <span className="font-mono-tabular text-[11px] text-[#FDE047]">[{spec.hotkey}]</span>
                </div>
                <div className="font-mono-tabular whitespace-nowrap text-[11px] text-[#D9F99D]">
                  {isTargeting
                    ? 'Clique no mapa'
                    : isOverchargeActive
                      ? `Ativa ${hud.overchargeTimer.toFixed(1)}s`
                      : isReady
                        ? spec.description
                        : `Recarga ${Math.ceil(cd)}s`}
                </div>
              </div>
              {!isReady && (
                <span className="font-mono-tabular relative z-10 text-xs font-bold text-[#FDE047] sm:hidden">
                  {Math.ceil(cd)}s
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Troop Recruitment Dock — Clean, Legible Names & Clear Layout */}
      <div className="pointer-events-none flex w-full justify-center">
        <div className="pointer-events-auto grid w-full max-w-md grid-cols-3 gap-1.5 rounded-2xl border-2 border-[#1B2C13] bg-[#1E3115]/96 p-1.5 shadow-[0_5px_0_rgba(15,28,10,0.7)] sm:flex sm:w-auto sm:max-w-none sm:items-center sm:gap-2.5 sm:p-2">
          {UNIT_ORDER.map((kind) => {
            const spec = UNIT_SPECS[kind];
            const isSelected = hud.selectedUnit === kind;
            const canAfford = hud.essence >= spec.cost;
            return (
              <div
                key={kind}
                className={`flex flex-col justify-between gap-1 rounded-xl border-2 p-1.5 transition-colors sm:flex-row sm:items-center sm:gap-2 sm:px-2.5 sm:py-1.5 ${
                  isSelected
                    ? 'border-[#FDE047] bg-[#365624]'
                    : 'border-[#2B431E] bg-[#162510]/90 hover:bg-[#263F1B]'
                } ${!canAfford ? 'opacity-70' : ''}`}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onPointerDown={(e) => {
                    onSelectUnit(kind);
                    onStartCardDrag(kind, e.clientX, e.clientY);
                  }}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectUnit(kind);
                  }}
                  className="flex min-w-0 flex-1 cursor-grab touch-none flex-col items-start gap-1 text-left active:cursor-grabbing sm:flex-row sm:items-center sm:gap-2.5"
                >
                  <div className="flex w-full items-center justify-between gap-1 sm:w-auto">
                    <UnitIcon kind={kind} />
                    <span className="font-mono-tabular rounded bg-[#111D0C] px-1.5 py-0.5 text-[11px] font-bold text-[#FACC15] sm:hidden">
                      {spec.cost}
                    </span>
                  </div>
                  <div className="min-w-0 leading-tight">
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-white sm:text-sm">
                      <span>{spec.name}</span>
                      <span className="font-mono-tabular hidden text-[11px] text-[#FDE047] sm:inline">
                        [{spec.hotkey}]
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-[#D9F99D]">
                      <span className="font-mono-tabular hidden font-bold text-[#FACC15] sm:inline">
                        {spec.cost} ess.
                      </span>
                      <span aria-hidden="true" className="hidden sm:inline">·</span>
                      <span className="text-[10px] sm:text-[11px]">{spec.shortRole}</span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Recrutar ${spec.name} em slot livre (${spec.cost} essência)`}
                  disabled={!canAfford}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onQuickRecruit(kind);
                  }}
                  className="flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-lg border border-[#16290E] bg-[#22C55E] text-xs font-bold text-white shadow-[0_2px_0_#15803D] transition-transform active:translate-y-0.5 hover:bg-[#4ADE80] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span className="sm:hidden">Criar</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
