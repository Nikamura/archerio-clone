import Phaser from 'phaser'
import { GraphicsQuality } from './SaveManager'
import {
  getChapterAnimationConfig,
  getParticleTints,
  getColorShiftColors,
  getParticleCount,
  type ChapterAnimationConfig,
  type ParticleDirection,
} from '../config/backgroundAnimationData'

/**
 * BackgroundAnimationManager - Manages subtle animated background effects
 *
 * Creates atmospheric background animations including:
 * - Floating particles (dust, pollen, snow, embers, shadow wisps)
 * - Ambient color shifts (torch flicker, lava glow, crystalline shimmer)
 *
 * All effects are intentionally slow and subtle to avoid motion sickness.
 * Respects graphics quality settings: LOW=off, MEDIUM=reduced, HIGH=full
 */
export class BackgroundAnimationManager {
  private scene: Phaser.Scene
  private config: ChapterAnimationConfig | undefined
  private themeId: string = 'medieval'
  private quality: GraphicsQuality = GraphicsQuality.HIGH

  // Particle emitter for floating effects
  private particleEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  // Color shift tween for ambient lighting
  private colorShiftTween: Phaser.Tweens.Tween | null = null
  private backgroundImage: Phaser.GameObjects.Image | null = null
  private currentColorIndex: number = 0

  // State flags
  private particlesEnabled: boolean = true
  private colorShiftEnabled: boolean = true
  private isDestroyed: boolean = false

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Initialize background animations for a specific chapter
   */
  initialize(
    chapterId: number,
    themeId: string,
    quality: GraphicsQuality,
    backgroundImage?: Phaser.GameObjects.Image
  ): void {
    this.config = getChapterAnimationConfig(chapterId)
    this.themeId = themeId
    this.quality = quality
    this.backgroundImage = backgroundImage ?? null

    // Apply quality settings
    this.applyQualitySettings(quality)

    // Create effects if config exists
    if (this.config) {
      this.createFloatingParticles()
      this.createColorShiftEffect()
    }
  }

  /**
   * Apply quality-based animation settings
   */
  private applyQualitySettings(quality: GraphicsQuality): void {
    switch (quality) {
      case GraphicsQuality.LOW:
        this.particlesEnabled = false
        this.colorShiftEnabled = false
        break
      case GraphicsQuality.MEDIUM:
        this.particlesEnabled = true
        this.colorShiftEnabled = true
        break
      case GraphicsQuality.HIGH:
        this.particlesEnabled = true
        this.colorShiftEnabled = true
        break
    }
  }

  /**
   * Update quality settings at runtime
   */
  setQuality(quality: GraphicsQuality): void {
    const oldQuality = this.quality
    this.quality = quality
    this.applyQualitySettings(quality)

    // Recreate effects if quality changed
    if (oldQuality !== quality && this.config) {
      this.destroyEffects()
      this.createFloatingParticles()
      this.createColorShiftEffect()
    }
  }

  /**
   * Create floating particle emitter
   */
  private createFloatingParticles(): void {
    if (!this.config || !this.particlesEnabled || !this.config.particles.enabled) {
      return
    }

    const { particles } = this.config
    const qualityKey = this.quality.toLowerCase() as 'low' | 'medium' | 'high'
    const particleCount = getParticleCount(particles, qualityKey)

    if (particleCount <= 0) {
      return
    }

    // Check if texture exists
    if (!this.scene.textures.exists(particles.texture)) {
      console.warn(`BackgroundAnimationManager: Texture '${particles.texture}' not found`)
      return
    }

    const { width, height } = this.scene.cameras.main
    const tints = getParticleTints(particles, this.themeId)

    // Calculate movement angle based on direction
    const angleConfig = this.getAngleConfig(particles.direction)

    // Create continuous particle emitter
    this.particleEmitter = this.scene.add.particles(0, 0, particles.texture, {
      x: { min: 0, max: width },
      y: this.getSpawnY(particles.direction, height),
      speed: particles.speed,
      scale: particles.scale,
      alpha: particles.alpha,
      lifespan: particles.lifespan,
      angle: angleConfig,
      tint: tints,
      frequency: this.calculateFrequency(particleCount, particles.lifespan),
      blendMode: Phaser.BlendModes.ADD,
      emitting: true,
    })

    // Set depth behind walls but above background
    this.particleEmitter.setDepth(0.3)
  }

  /**
   * Get spawn Y position based on particle direction
   */
  private getSpawnY(direction: ParticleDirection, height: number): number | { min: number; max: number } {
    switch (direction) {
      case 'up':
        return height + 20 // Spawn below screen, rise up
      case 'down':
        return -20 // Spawn above screen, fall down
      case 'drift':
      default:
        return { min: 0, max: height } // Spawn anywhere
    }
  }

