import Phaser from "phaser";

/**
 * Performance metrics tracked by the monitor
 */
export interface PerformanceMetrics {
  fps: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  frameTime: number;
  avgFrameTime: number;
  entityCount: number;
  bulletCount: number;
  enemyCount: number;
  particleCount: number;
  drawCalls: number;
  heapSize: number | null; // MB, null if not available
}

/**
 * Configuration for the performance monitor
 */
export interface PerformanceMonitorConfig {
  sampleSize: number; // Number of frames to average
  warnThreshold: number; // FPS below this triggers warning
  criticalThreshold: number; // FPS below this triggers critical warning
  showOnScreen: boolean; // Display overlay on screen
  logInterval: number; // How often to log to console (ms), 0 to disable
}

const DEFAULT_CONFIG: PerformanceMonitorConfig = {
  sampleSize: 60,
  warnThreshold: 45,
  criticalThreshold: 30,
  showOnScreen: false,
  logInterval: 0,
};

/**
 * PerformanceMonitor - Singleton system for tracking game performance metrics
 *
 * Tracks FPS, frame time, entity counts, and memory usage.
 * Provides warnings when performance drops below thresholds.
 * Can display an on-screen overlay for development.
 */
export class PerformanceMonitor {
  private static _instance: PerformanceMonitor | null = null;

  private config: PerformanceMonitorConfig;
  private enabled: boolean = true;

  // Frame time tracking
  private frameTimes: number[] = [];
  private lastFrameTime: number = 0;
  private minFps: number = Infinity;
  private maxFps: number = 0;

  // Entity counts (updated each frame)
  private _entityCount: number = 0;
  private _bulletCount: number = 0;
  private _enemyCount: number = 0;
  private _particleCount: number = 0;
  private _drawCalls: number = 0;

  // Logging
  private lastLogTime: number = 0;

  // On-screen display
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayText: Phaser.GameObjects.Text | null = null;

  // Performance warning callbacks
  private onWarning: ((metrics: PerformanceMetrics) => void) | null = null;
  private onCritical: ((metrics: PerformanceMetrics) => void) | null = null;

  private constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  static get instance(): PerformanceMonitor {
    if (!PerformanceMonitor._instance) {
      PerformanceMonitor._instance = new PerformanceMonitor();
    }
    return PerformanceMonitor._instance;
  }

  /**
   * Initialize with custom configuration
   */
  static initialize(config: Partial<PerformanceMonitorConfig> = {}): PerformanceMonitor {
    if (!PerformanceMonitor._instance) {
      PerformanceMonitor._instance = new PerformanceMonitor(config);
    } else {
      PerformanceMonitor._instance.config = {
        ...PerformanceMonitor._instance.config,
        ...config,
      };
    }
    return PerformanceMonitor._instance;
  }

  /**
   * Reset the singleton (useful for testing)
   */
  static reset(): void {
    if (PerformanceMonitor._instance) {
      PerformanceMonitor._instance.destroy();
      PerformanceMonitor._instance = null;
    }
  }

  /**
   * Enable or disable the performance monitor
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled && this.overlay) {
      this.overlay.setVisible(false);
    }
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set performance warning callbacks
   */
  setWarningCallbacks(
    onWarning: (metrics: PerformanceMetrics) => void,
    onCritical: (metrics: PerformanceMetrics) => void,
  ): void {
    this.onWarning = onWarning;
    this.onCritical = onCritical;
  }

  /**
   * Update entity counts - call this each frame from GameScene
   */
  updateEntityCounts(
    enemies: number,
    bullets: number,
    particles: number = 0,
    drawCalls: number = 0,
  ): void {
    this._enemyCount = enemies;
    this._bulletCount = bullets;
    this._particleCount = particles;
    this._drawCalls = drawCalls;
    this._entityCount = enemies + bullets + particles;
  }

  /**
   * Main update method - call this each frame
   * @param delta Delta time in ms
   */
  update(delta: number): void {
    if (!this.enabled) return;

    // Track frame time
    this.frameTimes.push(delta);
    if (this.frameTimes.length > this.config.sampleSize) {
      this.frameTimes.shift();
    }

    // Calculate FPS
    const fps = delta > 0 ? 1000 / delta : 60;
    this.minFps = Math.min(this.minFps, fps);
    this.maxFps = Math.max(this.maxFps, fps);

    // Check thresholds
    const avgFps = this.getAverageFps();
    if (avgFps < this.config.criticalThreshold && this.onCritical) {
      this.onCritical(this.getMetrics());
    } else if (avgFps < this.config.warnThreshold && this.onWarning) {
      this.onWarning(this.getMetrics());
    }

    // Log periodically
    const now = globalThis.performance.now();
    if (this.config.logInterval > 0 && now - this.lastLogTime > this.config.logInterval) {
      this.logMetrics();
      this.lastLogTime = now;
    }

    // Update on-screen display
    if (this.config.showOnScreen && this.overlayText) {
      this.updateOverlay();
    }

    this.lastFrameTime = delta;
  }

