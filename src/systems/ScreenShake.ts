import Phaser from 'phaser'

/**
 * Screen shake intensity presets
 */
export enum ShakeIntensity {
  TINY = 0.001,     // Very subtle (gold pickup, etc.)
  SMALL = 0.003,    // Player damage
  MEDIUM = 0.006,   // Boss attacks, explosions
  LARGE = 0.01,     // Major impacts, boss death
  EXTREME = 0.015,  // Critical moments
}

/**
 * Screen shake duration presets (in milliseconds)
 */
export enum ShakeDuration {
  SHORT = 100,
  MEDIUM = 200,
  LONG = 350,
  EXTENDED = 500,
}

/**
 * Screen shake configuration
 */
export interface ShakeConfig {
  intensity: number
  duration: number
  force?: boolean  // If true, interrupts current shake
}

/**
 * ScreenShake - A centralized system for managing camera shake effects
 *
 * Uses Phaser's built-in camera.shake() method with configurable presets
 * for different game events (damage, explosions, boss attacks, etc.)
 */
export class ScreenShake {
  private scene: Phaser.Scene
  private enabled: boolean = true
  private currentShakeEndTime: number = 0

  constructor(scene: Phaser.Scene) {
    this.scene = scene
  }

  /**
   * Enable or disable screen shake effects
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Check if screen shake is currently enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Perform a screen shake with custom configuration
   */
  shake(config: ShakeConfig): void {
    if (!this.enabled) return

    const camera = this.scene.cameras.main
    if (!camera) return

    const now = this.scene.time.now

    // Check if we should interrupt current shake
    if (!config.force && now < this.currentShakeEndTime) {
      return
    }

    // Apply the shake
    camera.shake(config.duration, config.intensity)
    this.currentShakeEndTime = now + config.duration
  }

  /**
   * Shake when player takes damage
   */
  onPlayerDamage(): void {
    this.shake({
      intensity: ShakeIntensity.SMALL,
      duration: ShakeDuration.SHORT,
    })
  }

  /**
   * Shake when player takes heavy damage
   */
  onPlayerHeavyDamage(): void {
    this.shake({
      intensity: ShakeIntensity.MEDIUM,
      duration: ShakeDuration.MEDIUM,
    })
  }

  /**
   * Shake when boss attacks
   */
  onBossAttack(): void {
    this.shake({
      intensity: ShakeIntensity.MEDIUM,
      duration: ShakeDuration.MEDIUM,
    })
  }

  /**
   * Shake when boss performs spread attack
   */
  onBossSpreadAttack(): void {
    this.shake({
      intensity: ShakeIntensity.SMALL,
      duration: ShakeDuration.SHORT,
    })
  }

  /**
   * Shake when boss charges
   */
  onBossCharge(): void {
    this.shake({
      intensity: ShakeIntensity.MEDIUM,
      duration: ShakeDuration.LONG,
      force: true,
    })
  }

  /**
   * Shake on explosion (enemy death cluster, etc.)
   */
  onExplosion(): void {
    this.shake({
      intensity: ShakeIntensity.MEDIUM,
      duration: ShakeDuration.MEDIUM,
    })
  }

  /**
   * Shake on boss death - big impact
   */
  onBossDeath(): void {
    this.shake({
      intensity: ShakeIntensity.LARGE,
      duration: ShakeDuration.EXTENDED,
      force: true,
    })
  }

  /**
   * Shake on enemy hit by bullet (very subtle)
   */
  onEnemyHit(): void {
    this.shake({
      intensity: ShakeIntensity.TINY,
      duration: ShakeDuration.SHORT,
    })
  }

  /**
   * Shake on critical hit
   */
  onCriticalHit(): void {
    this.shake({
      intensity: ShakeIntensity.SMALL,
      duration: ShakeDuration.SHORT,
    })
  }

  /**
   * Shake on player death
   */
  onPlayerDeath(): void {
    this.shake({
      intensity: ShakeIntensity.LARGE,
      duration: ShakeDuration.LONG,
      force: true,
    })
  }

  /**
   * Stop any current shake immediately
   */
  stopShake(): void {
    const camera = this.scene.cameras.main
    if (camera) {
      camera.shake(0, 0)
      this.currentShakeEndTime = 0
    }
  }
}

// Export a factory function for easy creation
export function createScreenShake(scene: Phaser.Scene): ScreenShake {
  return new ScreenShake(scene)
}
