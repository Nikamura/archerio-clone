/**
 * Background Animation Configuration Data
 *
 * Defines subtle animated backgrounds for each chapter to add atmosphere
 * without causing motion sickness. All effects are intentionally slow and subtle.
 */

/**
 * Particle direction types
 */
export type ParticleDirection = "up" | "down" | "drift";

/**
 * Particle configuration for floating background effects
 */
export interface ParticleConfig {
  enabled: boolean;
  texture: string; // Asset key for particle texture
  tint: number[]; // Tint colors for particles
  count: {
    low: number; // Particle count at LOW quality (disabled)
    medium: number; // Particle count at MEDIUM quality
    high: number; // Particle count at HIGH quality
  };
  speed: { min: number; max: number }; // Very slow: 3-20 px/sec
  alpha: { start: number; end: number };
  scale: { start: number; end: number };
  lifespan: number; // Long: 8000-15000ms
  direction: ParticleDirection;
}

/**
 * Color shift configuration for ambient background tinting
 */
export interface ColorShiftConfig {
  enabled: boolean;
  colors: number[]; // Color cycle for transitions
  duration: number; // Time per color transition (6000-15000ms)
  intensity: number; // Tint strength 0.0-0.3 (subtle)
}

/**
 * Complete animation configuration for a chapter
 */
export interface ChapterAnimationConfig {
  chapterId: number;
  name: string;
  particles: ParticleConfig;
  colorShift: ColorShiftConfig;
}

/**
 * Animation configurations for all chapters
 */
export const CHAPTER_ANIMATION_CONFIGS: ChapterAnimationConfig[] = [
  // Chapter 1 - Dark Dungeon
  {
    chapterId: 1,
    name: "Dark Dungeon",
    particles: {
      enabled: true,
      texture: "bg_dust",
      tint: [0x888888, 0x666666, 0xaaaaaa],
      count: { low: 0, medium: 8, high: 20 },
      speed: { min: 3, max: 8 },
      alpha: { start: 0.6, end: 0 },
      scale: { start: 0.3, end: 0.1 },
      lifespan: 12000,
      direction: "drift",
    },
    colorShift: {
      enabled: true,
      colors: [0xffffff, 0xffeecc, 0xffdda0, 0xffffff], // Torch flicker
      duration: 10000,
      intensity: 0.15,
    },
  },

  // Chapter 2 - Forest Ruins
  {
    chapterId: 2,
    name: "Forest Ruins",
    particles: {
      enabled: true,
      texture: "bg_pollen",
      tint: [0x99ff66, 0xffff99, 0xffffff],
      count: { low: 0, medium: 10, high: 25 },
      speed: { min: 2, max: 6 },
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.25, end: 0.1 },
      lifespan: 15000,
      direction: "drift",
    },
    colorShift: {
      enabled: false, // Forest keeps natural colors
      colors: [0xffffff],
      duration: 12000,
      intensity: 0.08,
    },
  },

  // Chapter 3 - Frozen Caves
  {
    chapterId: 3,
    name: "Frozen Caves",
    particles: {
      enabled: true,
      texture: "bg_snowflake",
      tint: [0xffffff, 0xccddff, 0xeeeeff],
      count: { low: 0, medium: 12, high: 30 },
      speed: { min: 5, max: 15 },
      alpha: { start: 0.8, end: 0 },
      scale: { start: 0.2, end: 0.05 },
      lifespan: 10000,
      direction: "down",
    },
    colorShift: {
      enabled: true,
      colors: [0xffffff, 0xccddff, 0xaaccff, 0xffffff], // Crystalline shimmer
      duration: 8000,
      intensity: 0.12,
    },
  },

  // Chapter 4 - Volcanic Depths
  {
    chapterId: 4,
    name: "Volcanic Depths",
    particles: {
      enabled: true,
      texture: "bg_ember",
      tint: [0xff4400, 0xff6600, 0xffaa00],
      count: { low: 0, medium: 10, high: 25 },
      speed: { min: 8, max: 20 },
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.2, end: 0.05 },
      lifespan: 8000,
      direction: "up",
    },
    colorShift: {
      enabled: true,
      colors: [0xffffff, 0xffccaa, 0xff9966, 0xffddbb, 0xffffff], // Lava glow
      duration: 6000,
      intensity: 0.2,
    },
  },

  // Chapter 5 - Shadow Realm
  {
    chapterId: 5,
    name: "Shadow Realm",
    particles: {
      enabled: true,
      texture: "bg_shadow",
      tint: [0x6600cc, 0x9933ff, 0x330066],
      count: { low: 0, medium: 8, high: 20 },
      speed: { min: 4, max: 10 },
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.35, end: 0.1 },
      lifespan: 10000,
      direction: "drift",
    },
    colorShift: {
      enabled: true,
      colors: [0xffffff, 0xddccff, 0xcc99ff, 0xeeddff, 0xffffff], // Purple energy
      duration: 12000,
      intensity: 0.18,
    },
  },
];

/**
 * Get animation configuration for a specific chapter
 */
export function getChapterAnimationConfig(chapterId: number): ChapterAnimationConfig | undefined {
  return CHAPTER_ANIMATION_CONFIGS.find((config) => config.chapterId === chapterId);
}

/**
 * Get particle tint colors
 */
export function getParticleTints(config: ParticleConfig): number[] {
  return config.tint;
}

/**
 * Get color shift colors
 */
export function getColorShiftColors(config: ColorShiftConfig): number[] {
  return config.colors;
}

/**
 * Get particle count based on quality level
 */
export function getParticleCount(
  config: ParticleConfig,
  quality: "low" | "medium" | "high",
): number {
  return config.count[quality];
}