  /**
   * Get current FPS (based on last frame)
   */
  getCurrentFps(): number {
    return this.lastFrameTime > 0 ? 1000 / this.lastFrameTime : 60;
  }

  /**
   * Get average FPS over sample window
   */
  getAverageFps(): number {
    if (this.frameTimes.length === 0) return 60;
    const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
  }

  /**
   * Get average frame time in ms
   */
  getAverageFrameTime(): number {
    if (this.frameTimes.length === 0) return 16.67;
    return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
  }

  /**
   * Get heap size in MB (if available)
   */
  getHeapSize(): number | null {
    // Check for Chrome-specific memory API (non-standard but available in Chrome)
    interface PerformanceWithMemory {
      memory?: { usedJSHeapSize: number };
    }
    const perf = globalThis.performance as PerformanceWithMemory;
    if (perf?.memory?.usedJSHeapSize) {
      return Math.round(perf.memory.usedJSHeapSize / 1024 / 1024);
    }
    return null;
  }

  /**
   * Get all performance metrics
   */
  getMetrics(): PerformanceMetrics {
    return {
      fps: Math.round(this.getCurrentFps()),
      avgFps: Math.round(this.getAverageFps()),
      minFps: Math.round(this.minFps === Infinity ? 60 : this.minFps),
      maxFps: Math.round(this.maxFps === 0 ? 60 : this.maxFps),
      frameTime: this.lastFrameTime,
      avgFrameTime: this.getAverageFrameTime(),
      entityCount: this._entityCount,
      bulletCount: this._bulletCount,
      enemyCount: this._enemyCount,
      particleCount: this._particleCount,
      drawCalls: this._drawCalls,
      heapSize: this.getHeapSize(),
    };
  }

  /**
   * Reset min/max FPS tracking
   */
  resetMinMax(): void {
    this.minFps = Infinity;
    this.maxFps = 0;
  }

  /**
   * Log current metrics to console
   */
  logMetrics(): void {
    const metrics = this.getMetrics();
    const heapStr = metrics.heapSize !== null ? ` | Heap: ${metrics.heapSize}MB` : "";
    console.log(
      `[Perf] FPS: ${metrics.avgFps} (${metrics.minFps}-${metrics.maxFps}) | ` +
        `Entities: ${metrics.entityCount} (E:${metrics.enemyCount} B:${metrics.bulletCount} P:${metrics.particleCount})` +
        heapStr,
    );
  }

  /**
   * Create on-screen overlay for performance display
   */
  createOverlay(scene: Phaser.Scene): void {
    if (this.overlay) {
      this.destroyOverlay();
    }

    // Create container for all overlay elements
    this.overlay = scene.add.container(5, 60);
    this.overlay.setDepth(1000);
    this.overlay.setScrollFactor(0);

    // Background
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(0, 0, 140, 85);
    this.overlay.add(bg);

    // Performance text
    this.overlayText = scene.add.text(5, 5, "", {
      fontSize: "10px",
      color: "#00ff00",
      fontFamily: "monospace",
      lineSpacing: 2,
    });
    this.overlay.add(this.overlayText);

    this.config.showOnScreen = true;
  }

  /**
   * Update on-screen overlay text
   */
  private updateOverlay(): void {
    if (!this.overlayText) return;

    const metrics = this.getMetrics();
    const color =
      metrics.avgFps < this.config.criticalThreshold
        ? "#ff0000"
        : metrics.avgFps < this.config.warnThreshold
          ? "#ffaa00"
          : "#00ff00";

    this.overlayText.setColor(color);
    this.overlayText.setText(
      [
        `FPS: ${metrics.avgFps} (${metrics.minFps}-${metrics.maxFps})`,
        `Frame: ${metrics.avgFrameTime.toFixed(1)}ms`,
        `Entities: ${metrics.entityCount}`,
        `  Enemies: ${metrics.enemyCount}`,
        `  Bullets: ${metrics.bulletCount}`,
        metrics.heapSize !== null ? `Heap: ${metrics.heapSize}MB` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  /**
   * Destroy on-screen overlay
   */
  destroyOverlay(): void {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
      this.overlayText = null;
    }
    this.config.showOnScreen = false;
  }

  /**
   * Toggle on-screen overlay visibility
   */
  toggleOverlay(scene?: Phaser.Scene): void {
    if (this.overlay) {
      this.destroyOverlay();
    } else if (scene) {
      this.createOverlay(scene);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.destroyOverlay();
    this.frameTimes = [];
    this.onWarning = null;
    this.onCritical = null;
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.instance;

// Export factory function for initialization
export function createPerformanceMonitor(
  config: Partial<PerformanceMonitorConfig> = {},
): PerformanceMonitor {
  return PerformanceMonitor.initialize(config);
}
