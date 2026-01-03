import Phaser from 'phaser'
import {
  type ThemeId,
  type ThemeDefinition,
  type ThemeColors,
  type ThemeAssets,
  THEME_DEFINITIONS,
  isValidThemeId,
  getAllThemeIds,
} from '../config/themeData'

const THEME_STORAGE_KEY = 'arrow_game_theme_data'

export interface ThemeSaveData {
  unlockedThemes: ThemeId[]
  selectedThemeId: ThemeId
}

export const THEME_EVENTS = {
  THEME_SELECTED: 'themeSelected',
  THEME_UNLOCKED: 'themeUnlocked',
}

export class ThemeManager extends Phaser.Events.EventEmitter {
  private static _instance: ThemeManager | null = null

  private unlockedThemes: Set<ThemeId>
  private selectedThemeId: ThemeId

  // Currency callbacks (injected from BootScene)
  private getGold: () => number = () => 0
  private spendGold: (amount: number) => boolean = () => false
  private getGems: () => number = () => 0
  private spendGems: (amount: number) => boolean = () => false
  private onSave: () => void = () => {}

  private constructor() {
    super()
    // Initialize with defaults
    this.unlockedThemes = new Set(['medieval'])
    this.selectedThemeId = 'medieval'
    this.loadFromStorage()
  }

  static get instance(): ThemeManager {
    if (!ThemeManager._instance) {
      ThemeManager._instance = new ThemeManager()
    }
    return ThemeManager._instance
  }

  static resetInstance(): void {
    if (ThemeManager._instance) {
      ThemeManager._instance.removeAllListeners()
      ThemeManager._instance = null
    }
  }

  // Currency integration - called from BootScene
  setCurrencyCallbacks(callbacks: {
    getGold: () => number
    spendGold: (amount: number) => boolean
    getGems?: () => number
    spendGems?: (amount: number) => boolean
    onSave?: () => void
  }): void {
    this.getGold = callbacks.getGold
    this.spendGold = callbacks.spendGold
    if (callbacks.getGems) {
      this.getGems = callbacks.getGems
    }
    if (callbacks.spendGems) {
      this.spendGems = callbacks.spendGems
    }
    if (callbacks.onSave) {
      this.onSave = callbacks.onSave
    }
  }

  // Persistence
  private saveToStorage(): void {
    try {
      const data: ThemeSaveData = {
        unlockedThemes: Array.from(this.unlockedThemes),
        selectedThemeId: this.selectedThemeId,
      }
      localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('ThemeManager: Failed to save:', error)
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as ThemeSaveData
        if (data.unlockedThemes) {
          this.unlockedThemes = new Set(
            data.unlockedThemes.filter((id) => isValidThemeId(id))
          )
          this.unlockedThemes.add('medieval') // Always unlocked
        }
        if (data.selectedThemeId && isValidThemeId(data.selectedThemeId)) {
          if (this.unlockedThemes.has(data.selectedThemeId)) {
            this.selectedThemeId = data.selectedThemeId
          }
        }
      }
    } catch (error) {
      console.error('ThemeManager: Failed to load:', error)
    }
  }

  // Getters
  getSelectedThemeId(): ThemeId {
    return this.selectedThemeId
  }

  getSelectedTheme(): ThemeDefinition {
    return THEME_DEFINITIONS[this.selectedThemeId]
  }

  getColors(): ThemeColors {
    return THEME_DEFINITIONS[this.selectedThemeId].colors
  }

  getAssets(): ThemeAssets {
    return THEME_DEFINITIONS[this.selectedThemeId].assets
  }

  isUnlocked(themeId: ThemeId): boolean {
    return this.unlockedThemes.has(themeId)
  }

  getUnlockedThemeIds(): ThemeId[] {
    return Array.from(this.unlockedThemes)
  }

  // Unlock logic
  canUnlock(themeId: ThemeId): boolean {
    if (!isValidThemeId(themeId)) return false
    if (this.unlockedThemes.has(themeId)) return false

    const theme = THEME_DEFINITIONS[themeId]
    if (theme.unlockCurrency === 'free') return true
    if (theme.unlockCurrency === 'gold') {
      return this.getGold() >= theme.unlockCost
    }
    if (theme.unlockCurrency === 'gems') {
      return this.getGems() >= theme.unlockCost
    }
    return false
  }

  getUnlockCost(themeId: ThemeId): { cost: number; currency: 'gold' | 'gems' | 'free' } {
    const theme = THEME_DEFINITIONS[themeId]
    return { cost: theme.unlockCost, currency: theme.unlockCurrency }
  }

  unlock(themeId: ThemeId): boolean {
    if (!isValidThemeId(themeId)) return false
    if (this.unlockedThemes.has(themeId)) return false

    const theme = THEME_DEFINITIONS[themeId]

    // Check currency based on type
    if (theme.unlockCurrency === 'gold') {
      if (!this.canUnlock(themeId)) return false
      if (!this.spendGold(theme.unlockCost)) return false
    } else if (theme.unlockCurrency === 'gems') {
      if (!this.canUnlock(themeId)) return false
      if (!this.spendGems(theme.unlockCost)) return false
    }
    // Free themes don't need currency check

    this.unlockedThemes.add(themeId)
    this.emit(THEME_EVENTS.THEME_UNLOCKED, { themeId })
    this.saveToStorage()
    this.onSave()

    return true
  }

  // Selection
  select(themeId: ThemeId): boolean {
    if (!isValidThemeId(themeId)) return false
    if (!this.unlockedThemes.has(themeId)) return false
    if (themeId === this.selectedThemeId) return true

    const previousThemeId = this.selectedThemeId
    this.selectedThemeId = themeId

    this.emit(THEME_EVENTS.THEME_SELECTED, {
      previousThemeId,
      newThemeId: themeId,
    })
    this.saveToStorage()
    this.onSave()

    return true
  }

  // Get all theme states for UI
  getAllThemeStates(): Array<{
    id: ThemeId
    name: string
    description: string
    isUnlocked: boolean
    isSelected: boolean
    cost: number
    currency: 'gold' | 'gems' | 'free'
  }> {
    return getAllThemeIds().map((id) => {
      const theme = THEME_DEFINITIONS[id]
      return {
        id,
        name: theme.name,
        description: theme.description,
        isUnlocked: this.unlockedThemes.has(id),
        isSelected: id === this.selectedThemeId,
        cost: theme.unlockCost,
        currency: theme.unlockCurrency,
      }
    })
  }

  // Reset
  reset(): void {
    this.unlockedThemes = new Set(['medieval'])
    this.selectedThemeId = 'medieval'
    this.saveToStorage()
    this.onSave()
  }
}

// Singleton export
export const themeManager = ThemeManager.instance
