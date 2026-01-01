/**
 * TalentManager - Manages the talent lottery system and talent bonuses.
 *
 * The talent system provides permanent stat bonuses through a lottery mechanic.
 * Players spend gold to spin and unlock random talents, which persist across runs.
 *
 * Features:
 * - Lottery spin with weighted tier drops (50% Common, 35% Rare, 15% Epic)
 * - Escalating spin costs (500 base, +250 per spin today)
 * - Daily spin limit (10 per day)
 * - Talent stacking (same talent can be rolled multiple times up to max level)
 * - Persistent save/load support
 */

import {
  TalentId,
  TalentTier,
  Talent,
  TalentBonuses,
  TALENTS,
  TIER_DROP_RATES,
  getTalentsByTier,
  getTalent,
  createDefaultBonuses,
} from '../config/talentData'

// ============================================
// Type Definitions
// ============================================

/**
 * Result of a lottery spin
 */
export interface SpinResult {
  success: boolean
  talent?: Talent
  newLevel?: number
  goldSpent?: number
  error?: string
}

/**
 * Lottery state for tracking daily limits
 */
export interface LotteryState {
  spinsToday: number
  lastSpinDate: string // ISO date string (YYYY-MM-DD)
}

/**
 * Save data structure for TalentManager
 */
export interface TalentSaveData {
  /** Map of talent ID to current level */
  unlockedTalents: Record<string, number>
  /** Lottery state for daily limits */
  lotteryState: LotteryState
}

/**
 * Event types emitted by TalentManager
 */
export type TalentEventType =
  | 'talentUnlocked'
  | 'talentUpgraded'
  | 'spinFailed'
  | 'dailyLimitReached'

/**
 * Event callback data
 */
export interface TalentEventData {
  type: TalentEventType
  talent?: Talent
  newLevel?: number
  goldSpent?: number
  error?: string
}

/**
 * Event listener callback type
 */
export type TalentEventCallback = (data: TalentEventData) => void

// ============================================
// Constants
// ============================================

/** localStorage key for talent data persistence */
const TALENT_STORAGE_KEY = 'archerio_talent_data'

/** Base cost for lottery spin in gold */
const BASE_SPIN_COST = 500

/** Cost increase per spin today */
const COST_INCREMENT = 250

/** Maximum spins allowed per day */
const MAX_DAILY_SPINS = 10

// ============================================
// TalentManager Class
// ============================================

export class TalentManager {
  /** Map of talent ID to current level */
  private unlockedTalents: Map<TalentId, number>

  /** Current lottery state */
  private lotteryState: LotteryState

  /** Event listeners */
  private eventListeners: Map<TalentEventType, Set<TalentEventCallback>>

  /** Cached bonuses (recalculated when talents change) */
  private cachedBonuses: TalentBonuses | null = null

  constructor() {
    this.unlockedTalents = new Map()
    this.lotteryState = this.createFreshLotteryState()
    this.eventListeners = new Map()
    // Load saved data on construction
    this.loadFromStorage()
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to talent events
   */
  on(eventType: TalentEventType, callback: TalentEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(callback)
  }

  /**
   * Unsubscribe from talent events
   */
  off(eventType: TalentEventType, callback: TalentEventCallback): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: TalentEventType, data: TalentEventData): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  // ============================================
  // Lottery System
  // ============================================

  /**
   * Get the current cost for a lottery spin
   * Base cost + (spins today * increment)
   */
  getSpinCost(): number {
    this.updateDailyState()
    return BASE_SPIN_COST + this.lotteryState.spinsToday * COST_INCREMENT
  }

  /**
   * Get number of spins remaining today
   */
  getSpinsRemaining(): number {
    this.updateDailyState()
    return Math.max(0, MAX_DAILY_SPINS - this.lotteryState.spinsToday)
  }

  /**
   * Get total spins today
   */
  getSpinsToday(): number {
    this.updateDailyState()
    return this.lotteryState.spinsToday
  }

