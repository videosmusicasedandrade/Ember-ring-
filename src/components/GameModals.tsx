import React from 'react';
import { Lock, Trophy } from 'lucide-react';
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
        {/* Bespoke Inline SVG Title Emblem over calm upper meadow region */}
        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 420 118"
            className="w-[260px] sm:w-[340px] drop-shadow-[0_6px_0_rgba(20,38,14,0.65)]"
            role="img"
            aria-label="Ember Ring Defense"
          >
            <rect x="16" y="18" width="388" height="92" rx="22" fill="#29431C" stroke="#FDE047" strokeWidth="4" />
            <rect x="24" y="26" width="372" height="76" rx="16" fill="#365725" />
            <path
              d="M210 4C223 9 229 27 224 41C219 52 201 52 196 41C191 27 197 9 210 4Z"
              fill="#F97316"
              stroke="#231205"
              strokeWidth="3.5"
            />
            <ellipse cx="206" cy="24" rx="4" ry="8" fill="#FEF08A" />
            <text
              x="210"
              y="72"
              textAnchor="middle"
              fill="#FFFFFF"
              stroke="#192811"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Fredoka, Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="32"
            >
              EMBER RING
            </text>
            <text
              x="210"
              y="95"
              textAnchor="middle"
              fill="#FDE047"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="800"
              fontSize="13"
              letterSpacing="4"
            >
              DEFESA CIRCULAR
            </text>
          </svg>
        </div>

        {/* Bottom Stage Selector (1-10) + Start CTA */}
        <div className="flex w-full max-w-md flex-col items-center gap-2.5 pb-2">
          <div
            aria-label="Seletor de Fases"
            className="w-full rounded-2xl border-2 border-[#233818] bg-[#2B441D]/94 p-3 shadow-[0_6px_0_rgba(20,34,12,0.65)]"
          >
            <div className="mb-2 flex items-center justify-between text-xs font-bold">
              <span className="text-[#FDE047]">
                Fase {selectedStage} · {stageCfg.title}
              </span>
              <span className="font-mono-tabular text-[#D9F99D]">
                {stageCfg.totalWaves} ondas · Chefe final
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
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
                    className={`font-mono-tabular flex h-9 items-center justify-center gap-1 rounded-xl border-2 text-sm font-bold transition-transform active:translate-y-0.5 ${
                      !unlocked
                        ? 'cursor-not-allowed border-[#1B2D12] bg-[#1F3315] text-white/35'
                        : active
                          ? 'border-[#FDE047] bg-[#F97316] text-white shadow-[0_2px_0_#9A3412]'
                          : 'border-[#1E3114] bg-[#3B5B28] text-[#FEF9C3] hover:bg-[#497032]'
                    }`}
                  >
                    {unlocked ? stageNum : <Lock className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={() => {
              soundEngine.playClick();
              onStart(selectedStage);
            }}
            className="font-display rounded-2xl border-4 border-[#1D3212] bg-[#F97316] px-10 py-3 text-xl font-bold tracking-wide text-white shadow-[0_6px_0_#9A3412] transition-transform hover:-translate-y-0.5 hover:bg-[#FB923C] active:translate-y-1 active:shadow-[0_2px_0_#9A3412] sm:text-2xl"
          >
            Jogar Fase {selectedStage}
          </button>

          <p className="text-outline-dark text-center text-xs font-bold tracking-wide text-[#FEF9C3]">
            1-3 Tropas · Arraste Iguais para Fundir · Q/W/E Habilidades · P Pausar
          </p>
        </div>
      </div>
    );
  }

  if (hud.phase === 'paused') {
    return (
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/45 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-title"
          className="w-full max-w-sm rounded-3xl border-4 border-[#233818] bg-[#2E4920] p-6 text-center shadow-[0_8px_0_rgba(15,28,10,0.75)]"
        >
          <h2 id="pause-title" className="font-display text-3xl font-bold text-white">
            Pausado
          </h2>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[#223617] p-3">
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
          <div className="mt-5 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onResume();
              }}
              className="font-display rounded-xl border-2 border-[#1B2E11] bg-[#22C55E] px-5 py-2.5 text-lg font-bold text-white shadow-[0_4px_0_#15803D] transition-transform active:translate-y-0.5 hover:bg-[#4ADE80]"
            >
              Continuar
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onRestart();
              }}
              className="font-display rounded-xl border-2 border-[#1B2E11] bg-[#F59E0B] px-5 py-2.5 text-lg font-bold text-white shadow-[0_4px_0_#B45309] transition-transform active:translate-y-0.5 hover:bg-[#FBBF24]"
            >
              Reiniciar Fase
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnTitle();
              }}
              className="rounded-xl border-2 border-[#1B2E11] bg-[#3B5929] px-5 py-2 text-sm font-bold text-[#E2E8F0] transition-colors hover:bg-[#4A6D34]"
            >
              Menu Principal
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
      <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/55 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="outcome-title"
          className="w-full max-w-sm rounded-3xl border-4 border-[#233818] bg-[#2E4920] p-6 text-center shadow-[0_8px_0_rgba(15,28,10,0.8)]"
        >
          {isVictory && (
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#422006] bg-[#FACC15] text-[#422006]">
              <Trophy className="h-6 w-6" />
            </div>
          )}
          <h2
            id="outcome-title"
            className={`font-display text-3xl font-bold ${
              isVictory ? 'text-[#FDE047]' : 'text-[#FCA5A5]'
            }`}
          >
            {isVictory
              ? hud.stage >= TOTAL_STAGES
                ? 'Vitória Final!'
                : `Fase ${hud.stage} Concluída!`
              : 'Base Destruída'}
          </h2>
          <p className="mt-1 text-xs font-bold text-[#D9F99D]">
            {isVictory
              ? hasNextStage
                ? `Fase ${hud.stage + 1} desbloqueada`
                : 'Todas as 10 fases defendidas!'
              : `Fase ${hud.stage} · Onda ${hud.wave}/${hud.totalWavesInStage}`}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-2xl bg-[#223617] p-3">
            <div className="rounded-xl bg-[#1A2B11]/70 p-2">
              <div className="text-[10px] font-bold text-[#BEF264] uppercase">Zumbis Derrotados</div>
              <div className="font-mono-tabular text-xl font-bold text-white" data-testid="modal-kills">
                {hud.kills}
              </div>
            </div>
            <div className="rounded-xl bg-[#1A2B11]/70 p-2">
              <div className="text-[10px] font-bold text-[#93C5FD] uppercase">Sobrevivência</div>
              <div className="font-mono-tabular text-xl font-bold text-white" data-testid="modal-time">
                {formatSurvivalTime(hud.survivalSeconds)}
              </div>
            </div>
            <div className="rounded-xl bg-[#1A2B11]/70 p-2">
              <div className="text-[10px] font-bold text-[#FDE047] uppercase">Essência Coletada</div>
              <div className="font-mono-tabular text-xl font-bold text-white" data-testid="modal-essence">
                {Math.round(hud.essenceCollected)}
              </div>
            </div>
            <div className="rounded-xl bg-[#1A2B11]/70 p-2">
              <div className="text-[10px] font-bold text-[#FDBA74] uppercase">Pontos</div>
              <div className="font-mono-tabular text-xl font-bold text-white" data-testid="modal-score">
                {Math.round(hud.score)}
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            {hasNextStage ? (
              <>
                <button
                  type="button"
                  data-start="true"
                  onClick={() => {
                    soundEngine.playClick();
                    onNextStage();
                  }}
                  className="font-display rounded-xl border-2 border-[#1B2E11] bg-[#22C55E] px-5 py-3 text-xl font-bold text-white shadow-[0_4px_0_#15803D] transition-transform active:translate-y-0.5 hover:bg-[#4ADE80]"
                >
                  Próxima Fase
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onStart(hud.stage);
                  }}
                  className="font-display rounded-xl border-2 border-[#1B2E11] bg-[#F59E0B] px-5 py-2 text-base font-bold text-white shadow-[0_3px_0_#B45309] transition-transform active:translate-y-0.5 hover:bg-[#FBBF24]"
                >
                  Jogar Novamente
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
                className="font-display rounded-xl border-2 border-[#1B2E11] bg-[#F97316] px-5 py-3 text-xl font-bold text-white shadow-[0_4px_0_#9A3412] transition-transform active:translate-y-0.5 hover:bg-[#FB923C]"
              >
                {isVictory ? 'Jogar Novamente' : 'Tentar Novamente'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onReturnTitle();
              }}
              className="rounded-xl border-2 border-[#1B2E11] bg-[#3B5929] px-5 py-2 text-sm font-bold text-[#E2E8F0] transition-colors hover:bg-[#4A6D34]"
            >
              Menu Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
