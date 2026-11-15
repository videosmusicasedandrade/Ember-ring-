import React from 'react';
import { ArrowRight, Home, Lock, Play, RotateCcw, ShieldAlert, Trophy } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { formatSurvivalTime, getStageConfig } from '../game/engineMath';
import { HERO_SPECS, HeroClass, HudSnapshot, TOTAL_STAGES } from '../game/types';

interface GameModalsProps {
  hud: HudSnapshot;
  selectedStage: number;
  onSelectHero: (heroClass: HeroClass) => void;
  onSelectStage: (stage: number) => void;
  onStart: (stage?: number) => void;
  onNextStage: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

const STAGES = Array.from({ length: TOTAL_STAGES }, (_, idx) => idx + 1);
const HERO_ORDER: HeroClass[] = ['archer', 'swordsman', 'bomber'];

export function HeroClassIcon({ heroClass, className = 'h-8 w-8' }: { heroClass: HeroClass; className?: string }) {
  if (heroClass === 'archer') {
    return (
      <svg viewBox="0 0 32 32" className={`${className} shrink-0`} aria-hidden="true">
        <path d="M21 5c5 5 5 17 0 22" fill="none" stroke="#FACC15" strokeWidth="3" strokeLinecap="round" />
        <line x1="20" y1="6" x2="20" y2="26" stroke="#BAE6FD" strokeWidth="1.6" />
        <line x1="6" y1="16" x2="26" y2="16" stroke="#00D4FF" strokeWidth="3" strokeLinecap="round" />
        <polygon points="28,16 22,12 22,20" fill="#FACC15" />
      </svg>
    );
  }
  if (heroClass === 'swordsman') {
    return (
      <svg viewBox="0 0 32 32" className={`${className} shrink-0`} aria-hidden="true">
        <path d="M9 23L24 6l2 2-15 17z" fill="#F8FAFC" stroke="#020617" strokeWidth="1.8" />
        <path d="M6 19l7 7" stroke="#FACC15" strokeWidth="3.2" strokeLinecap="round" />
        <line x1="6" y1="26" x2="10" y2="22" stroke="#FF2E4C" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className={`${className} shrink-0`} aria-hidden="true">
      <circle cx="15" cy="18" r="9" fill="#1E293B" stroke="#FACC15" strokeWidth="2.4" />
      <path d="M18 10c2-3 5-4 8-3" fill="none" stroke="#F59E0B" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="26" cy="7" r="3" fill="#FF2E4C" />
      <circle cx="12" cy="15" r="2.2" fill="#FACC15" />
    </svg>
  );
}

export const GameModals: React.FC<GameModalsProps> = ({
  hud,
  selectedStage,
  onSelectHero,
  onSelectStage,
  onStart,
  onNextStage,
  onResume,
  onRestart,
  onReturnTitle,
}) => {
  if (hud.phase === 'title') {
    const stageCfg = getStageConfig(selectedStage);
    return (
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-between overflow-y-auto bg-[#080D1A]/68 px-3 py-3 sm:px-6 sm:py-5">
        {/* Imposing Top Title Crest */}
        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 430 108"
            className="w-[250px] sm:w-[340px] drop-shadow-[0_6px_0_rgba(2,6,23,0.9)]"
            role="img"
            aria-label="Ember Ring Defense"
          >
            <rect x="14" y="14" width="402" height="84" rx="22" fill="#0F172A" stroke="#FACC15" strokeWidth="3.5" />
            <rect x="22" y="22" width="386" height="68" rx="16" fill="#1E293B" />
            <text
              x="215"
              y="60"
              textAnchor="middle"
              fill="#FFFFFF"
              stroke="#020617"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Fredoka, Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="32"
            >
              EMBER RING
            </text>
            <text
              x="215"
              y="81"
              textAnchor="middle"
              fill="#00D4FF"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="800"
              fontSize="11.5"
              letterSpacing="3.4"
            >
              DEFESA HEROICA DO CASTELO
            </text>
          </svg>
        </div>

        {/* Center-Bottom Hero Class Selector + Stage Selector + Action */}
        <div className="my-auto flex w-full max-w-2xl flex-col items-center gap-3 py-2">
          {/* 1. Imposing 3-Class Hero Selection Panel */}
          <section
            aria-label="Seleção de Herói Principal"
            className="w-full rounded-2xl border-2 border-[#334155] bg-[#0F172A]/95 p-3 shadow-[0_8px_0_rgba(2,6,23,0.85)] sm:p-4"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-[#FACC15] sm:text-lg">
                Escolha seu Herói Principal
              </h2>
              <span className="text-[11px] font-semibold text-[#94A3B8]">
                Evolui em tempo real a cada abate
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
              {HERO_ORDER.map((heroClass) => {
                const spec = HERO_SPECS[heroClass];
                const isSelected = hud.selectedHeroClass === heroClass;
                return (
                  <button
                    key={heroClass}
                    type="button"
                    data-testid={`hero-card-${heroClass}`}
                    aria-pressed={isSelected}
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectHero(heroClass);
                    }}
                    className={`flex flex-col justify-between rounded-xl border-2 p-2.5 text-left transition-transform active:translate-y-0.5 sm:p-3 ${
                      isSelected
                        ? 'border-[#FACC15] bg-[#1E293B] shadow-[0_4px_0_#B45309]'
                        : 'border-[#1E293B] bg-[#0B1120]/90 hover:border-[#38BDF8]/60 hover:bg-[#162033]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#080D1A]"
                        style={{
                          boxShadow: isSelected ? `0 0 14px ${spec.glowColor}` : undefined,
                        }}
                      >
                        <HeroClassIcon heroClass={heroClass} className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display text-sm font-bold text-white sm:text-base">
                            {spec.name}
                          </span>
                        </div>
                        <div
                          className="text-[11px] font-bold"
                          style={{ color: spec.color }}
                        >
                          {spec.shortRole}
                        </div>
                      </div>
                    </div>

                    <p className="mt-2 text-[11px] leading-snug text-[#CBD5E1]">
                      {spec.description}
                    </p>

                    <div className="mt-2.5 grid grid-cols-3 gap-1.5 text-[10px] font-bold text-[#94A3B8]">
                      <div>
                        <div className="mb-0.5">Poder</div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#080D1A]">
                          <div
                            className="h-full rounded-full bg-[#FF2E4C]"
                            style={{ width: `${spec.statPower}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-0.5">Veloc.</div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#080D1A]">
                          <div
                            className="h-full rounded-full bg-[#00D4FF]"
                            style={{ width: `${spec.statSpeed}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="mb-0.5">Área</div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#080D1A]">
                          <div
                            className="h-full rounded-full bg-[#FACC15]"
                            style={{ width: `${spec.statArea}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 2. Dynamic Route Stage Selector (1-10) */}
          <section
            aria-label="Seletor de Fases"
            className="w-full rounded-2xl border-2 border-[#334155] bg-[#0F172A]/95 p-3 shadow-[0_6px_0_rgba(2,6,23,0.85)] sm:p-3.5"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
              <span className="truncate text-[#FACC15]">
                Fase {selectedStage} · {stageCfg.title}
              </span>
              <span className="font-mono-tabular shrink-0 text-[#00D4FF]">
                {stageCfg.routeArchetype} · {stageCfg.totalWaves} ondas
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
              {STAGES.map((stageNum) => {
                const unlocked = stageNum <= hud.highestUnlockedStage;
                const active = stageNum === selectedStage;
                return (
                  <button
                    key={stageNum}
                    type="button"
                    disabled={!unlocked}
                    data-testid={`stage-btn-${stageNum}`}
                    aria-label={unlocked ? `Selecionar Fase ${stageNum}` : `Fase ${stageNum} bloqueada`}
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectStage(stageNum);
                    }}
                    className={`font-mono-tabular flex h-10 items-center justify-center rounded-xl border-2 text-sm font-bold transition-transform active:translate-y-0.5 ${
                      !unlocked
                        ? 'cursor-not-allowed border-[#1E293B] bg-[#080D1A] text-white/30'
                        : active
                          ? 'border-[#FACC15] bg-[#FF2E4C] text-white shadow-[0_3px_0_#991B1B]'
                          : 'border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:border-[#00D4FF]'
                    }`}
                  >
                    {unlocked ? stageNum : <Lock className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 3. Dominant Saturated CTA */}
          <button
            type="button"
            data-start="true"
            onClick={() => {
              soundEngine.playClick();
              onStart(selectedStage);
            }}
            className="font-display flex items-center justify-center gap-2.5 rounded-2xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#FF2E4C] to-[#F59E0B] px-10 py-3 text-xl font-bold whitespace-nowrap text-white shadow-[0_6px_0_#991B1B] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#991B1B] sm:text-2xl"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>Iniciar Fase {selectedStage}</span>
          </button>

          <p className="text-center text-xs font-semibold tracking-wide text-[#CBD5E1]">
            Arraste o Herói para reposicionar · 1-3 Tropas · Funda Iguais · Q/W/E Habilidades
          </p>
        </div>
      </div>
    );
  }

  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="w-full max-w-sm rounded-3xl border-2 border-[#334155] bg-[#0F172A] p-6 text-center shadow-[0_10px_0_rgba(2,6,23,0.9)]"
        >
          <h2 id="pause-title" className="font-display text-3xl font-bold text-white">
            Jogo Pausado
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[#1E293B] bg-[#080D1A] p-3">
            <div>
              <div className="text-[10px] font-bold text-[#FACC15] uppercase">Fase</div>
              <div className="font-mono-tabular text-xl font-bold text-white">{hud.stage}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#00D4FF] uppercase">Herói</div>
              <div className="font-mono-tabular text-xl font-bold text-white">Nv.{hud.heroLevel}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#FF2E4C] uppercase">Pontos</div>
              <div className="font-mono-tabular text-xl font-bold text-white">{Math.round(hud.score)}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onResume();
              }}
              className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#020617] bg-[#00D4FF] px-5 py-3 text-lg font-bold whitespace-nowrap text-[#020617] shadow-[0_4px_0_#0369A1] transition-transform active:translate-y-0.5 hover:bg-[#38BDF8]"
            >
              <Play className="h-5 w-5 fill-current" />
              <span>Continuar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onRestart();
              }}
              className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#020617] bg-[#FACC15] px-5 py-2.5 text-base font-bold whitespace-nowrap text-[#020617] shadow-[0_4px_0_#B45309] transition-transform active:translate-y-0.5 hover:bg-[#FDE047]"
            >
              <RotateCcw className="h-4.5 w-4.5" />
              <span>Jogar Novamente</span>
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnTitle();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#334155] bg-[#1E293B] px-5 py-2.5 text-sm font-bold whitespace-nowrap text-[#E2E8F0] transition-colors hover:bg-[#334155]"
            >
              <Home className="h-4 w-4" />
              <span>Menu Principal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'victory' || hud.phase === 'gameover') {
    const isVictory = hud.phase === 'victory';
    const hasNextStage = isVictory && hud.stage < TOTAL_STAGES;

    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outcome-title"
          className="w-full max-w-sm rounded-3xl border-2 border-[#334155] bg-[#0F172A] p-6 text-center shadow-[0_10px_0_rgba(2,6,23,0.92)]"
        >
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-2 ${
              isVictory
                ? 'border-[#B45309] bg-[#FACC15] text-[#020617]'
                : 'border-[#7F1D1D] bg-[#FF2E4C] text-white'
            }`}
          >
            {isVictory ? <Trophy className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
          </div>

          <h2
            id="outcome-title"
            className={`font-display text-3xl font-bold leading-tight ${
              isVictory ? 'text-[#FACC15]' : 'text-[#FF2E4C]'
            }`}
          >
            {isVictory
              ? hud.stage >= TOTAL_STAGES
                ? 'Vitória Final!'
                : `Fase ${hud.stage} Concluída!`
              : 'Castelo Destruído'}
          </h2>
          <p className="mt-1 text-xs font-bold text-[#00D4FF]">
            {isVictory
              ? hasNextStage
                ? `Nova Rota Desbloqueada · Fase ${hud.stage + 1}`
                : 'Todas as 10 rotas defendidas!'
              : `Fase ${hud.stage} · Onda ${hud.wave}/${hud.totalWavesInStage}`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-[#1E293B] bg-[#080D1A] p-3">
            <div className="rounded-xl bg-[#0F172A] p-2.5">
              <div className="text-[10px] font-bold text-[#00D4FF] uppercase">Abates Totais</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white" data-testid="modal-kills">
                {hud.kills}
              </div>
            </div>
            <div className="rounded-xl bg-[#0F172A] p-2.5">
              <div className="text-[10px] font-bold text-[#FACC15] uppercase">Nível do Herói</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white">
                Nv.{hud.heroLevel}
              </div>
            </div>
            <div className="rounded-xl bg-[#0F172A] p-2.5">
              <div className="text-[10px] font-bold text-[#94A3B8] uppercase">Tempo</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white" data-testid="modal-time">
                {formatSurvivalTime(hud.survivalSeconds)}
              </div>
            </div>
            <div className="rounded-xl bg-[#0F172A] p-2.5">
              <div className="text-[10px] font-bold text-[#FF2E4C] uppercase">Pontos</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white" data-testid="modal-score">
                {Math.round(hud.score)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {hasNextStage ? (
              <>
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    soundEngine.playClick();
                    onNextStage();
                  }}
                  className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#FF2E4C] to-[#F59E0B] px-5 py-3 text-lg font-bold whitespace-nowrap text-white shadow-[0_4px_0_#991B1B] transition-transform active:translate-y-0.5"
                >
                  <span>Próxima Fase</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onStart(hud.stage);
                  }}
                  className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#020617] bg-[#00D4FF] px-5 py-2.5 text-base font-bold whitespace-nowrap text-[#020617] shadow-[0_3px_0_#0369A1] transition-transform active:translate-y-0.5 hover:bg-[#38BDF8]"
                >
                  <RotateCcw className="h-4.5 w-4.5" />
                  <span>Jogar Novamente</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                data-start="true"
                onClick={() => {
                  soundEngine.playClick();
                  onStart(hud.stage);
                }}
                className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#FF2E4C] to-[#F59E0B] px-5 py-3 text-lg font-bold whitespace-nowrap text-white shadow-[0_4px_0_#991B1B] transition-transform active:translate-y-0.5"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Jogar Novamente</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnTitle();
              }}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#334155] bg-[#1E293B] px-5 py-2.5 text-sm font-bold whitespace-nowrap text-[#E2E8F0] transition-colors hover:bg-[#334155]"
            >
              <Home className="h-4 w-4" />
              <span>Menu Principal</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
