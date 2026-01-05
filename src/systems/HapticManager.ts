/**
 * HapticManager - Mobile haptic feedback system
 *
 * Uses Capacitor Haptics for native apps (iOS Taptic Engine, Android haptic feedback)
 * Falls back to Vibration API for web browsers.
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export class HapticManager {
  private _enabled: boolean = true
  private _isNative: boolean = false
  private _actuallyWorks: boolean | null = null // Cache whether web vibration actually works

  // Vibration patterns for web fallback (in milliseconds)
  private readonly patterns = {
    light: 10, // Collecting gold/items
    medium: 25, // Shooting arrows
    heavy: 50, // Taking damage
    bossHit: 40, // Hitting the boss
    death: [100, 50, 100], // Player death pattern
    levelUp: [50, 30, 50, 30, 100], // Level up celebration
  }

  constructor() {
    this._isNative = Capacitor.isNativePlatform()
    // Only check web vibration support if not native
    if (!this._isNative && !this.isWebSupported()) {
      console.log('HapticManager: Vibration API not supported')
      this._actuallyWorks = false
    }
  }

  /**
   * Check if the web Vibration API is supported
   */
  isWebSupported(): boolean {
    return typeof window !== 'undefined' && 'vibrate' in window.navigator
  }

  /**
   * Check if haptics are supported (native or web)
   */
  isSupported(): boolean {
    return this._isNative || this.isWebSupported()
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
   * Trigger a web vibration pattern (fallback for non-native)
   */
  private vibrateWeb(pattern: number | number[]): void {
    if (!this._enabled || !this.isWebSupported()) {
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
    if (!this._enabled) return

    if (this._isNative) {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        // Silently fail
      })
    } else {
      this.vibrateWeb(this.patterns.light)
    }
  }

  /**
   * Medium vibration - for shooting arrows
   */
  medium(): void {
    if (!this._enabled) return

    if (this._isNative) {
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {
        // Silently fail
      })
    } else {
      this.vibrateWeb(this.patterns.medium)
    }
  }

  /**
   * Heavy vibration - for taking damage
   */
  heavy(): void {
    if (!this._enabled) return

    if (this._isNative) {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {
        // Silently fail
      })
    } else {
      this.vibrateWeb(this.patterns.heavy)
    }
  }

  /**
   * Boss hit vibration
   */
  bossHit(): void {
    if (!this._enabled) return

    if (this._isNative) {
      // Use medium impact for boss hits
      Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {
        // Silently fail
      })
    } else {
      this.vibrateWeb(this.patterns.bossHit)
    }
  }

  /**
   * Death pattern - for player death
   */
  death(): void {
    if (!this._enabled) return

    if (this._isNative) {
      // Use vibrate for custom patterns on native
      Haptics.vibrate({ duration: 100 })
        .then(() => new Promise((resolve) => window.setTimeout(resolve, 50)))
        .then(() => Haptics.vibrate({ duration: 100 }))
        .catch(() => {
          // Silently fail
        })
    } else {
      this.vibrateWeb(this.patterns.death)
    }
  }

  /**
   * Level up pattern - celebration feedback
   */
  levelUp(): void {
    if (!this._enabled) return

    if (this._isNative) {
      // Use a sequence of light impacts for celebration
      const celebrationSequence = async () => {
        try {
          await Haptics.impact({ style: ImpactStyle.Light })
          await new Promise((resolve) => window.setTimeout(resolve, 30))
          await Haptics.impact({ style: ImpactStyle.Light })
          await new Promise((resolve) => window.setTimeout(resolve, 30))
          await Haptics.impact({ style: ImpactStyle.Medium })
        } catch {
          // Silently fail
        }
      }
      celebrationSequence()
    } else {
      this.vibrateWeb(this.patterns.levelUp)
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stop(): void {
    if (this._isNative) {
      // Capacitor Haptics doesn't have a stop method, but impacts are short-lived
      return
    }

    if (this.isWebSupported()) {
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
