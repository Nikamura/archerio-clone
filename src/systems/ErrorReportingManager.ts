/* eslint-disable no-undef */
/**
 * ErrorReportingManager - Remote error tracking with Sentry
 *
 * Features:
 * - Automatic capture of unhandled errors and promise rejections
 * - Console.warn and console.error automatically sent to Sentry
 * - Game context (current scene, player stats, chapter/room)
 * - Breadcrumbs for debugging (scene transitions, level ups, etc.)
 * - Device info and session duration tracking
 *
 * Note: Sentry metrics API was removed in v9. Analytics events are now
 * tracked via SimpleAnalytics in AnalyticsManager.ts.
 *
 * To override the DSN, set VITE_SENTRY_DSN environment variable.
 */

import * as Sentry from "@sentry/browser";
import { analytics } from "./AnalyticsManager";

// Game context for error reports
interface GameContext {
  currentScene?: string;
  chapter?: number;
  room?: number;
  playerLevel?: number;
  playerHealth?: number;
  heroId?: string;
  sessionDuration?: number;
}

class ErrorReportingManager {
  private static _instance: ErrorReportingManager;
  private initialized = false;
  private gameContext: GameContext = {};
  private sessionStart: number = Date.now();

  static get instance(): ErrorReportingManager {
    if (!ErrorReportingManager._instance) {
      ErrorReportingManager._instance = new ErrorReportingManager();
    }
    return ErrorReportingManager._instance;
  }

  private constructor() {
    this.init();
  }