  /**
   * Get maximum daily spins
   */
  getMaxDailySpins(): number {
    return MAX_DAILY_SPINS
  }

  /**
   * Check if player can spin (has spins remaining)
   */
  canSpin(): boolean {
    return this.getSpinsRemaining() > 0
  }

  /**
   * Perform a lottery spin
   * @param goldBalance Current gold balance
   * @param spendGold Function to spend gold (returns true if successful)
   * @returns SpinResult with outcome
   */
  spin(goldBalance: number, spendGold: (amount: number) => boolean): SpinResult {
    this.updateDailyState()

    // Check daily limit
    if (!this.canSpin()) {
      const result: SpinResult = {
        success: false,
        error: 'Daily spin limit reached',
      }
      this.emit('dailyLimitReached', { type: 'dailyLimitReached', error: result.error })
      return result
    }

    const cost = this.getSpinCost()

    // Check if can afford
    if (goldBalance < cost) {
      const result: SpinResult = {
        success: false,
        error: `Not enough gold. Need ${cost}, have ${goldBalance}`,
      }
      this.emit('spinFailed', { type: 'spinFailed', error: result.error })
      return result
    }

    // Spend gold
    if (!spendGold(cost)) {
      const result: SpinResult = {
        success: false,
        error: 'Failed to spend gold',
      }
      this.emit('spinFailed', { type: 'spinFailed', error: result.error })
      return result
    }

    // Increment spins today
    this.lotteryState.spinsToday++
    // Save lottery state immediately to persist spin count
    this.saveToStorage()

    // Roll for talent
    const talent = this.rollRandomTalent()
    const currentLevel = this.getTalentLevel(talent.id)
    const newLevel = Math.min(currentLevel + 1, talent.maxLevel)

    // Check if at max level
    if (currentLevel >= talent.maxLevel) {
      // Re-roll until we get a non-maxed talent, or return duplicate if all maxed
      const upgradableTalent = this.getUpgradableTalent()
      if (upgradableTalent) {
        const actualNewLevel = this.getTalentLevel(upgradableTalent.id) + 1
        this.unlockedTalents.set(upgradableTalent.id, actualNewLevel)
        this.invalidateBonusCache()
        this.saveToStorage()

        const isNew = actualNewLevel === 1
        const eventType = isNew ? 'talentUnlocked' : 'talentUpgraded'

        const result: SpinResult = {
          success: true,
          talent: upgradableTalent,
          newLevel: actualNewLevel,
          goldSpent: cost,
        }

        this.emit(eventType, {
          type: eventType,
          talent: upgradableTalent,
          newLevel: actualNewLevel,
          goldSpent: cost,
        })

        return result
      }
      // All talents maxed - still consume the spin but no upgrade
      return {
        success: true,
        talent,
        newLevel: currentLevel,
        goldSpent: cost,
        error: 'Talent already at max level (all talents maxed)',
      }
    }

    // Upgrade the talent
    this.unlockedTalents.set(talent.id, newLevel)
    this.invalidateBonusCache()
    this.saveToStorage()

    const isNew = newLevel === 1
    const eventType = isNew ? 'talentUnlocked' : 'talentUpgraded'

    const result: SpinResult = {
      success: true,
      talent,
      newLevel,
      goldSpent: cost,
    }

    this.emit(eventType, {
      type: eventType,
      talent,
      newLevel,
      goldSpent: cost,
    })

    return result
  }

  /**
   * Roll a random talent based on tier drop rates
   */
  private rollRandomTalent(): Talent {
    // Roll for tier
    const roll = Math.random() * 100
    let tier: TalentTier

    if (roll < TIER_DROP_RATES[TalentTier.COMMON]) {
      tier = TalentTier.COMMON
    } else if (roll < TIER_DROP_RATES[TalentTier.COMMON] + TIER_DROP_RATES[TalentTier.RARE]) {
      tier = TalentTier.RARE
    } else {
      tier = TalentTier.EPIC
    }

    // Get talents in this tier
    const tierTalents = getTalentsByTier(tier)

    // Pick random talent from tier
    const randomIndex = Math.floor(Math.random() * tierTalents.length)
    return tierTalents[randomIndex]
  }

