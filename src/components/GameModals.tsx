import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Home,
  Lock,
  Palette,
  Play,
  RotateCcw,
  Shield,
  ShieldAlert,
  Skull,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { soundEngine } from '../game/audio';
import {
  ALLY_ALBUM,
  ENEMY_ALBUM,
  getAllyUnlockForStage,
  getEnemyUnlockForStage,
  isAllyUnlocked,
  isEnemyUnlocked,
} from '../game/bestiaryData';
import {
  formatSurvivalTime,
  getHeroEvolutionCost,
  getHeroRankTitle,
  getHeroStatsForLevel,
  getHeroXpBounds,
  getStageConfig,
} from '../game/engineMath';
import {
  ACHIEVEMENT_CATALOG,
  FX_STYLES,
  FxStyleId,
  HERO_SPECS,
  HeroClass,
  HeroUpgradeId,
  HudSnapshot,
  MAX_HERO_LEVEL,
  RING_SKINS,
  RingSkinId,
  TOTAL_STAGES,
} from '../game/types';
import { TALENT_SPECS } from '../game/simulation';
import { AlbumTab } from './AlbumModal';

interface GameModalsProps {
  hud: HudSnapshot;
  selectedStage: number;
  convergenceStages: ReadonlyArray<number>;
  onSelectHero: (heroClass: HeroClass) => void;
  onSelectStage: (stage: number) => void;
  onSelectUpgrade: (upgradeId: HeroUpgradeId) => void;
  onUpgradeTalent: (talentId: string) => void;
  onSelectPact: (pactId: string) => void;
  onBuyOrEquipRingSkin: (skinId: RingSkinId) => void;
  onBuyOrEquipFxStyle: (fxId: FxStyleId) => void;
  onStart: (stage?: number) => void;
  onNextStage: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onOpenAlbum: (tab: AlbumTab) => void;
}