  private init(): void {
    // Use configured DSN or fall back to environment variable
    const dsn =
      (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
      "https://d502f4929eac926a86ecbd32b31c112a@o315779.ingest.us.sentry.io/4510640322248704";

    try {
      Sentry.init({
        dsn,
        environment: import.meta.env.MODE, // 'development' or 'production'
        release: (import.meta.env.VITE_APP_VERSION as string) || "0.1.0",

        // Adjust sample rate based on your traffic
        // 1.0 = 100% of errors, 0.1 = 10% of errors
        sampleRate: 1.0,

        // Capture console.warn and console.error as Sentry events
        integrations: [Sentry.captureConsoleIntegration({ levels: ["warn", "error"] })],

        // Filter out noise
        ignoreErrors: [
          // Browser extensions
          /^Script error\.?$/,
          /^ResizeObserver loop/,
          // Network errors (usually user's connection)
          /^NetworkError/,
          /^Failed to fetch/,
          /^Load failed/,
        ],

        // Add game context to every error
        beforeSend: (event) => {
          // Add game-specific context
          event.contexts = {
            ...event.contexts,
            game: {
              ...this.gameContext,
              sessionDuration: Math.floor((Date.now() - this.sessionStart) / 1000),
            },
          };

          // Add device info for mobile debugging
          event.tags = {
            ...event.tags,
            isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
            screenSize: `${window.innerWidth}x${window.innerHeight}`,
          };

          return event;
        },
      });

      this.initialized = true;
      console.log("[ErrorReporting] Sentry initialized successfully");
    } catch (error) {
      console.error("[ErrorReporting] Failed to initialize Sentry:", error);
    }
  }

  /**
   * Update game context that gets attached to error reports
   */
  setContext(context: Partial<GameContext>): void {
    this.gameContext = { ...this.gameContext, ...context };

    if (this.initialized) {
      // Convert to plain object for Sentry
      Sentry.setContext("game", { ...this.gameContext });
    }
  }

  /**
   * Set current scene name for error context
   */
  setScene(sceneName: string): void {
    this.setContext({ currentScene: sceneName });
    this.addBreadcrumb("navigation", `Scene: ${sceneName}`);
  }

  /**
   * Set chapter/room progress
   */
  setProgress(chapter: number, room: number): void {
    this.setContext({ chapter, room });
  }

  /**
   * Set player stats for debugging
   */
  setPlayerStats(level: number, health: number, heroId?: string): void {
    this.setContext({ playerLevel: level, playerHealth: health, heroId });
  }

  /**
   * Add a breadcrumb for debugging context
   * Breadcrumbs show what happened before an error
   */
  addBreadcrumb(
    category: "navigation" | "game" | "user" | "system",
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (!this.initialized) return;

    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level: "info",
    });
  }

  /**
   * Manually capture an error
   */
  captureError(error: Error, context?: Record<string, unknown>): void {
    if (!this.initialized) {
      console.error("[ErrorReporting] Not initialized:", error);
      return;
    }

    Sentry.captureException(error, { extra: context });
  }

  /**
   * Capture a message/warning (non-error)
   */
  captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
    if (!this.initialized) {
      console.log("[ErrorReporting] Not initialized:", message);
      return;
    }

    Sentry.captureMessage(message, level);
  }

  /**
   * Set user ID for tracking (optional - for analytics)
   * Note: Only use anonymous IDs for privacy
   */
  setUser(userId: string): void {
    if (!this.initialized) return;

    Sentry.setUser({ id: userId });
  }

  /**
   * Clear user on logout
   */
  clearUser(): void {
    if (!this.initialized) return;

    Sentry.setUser(null);
  }

  /**
   * Check if error reporting is enabled
   */
  isEnabled(): boolean {
    return this.initialized;
  }

  // ============================================
  // Analytics Tracking (delegated to AnalyticsManager)
  // ============================================
  // Note: These methods delegate to SimpleAnalytics via AnalyticsManager.
  // Sentry metrics API was removed in SDK v9.

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
    analytics.trackRunCompleted(data);

    this.addBreadcrumb("game", "Run completed", {
      score: data.score,
      victory: data.isVictory,
      playTimeMs: data.playTimeMs,
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
    analytics.trackNewHighScore(score, previousScore, mode);

    this.addBreadcrumb("game", "New high score!", {
      newScore: score,
      previousScore,
      improvement: score - previousScore,
    });
  }

  /**
   * Track a level up event
   */
  trackLevelUp(playerLevel: number, abilityChosen?: string): void {
    analytics.trackLevelUp(playerLevel, abilityChosen);
  }

  /**
   * Track a boss kill
   */
  trackBossKill(bossId: string, timeToKillMs: number, chapterId: number): void {
    analytics.trackBossKill(bossId, timeToKillMs, chapterId);
  }

  /**
   * Track ability acquisition
   */
  trackAbilityAcquired(abilityId: string, level: number): void {
    analytics.trackAbilityAcquired(abilityId, level);
  }

  /**
   * Track game start
   */
  trackGameStart(
    mode: "normal" | "endless" | "daily",
    chapterId: number,
    difficulty: string,
  ): void {
    analytics.trackGameStart(mode, chapterId, difficulty);
  }

  /**
   * Track hero usage
   */
  trackHeroUsed(heroId: string): void {
    analytics.trackHeroUsed(heroId);
  }

  /**
   * Track enemy kills by type
   */
  trackEnemyKill(enemyType: string): void {
    analytics.trackEnemyKill(enemyType);
  }

  /**
   * Track currency earned
   */
  trackCurrencyEarned(type: "gold" | "gems" | "scrolls", amount: number): void {
    analytics.trackCurrencyEarned(type, amount);
  }

  /**
   * Track a custom metric (generic counter)
   */
  trackMetric(name: string, value: number = 1, attributes?: Record<string, string>): void {
    analytics.track(name, { value, ...attributes });
  }

  /**
   * Track a gauge metric (point-in-time value)
   */
  trackGauge(name: string, value: number, attributes?: Record<string, string>): void {
    analytics.track(name, { value, ...attributes });
  }

  /**
   * Track a distribution metric (for histograms/percentiles)
   */
  trackDistribution(
    name: string,
    value: number,
    attributes?: Record<string, string>,
    _unit?: string,
  ): void {
    analytics.track(name, { value, ...attributes });
  }
}

// Export singleton
export const errorReporting = ErrorReportingManager.instance;
