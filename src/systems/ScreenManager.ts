/**
 * ScreenManager - Handles responsive screen sizing for any device
 *
 * Uses "Extended Game World" approach:
 * - Core gameplay area is always 375x667 (portrait)
 * - Extended margins fill extra screen space on different aspect ratios
 * - Physics bounds are set to core area only (preserves game balance)
 * - Background and camera fill the entire screen
 */

// Base game dimensions (core gameplay area)
export const BASE_WIDTH = 375;
export const BASE_HEIGHT = 667;
const BASE_ASPECT_RATIO = BASE_WIDTH / BASE_HEIGHT;

export interface CoreArea {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface GameArea {
  /** Full screen width */
  width: number;
  /** Full screen height */
  height: number;
  /** The core gameplay area (375x667) centered on screen */
  core: CoreArea;
}

class ScreenManager {
  private static instance: ScreenManager;
  private currentArea: GameArea | null = null;

  private constructor() {}

  static getInstance(): ScreenManager {
    if (!ScreenManager.instance) {
      ScreenManager.instance = new ScreenManager();
    }
    return ScreenManager.instance;
  }

  /**
   * Calculate game area based on actual screen dimensions
   * Call this when the game starts or on resize
   */
  calculateGameArea(screenWidth: number, screenHeight: number): GameArea {
    const screenAspect = screenWidth / screenHeight;

    let gameWidth: number;
    let gameHeight: number;
    let offsetX: number;
    let offsetY: number;

    if (screenAspect > BASE_ASPECT_RATIO) {
      // Screen is wider than 375:667 - extend horizontally
      // Scale height to match base, then calculate width
      gameHeight = BASE_HEIGHT;
      gameWidth = Math.floor(BASE_HEIGHT * screenAspect);
      offsetX = (gameWidth - BASE_WIDTH) / 2;
      offsetY = 0;
    } else {
      // Screen is taller than 375:667 - extend vertically
      // Scale width to match base, then calculate height
      gameWidth = BASE_WIDTH;
      gameHeight = Math.floor(BASE_WIDTH / screenAspect);
      offsetX = 0;
      offsetY = (gameHeight - BASE_HEIGHT) / 2;
    }

    const core: CoreArea = {
      x: offsetX,
      y: offsetY,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      centerX: offsetX + BASE_WIDTH / 2,
      centerY: offsetY + BASE_HEIGHT / 2,
      left: offsetX,
      right: offsetX + BASE_WIDTH,
      top: offsetY,
      bottom: offsetY + BASE_HEIGHT,
    };

    this.currentArea = {
      width: gameWidth,
      height: gameHeight,
      core,
    };

    return this.currentArea;
  }

  /**
   * Get the current game area (call calculateGameArea first)
   */
  getGameArea(): GameArea {
    if (!this.currentArea) {
      throw new Error("ScreenManager: Call calculateGameArea before getGameArea");
    }
    return this.currentArea;
  }

  /**
   * Check if the game area has been calculated
   */
  hasCalculated(): boolean {
    return this.currentArea !== null;
  }

  /**
   * Get scale factor from screen pixels to game units
   * Used for positioning UI elements that need to be in screen space
   */
  getScaleFactor(screenWidth: number, screenHeight: number): number {
    const screenAspect = screenWidth / screenHeight;
    if (screenAspect > BASE_ASPECT_RATIO) {
      // Width-limited
      return screenHeight / BASE_HEIGHT;
    } else {
      // Height-limited
      return screenWidth / BASE_WIDTH;
    }
  }
}

export const screenManager = ScreenManager.getInstance();