  /**
   * Get a random talent that can still be upgraded
   * Returns undefined if all talents are maxed
   */
  private getUpgradableTalent(): Talent | undefined {
    const allTalents = Object.values(TALENTS)
    const upgradable = allTalents.filter((talent) => {
      const currentLevel = this.getTalentLevel(talent.id)
      return currentLevel < talent.maxLevel
    })

    if (upgradable.length === 0) {
      return undefined
    }

    // Weight by tier for fair distribution
    const weighted: Talent[] = []
    for (const talent of upgradable) {
      const weight =
        talent.tier === TalentTier.COMMON
          ? 50
          : talent.tier === TalentTier.RARE
            ? 35
            : 15
      for (let i = 0; i < weight; i++) {
        weighted.push(talent)
      }
    }

    const randomIndex = Math.floor(Math.random() * weighted.length)
    return weighted[randomIndex]
  }

  // ============================================
  // Talent Level Management
  // ============================================

  /**
   * Get the current level of a talent
   */
  getTalentLevel(talentId: TalentId): number {
    return this.unlockedTalents.get(talentId) ?? 0
  }

  /**
   * Check if a talent is unlocked (level > 0)
   */
  isTalentUnlocked(talentId: TalentId): boolean {
    return this.getTalentLevel(talentId) > 0
  }

  /**
   * Get the bonus value for a specific talent
   */
  getTalentBonus(talentId: TalentId): number {
    const level = this.getTalentLevel(talentId)
    if (level === 0) return 0

    const talent = getTalent(talentId)
    return level * talent.effectPerLevel
  }

  /**
   * Get all unlocked talents with their levels
   */
  getAllUnlockedTalents(): Array<{ talent: Talent; level: number }> {
    const result: Array<{ talent: Talent; level: number }> = []
    for (const [id, level] of this.unlockedTalents) {
      if (level > 0) {
        result.push({ talent: getTalent(id), level })
      }
    }
    return result
  }

  // ============================================
  // Bonus Calculations
  // ============================================

  /**
   * Calculate total bonuses from all unlocked talents
   * Results are cached until talents change
   */
  calculateTotalBonuses(): TalentBonuses {
    if (this.cachedBonuses) {
      return this.cachedBonuses
    }

    const bonuses = createDefaultBonuses()

    for (const [talentId, level] of this.unlockedTalents) {
      if (level <= 0) continue

      const talent = getTalent(talentId)
      const bonus = level * talent.effectPerLevel

      switch (talent.effectType) {
        case 'flat_hp':
          bonuses.flatHp += bonus
          break
        case 'flat_attack':
          bonuses.flatAttack += bonus
          break
        case 'percent_damage_reduction':
          bonuses.percentDamageReduction += bonus
          break
        case 'percent_attack_speed':
          bonuses.percentAttackSpeed += bonus
          break
        case 'flat_heal_on_level':
          bonuses.flatHealOnLevel += bonus
          break
        case 'percent_crit_chance':
          bonuses.percentCritChance += bonus
          break
        case 'percent_equipment_stats':
          bonuses.percentEquipmentStats += bonus
          break
        case 'starting_abilities':
          bonuses.startingAbilities += bonus
          break
        case 'percent_hp_when_low':
          bonuses.percentHpWhenLow += bonus
          if (talent.threshold) {
            bonuses.lowHpThreshold = talent.threshold
          }
          break
      }
    }

    this.cachedBonuses = bonuses
    return bonuses
  }

  /**
   * Invalidate the cached bonuses (called when talents change)
   */
  private invalidateBonusCache(): void {
    this.cachedBonuses = null
  }

  // ============================================
  // Daily State Management
  // ============================================

  /**
   * Create a fresh lottery state for a new day
   */
  private createFreshLotteryState(): LotteryState {
    return {
      spinsToday: 0,
      lastSpinDate: this.getTodayDateString(),
    }
  }

