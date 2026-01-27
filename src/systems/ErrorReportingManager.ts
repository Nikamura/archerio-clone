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
 * - Metrics tracking via Sentry metrics API (v10.25+)
 *
 * To override the DSN, set VITE_SENTRY_DSN environment variable.
 */

import * as Sentry from "@sentry/browser";

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
  // Metrics Tracking (Sentry v10.25+)
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
    if (!this.initialized) return;

    const mode = data.isEndlessMode ? "endless" : data.isDailyChallenge ? "daily" : "normal";

    // Count the run
    Sentry.metrics.count("run_completed", 1, {
      attributes: {
        victory: String(data.isVictory),
        mode,
        difficulty: data.difficulty ?? "normal",
        chapter: String(data.chapterId ?? 1),
      },
    });

    // Track run duration as a distribution
    Sentry.metrics.distribution("run_duration_seconds", Math.floor(data.playTimeMs / 1000), {
      unit: "second",
      attributes: {
        victory: String(data.isVictory),
        mode,
      },
    });

    // Track score as a distribution
    Sentry.metrics.distribution("run_score", data.score, {
      attributes: {
        victory: String(data.isVictory),
        mode,
      },
    });

    // Track rooms cleared
    Sentry.metrics.distribution("rooms_cleared", data.roomsCleared, {
      attributes: {
        victory: String(data.isVictory),
        chapter: String(data.chapterId ?? 1),
      },
    });

    // Track enemies killed
    Sentry.metrics.distribution("enemies_killed", data.enemiesKilled, {
      attributes: { chapter: String(data.chapterId ?? 1) },
    });

    // Track endless wave as gauge for high scores
    if (data.isEndlessMode && data.endlessWave !== undefined) {
      Sentry.metrics.gauge("endless_wave_reached", data.endlessWave);
    }

    // Track abilities gained
    if (data.abilitiesGained !== undefined) {
      Sentry.metrics.distribution("abilities_per_run", data.abilitiesGained);
    }

    this.addBreadcrumb("game", "Run completed", {
      score: data.score,
      victory: data.isVictory,
      playTimeMs: data.playTimeMs,
    });
  }

  /**
   * Track when a new high score is achieved
   * For endless mode, this tracks wave reached (not score)
   */
  trackNewHighScore(
    value: number,
    previousValue: number,
    mode: "normal" | "endless" = "normal",
  ): void {
    if (!this.initialized) return;

    Sentry.metrics.count("new_high_score", 1, {
      attributes: { mode },
    });

    // Use different metric names for clarity
    if (mode === "endless") {
      Sentry.metrics.gauge("endless_high_wave", value);
      this.addBreadcrumb("game", "New endless high wave!", {
        newWave: value,
        previousWave: previousValue,
        improvement: value - previousValue,
      });
    } else {
      Sentry.metrics.gauge("high_score", value);
      this.addBreadcrumb("game", "New high score!", {
        newScore: value,
        previousScore: previousValue,
        improvement: value - previousValue,
      });
    }
  }

  /**
   * Track a level up event
   */
  trackLevelUp(playerLevel: number, abilityChosen?: string): void {
    if (!this.initialized) return;

    Sentry.metrics.count("level_up", 1, {
      attributes: {
        level: String(playerLevel),
        ability: abilityChosen ?? "unknown",
      },
    });
  }

  /**
   * Track a boss kill
   */
  trackBossKill(bossId: string, timeToKillMs: number, chapterId: number): void {
    if (!this.initialized) return;

    Sentry.metrics.count("boss_kill", 1, {
      attributes: {
        boss: bossId,
        chapter: String(chapterId),
      },
    });

    Sentry.metrics.distribution("boss_kill_time_seconds", Math.floor(timeToKillMs / 1000), {
      unit: "second",
      attributes: { boss: bossId },
    });
  }

  /**
   * Track ability acquisition
   */
  trackAbilityAcquired(abilityId: string, level: number): void {
    if (!this.initialized) return;

    Sentry.metrics.count("ability_acquired", 1, {
      attributes: {
        ability: abilityId,
        level: String(level),
      },
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
    if (!this.initialized) return;

    Sentry.metrics.count("game_start", 1, {
      attributes: {
        mode,
        chapter: String(chapterId),
        difficulty,
      },
    });
  }

  /**
   * Track hero usage
   */
  trackHeroUsed(heroId: string): void {
    if (!this.initialized) return;

    Sentry.metrics.count("hero_usage", 1, {
      attributes: { hero: heroId },
    });
  }

  // NOTE: trackEnemyKill removed - per-enemy events were too noisy.
  // Aggregate enemy kills are tracked in trackRunCompleted() instead.

  /**
   * Track currency earned
   */
  trackCurrencyEarned(type: "gold" | "gems" | "scrolls", amount: number): void {
    if (!this.initialized) return;

    Sentry.metrics.count("currency_earned", amount, {
      attributes: { type },
    });
  }

  /**
   * Track a custom metric (generic counter)
   */
  trackMetric(name: string, value: number = 1, attributes?: Record<string, string>): void {
    if (!this.initialized) return;

    Sentry.metrics.count(name, value, { attributes });
  }

  /**
   * Track a gauge metric (point-in-time value)
   */
  trackGauge(name: string, value: number, attributes?: Record<string, string>): void {
    if (!this.initialized) return;

    Sentry.metrics.gauge(name, value, { attributes });
  }

  /**
   * Track a distribution metric (for histograms/percentiles)
   */
  trackDistribution(
    name: string,
    value: number,
    attributes?: Record<string, string>,
    unit?: string,
  ): void {
    if (!this.initialized) return;

    Sentry.metrics.distribution(name, value, { attributes, unit });
  }
}

// Export singleton
export const errorReporting = ErrorReportingManager.instance;
