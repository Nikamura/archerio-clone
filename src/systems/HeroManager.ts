/**
 * HeroManager - Manages hero selection, unlocking, and progression.
 *
 * Singleton pattern for global access.
 * Emits events for hero changes that UI can listen to.
 */

import Phaser from 'phaser'
import {
  type HeroId,
  type HeroProgress,
  type HeroSaveData,
  type ComputedHeroStats,
  type HeroState,
  type HeroSelectEvent,
  type HeroUnlockEvent,
  type HeroLevelUpEvent,
  HERO_EVENTS,
  createDefaultHeroProgress,
  createDefaultHeroSaveData,
} from './Hero'
import {
  type HeroDefinition,
  type HeroPerk,
  HERO_DEFINITIONS,
  HERO_MAX_LEVEL,
  HERO_LEVEL_STATS,
  getHeroLevelUpCost,
  getHeroXPThreshold,
  getUnlockedPerks,
  getNextPerk,
  isValidHeroId,
  getAllHeroIds,
} from '../config/heroData'

// ============================================
// Constants
// ============================================

const HERO_STORAGE_KEY = 'arrow_game_hero_data'

// ============================================
// HeroManager Class
// ============================================

export class HeroManager extends Phaser.Events.EventEmitter {
  private static instance: HeroManager | null = null

  private unlockedHeroes: Set<HeroId>
  private selectedHeroId: HeroId
  private heroProgress: Record<HeroId, HeroProgress>

  // Currency getters (injected via setSaveManager or direct callbacks)
  private getGold: () => number = () => 0
  private getGems: () => number = () => 0
  private spendGold: (amount: number) => boolean = () => false
  private spendGems: (amount: number) => boolean = () => false
  private onSave: () => void = () => {}

  private constructor() {
    super()
    // Initialize with defaults
    const defaults = createDefaultHeroSaveData()
    this.unlockedHeroes = new Set(defaults.unlockedHeroes)
    this.selectedHeroId = defaults.selectedHeroId
    this.heroProgress = defaults.heroProgress

    // Load persisted data
    this.loadFromStorage()
  }

  /**
   * Save hero data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = this.toSaveData()
      localStorage.setItem(HERO_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('HeroManager: Failed to save data:', error)
    }
  }

  /**
   * Load hero data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(HERO_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as HeroSaveData
        this.fromSaveData(data)
        console.log(`HeroManager: Loaded ${this.unlockedHeroes.size} heroes from storage`)
      }
    } catch (error) {
      console.error('HeroManager: Failed to load data:', error)
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): HeroManager {
    if (!HeroManager.instance) {
      HeroManager.instance = new HeroManager()
    }
    return HeroManager.instance
  }

  /**
   * Reset singleton (useful for testing)
   */
  static resetInstance(): void {
    if (HeroManager.instance) {
      HeroManager.instance.removeAllListeners()
      HeroManager.instance = null
    }
  }

  // ============================================
  // Currency Integration
  // ============================================

  /**
   * Set currency callbacks for integration with SaveManager
   */
  setCurrencyCallbacks(callbacks: {
    getGold: () => number
    getGems: () => number
    spendGold: (amount: number) => boolean
    spendGems: (amount: number) => boolean
    onSave?: () => void
  }): void {
    this.getGold = callbacks.getGold
    this.getGems = callbacks.getGems
    this.spendGold = callbacks.spendGold
    this.spendGems = callbacks.spendGems
    if (callbacks.onSave) {
      this.onSave = callbacks.onSave
    }
  }

  // ============================================
  // Save/Load
  // ============================================

  /**
   * Export data for saving
   */
  toSaveData(): HeroSaveData {
    return {
      unlockedHeroes: Array.from(this.unlockedHeroes),
      selectedHeroId: this.selectedHeroId,
      heroProgress: { ...this.heroProgress },
    }
  }

  /**
   * Import data from save
   */
  fromSaveData(data: Partial<HeroSaveData>): void {
    if (data.unlockedHeroes) {
      this.unlockedHeroes = new Set(
        data.unlockedHeroes.filter((id) => isValidHeroId(id))
      )
      // Ensure Atreus is always unlocked
      this.unlockedHeroes.add('atreus')
    }

    if (data.selectedHeroId && isValidHeroId(data.selectedHeroId)) {
      // Ensure selected hero is unlocked
      if (this.unlockedHeroes.has(data.selectedHeroId)) {
        this.selectedHeroId = data.selectedHeroId
      } else {
        this.selectedHeroId = 'atreus'
      }
    }

    if (data.heroProgress) {
      for (const heroId of getAllHeroIds()) {
        if (data.heroProgress[heroId]) {
          this.heroProgress[heroId] = {
            ...createDefaultHeroProgress(),
            ...data.heroProgress[heroId],
          }
        }
      }
    }
    this.saveToStorage()
  }

