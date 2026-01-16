/**
 * EncyclopediaManager - Manages encyclopedia entry unlock tracking.
 *
 * Enemies and bosses are locked until the player reaches the chapter
 * where they are introduced. Other content (equipment, abilities, etc.)
 * is always visible.
 *
 * Uses singleton pattern for global access throughout the game.
 */

import { ChapterId, EnemyType } from "../config/chapterData";
import { BossId, BOSS_DEFINITIONS } from "../config/bossData";
import { getEnemyIntroChapter } from "../config/encyclopediaData";
import { chapterManager } from "./ChapterManager";

// ============================================
// Constants
// ============================================

const STORAGE_KEY = "aura_archer_encyclopedia_data";

// ============================================
// Type Definitions
// ============================================

/**
 * Save data structure for EncyclopediaManager
 */
export interface EncyclopediaSaveData {
  /** Version for migration support */
  version: number;
}

// ============================================
// EncyclopediaManager Class
// ============================================

class EncyclopediaManager {
  private static _instance: EncyclopediaManager;

  /**
   * Get singleton instance
   */
  static get instance(): EncyclopediaManager {
    if (!EncyclopediaManager._instance) {
      EncyclopediaManager._instance = new EncyclopediaManager();
    }
    return EncyclopediaManager._instance;
  }

  private constructor() {
    this.loadFromStorage();
  }

  // ============================================
  // Unlock Checks (Chapter-Based)
  // ============================================

  /**
   * Check if an enemy type is unlocked (visible in encyclopedia)
   * Enemy is unlocked when player has reached the chapter where it's introduced
   */
  isEnemyUnlocked(enemyType: EnemyType): boolean {
    const introChapter = getEnemyIntroChapter(enemyType);
    return this.isChapterReached(introChapter);
  }

  /**
   * Check if a boss is unlocked (visible in encyclopedia)
   * Boss is unlocked when player has reached its chapter
   */
  isBossUnlocked(bossId: BossId): boolean {
    const boss = BOSS_DEFINITIONS[bossId];
    if (!boss) return false;
    return this.isChapterReached(boss.chapter);
  }

  /**
   * Check if a chapter has been reached (unlocked or played)
   * Chapter 1 is always unlocked
   */
  private isChapterReached(chapterId: ChapterId): boolean {
    return chapterManager.isChapterUnlocked(chapterId);
  }

  // ============================================
  // Unlock Counts
  // ============================================

  /**
   * Get count of unlocked enemies
   */
  getUnlockedEnemyCount(): number {
    const enemyTypes: EnemyType[] = [
      "melee",
      "ranged",
      "spreader",
      "bomber",
      "tank",
      "charger",
      "healer",
      "spawner",
    ];
    return enemyTypes.filter((type) => this.isEnemyUnlocked(type)).length;
  }

  /**
   * Get count of unlocked bosses
   */
  getUnlockedBossCount(): number {
    const bossIds = Object.keys(BOSS_DEFINITIONS) as BossId[];
    return bossIds.filter((id) => this.isBossUnlocked(id)).length;
  }

  // ============================================
  // Persistence
  // ============================================

  /**
   * Save to localStorage
   * Currently minimal since unlocks are derived from ChapterManager
   */
  private saveToStorage(): void {
    try {
      const data: EncyclopediaSaveData = {
        version: 1,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error("EncyclopediaManager: Failed to save data:", error);
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored) as EncyclopediaSaveData;
        // Future: handle migrations based on version
        console.log("EncyclopediaManager: Loaded from storage, version:", data.version);
      }
    } catch (error) {
      console.error("EncyclopediaManager: Failed to load data:", error);
    }
  }

  /**
   * Reset all encyclopedia data
   */
  reset(): void {
    this.saveToStorage();
  }
}

// ============================================
// Singleton Export
// ============================================

export const encyclopediaManager = EncyclopediaManager.instance;

// Expose to window for debugging
if (typeof window !== "undefined") {
  (window as never as Record<string, unknown>).encyclopediaManager = encyclopediaManager;
}
