import { HeroClass, TOTAL_STAGES } from './types';

const STORAGE_KEY = 'ember_ring_defense_progress_v2';

export interface SavedProgress {
  highestUnlockedStage: number;
  bestScore: number;
  selectedHeroClass: HeroClass;
}

const VALID_HEROES: HeroClass[] = ['archer', 'swordsman', 'bomber'];

export function loadProgress(): SavedProgress {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { highestUnlockedStage: 1, bestScore: 0, selectedHeroClass: 'archer' };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { highestUnlockedStage: 1, bestScore: 0, selectedHeroClass: 'archer' };
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
    return { highestUnlockedStage: stage, bestScore, selectedHeroClass };
  } catch {
    return { highestUnlockedStage: 1, bestScore: 0, selectedHeroClass: 'archer' };
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
      })
    );
  } catch {
    // Ignore storage quota or private-mode failures
  }
}
