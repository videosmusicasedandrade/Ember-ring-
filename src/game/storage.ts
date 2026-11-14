import { TOTAL_STAGES } from './types';

const STORAGE_KEY = 'ember_ring_defense_progress_v1';

export interface SavedProgress {
  highestUnlockedStage: number;
  bestScore: number;
}

export function loadProgress(): SavedProgress {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { highestUnlockedStage: 1, bestScore: 0 };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { highestUnlockedStage: 1, bestScore: 0 };
    const parsed = JSON.parse(raw) as Partial<SavedProgress>;
    const stage = Math.max(
      1,
      Math.min(TOTAL_STAGES, Math.floor(Number(parsed.highestUnlockedStage) || 1))
    );
    const bestScore = Math.max(0, Math.floor(Number(parsed.bestScore) || 0));
    return { highestUnlockedStage: stage, bestScore };
  } catch {
    return { highestUnlockedStage: 1, bestScore: 0 };
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
      })
    );
  } catch {
    // Ignore storage quota or private-mode failures
  }
}