  // ============================================
  // Hero Selection
  // ============================================

  /**
   * Get currently selected hero ID
   */
  getSelectedHeroId(): HeroId {
    return this.selectedHeroId
  }

  /**
   * Get selected hero definition
   */
  getSelectedHero(): HeroDefinition {
    return HERO_DEFINITIONS[this.selectedHeroId]
  }

  /**
   * Select a hero (must be unlocked)
   */
  select(heroId: HeroId): boolean {
    if (!isValidHeroId(heroId)) return false
    if (!this.unlockedHeroes.has(heroId)) return false
    if (heroId === this.selectedHeroId) return true

    const previousHeroId = this.selectedHeroId
    this.selectedHeroId = heroId

    const event: HeroSelectEvent = {
      previousHeroId,
      newHeroId: heroId,
    }
    this.emit(HERO_EVENTS.HERO_SELECTED, event)
    this.saveToStorage()
    this.onSave()

    return true
  }

  // ============================================
  // Hero Unlocking
  // ============================================

  /**
   * Check if a hero is unlocked
   */
  isUnlocked(heroId: HeroId): boolean {
    return this.unlockedHeroes.has(heroId)
  }

  /**
   * Get all unlocked hero IDs
   */
  getUnlockedHeroIds(): HeroId[] {
    return Array.from(this.unlockedHeroes)
  }

  /**
   * Check if player can afford to unlock a hero
   */
  canUnlock(heroId: HeroId): boolean {
    if (!isValidHeroId(heroId)) return false
    if (this.unlockedHeroes.has(heroId)) return false

    const hero = HERO_DEFINITIONS[heroId]
    if (hero.unlockCurrency === 'free') return true
    if (hero.unlockCurrency === 'gold') {
      return this.getGold() >= hero.unlockCost
    }
    if (hero.unlockCurrency === 'gems') {
      return this.getGems() >= hero.unlockCost
    }
    return false
  }

  /**
   * Get unlock cost and currency for a hero
   */
  getUnlockCost(heroId: HeroId): { cost: number; currency: 'gold' | 'gems' | 'free' } {
    const hero = HERO_DEFINITIONS[heroId]
    return {
      cost: hero.unlockCost,
      currency: hero.unlockCurrency,
    }
  }

  /**
   * Attempt to unlock a hero
   */
  unlock(heroId: HeroId): boolean {
    if (!this.canUnlock(heroId)) return false

    const hero = HERO_DEFINITIONS[heroId]

    // Spend currency if not free
    if (hero.unlockCurrency === 'gold') {
      if (!this.spendGold(hero.unlockCost)) return false
    } else if (hero.unlockCurrency === 'gems') {
      if (!this.spendGems(hero.unlockCost)) return false
    }

    this.unlockedHeroes.add(heroId)

    const event: HeroUnlockEvent = {
      heroId,
      cost: hero.unlockCost,
      currency: hero.unlockCurrency === 'free' ? 'gold' : hero.unlockCurrency,
    }
    this.emit(HERO_EVENTS.HERO_UNLOCKED, event)
    this.saveToStorage()
    this.onSave()

    return true
  }

  /**
   * Force unlock a hero without spending currency (for debug/testing)
   */
  forceUnlock(heroId: HeroId): void {
    if (!isValidHeroId(heroId)) return
    this.unlockedHeroes.add(heroId)
    this.emit(HERO_EVENTS.HERO_UNLOCKED, { heroId, cost: 0, currency: 'gold' })
    this.saveToStorage()
    this.onSave()
  }

  // ============================================
  // Hero Leveling
  // ============================================

  /**
   * Get hero's current level
   */
  getLevel(heroId: HeroId): number {
    return this.heroProgress[heroId]?.level ?? 1
  }

  /**
   * Get hero's current XP
   */
  getXP(heroId: HeroId): number {
    return this.heroProgress[heroId]?.xp ?? 0
  }

