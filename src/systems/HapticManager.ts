/**
 * HapticManager - Mobile haptic feedback system using the Vibration API
 *
 * Provides tactile feedback for game events on supported mobile devices.
 * Uses navigator.vibrate() with graceful fallback for unsupported browsers.
 */
export class HapticManager {
  private _enabled: boolean = true
  private _actuallyWorks: boolean | null = null // Cache whether vibration actually works

  // Vibration patterns (in milliseconds)
  private readonly patterns = {
    light: 10, // Collecting gold/items
    medium: 25, // Shooting arrows
    heavy: 50, // Taking damage
    bossHit: 40, // Hitting the boss
    death: [100, 50, 100], // Player death pattern
    levelUp: [50, 30, 50, 30, 100], // Level up celebration
  }

  constructor() {
    // Check if vibration API is supported
    if (!this.isSupported()) {
      console.log('HapticManager: Vibration API not supported')
      this._actuallyWorks = false
    }
  }

  /**
   * Check if the Vibration API is supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'vibrate' in window.navigator
  }

  /**
   * Get whether haptic feedback is enabled
   */
  get enabled(): boolean {
    return this._enabled
  }

  /**
   * Set whether haptic feedback is enabled
   */
  set enabled(value: boolean) {
    this._enabled = value
    console.log(`HapticManager: ${value ? 'enabled' : 'disabled'}`)
  }

  /**
   * Trigger a vibration pattern
   */
  private vibrate(pattern: number | number[]): void {
    if (!this._enabled || !this.isSupported()) {
      return
    }

    // If we've already determined vibration doesn't work, don't try again
    if (this._actuallyWorks === false) {
      return
    }

    try {
      const result = window.navigator.vibrate(pattern)
      // If this is the first successful call, cache that it works
      if (this._actuallyWorks === null) {
        this._actuallyWorks = result
        if (!result) {
          console.log('HapticManager: Vibration API present but not functional')
        }
      }
    } catch (error) {
      // Cache that vibration doesn't work, log once, then silently fail forever
      if (this._actuallyWorks === null) {
        this._actuallyWorks = false
        console.log('HapticManager: vibrate failed', error)
      }
    }
  }

  /**
   * Light vibration - for collecting gold/items
   */
  light(): void {
    this.vibrate(this.patterns.light)
  }

  /**
   * Medium vibration - for shooting arrows
   */
  medium(): void {
    this.vibrate(this.patterns.medium)
  }

  /**
   * Heavy vibration - for taking damage
   */
  heavy(): void {
    this.vibrate(this.patterns.heavy)
  }

  /**
   * Boss hit vibration
   */
  bossHit(): void {
    this.vibrate(this.patterns.bossHit)
  }

  /**
   * Death pattern - for player death
   */
  death(): void {
    this.vibrate(this.patterns.death)
  }

  /**
   * Level up pattern - celebration feedback
   */
  levelUp(): void {
    this.vibrate(this.patterns.levelUp)
  }

  /**
   * Stop any ongoing vibration
   */
  stop(): void {
    if (this.isSupported()) {
      try {
        window.navigator.vibrate(0)
      } catch {
        // Silently fail
      }
    }
  }
}

// Singleton instance for easy import
export const hapticManager = new HapticManager()
