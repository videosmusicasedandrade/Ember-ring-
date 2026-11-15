import React from 'react';
import { ArrowRight, Home, Lock, Play, RotateCcw, ShieldAlert, Trophy } from 'lucide-react';
import { soundEngine } from '../game/audio';
import { formatSurvivalTime, getStageConfig } from '../game/engineMath';
import { HudSnapshot, TOTAL_STAGES } from '../game/types';

interface GameModalsProps {
  hud: HudSnapshot;
  selectedStage: number;
  onSelectStage: (stage: number) => void;
  onStart: (stage?: number) => void;
  onNextStage: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
}

const STAGES = Array.from({ length: TOTAL_STAGES }, (_, idx) => idx + 1);

export const GameModals: React.FC<GameModalsProps> = ({
  hud,
  selectedStage,
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
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        {/* Clean Bespoke Inline SVG Title Crest */}
        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 430 124"
            className="w-[260px] sm:w-[350px] drop-shadow-[0_6px_0_rgba(16,32,12,0.72)]"
            role="img"
            aria-label="Ember Ring Defense"
          >
            <rect x="14" y="20" width="402" height="94" rx="24" fill="#1D3115" stroke="#FDE047" strokeWidth="4" />
            <rect x="22" y="28" width="386" height="78" rx="18" fill="#2A461E" />
            <path
              d="M190 22V8h8v5h6V8h8v5h6V8h8v14z"
              fill="#E2E8F0"
              stroke="#0F172A"
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
            <rect x="193" y="20" width="44" height="14" rx="3" fill="#CBD5E1" stroke="#0F172A" strokeWidth="2.5" />
            <circle cx="215" cy="27" r="4.5" fill="#FACC15" stroke="#422006" strokeWidth="1.8" />
            <text
              x="215"
              y="74"
              textAnchor="middle"
              fill="#FFFFFF"
              stroke="#12200C"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Fredoka, Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="33"
            >
              EMBER RING
            </text>
            <text
              x="215"
              y="97"
              textAnchor="middle"
              fill="#FDE047"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="800"
              fontSize="12.5"
              letterSpacing="3.8"
            >
              DEFESA DO CASTELO
            </text>
          </svg>
        </div>

        {/* Bottom Stage Selector (1-30 scrollable grid) + Start CTA */}
        <div className="flex w-full max-w-md flex-col items-center gap-2.5 pb-1">
          <div
            aria-label="Seletor de Fases"
            className="w-full rounded-2xl border-2 border-[#1B2C13] bg-[#1E3115]/96 p-3 shadow-[0_6px_0_rgba(15,28,10,0.7)]"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
              <span className="truncate text-[#FDE047]">
                Fase {selectedStage} · {stageCfg.title}
              </span>
              <span className="font-mono-tabular shrink-0 text-[#D9F99D]">
                {stageCfg.totalWaves} ondas · Chefe
              </span>
            </div>

            <div className="max-h-[130px] overflow-y-auto pr-1">
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-6">
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
                      className={`font-mono-tabular flex h-8 items-center justify-center gap-1 rounded-lg border-2 text-xs font-bold transition-transform active:translate-y-0.5 ${
                        !unlocked
                          ? 'cursor-not-allowed border-[#14220E] bg-[#172610] text-white/35'
                          : active
                            ? 'border-[#FDE047] bg-[#F97316] text-white shadow-[0_2px_0_#9A3412]'
                            : 'border-[#253B1A] bg-[#2D481F] text-[#FEF9C3] hover:bg-[#3A5D28]'
                      }`}
                    >
                      {unlocked ? stageNum : <Lock className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={() => {
              soundEngine.playClick();
              onStart(selectedStage);
            }}
            className="font-display flex items-center justify-center gap-2 rounded-2xl border-4 border-[#15240E] bg-[#F97316] px-8 py-2.5 text-lg font-bold tracking-wide text-white shadow-[0_5px_0_#9A3412] transition-transform hover:-translate-y-0.5 hover:bg-[#FB923C] active:translate-y-1 active:shadow-[0_2px_0_#9A3412] sm:text-xl"
          >
            <Play className="h-4.5 w-4.5 fill-current" />
            <span>Jogar Fase {selectedStage}</span>
          </button>

          <p className="text-outline-dark text-center text-[11px] font-bold tracking-wide text-[#FEF9C3]">
            1-3 Tropas · Arraste Iguais para Fundir · Q/W/E Habilidades · P Pausar
          </p>
        </div>
      </div>
    );
  }

  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="w-full max-w-sm rounded-3xl border-4 border-[#1B2C13] bg-[#213617] p-6 text-center shadow-[0_8px_0_rgba(12,22,8,0.85)]"
        >
          <h2 id="pause-title" className="font-display text-3xl font-bold text-white">
            Jogo Pausado
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-[#2D4720] bg-[#162510] p-3">
            <div>
              <div className="text-[10px] font-bold text-[#FDE047] uppercase">Fase</div>
              <div className="font-mono-tabular text-xl font-bold text-white">{hud.stage}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#BEF264] uppercase">Onda</div>
              <div className="font-mono-tabular text-xl font-bold text-white">
                {hud.wave}/{hud.totalWavesInStage}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#93C5FD] uppercase">Pontos</div>
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
              className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#22C55E] px-5 py-3 text-lg font-bold text-white shadow-[0_4px_0_#15803D] transition-transform active:translate-y-0.5 hover:bg-[#4ADE80]"
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
              className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#F59E0B] px-5 py-2.5 text-base font-bold text-white shadow-[0_4px_0_#B45309] transition-transform active:translate-y-0.5 hover:bg-[#FBBF24]"
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
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#2D4720] px-5 py-2.5 text-sm font-bold text-[#E2E8F0] transition-colors hover:bg-[#3A5A2A]"
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
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/58 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outcome-title"
          className="w-full max-w-sm rounded-3xl border-4 border-[#1B2C13] bg-[#213617] p-6 text-center shadow-[0_8px_0_rgba(12,22,8,0.88)]"
        >
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-2 ${
              isVictory
                ? 'border-[#713F12] bg-[#FACC15] text-[#422006]'
                : 'border-[#7F1D1D] bg-[#EF4444] text-white'
            }`}
          >
            {isVictory ? <Trophy className="h-7 w-7" /> : <ShieldAlert className="h-7 w-7" />}
          </div>

          <h2
            id="outcome-title"
            className={`font-display text-3xl font-bold leading-tight ${
              isVictory ? 'text-[#FDE047]' : 'text-[#FCA5A5]'
            }`}
          >
            {isVictory
              ? hud.stage >= TOTAL_STAGES
                ? 'Vitória Final!'
                : `Fase ${hud.stage} Concluída!`
              : 'Castelo Destruído'}
          </h2>
          <p className="mt-1 text-xs font-bold text-[#D9F99D]">
            {isVictory
              ? hasNextStage
                ? `Fase ${hud.stage + 1} desbloqueada`
                : 'Todas as 30 fases defendidas!'
              : `Fase ${hud.stage} · Onda ${hud.wave}/${hud.totalWavesInStage}`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl border border-[#2D4720] bg-[#162510] p-3">
            <div className="rounded-xl bg-[#1E3115] p-2.5">
              <div className="text-[10px] font-bold text-[#BEF264] uppercase">Zumbis Derrotados</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white" data-testid="modal-kills">
                {hud.kills}
              </div>
            </div>
            <div className="rounded-xl bg-[#1E3115] p-2.5">
              <div className="text-[10px] font-bold text-[#93C5FD] uppercase">Sobrevivência</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white" data-testid="modal-time">
                {formatSurvivalTime(hud.survivalSeconds)}
              </div>
            </div>
            <div className="rounded-xl bg-[#1E3115] p-2.5">
              <div className="text-[10px] font-bold text-[#FDE047] uppercase">Essência Coletada</div>
              <div className="font-mono-tabular mt-0.5 text-xl font-bold text-white" data-testid="modal-essence">
                {Math.round(hud.essenceCollected)}
              </div>
            </div>
            <div className="rounded-xl bg-[#1E3115] p-2.5">
              <div className="text-[10px] font-bold text-[#FDBA74] uppercase">Pontos</div>
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
                  className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#22C55E] px-5 py-3 text-lg font-bold whitespace-nowrap text-white shadow-[0_4px_0_#15803D] transition-transform active:translate-y-0.5 hover:bg-[#4ADE80]"
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
                  className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#F59E0B] px-5 py-2.5 text-base font-bold whitespace-nowrap text-white shadow-[0_3px_0_#B45309] transition-transform active:translate-y-0.5 hover:bg-[#FBBF24]"
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
                className="font-display flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#F97316] px-5 py-3 text-lg font-bold whitespace-nowrap text-white shadow-[0_4px_0_#9A3412] transition-transform active:translate-y-0.5 hover:bg-[#FB923C]"
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
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-[#14240E] bg-[#2D4720] px-5 py-2.5 text-sm font-bold whitespace-nowrap text-[#E2E8F0] transition-colors hover:bg-[#3A5A2A]"
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