  /**
   * Get gold cost for next level
   */
  getLevelUpCost(heroId: HeroId): number {
    const level = this.getLevel(heroId)
    return getHeroLevelUpCost(level)
  }

  /**
   * Check if hero can level up (has enough gold)
   */
  canLevelUp(heroId: HeroId): boolean {
    if (!isValidHeroId(heroId)) return false
    const level = this.getLevel(heroId)
    if (level >= HERO_MAX_LEVEL) return false
    const cost = this.getLevelUpCost(heroId)
    return this.getGold() >= cost
  }

  /**
   * Attempt to level up a hero
   */
  levelUp(heroId: HeroId): boolean {
    if (!this.canLevelUp(heroId)) return false

    const cost = this.getLevelUpCost(heroId)
    if (!this.spendGold(cost)) return false

    const progress = this.heroProgress[heroId]
    const previousLevel = progress.level
    progress.level++

    // Check for new perks
    const newPerks = this.checkAndUnlockPerks(heroId)

    const event: HeroLevelUpEvent = {
      heroId,
      previousLevel,
      newLevel: progress.level,
      cost,
      newPerks,
    }
    this.emit(HERO_EVENTS.HERO_LEVELED_UP, event)
    this.emit(HERO_EVENTS.HERO_STATS_CHANGED, { heroId })
    this.saveToStorage()
    this.onSave()

    return true
  }

  /**
   * Check and unlock any perks at the current level
   */
  private checkAndUnlockPerks(heroId: HeroId): HeroPerk[] {
    const progress = this.heroProgress[heroId]
    const hero = HERO_DEFINITIONS[heroId]
    const newPerks: HeroPerk[] = []

    for (const perk of hero.perks) {
      if (
        perk.level <= progress.level &&
        !progress.unlockedPerks.includes(perk.level)
      ) {
        progress.unlockedPerks.push(perk.level)
        newPerks.push(perk)
      }
    }

    return newPerks
  }

  // ============================================
  // XP-Based Leveling
  // ============================================

  /**
   * Get XP required for next level
   */
  getXPThreshold(heroId: HeroId): number {
    return getHeroXPThreshold(this.getLevel(heroId))
  }

  /**
   * Add XP to a hero and process any level-ups
   * @returns Array of level-up events if any levels were gained
   */
  addXP(heroId: HeroId, amount: number): HeroLevelUpEvent[] {
    if (!isValidHeroId(heroId)) return []

    const progress = this.heroProgress[heroId]
    if (!progress) return []

    progress.xp += amount
    const levelUpEvents: HeroLevelUpEvent[] = []

    // Process level-ups while we have enough XP
    while (progress.level < HERO_MAX_LEVEL) {
      const threshold = getHeroXPThreshold(progress.level)
      if (progress.xp >= threshold) {
        progress.xp -= threshold
        const previousLevel = progress.level
        progress.level++

        // Check for new perks
        const newPerks = this.checkAndUnlockPerks(heroId)

        const event: HeroLevelUpEvent = {
          heroId,
          previousLevel,
          newLevel: progress.level,
          cost: 0,
          newPerks,
        }

        levelUpEvents.push(event)
        this.emit(HERO_EVENTS.HERO_LEVELED_UP, event)
      } else {
        break
      }
    }

    if (levelUpEvents.length > 0) {
      this.emit(HERO_EVENTS.HERO_STATS_CHANGED, { heroId })
    }

    this.saveToStorage()
    this.onSave()

    return levelUpEvents
  }

  // ============================================
  // Stats Calculation
  // ============================================

