/**
 * Background Animation Configuration Data
 *
 * Defines subtle animated backgrounds for each chapter to add atmosphere
 * without causing motion sickness. All effects are intentionally slow and subtle.
 */

import type { ThemeId } from './themeData'

/**
 * Particle direction types
 */
export type ParticleDirection = 'up' | 'down' | 'drift'

/**
 * Particle configuration for floating background effects
 */
export interface ParticleConfig {
  enabled: boolean
  texture: string // Asset key for particle texture
  tint: {
    medieval: number[] // Tint colors for medieval theme
    vaporwave: number[] // Tint colors for vaporwave theme
  }
  count: {
    low: number // Particle count at LOW quality (disabled)
    medium: number // Particle count at MEDIUM quality
    high: number // Particle count at HIGH quality
  }
  speed: { min: number; max: number } // Very slow: 3-20 px/sec
  alpha: { start: number; end: number }
  scale: { start: number; end: number }
  lifespan: number // Long: 8000-15000ms
  direction: ParticleDirection
}

/**
 * Color shift configuration for ambient background tinting
 */
export interface ColorShiftConfig {
  enabled: boolean
  colors: {
    medieval: number[] // Color cycle for medieval theme
    vaporwave: number[] // Color cycle for vaporwave theme
  }
  duration: number // Time per color transition (6000-15000ms)
  intensity: number // Tint strength 0.0-0.3 (subtle)
}

/**
 * Complete animation configuration for a chapter
 */
export interface ChapterAnimationConfig {
  chapterId: number
  name: string
  particles: ParticleConfig
  colorShift: ColorShiftConfig
}

/**
 * Animation configurations for all chapters
 */
export const CHAPTER_ANIMATION_CONFIGS: ChapterAnimationConfig[] = [
  // Chapter 1 - Dark Dungeon
  {
    chapterId: 1,
    name: 'Dark Dungeon',
    particles: {
      enabled: true,
      texture: 'bg_dust',
      tint: {
        medieval: [0x888888, 0x666666, 0xaaaaaa],
        vaporwave: [0x00ffff, 0xff00ff, 0x9999ff],
      },
      count: { low: 0, medium: 8, high: 20 },
      speed: { min: 3, max: 8 },
      alpha: { start: 0.6, end: 0 },
      scale: { start: 0.3, end: 0.1 },
      lifespan: 12000,
      direction: 'drift',
    },
    colorShift: {
      enabled: true,
      colors: {
        medieval: [0xffffff, 0xffeecc, 0xffdda0, 0xffffff], // Torch flicker
        vaporwave: [0xffffff, 0xccffff, 0xffccff, 0xffffff], // Neon pulse
      },
      duration: 10000,
      intensity: 0.15,
    },
  },

  // Chapter 2 - Forest Ruins
  {
    chapterId: 2,
    name: 'Forest Ruins',
    particles: {
      enabled: true,
      texture: 'bg_pollen',
      tint: {
        medieval: [0x99ff66, 0xffff99, 0xffffff],
        vaporwave: [0x00ffcc, 0x66ff99, 0xccffff],
      },
      count: { low: 0, medium: 10, high: 25 },
      speed: { min: 2, max: 6 },
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.25, end: 0.1 },
      lifespan: 15000,
      direction: 'drift',
    },
    colorShift: {
      enabled: false, // Forest keeps natural colors
      colors: {
        medieval: [0xffffff],
        vaporwave: [0xffffff, 0xccffee, 0xffffff],
      },
      duration: 12000,
      intensity: 0.08,
    },
  },

  // Chapter 3 - Frozen Caves
  {
    chapterId: 3,
    name: 'Frozen Caves',
    particles: {
      enabled: true,
      texture: 'bg_snowflake',
      tint: {
        medieval: [0xffffff, 0xccddff, 0xeeeeff],
        vaporwave: [0x66ffff, 0xffffff, 0xccffff],
      },
      count: { low: 0, medium: 12, high: 30 },
      speed: { min: 5, max: 15 },
      alpha: { start: 0.8, end: 0 },
      scale: { start: 0.2, end: 0.05 },
      lifespan: 10000,
      direction: 'down',
    },
    colorShift: {
      enabled: true,
      colors: {
        medieval: [0xffffff, 0xccddff, 0xaaccff, 0xffffff], // Crystalline shimmer
        vaporwave: [0xffffff, 0xccffff, 0x99eeff, 0xffffff], // Cyan pulse
      },
      duration: 8000,
      intensity: 0.12,
    },
  },

  // Chapter 4 - Volcanic Depths
  {
    chapterId: 4,
    name: 'Volcanic Depths',
    particles: {
      enabled: true,
      texture: 'bg_ember',
      tint: {
        medieval: [0xff4400, 0xff6600, 0xffaa00],
        vaporwave: [0xff0066, 0xff00ff, 0xff6699],
      },
      count: { low: 0, medium: 10, high: 25 },
      speed: { min: 8, max: 20 },
      alpha: { start: 0.9, end: 0 },
      scale: { start: 0.2, end: 0.05 },
      lifespan: 8000,
      direction: 'up',
    },
    colorShift: {
      enabled: true,
      colors: {
        medieval: [0xffffff, 0xffccaa, 0xff9966, 0xffddbb, 0xffffff], // Lava glow
        vaporwave: [0xffffff, 0xffccff, 0xff99cc, 0xffffff], // Pink heat
      },
      duration: 6000,
      intensity: 0.2,
    },
  },

  // Chapter 5 - Shadow Realm
  {
    chapterId: 5,
    name: 'Shadow Realm',
    particles: {
      enabled: true,
      texture: 'bg_shadow',
      tint: {
        medieval: [0x6600cc, 0x9933ff, 0x330066],
        vaporwave: [0x9900ff, 0xff00ff, 0x6600ff],
      },
      count: { low: 0, medium: 8, high: 20 },
      speed: { min: 4, max: 10 },
      alpha: { start: 0.7, end: 0 },
      scale: { start: 0.35, end: 0.1 },
      lifespan: 10000,
      direction: 'drift',
    },
    colorShift: {
      enabled: true,
      colors: {
        medieval: [0xffffff, 0xddccff, 0xcc99ff, 0xeeddff, 0xffffff], // Purple energy
        vaporwave: [0xffffff, 0xffccff, 0xcc99ff, 0x99ccff, 0xffffff], // Neon void
      },
      duration: 12000,
      intensity: 0.18,
    },
  },
]

/**
 * Get animation configuration for a specific chapter
 */
export function getChapterAnimationConfig(chapterId: number): ChapterAnimationConfig | undefined {
  return CHAPTER_ANIMATION_CONFIGS.find((config) => config.chapterId === chapterId)
}

/**
 * Get particle tint colors based on theme
 */
export function getParticleTints(config: ParticleConfig, themeId: ThemeId): number[] {
  return themeId === 'vaporwave' ? config.tint.vaporwave : config.tint.medieval
}

/**
 * Get color shift colors based on theme
 */
export function getColorShiftColors(config: ColorShiftConfig, themeId: ThemeId): number[] {
  return themeId === 'vaporwave' ? config.colors.vaporwave : config.colors.medieval
}

/**
 * Get particle count based on quality level
 */
export function getParticleCount(
  config: ParticleConfig,
  quality: 'low' | 'medium' | 'high'
): number {
  return config.count[quality]
}
