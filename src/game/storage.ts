import {
  HERO_XP_THRESHOLDS,
  HeroClass,
  HeroSaveData,
  HeroUpgradeId,
  MAX_HERO_LEVEL,
  TOTAL_STAGES,
} from './types';

const STORAGE_KEY = 'ember_ring_defense_progress_v3';
const LEGACY_STORAGE_KEY = 'ember_ring_defense_progress_v2';

export interface SavedProgress {
  highestUnlockedStage: number;
  bestScore: number;
  selectedHeroClass: HeroClass;
  evolutionPoints: number;
  emberSouls: number;
  talents: Record<string, number>;
  heroes: Record<HeroClass, HeroSaveData>;
  convergenceStages: number[];
}

const VALID_HEROES: HeroClass[] = ['archer', 'swordsman', 'bomber'];
const VALID_UPGRADES: HeroUpgradeId[] = ['power', 'haste', 'fortress', 'area'];

export function createDefaultHeroSave(): HeroSaveData {
  return {
    level: 1,
    xp: 0,
    kills: 0,
    upgradeChoices: [],
  };
}

export function createDefaultHeroRoster(): Record<HeroClass, HeroSaveData> {
  return {
    archer: createDefaultHeroSave(),
    swordsman: createDefaultHeroSave(),
    bomber: createDefaultHeroSave(),
  };
}

/**
 * Generates an irregular, non-standardized schedule of 3-Hero Convergence stages
 * spaced strictly between 4 and 8 stages apart across 1..TOTAL_STAGES.
 */
export function generateConvergenceStages(seed = Date.now()): number[] {
  let state = Math.max(1, Math.floor(Math.abs(seed)) % 2147483647);
  const nextRand = () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };

  const stages: number[] = [];
  let cursor = 4 + Math.floor(nextRand() * 5); // 4..8 for the first Convergence stage
  while (cursor <= TOTAL_STAGES) {
    stages.push(cursor);
    const gap = 4 + Math.floor(nextRand() * 5); // 4..8 between every Convergence stage
    cursor += gap;
  }
  return stages;
}

function sanitizeHeroSave(raw: Partial<HeroSaveData> | undefined): HeroSaveData {
  const xp = Math.max(0, Math.floor(Number(raw?.xp) || 0));
  let computedLevel = 1;
  for (let i = 1; i < HERO_XP_THRESHOLDS.length; i++) {
    if (xp >= HERO_XP_THRESHOLDS[i]) computedLevel = i + 1;
  }
  const rawLevel = Math.max(1, Math.min(MAX_HERO_LEVEL, Math.floor(Number(raw?.level) || 1)));
  const level = Math.max(rawLevel, Math.min(MAX_HERO_LEVEL, computedLevel));
  const safeXp = Math.max(xp, HERO_XP_THRESHOLDS[level - 1] ?? 0);
  const kills = Math.max(0, Math.floor(Number(raw?.kills) || 0));
  const upgradeChoices = Array.isArray(raw?.upgradeChoices)
    ? raw!.upgradeChoices.filter((u): u is HeroUpgradeId => VALID_UPGRADES.includes(u))
    : [];
  return {
    level,
    xp: safeXp,
    kills,
    upgradeChoices,
  };
}

function sanitizeConvergenceStages(raw: unknown): number[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return generateConvergenceStages(7319);
  }
  const valid = raw
    .map((n) => Math.floor(Number(n)))
    .filter((n) => Number.isFinite(n) && n >= 4 && n <= TOTAL_STAGES)
    .sort((a, b) => a - b);
  if (valid.length === 0) return generateConvergenceStages(7319);
  for (let i = 1; i < valid.length; i++) {
    const gap = valid[i] - valid[i - 1];
    if (gap < 4 || gap > 8) {
      return generateConvergenceStages(7319);
    }
  }
  return valid;
}

export function createDefaultProgress(seed?: number): SavedProgress {
  return {
    highestUnlockedStage: 1,
    bestScore: 0,
    selectedHeroClass: 'archer',
    evolutionPoints: 2,
    emberSouls: 10,
    talents: {
      critMastery: 0,
      manaRegen: 0,
      ringReach: 0,
      towerDiscount: 0,
    },
    heroes: createDefaultHeroRoster(),
    convergenceStages: generateConvergenceStages(seed),
  };
}

