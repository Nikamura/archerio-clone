/**
 * DebugManager - Singleton for managing debug settings
 * Provides comprehensive debug options for testing game features.
 */

import { ChapterId } from '../config/chapterData'
import { ROOM_LAYOUTS, CHOKEPOINT_LAYOUTS, BOSS_LAYOUTS, MINI_BOSS_LAYOUTS, RoomLayout } from './room/RoomLayouts'

const STORAGE_KEY = 'aura_archer_debug_settings'

/**
 * Debug settings that can be customized
 */
export interface DebugSettings {
  // Energy bypass
  bypassEnergy: boolean

  // Game start options
  startChapter: ChapterId
  startRoom: number

  // Starting abilities (ability IDs to grant at game start)
  startingAbilities: string[]

  // Player modifiers
  invincible: boolean
  infiniteAmmo: boolean
  playerDamageMultiplier: number
  playerSpeedMultiplier: number
  startingHealthMultiplier: number

  // Enemy modifiers
  enemyHealthMultiplier: number
  enemyDamageMultiplier: number
  disableEnemySpawns: boolean

  // Room layout override (null = use random generation)
  forcedLayoutIndex: number | null
  layoutCategory: 'standard' | 'chokepoint' | 'boss' | 'miniboss'

  // XP and gold multipliers
  xpMultiplier: number
  goldMultiplier: number

  // Instant level up (grant ability every N seconds, 0 = disabled)
  autoLevelUpInterval: number

  // Skip to boss
  skipToBoss: boolean

  // Show hitboxes
  showHitboxes: boolean

  // One-shot enemies
  oneShotEnemies: boolean
}

/**
 * Default debug settings
 */
const DEFAULT_SETTINGS: DebugSettings = {
  bypassEnergy: false,
  startChapter: 1,
  startRoom: 1,
  startingAbilities: [],
  invincible: false,
  infiniteAmmo: false,
  playerDamageMultiplier: 1.0,
  playerSpeedMultiplier: 1.0,
  startingHealthMultiplier: 1.0,
  enemyHealthMultiplier: 1.0,
  enemyDamageMultiplier: 1.0,
  disableEnemySpawns: false,
  forcedLayoutIndex: null,
  layoutCategory: 'standard',
  xpMultiplier: 1.0,
  goldMultiplier: 1.0,
  autoLevelUpInterval: 0,
  skipToBoss: false,
  showHitboxes: false,
  oneShotEnemies: false,
}

class DebugManager {
  private static _instance: DebugManager
  private settings: DebugSettings

  static get instance(): DebugManager {
    if (!DebugManager._instance) {
      DebugManager._instance = new DebugManager()
    }
    return DebugManager._instance
  }

  private constructor() {
    this.settings = { ...DEFAULT_SETTINGS }
    this.loadFromStorage()
  }

  /**
   * Get all current debug settings
   */
  getSettings(): DebugSettings {
    return { ...this.settings }
  }

  /**
   * Update a single setting
   */
  setSetting<K extends keyof DebugSettings>(key: K, value: DebugSettings[K]): void {
    this.settings[key] = value
    this.saveToStorage()
  }

  /**
   * Update multiple settings at once
   */
  setSettings(updates: Partial<DebugSettings>): void {
    this.settings = { ...this.settings, ...updates }
    this.saveToStorage()
  }

  /**
   * Reset all settings to defaults
   */
  resetSettings(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveToStorage()
  }

  /**
   * Get a specific setting value
   */
  get<K extends keyof DebugSettings>(key: K): DebugSettings[K] {
    return this.settings[key]
  }

  /**
   * Check if any debug overrides are active
   */
  hasActiveOverrides(): boolean {
    return (
      this.settings.bypassEnergy ||
      this.settings.invincible ||
      this.settings.oneShotEnemies ||
      this.settings.startingAbilities.length > 0 ||
      this.settings.startChapter !== 1 ||
      this.settings.startRoom !== 1 ||
      this.settings.playerDamageMultiplier !== 1.0 ||
      this.settings.playerSpeedMultiplier !== 1.0 ||
      this.settings.startingHealthMultiplier !== 1.0 ||
      this.settings.enemyHealthMultiplier !== 1.0 ||
      this.settings.enemyDamageMultiplier !== 1.0 ||
      this.settings.disableEnemySpawns ||
      this.settings.forcedLayoutIndex !== null ||
      this.settings.xpMultiplier !== 1.0 ||
      this.settings.goldMultiplier !== 1.0 ||
      this.settings.autoLevelUpInterval > 0 ||
      this.settings.skipToBoss ||
      this.settings.showHitboxes
    )
  }

  /**
   * Get the forced room layout if set
   */
  getForcedLayout(): RoomLayout | null {
    if (this.settings.forcedLayoutIndex === null) return null

    const layouts = this.getLayoutsForCategory(this.settings.layoutCategory)
    if (this.settings.forcedLayoutIndex < 0 || this.settings.forcedLayoutIndex >= layouts.length) {
      return null
    }
    return layouts[this.settings.forcedLayoutIndex]
  }

  /**
   * Get layouts for a specific category
   */
  getLayoutsForCategory(category: DebugSettings['layoutCategory']): RoomLayout[] {
    switch (category) {
      case 'standard':
        return ROOM_LAYOUTS
      case 'chokepoint':
        return CHOKEPOINT_LAYOUTS
      case 'boss':
        return BOSS_LAYOUTS
      case 'miniboss':
        return MINI_BOSS_LAYOUTS
      default:
        return ROOM_LAYOUTS
    }
  }

  /**
   * Get all available layout names for UI
   */
  getLayoutNames(category: DebugSettings['layoutCategory']): string[] {
    return this.getLayoutsForCategory(category).map((layout) => layout.name)
  }

  /**
   * Add a starting ability
   */
  addStartingAbility(abilityId: string): void {
    if (!this.settings.startingAbilities.includes(abilityId)) {
      this.settings.startingAbilities.push(abilityId)
      this.saveToStorage()
    }
  }

  /**
   * Remove a starting ability
   */
  removeStartingAbility(abilityId: string): void {
    this.settings.startingAbilities = this.settings.startingAbilities.filter((id) => id !== abilityId)
    this.saveToStorage()
  }

  /**
   * Clear all starting abilities
   */
  clearStartingAbilities(): void {
    this.settings.startingAbilities = []
    this.saveToStorage()
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings))
    } catch (e) {
      console.warn('Failed to save debug settings:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Merge with defaults to handle new properties
        this.settings = { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (e) {
      console.warn('Failed to load debug settings:', e)
      this.settings = { ...DEFAULT_SETTINGS }
    }
  }
}

export const debugManager = DebugManager.instance

// Register globally for access from entities that can't import directly (e.g., Enemy, PlayerStats)
;(globalThis as Record<string, unknown>).__debugManager = debugManager
