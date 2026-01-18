/**
 * Asset size configurations for different asset types
 * Gemini generates 1024x1024 minimum - we downscale to target sizes
 */

export interface SizeConfig {
  targetSize: number;
  /** Interpolation method: 'nearest' for pixel art, 'lanczos' for smooth images */
  interpolation: "nearest" | "lanczos";
  /** Description of what this size is used for */
  description: string;
}

export const SIZE_CONFIGS: Record<string, SizeConfig> = {
  player: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Hero characters",
  },
  enemy: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Standard enemies",
  },
  boss: {
    targetSize: 128,
    interpolation: "nearest",
    description: "Boss enemies",
  },
  projectile: {
    targetSize: 32,
    interpolation: "nearest",
    description: "Bullets, arrows, spells",
  },
  item: {
    targetSize: 32,
    interpolation: "nearest",
    description: "Collectibles, pickups",
  },
  effect: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Visual effects, particles",
  },
  ui: {
    targetSize: 48,
    interpolation: "nearest",
    description: "Interface icons",
  },
  generic: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Other game assets",
  },
  abilities: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Ability icons",
  },
  chest: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Chest sprites",
  },
  door: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Door sprites",
  },
  equipment: {
    targetSize: 64,
    interpolation: "nearest",
    description: "Equipment icons",
  },
} as const;

// Background dimensions (portrait mode game)
export const BACKGROUND_CONFIG = {
  width: 375,
  height: 667,
  interpolation: "lanczos" as const,
  description: "Game backgrounds (portrait)",
};

export type SpriteType = keyof typeof SIZE_CONFIGS;

/**
 * Get size configuration for a sprite type
 */
export function getSizeConfig(type: string): SizeConfig {
  return SIZE_CONFIGS[type] || SIZE_CONFIGS.generic;
}

/**
 * Get target size for a sprite type
 */
export function getTargetSize(type: string): number {
  return getSizeConfig(type).targetSize;
}

/**
 * Check if a type uses nearest-neighbor interpolation (pixel art)
 */
export function usesNearestInterpolation(type: string): boolean {
  return getSizeConfig(type).interpolation === "nearest";
}

/**
 * List all valid sprite types
 */
export function getValidSpriteTypes(): string[] {
  return Object.keys(SIZE_CONFIGS);
}
