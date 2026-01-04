/**
 * HapticManager - Mobile haptic feedback system
 *
 * Provides tactile feedback for game events on supported mobile devices.
 * Uses Capacitor Haptics when running as native app, falls back to web Vibration API.
 */
import { Capacitor } from '@capacitor/core'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'

export class HapticManager {
  private _enabled: boolean = true
  private _actuallyWorks: boolean | null = null // Cache whether vibration actually works
  private _isNative: boolean = false

  // Vibration patterns (in milliseconds) for web fallback
  private readonly patterns = {
    light: 10, // Collecting gold/items
    medium: 25, // Shooting arrows
    heavy: 50, // Taking damage
    bossHit: 40, // Hitting the boss
    death: [100, 50, 100], // Player death pattern
    levelUp: [50, 30, 50, 30, 100], // Level up celebration
  }

  constructor() {
    // Check if running as a native app via Capacitor
    this._isNative = Capacitor.isNativePlatform()

    if (this._isNative) {
      console.log('HapticManager: Running on native platform, using Capacitor Haptics')
      this._actuallyWorks = true
    } else if (!this.isWebVibrateSupported()) {
      console.log('HapticManager: Vibration API not supported')
      this._actuallyWorks = false
    }
  }

  /**
   * Check if running on native platform (iOS/Android via Capacitor)
   */
  get isNative(): boolean {
    return this._isNative
  }

  /**
   * Check if the web Vibration API is supported
   */
  isWebVibrateSupported(): boolean {
    return typeof window !== 'undefined' && 'vibrate' in window.navigator
  }

  /**
   * Check if haptic feedback is supported (either native or web)
   */
  isSupported(): boolean {
    return this._isNative || this.isWebVibrateSupported()
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
   * Trigger a vibration pattern using web API (fallback)
   */
  private vibrateWeb(pattern: number | number[]): void {
    if (!this._enabled || !this.isWebVibrateSupported()) {
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
      // Use notification type error for death - stronger feedback
      Haptics.notification({ type: NotificationType.Error }).catch(() => {
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
      // Use notification type success for level up
      Haptics.notification({ type: NotificationType.Success }).catch(() => {
        // Silently fail
      })
    } else {
      this.vibrateWeb(this.patterns.levelUp)
    }
  }

  /**
   * Custom vibration with specified duration (native only uses impact)
   */
  vibrate(duration: number): void {
    if (!this._enabled) return

    if (this._isNative) {
      Haptics.vibrate({ duration }).catch(() => {
        // Silently fail
      })
    } else {
      this.vibrateWeb(duration)
    }
  }

  /**
   * Stop any ongoing vibration
   */
  stop(): void {
    if (this._isNative) {
      // Capacitor doesn't have a direct stop, but vibrate with 0 should work
      Haptics.vibrate({ duration: 0 }).catch(() => {
        // Silently fail
      })
    } else if (this.isWebVibrateSupported()) {
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
