/**
 * AnalyticsManager - Event tracking with SimpleAnalytics
 *
 * Features:
 * - Game event tracking (run completion, high scores, abilities, etc.)
 * - Privacy-first analytics via SimpleAnalytics
 * - Metadata support for event attributes
 *
 * SimpleAnalytics script is loaded in index.html.
 * Events are sent via the global `sa_event` function.
 */

// Declare the global sa_event function from SimpleAnalytics
declare global {
  interface Window {
    sa_event?: (eventName: string, metadata?: Record<string, unknown>) => void;
  }
}

class AnalyticsManager {
  private static _instance: AnalyticsManager;

  static get instance(): AnalyticsManager {
    if (!AnalyticsManager._instance) {
      AnalyticsManager._instance = new AnalyticsManager();
    }
    return AnalyticsManager._instance;
  }

  private constructor() {
    // SimpleAnalytics script is loaded via index.html
  }

  /**
   * Check if SimpleAnalytics is available
   */
  private isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.sa_event === "function";
  }

  /**
   * Track a custom event with optional metadata
   * Event names are automatically converted to lowercase with underscores
   */
  private trackEvent(eventName: string, metadata?: Record<string, unknown>): void {
    if (!this.isAvailable()) {
      console.debug(`[Analytics] SimpleAnalytics not available, skipping: ${eventName}`);
      return;
    }

    try {
      window.sa_event!(eventName, metadata);
    } catch (error) {
      console.debug(`[Analytics] Failed to track event: ${eventName}`, error);
    }
  }

  // ============================================
  // Game Events
  // ============================================

  /**
   * Track a run completion with all relevant metrics
   */
  trackRunCompleted(data: {
    roomsCleared: number;
    enemiesKilled: number;
    playTimeMs: number;
    score: number;
    isVictory: boolean;
    isEndlessMode?: boolean;
    endlessWave?: number;
    isDailyChallenge?: boolean;
    chapterId?: number;
    difficulty?: string;
    heroId?: string;
    abilitiesGained?: number;
  }): void {
    const mode = data.isEndlessMode ? "endless" : data.isDailyChallenge ? "daily" : "normal";

    this.trackEvent("run_completed", {
      victory: data.isVictory,
      mode,
      difficulty: data.difficulty ?? "normal",
      chapter: data.chapterId ?? 1,
      rooms_cleared: data.roomsCleared,
      enemies_killed: data.enemiesKilled,
      play_time_seconds: Math.floor(data.playTimeMs / 1000),
      score: data.score,
      endless_wave: data.endlessWave ?? 0,
      abilities_gained: data.abilitiesGained ?? 0,
      hero: data.heroId ?? "unknown",
    });
  }

  /**
   * Track when a new high score is achieved
   */
  trackNewHighScore(
    score: number,
    previousScore: number,
    mode: "normal" | "endless" = "normal",
  ): void {
    this.trackEvent("new_high_score", {
      score,
      previous_score: previousScore,
      improvement: score - previousScore,
      mode,
    });
  }

  /**
   * Track a level up event
   */
  trackLevelUp(playerLevel: number, abilityChosen?: string): void {
    this.trackEvent("level_up", {
      level: playerLevel,
      ability: abilityChosen ?? "unknown",
    });
  }

  /**
   * Track a boss kill
   */
  trackBossKill(bossId: string, timeToKillMs: number, chapterId: number): void {
    this.trackEvent("boss_kill", {
      boss: bossId,
      chapter: chapterId,
      time_to_kill_seconds: Math.floor(timeToKillMs / 1000),
    });
  }

  /**
   * Track ability acquisition
   */
  trackAbilityAcquired(abilityId: string, level: number): void {
    this.trackEvent("ability_acquired", {
      ability: abilityId,
      level,
    });
  }

  /**
   * Track game start
   */
  trackGameStart(
    mode: "normal" | "endless" | "daily",
    chapterId: number,
    difficulty: string,
  ): void {
    this.trackEvent("game_start", {
      mode,
      chapter: chapterId,
      difficulty,
    });
  }

  /**
   * Track hero usage
   */
  trackHeroUsed(heroId: string): void {
    this.trackEvent("hero_used", {
      hero: heroId,
    });
  }

  /**
   * Track enemy kills by type
   */
  trackEnemyKill(enemyType: string): void {
    this.trackEvent("enemy_kill", {
      type: enemyType,
    });
  }

  /**
   * Track currency earned
   */
  trackCurrencyEarned(type: "gold" | "gems" | "scrolls", amount: number): void {
    this.trackEvent("currency_earned", {
      type,
      amount,
    });
  }

  /**
   * Track a generic custom event
   */
  track(eventName: string, metadata?: Record<string, unknown>): void {
    this.trackEvent(eventName, metadata);
  }
}

// Export singleton
export const analytics = AnalyticsManager.instance;