export function loadProgress(): SavedProgress {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return createDefaultProgress(7319);
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const legacy = JSON.parse(legacyRaw) as Partial<SavedProgress>;
        const migrated: SavedProgress = {
          highestUnlockedStage: Math.max(
            1,
            Math.min(TOTAL_STAGES, Math.floor(Number(legacy.highestUnlockedStage) || 1))
          ),
          bestScore: Math.max(0, Math.floor(Number(legacy.bestScore) || 0)),
          selectedHeroClass: VALID_HEROES.includes(legacy.selectedHeroClass as HeroClass)
            ? (legacy.selectedHeroClass as HeroClass)
            : 'archer',
          evolutionPoints: 2,
          emberSouls: 10,
          talents: { critMastery: 0, manaRegen: 0, ringReach: 0, towerDiscount: 0 },
          heroes: createDefaultHeroRoster(),
          convergenceStages: generateConvergenceStages(),
        };
        saveProgress(migrated);
        return migrated;
      }
      const fresh = createDefaultProgress();
      saveProgress(fresh);
      return fresh;
    }

    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const stage = Math.max(
      1,
      Math.min(TOTAL_STAGES, Math.floor(Number(parsed.highestUnlockedStage) || 1))
    );
    const bestScore = Math.max(0, Math.floor(Number(parsed.bestScore) || 0));
    const selectedHeroClass = VALID_HEROES.includes(parsed.selectedHeroClass as HeroClass)
      ? (parsed.selectedHeroClass as HeroClass)
      : 'archer';
    const evolutionPoints = Math.max(0, Math.floor(Number(parsed.evolutionPoints) ?? 0));
    const emberSouls = Math.max(0, Math.floor(Number(parsed.emberSouls) ?? 10));
    const talents = {
      critMastery: Math.max(0, Math.min(5, Math.floor(Number(parsed.talents?.critMastery) || 0))),
      manaRegen: Math.max(0, Math.min(5, Math.floor(Number(parsed.talents?.manaRegen) || 0))),
      ringReach: Math.max(0, Math.min(5, Math.floor(Number(parsed.talents?.ringReach) || 0))),
      towerDiscount: Math.max(0, Math.min(5, Math.floor(Number(parsed.talents?.towerDiscount) || 0))),
    };
    const heroes: Record<HeroClass, HeroSaveData> = {
      archer: sanitizeHeroSave(parsed.heroes?.archer),
      swordsman: sanitizeHeroSave(parsed.heroes?.swordsman),
      bomber: sanitizeHeroSave(parsed.heroes?.bomber),
    };
    const convergenceStages = sanitizeConvergenceStages(parsed.convergenceStages);

    return {
      highestUnlockedStage: stage,
      bestScore,
      selectedHeroClass,
      evolutionPoints,
      emberSouls,
      talents,
      heroes,
      convergenceStages,
    };
  } catch {
    return createDefaultProgress(7319);
  }
}

export function saveProgress(progress: SavedProgress): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        highestUnlockedStage: Math.max(
          1,
          Math.min(TOTAL_STAGES, Math.floor(progress.highestUnlockedStage))
        ),
        bestScore: Math.max(0, Math.floor(progress.bestScore)),
        selectedHeroClass: VALID_HEROES.includes(progress.selectedHeroClass)
          ? progress.selectedHeroClass
          : 'archer',
        evolutionPoints: Math.max(0, Math.floor(progress.evolutionPoints)),
        emberSouls: Math.max(0, Math.floor(progress.emberSouls)),
        talents: {
          critMastery: Math.max(0, Math.min(5, Math.floor(progress.talents?.critMastery || 0))),
          manaRegen: Math.max(0, Math.min(5, Math.floor(progress.talents?.manaRegen || 0))),
          ringReach: Math.max(0, Math.min(5, Math.floor(progress.talents?.ringReach || 0))),
          towerDiscount: Math.max(0, Math.min(5, Math.floor(progress.talents?.towerDiscount || 0))),
        },
        heroes: {
          archer: sanitizeHeroSave(progress.heroes.archer),
          swordsman: sanitizeHeroSave(progress.heroes.swordsman),
          bomber: sanitizeHeroSave(progress.heroes.bomber),
        },
        convergenceStages: sanitizeConvergenceStages(progress.convergenceStages),
      })
    );
  } catch {
    // Ignore storage quota or private-mode failures
  }
}