  /**
   * Get computed stats for a hero (after level bonuses and perks)
   */
  getStats(heroId: HeroId): ComputedHeroStats {
    const hero = HERO_DEFINITIONS[heroId]
    const progress = this.heroProgress[heroId] ?? createDefaultHeroProgress()
    const level = progress.level
    const unlockedPerkLevels = new Set(progress.unlockedPerks)

    // Start with base stats
    let maxHealth = hero.baseStats.maxHealth
    let attack = hero.baseStats.attack
    let attackSpeed = hero.baseStats.attackSpeed
    let critChance = 0
    let critDamage = 1.5 // Base 150% crit damage

    // Apply level scaling
    const levelBonus = level - 1 // Level 1 has no bonus
    maxHealth *= 1 + levelBonus * HERO_LEVEL_STATS.healthPercent
    attack *= 1 + levelBonus * HERO_LEVEL_STATS.attackPercent
    attackSpeed *= 1 + levelBonus * HERO_LEVEL_STATS.attackSpeedPercent

    // Apply perks
    const unlockedPerks = getUnlockedPerks(heroId, level)
    for (const perk of unlockedPerks) {
      if (!unlockedPerkLevels.has(perk.level)) continue

      if (perk.effect.type === 'stat_boost' && perk.effect.value) {
        switch (perk.effect.stat) {
          case 'attack':
            attack *= 1 + perk.effect.value
            break
          case 'health':
            maxHealth *= 1 + perk.effect.value
            break
          case 'attackSpeed':
            attackSpeed *= 1 + perk.effect.value
            break
          case 'critChance':
            critChance += perk.effect.value
            break
          case 'critDamage':
            critDamage *= 1 + perk.effect.value
            break
        }
      }

      // Handle special perks
      if (perk.effect.type === 'special' && perk.effect.special === 'master_archer') {
        critChance += 0.1
        critDamage *= 1.2
      }
    }

    return {
      maxHealth: Math.floor(maxHealth),
      attack: Math.floor(attack),
      attackSpeed: Math.round(attackSpeed * 100) / 100,
      critChance: Math.min(1, critChance),
      critDamage,
    }
  }

  /**
   * Get computed stats for the currently selected hero
   */
  getSelectedHeroStats(): ComputedHeroStats {
    return this.getStats(this.selectedHeroId)
  }

  // ============================================
  // Hero State (for UI)
  // ============================================

  /**
   * Get complete hero state for UI display
   */
  getHeroState(heroId: HeroId): HeroState {
    const hero = HERO_DEFINITIONS[heroId]
    const progress = this.heroProgress[heroId] ?? createDefaultHeroProgress()
    const unlockedPerks = getUnlockedPerks(heroId, progress.level).filter((p) =>
      progress.unlockedPerks.includes(p.level)
    )
    const nextPerk = getNextPerk(heroId, progress.level)

    // Calculate progress to next perk
    let progressToNextPerk = 0
    if (nextPerk) {
      const prevPerkLevel =
        unlockedPerks.length > 0
          ? unlockedPerks[unlockedPerks.length - 1].level
          : 0
      const levelRange = nextPerk.level - prevPerkLevel
      const currentProgress = progress.level - prevPerkLevel
      progressToNextPerk = currentProgress / levelRange
    }

    return {
      id: heroId,
      name: hero.name,
      level: progress.level,
      xp: progress.xp,
      isUnlocked: this.unlockedHeroes.has(heroId),
      baseStats: hero.baseStats,
      computedStats: this.getStats(heroId),
      unlockedPerks,
      nextPerk,
      progressToNextPerk,
    }
  }

  /**
   * Get all hero states
   */
  getAllHeroStates(): HeroState[] {
    return getAllHeroIds().map((id) => this.getHeroState(id))
  }

  // ============================================
  // Utility
  // ============================================

  /**
   * Check if hero has a specific perk unlocked
   */
  hasPerk(heroId: HeroId, perkLevel: number): boolean {
    const progress = this.heroProgress[heroId]
    return progress?.unlockedPerks.includes(perkLevel) ?? false
  }

  /**
   * Get unlocked perk levels for a hero
   */
  getUnlockedPerkLevels(heroId: HeroId): number[] {
    return this.heroProgress[heroId]?.unlockedPerks ?? []
  }

  /**
   * Reset a hero's progress (for testing or prestige system)
   */
  resetHeroProgress(heroId: HeroId): void {
    this.heroProgress[heroId] = createDefaultHeroProgress()
    this.emit(HERO_EVENTS.HERO_STATS_CHANGED, { heroId })
    this.saveToStorage()
    this.onSave()
  }

  /**
   * Reset all hero data to defaults
   */
  reset(): void {
    const defaults = createDefaultHeroSaveData()
    this.unlockedHeroes = new Set(defaults.unlockedHeroes)
    this.selectedHeroId = defaults.selectedHeroId
    this.heroProgress = defaults.heroProgress
    this.saveToStorage()
    this.onSave()
  }
}

// ============================================
// Singleton Export
// ============================================

/**
 * Global HeroManager instance
 */
export const heroManager = HeroManager.getInstance()