  /**
   * Get angle configuration based on direction
   */
  private getAngleConfig(direction: ParticleDirection): { min: number; max: number } {
    switch (direction) {
      case 'up':
        return { min: 250, max: 290 } // Mostly upward with slight drift
      case 'down':
        return { min: 70, max: 110 } // Mostly downward with slight drift
      case 'drift':
      default:
        return { min: 0, max: 360 } // Random directions
    }
  }

  /**
   * Calculate emission frequency to maintain desired particle count
   */
  private calculateFrequency(targetCount: number, lifespan: number): number {
    // We want approximately targetCount particles visible at once
    // frequency = lifespan / targetCount (in ms)
    return Math.max(100, lifespan / targetCount)
  }

  /**
   * Create ambient color shift effect on background
   */
  private createColorShiftEffect(): void {
    if (
      !this.config ||
      !this.colorShiftEnabled ||
      !this.config.colorShift.enabled ||
      !this.backgroundImage
    ) {
      return
    }

    const { colorShift } = this.config
    const colors = getColorShiftColors(colorShift, this.themeId)

    if (colors.length < 2) {
      return
    }

    // Start color cycling
    this.currentColorIndex = 0
    this.cycleToNextColor(colors, colorShift.duration, colorShift.intensity)
  }

  /**
   * Cycle to the next color in the sequence
   */
  private cycleToNextColor(colors: number[], duration: number, intensity: number): void {
    if (this.isDestroyed || !this.backgroundImage || !this.colorShiftEnabled) {
      return
    }

    const currentColor = colors[this.currentColorIndex]
    const nextIndex = (this.currentColorIndex + 1) % colors.length

    // Apply subtle tint using setTint
    // We interpolate the tint color over time
    const targetColor = this.blendColorWithWhite(colors[nextIndex], intensity)

    // Create smooth tween to next color
    this.colorShiftTween = this.scene.tweens.add({
      targets: { value: 0 },
      value: 1,
      duration: duration,
      ease: 'Sine.easeInOut',
      onUpdate: (tween) => {
        if (this.isDestroyed || !this.backgroundImage) return
        const progress = tween.getValue() ?? 0
        const fromColor = this.blendColorWithWhite(currentColor, intensity)
        const toColor = targetColor
        const interpolated = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.IntegerToColor(fromColor),
          Phaser.Display.Color.IntegerToColor(toColor),
          1,
          progress
        )
        const tintColor = Phaser.Display.Color.GetColor(
          interpolated.r,
          interpolated.g,
          interpolated.b
        )
        this.backgroundImage?.setTint(tintColor)
      },
      onComplete: () => {
        this.currentColorIndex = nextIndex
        // Continue cycling to next color
        this.cycleToNextColor(colors, duration, intensity)
      },
    })
  }

  /**
   * Blend a color with white based on intensity
   * Lower intensity = closer to white (more subtle effect)
   */
  private blendColorWithWhite(color: number, intensity: number): number {
    const r = (color >> 16) & 0xff
    const g = (color >> 8) & 0xff
    const b = color & 0xff

    // Blend toward white
    const blendedR = Math.round(255 - (255 - r) * intensity)
    const blendedG = Math.round(255 - (255 - g) * intensity)
    const blendedB = Math.round(255 - (255 - b) * intensity)

    return Phaser.Display.Color.GetColor(blendedR, blendedG, blendedB)
  }

  /**
   * Update method (call from scene update if needed for special effects)
   */
  update(_delta: number): void {
    // Currently particles are self-updating via emitter
    // This method is available for future parallax or custom effects
  }

  /**
   * Destroy all effects (for cleanup or quality change)
   */
  private destroyEffects(): void {
    if (this.particleEmitter) {
      this.particleEmitter.stop()
      this.particleEmitter.destroy()
      this.particleEmitter = null
    }

    if (this.colorShiftTween) {
      this.colorShiftTween.stop()
      this.colorShiftTween.destroy()
      this.colorShiftTween = null
    }

    // Reset background tint
    if (this.backgroundImage) {
      this.backgroundImage.clearTint()
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.isDestroyed = true
    this.destroyEffects()
    this.backgroundImage = null
    this.config = undefined
  }

  /**
   * Check if animations are currently active
   */
  isActive(): boolean {
    return !this.isDestroyed && (this.particleEmitter !== null || this.colorShiftTween !== null)
  }

  /**
   * Get current configuration (for debugging)
   */
  getConfig(): ChapterAnimationConfig | undefined {
    return this.config
  }
}

/**
 * Factory function for creating BackgroundAnimationManager
 */
export function createBackgroundAnimationManager(scene: Phaser.Scene): BackgroundAnimationManager {
  return new BackgroundAnimationManager(scene)
}