  /**
   * Get today's date as ISO string (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    return new Date().toISOString().split('T')[0]
  }

  /**
   * Update daily state if day has changed
   */
  private updateDailyState(): void {
    const today = this.getTodayDateString()
    if (this.lotteryState.lastSpinDate !== today) {
      this.lotteryState = this.createFreshLotteryState()
    }
  }

  // ============================================
  // Persistence (Save/Load)
  // ============================================

  /**
   * Get data for saving to storage
   */
  toSaveData(): TalentSaveData {
    const unlockedTalents: Record<string, number> = {}
    for (const [id, level] of this.unlockedTalents) {
      unlockedTalents[id] = level
    }

    return {
      unlockedTalents,
      lotteryState: { ...this.lotteryState },
    }
  }

  /**
   * Load data from storage
   */
  fromSaveData(data: TalentSaveData): void {
    // Clear existing talents
    this.unlockedTalents.clear()

    // Load talents
    if (data.unlockedTalents) {
      for (const [id, level] of Object.entries(data.unlockedTalents)) {
        // Validate talent ID exists
        if (Object.values(TalentId).includes(id as TalentId)) {
          this.unlockedTalents.set(id as TalentId, level)
        }
      }
    }

    // Load lottery state
    if (data.lotteryState) {
      this.lotteryState = {
        spinsToday: data.lotteryState.spinsToday ?? 0,
        lastSpinDate: data.lotteryState.lastSpinDate ?? this.getTodayDateString(),
      }
    } else {
      this.lotteryState = this.createFreshLotteryState()
    }

    // Update daily state in case day changed since last save
    this.updateDailyState()

    // Invalidate cache
    this.invalidateBonusCache()
  }

  /**
   * Reset all talents and lottery state
   */
  reset(): void {
    this.unlockedTalents.clear()
    this.lotteryState = this.createFreshLotteryState()
    this.invalidateBonusCache()
    this.saveToStorage()
  }

  // ============================================
  // Debug/Utility
  // ============================================

  /**
   * Get a debug snapshot of current state
   */
  getDebugSnapshot(): {
    unlockedTalents: Array<{ id: TalentId; level: number; maxLevel: number }>
    lotteryState: LotteryState
    spinCost: number
    spinsRemaining: number
    bonuses: TalentBonuses
  } {
    const talents: Array<{ id: TalentId; level: number; maxLevel: number }> = []
    for (const [id, level] of this.unlockedTalents) {
      const talent = getTalent(id)
      talents.push({ id, level, maxLevel: talent.maxLevel })
    }

    return {
      unlockedTalents: talents,
      lotteryState: { ...this.lotteryState },
      spinCost: this.getSpinCost(),
      spinsRemaining: this.getSpinsRemaining(),
      bonuses: this.calculateTotalBonuses(),
    }
  }

  /**
   * Force unlock a talent at a specific level (for testing/cheats)
   */
  forceUnlock(talentId: TalentId, level: number): void {
    const talent = getTalent(talentId)
    const clampedLevel = Math.max(0, Math.min(level, talent.maxLevel))
    this.unlockedTalents.set(talentId, clampedLevel)
    this.invalidateBonusCache()
    this.saveToStorage()
  }

  // ============================================
  // LocalStorage Persistence
  // ============================================

  /**
   * Save talent data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data = this.toSaveData()
      localStorage.setItem(TALENT_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.error('TalentManager: Failed to save data:', error)
    }
  }

  /**
   * Load talent data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(TALENT_STORAGE_KEY)
      if (stored) {
        const data = JSON.parse(stored) as TalentSaveData
        this.fromSaveData(data)
        console.log(`TalentManager: Loaded ${this.unlockedTalents.size} talents from storage`)
      }
    } catch (error) {
      console.error('TalentManager: Failed to load data:', error)
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

/** Global singleton instance for use throughout the game */
export const talentManager = new TalentManager()
