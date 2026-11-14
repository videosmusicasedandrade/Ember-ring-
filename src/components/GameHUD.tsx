import React, { useEffect, useState } from 'react';
import { Music, Pause, Plus, RotateCcw, Volume2, VolumeX } from 'lucide-react';
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
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <circle cx="12" cy="13" r="7" fill="#FED7AA" stroke="#1E293B" strokeWidth="2" />
        <path d="M5 11a7 7 0 0 1 14 0z" fill="#2563EB" stroke="#1E293B" strokeWidth="2" />
        <rect x="10" y="9" width="10" height="3.5" rx="1.5" fill="#FFFFFF" stroke="#1E293B" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === 'shield') {
    return (
      <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
        <rect x="5" y="4" width="14" height="16" rx="5" fill="#3B82F6" stroke="#0F172A" strokeWidth="2" />
        <circle cx="12" cy="12" r="3.5" fill="#FACC15" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
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

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-2 sm:p-4">
      {/* Top Row: Center Resource Plaque + Right Utility Controls */}
      <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="hidden w-40 sm:block" />

        <div
          aria-label="Recursos e progresso"
          className="pointer-events-auto flex items-center gap-2.5 rounded-2xl border-2 border-[#233818] bg-[#2D471F]/92 px-3 py-1.5 shadow-[0_4px_0_rgba(20,34,12,0.55)] sm:mx-auto sm:gap-5 sm:px-4 sm:py-2"
        >
          <div className="flex items-center gap-1.5 sm:gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 sm:h-6 sm:w-6" aria-hidden="true">
              <path
                d="M12 2C16.5 3.5 18.5 10.5 17 16.5C15.5 21 8.5 21 7 16.5C5.5 10.5 7.5 3.5 12 2Z"
                fill="#F97316"
                stroke="#271306"
                strokeWidth="2"
              />
              <ellipse cx="10" cy="10" rx="2" ry="4" fill="#FDE047" opacity="0.85" />
            </svg>
            <div className="leading-none">
              <div className="text-[9px] font-bold tracking-wider text-[#BEF264] uppercase sm:text-[10px]">Núcleo</div>
              <div className="font-mono-tabular text-base font-bold text-white sm:text-lg" data-testid="hud-level">
                Nv.{hud.baseLevel}
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-white/15 sm:h-7" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 shrink-0 sm:h-5 sm:w-5" aria-hidden="true">
              <polygon points="12,2 20,9 16,21 8,21 4,9" fill="#FACC15" stroke="#422006" strokeWidth="2" />
            </svg>
            <div className="leading-none">
              <div className="text-[9px] font-bold tracking-wider text-[#FDE047] uppercase sm:text-[10px]">
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

          <div className="h-6 w-px bg-white/15 sm:h-7" />

          <div className="leading-none text-center">
            <div className="flex items-center justify-center gap-1 text-[9px] font-bold tracking-wider text-[#D9F99D] uppercase sm:text-[10px]">
              <span>Fase {hud.stage}</span>
              {hud.bossActive && (
                <span className="rounded bg-[#DC2626] px-1 py-0.5 text-[8px] text-[#FEF08A] sm:text-[9px]">CHEFE</span>
              )}
            </div>
            <div className="font-mono-tabular text-base font-bold text-white sm:text-lg" data-testid="hud-wave">
              {hud.wave}/{hud.totalWavesInStage}
            </div>
          </div>

          <div className="h-6 w-px bg-white/15 sm:h-7" />

          <div className="leading-none text-right">
            <div className="text-[9px] font-bold tracking-wider text-[#93C5FD] uppercase sm:text-[10px]">Pontos</div>
            <div className="font-mono-tabular text-base font-bold text-white sm:text-lg" data-testid="hud-score">
              {Math.round(hud.score)}
            </div>
          </div>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2">
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
            className={`relative flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#233818] shadow-[0_3px_0_rgba(20,34,12,0.55)] transition-transform active:translate-y-0.5 sm:h-10 sm:w-10 ${
              hud.mutedMusic
                ? 'bg-[#223617]/92 text-red-300 hover:bg-[#2F4A20]'
                : 'bg-[#2D471F]/92 text-[#BEF264] hover:bg-[#3A5B28]'
            }`}
          >
            <Music className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
            {hud.mutedMusic && (
              <span className="pointer-events-none absolute h-0.5 w-5 rotate-45 rounded bg-red-400 sm:w-6" />
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
            className={`flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#233818] shadow-[0_3px_0_rgba(20,34,12,0.55)] transition-transform active:translate-y-0.5 sm:h-10 sm:w-10 ${
              hud.mutedSfx
                ? 'bg-[#223617]/92 text-red-300 hover:bg-[#2F4A20]'
                : 'bg-[#2D471F]/92 text-white hover:bg-[#3A5B28]'
            }`}
          >
            {hud.mutedSfx ? <VolumeX className="h-4.5 w-4.5 sm:h-5 sm:w-5" /> : <Volume2 className="h-4.5 w-4.5 sm:h-5 sm:w-5" />}
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#233818] bg-[#2D471F]/92 text-white shadow-[0_3px_0_rgba(20,34,12,0.55)] transition-transform active:translate-y-0.5 hover:bg-[#3A5B28] sm:h-10 sm:w-10"
          >
            <Pause className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
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
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#233818] bg-[#2D471F]/92 text-white shadow-[0_3px_0_rgba(20,34,12,0.55)] transition-transform active:translate-y-0.5 hover:bg-[#3A5B28] sm:h-10 sm:w-10"
          >
            <RotateCcw className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>

      {/* Base Health Bar (Top-Left below header on mobile portrait, Center-Left on desktop) */}
      <div
        className="pointer-events-none fixed left-3 top-[104px] z-20 sm:left-5 sm:top-1/2 sm:-translate-y-1/2"
        aria-label="Vida da base"
      >
        <div className="w-32 rounded-xl border-2 border-[#233818] bg-[#243918]/92 p-2 shadow-[0_4px_0_rgba(20,34,12,0.55)] sm:w-44 sm:p-2.5">
          <div className="mb-1 flex items-center justify-between text-[11px] font-bold sm:mb-1.5 sm:text-xs">
            <span className="tracking-wide text-[#FECACA] uppercase">Base</span>
            <span className="font-mono-tabular text-white" data-testid="hud-hp">
              {Math.round(hud.baseHp)}/{hud.baseMaxHp}
            </span>
          </div>
          <div className="relative h-3.5 w-full overflow-hidden rounded-lg border border-[#182611] bg-[#162110] sm:h-4">
            <div
              className="absolute inset-0 origin-left bg-[#FCA5A5] transition-transform duration-300"
              style={{ transform: `scaleX(${ghostPercent / 100})` }}
            />
            <div
              className="relative h-full w-full origin-left transition-transform duration-150"
              style={{
                transform: `scaleX(${hpPercent / 100})`,
                backgroundImage:
                  'repeating-linear-gradient(-45deg, #F43F5E, #F43F5E 6px, #FB7185 6px, #FB7185 12px)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Active Spells Panel (Bottom-Right above recruitment dock on mobile, Center-Right on desktop) */}
      <div
        className="pointer-events-auto fixed bottom-[84px] right-2.5 z-20 flex flex-row gap-1.5 sm:bottom-auto sm:right-5 sm:top-1/2 sm:-translate-y-1/2 sm:flex-col sm:gap-2"
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
              className={`relative flex items-center gap-2 overflow-hidden rounded-2xl border-2 px-2.5 py-1.5 text-left shadow-[0_4px_0_rgba(20,34,12,0.55)] transition-transform active:translate-y-0.5 sm:gap-2.5 sm:px-3 sm:py-2 ${
                isTargeting
                  ? 'border-[#6EE7B7] bg-[#1E4D36]'
                  : isOverchargeActive
                    ? 'border-[#FACC15] bg-[#4C4217]'
                    : isReady
                      ? 'border-[#233818] bg-[#2D471F]/94 hover:bg-[#3B5D29]'
                      : 'border-[#1C2C14] bg-[#1F3115]/88 opacity-80'
              }`}
            >
              {!isReady && (
                <div
                  className="pointer-events-none absolute inset-0 origin-bottom bg-black/50"
                  style={{ transform: `scaleY(${cdProgress})` }}
                />
              )}
              <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-[#1A2B11]/90">
                <SpellIcon kind={kind} />
              </div>
              <div className="relative z-10 hidden leading-tight sm:block">
                <div className="flex items-center gap-1.5 whitespace-nowrap text-xs font-bold text-white">
                  <span>{spec.name}</span>
                  <span className="font-mono-tabular text-[11px] text-[#FDE047]">[{spec.hotkey}]</span>
                </div>
                <div className="font-mono-tabular whitespace-nowrap text-[11px] text-[#D9F99D]">
                  {isTargeting
                    ? 'Clique na arena'
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

      {/* Bottom Troop Recruitment Dock */}
      <div className="pointer-events-none flex flex-col items-center gap-1.5">
        <div className="pointer-events-auto flex max-w-full items-center gap-1 rounded-2xl border-2 border-[#233818] bg-[#2D471F]/94 p-1 shadow-[0_4px_0_rgba(20,34,12,0.6)] sm:gap-2 sm:p-1.5">
          {UNIT_ORDER.map((kind) => {
            const spec = UNIT_SPECS[kind];
            const isSelected = hud.selectedUnit === kind;
            const canAfford = hud.essence >= spec.cost;
            return (
              <div
                key={kind}
                className={`flex items-center gap-0.5 rounded-xl border-2 p-0.5 transition-colors sm:gap-1 sm:p-1 ${
                  isSelected
                    ? 'border-[#FDE047] bg-[#456B2E]'
                    : 'border-transparent bg-[#233818]/80 hover:bg-[#365424]'
                } ${!canAfford ? 'opacity-65' : ''}`}
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
                  className="flex cursor-grab touch-none items-center gap-1.5 px-1.5 py-0.5 text-left active:cursor-grabbing sm:gap-2 sm:px-2"
                >
                  <UnitIcon kind={kind} />
                  <div className="leading-tight">
                    <div className="flex items-center gap-1 whitespace-nowrap text-[11px] font-bold text-white sm:gap-1.5 sm:text-xs">
                      <span>{spec.name}</span>
                      <span className="font-mono-tabular hidden text-[11px] text-[#FDE047] sm:inline">
                        [{spec.hotkey}]
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-[#D9F99D]">
                      <span className="font-mono-tabular font-bold text-[#FACC15]">{spec.cost}</span>
                      <span aria-hidden="true" className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{spec.role}</span>
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
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#1D3212] bg-[#5CA832] text-white shadow-[0_2px_0_#1D3212] transition-transform active:translate-y-0.5 hover:bg-[#6DC23E] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:w-8"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3] sm:h-4 sm:w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