const STAGES_PER_CHAPTER = 10;
const TOTAL_CHAPTERS = Math.ceil(TOTAL_STAGES / STAGES_PER_CHAPTER);
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
  convergenceStages,
  onSelectHero,
  onSelectStage,
  onSelectUpgrade,
  onUpgradeTalent,
  onSelectPact,
  onBuyOrEquipRingSkin,
  onBuyOrEquipFxStyle,
  onStart,
  onNextStage,
  onResume,
  onRestart,
  onReturnTitle,
  onOpenAlbum,
}) => {
  const [chapterIndex, setChapterIndex] = useState(() =>
    Math.floor((Math.max(1, selectedStage) - 1) / STAGES_PER_CHAPTER)
  );
  const [showTalentsModal, setShowTalentsModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);

  useEffect(() => {
    setChapterIndex(Math.floor((Math.max(1, selectedStage) - 1) / STAGES_PER_CHAPTER));
  }, [selectedStage]);

  // Show Pact Choice Modal if pendingPactChoices is active
  if (hud.phase === 'playing' && hud.pendingPactChoices && hud.pendingPactChoices.length > 0) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
        <div className="w-full max-w-md rounded-2xl border-2 border-[#00D4FF] bg-[#0F172A] p-5 text-center shadow-[0_12px_32px_rgba(0,0,0,0.85)]">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl border border-[#00D4FF] bg-[#082F49] text-[#00D4FF]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h2 className="font-display text-xl font-bold text-[#00D4FF]">Escolha de Pacto (Wave {hud.wave})</h2>
          <p className="mt-1 text-xs text-[#94A3B8]">Cada pacto concede poder formidável com um custo de risco.</p>
          <div className="mt-4 flex flex-col gap-2.5">
            {hud.pendingPactChoices.map((pact) => {
              const border =
                pact.tone === 'crimson'
                  ? 'border-[#FF2E4C] hover:bg-[#450A0A]'
                  : pact.tone === 'electric'
                    ? 'border-[#00D4FF] hover:bg-[#082F49]'
                    : 'border-[#FACC15] hover:bg-[#422006]';
              return (
                <button
                  key={pact.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onSelectPact(pact.id);
                  }}
                  className={`flex flex-col rounded-xl border-2 bg-[#080D1A] p-3 text-left transition-transform active:translate-y-0.5 ${border}`}
                >
                  <div className="font-display text-sm font-bold text-white">{pact.title}</div>
                  <div className="mt-1 text-xs text-[#CBD5E1]">{pact.description}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Show Upgrade Milestone Modal whenever a hero hits a 5-level milestone (in Menu or in Combat!)
  if (
    (hud.phase === 'playing' || hud.phase === 'title') &&
    hud.pendingUpgradeChoices &&
    hud.pendingUpgradeChoices.length > 0
  ) {
    const milestone = hud.pendingUpgradeMilestoneLevel ?? 5;
    const upgradeHeroClass = hud.pendingUpgradeHeroClass ?? hud.selectedHeroClass;
    const upgradeHeroName = HERO_SPECS[upgradeHeroClass].name;
    const incomingEnemy =
      milestone >= 15
        ? 'Ceifador Abissal'
        : milestone >= 10
          ? 'Titã Arcano'
          : hud.stage >= 3
            ? 'Espectro Ígneo'
            : 'Sombra Veloz';
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-title"
          data-testid="upgrade-modal"
          className="w-full max-w-md rounded-2xl border-2 border-[#FACC15] bg-[#0F172A] p-4 text-center shadow-[0_10px_0_rgba(2,6,23,0.92)] sm:p-5"
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-[#FACC15] bg-[#422006] text-[#FACC15]">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 id="upgrade-title" className="font-display text-xl font-bold text-[#FACC15] sm:text-2xl">
            {upgradeHeroName} · Nível {milestone}!
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-[#00D4FF]">
            {hud.phase === 'playing'
              ? `Escolha 1 evolução permanente · Novo inimigo: ${incomingEnemy}`
              : 'Escolha 1 evolução permanente para este herói'}
          </p>

          <div className="mt-3.5 flex flex-col gap-2">
            {hud.pendingUpgradeChoices.map((opt) => {
              const borderAccent =
                opt.accent === 'crimson'
                  ? 'border-[#FF2E4C] hover:bg-[#450A0A]/60'
                  : opt.accent === 'electric'
                    ? 'border-[#00D4FF] hover:bg-[#082F49]/60'
                    : 'border-[#FACC15] hover:bg-[#422006]/60';
              return (
                <button
                  key={opt.id}
                  type="button"
                  data-testid={`upgrade-option-${opt.id}`}
                  onClick={() => {
                    soundEngine.playClick();
                    onSelectUpgrade(opt.id);
                  }}
                  className={`flex items-center justify-between gap-3 rounded-xl border-2 bg-[#080D1A] px-3.5 py-2.5 text-left transition-transform active:translate-y-0.5 ${borderAccent}`}
                >
                  <div>
                    <div className="font-display text-sm font-bold text-white sm:text-base">
                      {opt.title}
                    </div>
                    <div className="text-xs font-medium text-[#CBD5E1]">{opt.effectText}</div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-[#1E293B] px-2.5 py-1 text-xs font-bold text-[#FACC15]">
                    Aplicar
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (hud.phase === 'title') {
    const stageCfg = getStageConfig(selectedStage, convergenceStages);
    const unlockedEnemies = ENEMY_ALBUM.filter((e) =>
      isEnemyUnlocked(e, hud.highestUnlockedStage)
    ).length;
    const unlockedAllies = ALLY_ALBUM.filter((a) =>
      isAllyUnlocked(a, hud.highestUnlockedStage)
    ).length;

    const chapterStart = chapterIndex * STAGES_PER_CHAPTER + 1;
    const chapterEnd = Math.min(TOTAL_STAGES, chapterStart + STAGES_PER_CHAPTER - 1);
    const chapterStages = Array.from(
      { length: chapterEnd - chapterStart + 1 },
      (_, idx) => chapterStart + idx
    );

    return (
      <div className="fixed inset-0 z-30 flex flex-col items-center justify-between overflow-y-auto bg-[#080D1A]/72 px-3 py-3 sm:px-6 sm:py-4">
        {/* Imposing Top Title Crest */}
        <div className="flex flex-col items-center text-center">
          <svg
            viewBox="0 0 430 96"
            className="w-[230px] sm:w-[300px] drop-shadow-[0_6px_0_rgba(2,6,23,0.9)]"
            role="img"
            aria-label="Ember Ring Defense"
          >
            <rect x="14" y="10" width="402" height="76" rx="22" fill="#0F172A" stroke="#FACC15" strokeWidth="3.5" />
            <rect x="22" y="18" width="386" height="60" rx="16" fill="#1E293B" />
            <text
              x="215"
              y="52"
              textAnchor="middle"
              fill="#FFFFFF"
              stroke="#020617"
              strokeWidth="6"
              paintOrder="stroke fill"
              fontFamily="Fredoka, Plus Jakarta Sans, sans-serif"
              fontWeight="700"
              fontSize="30"
            >
              EMBER RING
            </text>
            <text
              x="215"
              y="70"
              textAnchor="middle"
              fill="#00D4FF"
              fontFamily="Plus Jakarta Sans, sans-serif"
              fontWeight="800"
              fontSize="11"
              letterSpacing="3.2"
            >
              DEFESA HEROICA DO CASTELO
            </text>
          </svg>
        </div>

        {/* Center Main Menu Stack */}
        <div className="my-auto flex w-full max-w-2xl flex-col items-center gap-2.5 py-1.5">
          {/* 1. Persistent Hero Roster & Player-Chosen Evolution Forge */}
          <section
            aria-label="Seleção e Evolução de Heróis"
            className="w-full rounded-2xl border-2 border-[#334155] bg-[#0F172A]/95 p-3 shadow-[0_8px_0_rgba(2,6,23,0.85)] sm:p-3.5"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-bold text-[#FACC15] sm:text-lg">
                  {stageCfg.isConvergenceStage
                    ? 'Convergência Trio: Todos os 3 Heróis vão à Batalha!'
                    : 'Escolha seu Herói Principal'}
                </h2>
              </div>
              <span className="text-[11px] font-semibold text-[#94A3B8]">
                Evolui em tempo real combatendo inimigos
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5">
              {HERO_ORDER.map((heroClass) => {
                const spec = HERO_SPECS[heroClass];
                const saved = hud.heroRoster[heroClass];
                const isSelected = stageCfg.isConvergenceStage || hud.selectedHeroClass === heroClass;
                const isMax = saved.level >= MAX_HERO_LEVEL;
                const bounds = getHeroXpBounds(saved.level);
                const xpLeft = Math.max(0, bounds.nextThreshold - saved.xp);
                const xpSpan = Math.max(1, bounds.nextThreshold - bounds.currentFloor);
                const xpPct = isMax
                  ? 100
                  : Math.max(0, Math.min(100, ((saved.xp - bounds.currentFloor) / xpSpan) * 100));
                const scaled = getHeroStatsForLevel(heroClass, saved.level);
                const rankTitle = getHeroRankTitle(saved.level);

                return (
                  <div
                    key={heroClass}
                    role="button"
                    tabIndex={0}
                    data-testid={`hero-card-${heroClass}`}
                    aria-pressed={hud.selectedHeroClass === heroClass}
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectHero(heroClass);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        soundEngine.playClick();
                        onSelectHero(heroClass);
                      }
                    }}
                    className={`flex cursor-pointer flex-col justify-between rounded-xl border-2 p-2.5 text-left transition-transform ${
                      isSelected
                        ? 'border-[#FACC15] bg-[#1E293B] shadow-[0_4px_0_#B45309]'
                        : 'border-[#1E293B] bg-[#0B1120]/90 hover:border-[#38BDF8]/60 hover:bg-[#162033]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#080D1A]"
                          style={{
                            boxShadow: isSelected ? `0 0 14px ${spec.glowColor}` : undefined,
                          }}
                        >
                          <HeroClassIcon heroClass={heroClass} className="h-6.5 w-6.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-display text-sm font-bold text-white sm:text-base">
                              {spec.name}
                            </span>
                            <span
                              data-testid={`menu-hero-level-${heroClass}`}
                              className="font-mono-tabular text-xs font-extrabold text-[#00D4FF]"
                            >
                              {isMax ? 'MÁX' : `Nv.${saved.level}`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 whitespace-nowrap text-[10px] font-bold">
                            <span style={{ color: spec.color }}>{rankTitle}</span>
                            <span className="font-mono-tabular text-[#CBD5E1]">
                              ATK {scaled.damage}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Persistent XP Progress & Zeigarnik Near-Miss Cue */}
                      <div className="mt-2">
                        <div className="mb-0.5 flex items-center justify-between gap-1 whitespace-nowrap text-[10px] font-bold text-[#94A3B8]">
                          <span>{saved.kills} abates</span>
                          <span className="font-mono-tabular text-[#FACC15]">
                            {isMax ? 'Poder Supremo' : `Faltam ${xpLeft} XP`}
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#080D1A]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#00D4FF] to-[#FACC15]"
                            style={{ width: `${xpPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2. Códice de Brasa, Talentos & Loja de Aparências */}
          <section
            aria-label="Códice, Talentos e Aparências"
            className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-2.5"
          >
            <button
              type="button"
              data-testid="open-enemy-album"
              onClick={() => {
                soundEngine.playClick();
                onOpenAlbum('enemies');
              }}
              className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#7F1D1D] bg-[#0F172A]/95 px-4 py-2.5 text-left shadow-[0_5px_0_rgba(2,6,23,0.85)] transition-transform hover:-translate-y-0.5 hover:border-[#FF2E4C]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FF2E4C]/50 bg-[#450A0A] text-[#FF2E4C]">
                  <Skull className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white sm:text-base">
                    Códice · Inimigos
                  </div>
                  <div className="font-mono-tabular text-[11px] font-semibold text-[#CBD5E1]">
                    {unlockedEnemies}/50 revelados · {hud.totalLifetimeKills} abates
                  </div>
                </div>
              </div>
              <span className="font-mono-tabular shrink-0 text-xs font-bold whitespace-nowrap text-[#FACC15]">
                Abrir →
              </span>
            </button>

            <button
              type="button"
              data-testid="open-ally-album"
              onClick={() => {
                soundEngine.playClick();
                onOpenAlbum('allies');
              }}
              className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#0C4A6E] bg-[#0F172A]/95 px-4 py-2.5 text-left shadow-[0_5px_0_rgba(2,6,23,0.85)] transition-transform hover:-translate-y-0.5 hover:border-[#00D4FF]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#00D4FF]/50 bg-[#082F49] text-[#00D4FF]">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white sm:text-base">
                    Códice · Aliados
                  </div>
                  <div className="font-mono-tabular text-[11px] font-semibold text-[#CBD5E1]">
                    {unlockedAllies}/10 recrutáveis
                  </div>
                </div>
              </div>
              <span className="font-mono-tabular shrink-0 text-xs font-bold whitespace-nowrap text-[#00D4FF]">
                Abrir →
              </span>
            </button>

            <button
              type="button"
              data-testid="open-talents-modal"
              onClick={() => {
                soundEngine.playClick();
                setShowTalentsModal(true);
              }}
              className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#B45309] bg-[#0F172A]/95 px-4 py-2.5 text-left shadow-[0_5px_0_rgba(2,6,23,0.85)] transition-transform hover:-translate-y-0.5 hover:border-[#FACC15]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#FACC15]/50 bg-[#422006] text-[#FACC15]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white sm:text-base">
                    Talentos de Brasa
                  </div>
                  <div className="font-mono-tabular text-[11px] font-semibold text-[#FACC15]">
                    {hud.emberSouls} Almas de Brasa
                  </div>
                </div>
              </div>
              <span className="font-mono-tabular shrink-0 text-xs font-bold whitespace-nowrap text-[#FACC15]">
                Árvore →
              </span>
            </button>

            <button
              type="button"
              data-testid="open-shop-modal"
              onClick={() => {
                soundEngine.playClick();
                setShowShopModal(true);
              }}
              className="flex items-center justify-between gap-3 rounded-2xl border-2 border-[#047857] bg-[#0F172A]/95 px-4 py-2.5 text-left shadow-[0_5px_0_rgba(2,6,23,0.85)] transition-transform hover:-translate-y-0.5 hover:border-[#10B981]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#10B981]/50 bg-[#064E3B] text-[#6EE7B7]">
                  <Palette className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-white sm:text-base">
                    Loja de Aparências
                  </div>
                  <div className="font-mono-tabular text-[11px] font-semibold text-[#6EE7B7]">
                    {RING_SKINS[hud.equippedRingSkin].name.replace('Anel ', '')}
                  </div>
                </div>
              </div>
              <span className="font-mono-tabular shrink-0 text-xs font-bold whitespace-nowrap text-[#6EE7B7]">
                Skins →
              </span>
            </button>

            <button
              type="button"
              data-testid="open-achievements-album"
              onClick={() => {
                soundEngine.playClick();
                onOpenAlbum('achievements');
              }}
              className="sm:col-span-2 flex items-center justify-between gap-3 rounded-2xl border-2 border-[#475569] bg-[#0F172A]/95 px-4 py-2 text-left shadow-[0_4px_0_rgba(2,6,23,0.85)] transition-transform hover:-translate-y-0.5 hover:border-[#FACC15]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Trophy className="h-4.5 w-4.5 shrink-0 text-[#FACC15]" />
                <span className="font-display text-sm font-bold text-white">
                  Conquistas da Fortaleza
                </span>
                <span className="font-mono-tabular text-xs font-semibold text-[#94A3B8]">
                  ({hud.unlockedAchievements.length}/{ACHIEVEMENT_CATALOG.length} concluídas)
                </span>
              </div>
              <span className="font-mono-tabular shrink-0 text-xs font-bold whitespace-nowrap text-[#FACC15]">
                Resgatar Almas →
              </span>
            </button>
          </section>

          {/* Talents Tree Modal */}
          {showTalentsModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
              <div className="w-full max-w-lg rounded-3xl border-2 border-[#FACC15] bg-[#0F172A] p-5 text-left shadow-[0_12px_36px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#422006] text-[#FACC15]">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#FACC15]">Árvore de Talentos Permanentes</h3>
                      <div className="font-mono-tabular text-xs text-[#00D4FF]">Almas de Brasa disponíveis: {hud.emberSouls}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick();
                      setShowTalentsModal(false);
                    }}
                    className="rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#334155]"
                  >
                    Fechar
                  </button>
                </div>
                <div className="mt-4 flex flex-col gap-3">
                  {Object.entries(TALENT_SPECS).map(([talentId, spec]) => {
                    const currentLevel = hud.talents[talentId] ?? 0;
                    const isMax = currentLevel >= spec.maxLevel;
                    const cost = spec.baseCost * (currentLevel + 1);
                    const canAfford = hud.emberSouls >= cost && !isMax;

                    return (
                      <div key={talentId} className="flex items-center justify-between gap-3 rounded-2xl border border-[#334155] bg-[#080D1A] p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-bold text-white">{spec.name}</span>
                            <span className="font-mono-tabular text-xs text-[#00D4FF]">
                              Nv.{currentLevel}/{spec.maxLevel}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[#94A3B8]">{spec.description}</p>
                        </div>
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => {
                            soundEngine.playClick();
                            onUpgradeTalent(talentId);
                          }}
                          className="font-mono-tabular shrink-0 rounded-xl border border-[#FACC15] bg-[#422006] px-3 py-2 text-xs font-bold text-[#FACC15] transition-transform active:translate-y-0.5 hover:bg-[#78350F] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isMax ? 'MÁX' : `Evoluir (${cost} Almas)`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Loja de Aparências (Single-Player Cosmetics Shop) */}
          {showShopModal && (
            <div
              data-testid="shop-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Loja de Aparências"
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4"
            >
              <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-[#10B981] bg-[#0F172A] text-left shadow-[0_14px_40px_rgba(0,0,0,0.92)]">
                <div className="flex items-center justify-between border-b border-white/10 bg-[#080D1A] px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#10B981]/50 bg-[#064E3B] text-[#6EE7B7]">
                      <Palette className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-[#6EE7B7]">
                        Loja de Aparências
                      </h3>
                      <div className="font-mono-tabular text-xs font-bold text-[#FACC15]">
                        Almas de Brasa disponíveis: {hud.emberSouls}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-testid="shop-close"
                    onClick={() => {
                      soundEngine.playClick();
                      setShowShopModal(false);
                    }}
                    className="rounded-xl border border-[#334155] bg-[#1E293B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#334155]"
                  >
                    Fechar
                  </button>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto p-5">
                  {/* Section 1: Ring Skins */}
                  <div>
                    <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#FACC15]">
                      Skins do Anel Central
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {Object.values(RING_SKINS).map((skin) => {
                        const unlocked = hud.unlockedCosmetics.includes(`ring:${skin.id}`);
                        const equipped = hud.equippedRingSkin === skin.id;
                        const canAfford = hud.emberSouls >= skin.cost;

                        return (
                          <div
                            key={skin.id}
                            className={`flex flex-col justify-between gap-3 rounded-2xl border-2 p-3 ${
                              equipped
                                ? 'border-[#FACC15] bg-[#1E293B]'
                                : 'border-[#334155] bg-[#080D1A]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 bg-[#020617]"
                                style={{
                                  borderColor: skin.primaryColor,
                                  boxShadow: `0 0 14px ${skin.glowColor}`,
                                }}
                              >
                                <div
                                  className="h-4 w-4 rounded-full border-2"
                                  style={{
                                    borderColor: skin.secondaryColor,
                                    backgroundColor: skin.runeColor,
                                  }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="font-display text-sm font-bold text-white">
                                  {skin.name}
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-[#94A3B8]">
                                  {skin.description}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              data-testid={`shop-ring-${skin.id}`}
                              disabled={equipped || (!unlocked && !canAfford)}
                              onClick={() => onBuyOrEquipRingSkin(skin.id)}
                              className={`font-mono-tabular w-full rounded-xl border px-3 py-1.5 text-xs font-bold transition-transform active:translate-y-0.5 ${
                                equipped
                                  ? 'border-[#FACC15] bg-[#422006] text-[#FACC15]'
                                  : unlocked
                                    ? 'border-[#00D4FF] bg-[#082F49] text-[#E0F2FE] hover:bg-[#0369A1]'
                                    : canAfford
                                      ? 'border-[#10B981] bg-[#064E3B] text-[#6EE7B7] hover:bg-[#047857]'
                                      : 'cursor-not-allowed border-[#334155] bg-[#1E293B] text-[#64748B]'
                              }`}
                            >
                              {equipped
                                ? 'Equipado'
                                : unlocked
                                  ? 'Equipar'
                                  : `Desbloquear (${skin.cost} Almas)`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Shot & Spell FX Styles */}
                  <div>
                    <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-[#00D4FF]">
                      Efeitos de Disparo & Magias
                    </h4>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      {Object.values(FX_STYLES).map((fx) => {
                        const unlocked = hud.unlockedCosmetics.includes(`fx:${fx.id}`);
                        const equipped = hud.equippedFxStyle === fx.id;
                        const canAfford = hud.emberSouls >= fx.cost;

                        return (
                          <div
                            key={fx.id}
                            className={`flex flex-col justify-between gap-3 rounded-2xl border-2 p-3 ${
                              equipped
                                ? 'border-[#00D4FF] bg-[#1E293B]'
                                : 'border-[#334155] bg-[#080D1A]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 bg-[#020617]"
                                style={{ borderColor: fx.projectileTint }}
                              >
                                <div className="flex items-center gap-1">
                                  <span
                                    className="h-3 w-3 rounded-full"
                                    style={{ backgroundColor: fx.projectileTint }}
                                  />
                                  <span
                                    className="h-2 w-2 rounded-full"
                                    style={{ backgroundColor: fx.slashTint }}
                                  />
                                </div>
                              </div>
                              <div className="min-w-0">
                                <div className="font-display text-sm font-bold text-white">
                                  {fx.name}
                                </div>
                                <p className="mt-0.5 text-[11px] leading-snug text-[#94A3B8]">
                                  {fx.description}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              data-testid={`shop-fx-${fx.id}`}
                              disabled={equipped || (!unlocked && !canAfford)}
                              onClick={() => onBuyOrEquipFxStyle(fx.id)}
                              className={`font-mono-tabular w-full rounded-xl border px-3 py-1.5 text-xs font-bold transition-transform active:translate-y-0.5 ${
                                equipped
                                  ? 'border-[#00D4FF] bg-[#082F49] text-[#00D4FF]'
                                  : unlocked
                                    ? 'border-[#00D4FF] bg-[#082F49]/70 text-[#E0F2FE] hover:bg-[#0369A1]'
                                    : canAfford
                                      ? 'border-[#10B981] bg-[#064E3B] text-[#6EE7B7] hover:bg-[#047857]'
                                      : 'cursor-not-allowed border-[#334155] bg-[#1E293B] text-[#64748B]'
                              }`}
                            >
                              {equipped
                                ? 'Equipado'
                                : unlocked
                                  ? 'Equipar'
                                  : `Desbloquear (${fx.cost} Almas)`}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Dynamic 1-4 Route & Convergence Stage Selector */}
          <section
            aria-label="Seletor de Fases"
            className="w-full rounded-2xl border-2 border-[#334155] bg-[#0F172A]/95 p-3 shadow-[0_6px_0_rgba(2,6,23,0.85)] sm:p-3.5"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <span className="truncate text-[#FACC15]">
                  Fase {selectedStage} · {stageCfg.title}
                </span>
                <span className="font-mono-tabular text-[#00D4FF]">
                  · {stageCfg.routeCount} {stageCfg.routeCount === 1 ? 'Rota' : 'Rotas'} · {stageCfg.totalWaves} ondas
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Capítulo anterior"
                  disabled={chapterIndex <= 0}
                  onClick={() => {
                    soundEngine.playClick();
                    setChapterIndex((prev) => Math.max(0, prev - 1));
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#334155] bg-[#1E293B] text-white disabled:opacity-35"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="font-mono-tabular text-[11px] font-bold text-white">
                  Fases {chapterStart}-{chapterEnd}
                </span>
                <button
                  type="button"
                  aria-label="Próximo capítulo"
                  disabled={chapterIndex >= TOTAL_CHAPTERS - 1}
                  onClick={() => {
                    soundEngine.playClick();
                    setChapterIndex((prev) => Math.min(TOTAL_CHAPTERS - 1, prev + 1));
                  }}
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#334155] bg-[#1E293B] text-white disabled:opacity-35"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
              {chapterStages.map((stageNum) => {
                const unlocked = stageNum <= hud.highestUnlockedStage;
                const active = stageNum === selectedStage;
                const isConvergence = convergenceStages.includes(stageNum);
                const enemyUnlock = getEnemyUnlockForStage(stageNum);
                const allyUnlock = getAllyUnlockForStage(stageNum);
                const isBossStage = Boolean(enemyUnlock?.isBoss);
                return (
                  <button
                    key={stageNum}
                    type="button"
                    disabled={!unlocked}
                    data-testid={`stage-btn-${stageNum}`}
                    data-convergence={isConvergence ? 'true' : 'false'}
                    aria-label={unlocked ? `Selecionar Fase ${stageNum}` : `Fase ${stageNum} bloqueada`}
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectStage(stageNum);
                    }}
                    className={`font-mono-tabular relative flex h-9.5 items-center justify-center rounded-xl border-2 text-xs font-bold transition-transform active:translate-y-0.5 sm:text-sm ${
                      !unlocked
                        ? 'cursor-not-allowed border-[#1E293B] bg-[#080D1A] text-white/30'
                        : active
                          ? 'border-[#FACC15] bg-[#FF2E4C] text-white shadow-[0_3px_0_#991B1B]'
                          : isConvergence
                            ? 'border-[#FACC15] bg-[#422006]/85 text-[#FEF08A] hover:border-[#00D4FF]'
                            : isBossStage
                              ? 'border-[#FACC15]/80 bg-[#1E293B] text-[#FACC15] hover:border-[#00D4FF]'
                              : allyUnlock
                                ? 'border-[#10B981]/80 bg-[#1E293B] text-[#6EE7B7] hover:border-[#FACC15]'
                                : enemyUnlock
                                  ? 'border-[#00D4FF]/65 bg-[#1E293B] text-[#00D4FF] hover:border-[#FACC15]'
                                  : 'border-[#334155] bg-[#1E293B] text-[#E2E8F0] hover:border-[#00D4FF]'
                    }`}
                  >
                    {unlocked ? stageNum : <Lock className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 4. Dominant Saturated CTA */}
          <button
            type="button"
            data-start="true"
            onClick={() => {
              soundEngine.playClick();
              onStart(selectedStage);
            }}
            className="font-display flex items-center justify-center gap-2.5 rounded-2xl border-2 border-[#FEF08A] bg-gradient-to-r from-[#FF2E4C] to-[#F59E0B] px-9 py-2.5 text-lg font-bold whitespace-nowrap text-white shadow-[0_6px_0_#991B1B] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_2px_0_#991B1B] sm:text-2xl"
          >
            <Play className="h-5 w-5 fill-current" />
            <span>
              {stageCfg.isConvergenceStage
                ? `Convergência Trio · Fase ${selectedStage}`
                : `Iniciar Fase ${selectedStage}`}
            </span>
          </button>

          <p className="text-center text-xs font-semibold tracking-wide text-[#CBD5E1]">
            Posicione Heróis livremente no campo · Níveis ficam salvos · Portões abrem com o Nível de Rota
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
    const nextEnemy = hasNextStage ? getEnemyUnlockForStage(hud.stage + 1) : undefined;
    const nextAlly = hasNextStage ? getAllyUnlockForStage(hud.stage + 1) : undefined;

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
                ? `Nova Rota Desbloqueada · Fase ${hud.stage + 1}${
                    nextAlly
                      ? ` · Aliado Liberado: ${nextAlly.name}`
                      : nextEnemy
                        ? ` · Novo Card: ${nextEnemy.name}`
                        : ''
                  }`
                : 'Todas as 150 rotas defendidas!'
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
              <div className="text-[10px] font-bold text-[#FACC15] uppercase">Nível Mantido</div>
              <div className="font-mono-tabular mt-0.5 text-lg font-bold text-white">
                {hud.activeHeroes.length > 1
                  ? `Nv.${hud.heroRoster.archer.level}/${hud.heroRoster.swordsman.level}/${hud.heroRoster.bomber.level}`
                  : `Nv.${hud.heroLevel}`}
              </div>
            </div>
            <div className="rounded-xl bg-[#0F172A] p-2.5">
              <div className="text-[10px] font-bold text-[#00D4FF] uppercase">Tempo</div>
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
