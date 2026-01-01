/**
 * AchievementManager - Tracks achievement progress and rewards
 *
 * Uses SaveManager for statistics and CurrencyManager for reward payouts.
 * Maintains its own persistence for claimed rewards.
 */

import {
  Achievement,
  AchievementId as _AchievementId,
  AchievementReward,
  ACHIEVEMENTS,
  getAchievementById,
} from '../config/achievementData'
import { saveManager, EquipmentSlot } from './SaveManager'
import { currencyManager } from './CurrencyManager'

// ============================================
// Types and Interfaces
// ============================================

/** Progress data for a single achievement */
export interface AchievementProgress {
  achievementId: string
  currentValue: number
  highestCompletedTier: number // -1 if none completed
  highestClaimedTier: number // -1 if none claimed
}

/** Data structure for save/load persistence */
export interface AchievementSaveData {
  claimedTiers: Record<string, number> // achievementId -> highest claimed tier index
  totalGoldEarned: number
  totalGemsEarned: number
}

/** Event types emitted by AchievementManager */
export type AchievementEventType = 'achievementUnlocked' | 'rewardClaimed' | 'progressUpdated'

/** Event data for achievement events */
export interface AchievementEventData {
  achievementId: string
  tierIndex?: number
  reward?: AchievementReward
}

/** Event listener callback type */
export type AchievementEventCallback = (data: AchievementEventData) => void

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'archerio_achievements'

// ============================================
// AchievementManager Class
// ============================================

export class AchievementManager {
  private claimedTiers: Map<string, number>
  private totalGoldEarned: number
  private totalGemsEarned: number
  private eventListeners: Map<AchievementEventType, Set<AchievementEventCallback>>

  constructor() {
    this.claimedTiers = new Map()
    this.totalGoldEarned = 0
    this.totalGemsEarned = 0
    this.eventListeners = new Map()

    this.loadFromStorage()
  }

  // ============================================
  // Persistence
  // ============================================

  /**
   * Load achievement data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const data = JSON.parse(stored) as AchievementSaveData

      if (data.claimedTiers) {
        this.claimedTiers = new Map(Object.entries(data.claimedTiers))
      }

      this.totalGoldEarned = data.totalGoldEarned ?? 0
      this.totalGemsEarned = data.totalGemsEarned ?? 0
    } catch (error) {
      console.warn('AchievementManager: Failed to load from storage:', error)
    }
  }

  /**
   * Save achievement data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: AchievementSaveData = {
        claimedTiers: Object.fromEntries(this.claimedTiers),
        totalGoldEarned: this.totalGoldEarned,
        totalGemsEarned: this.totalGemsEarned,
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('AchievementManager: Failed to save to storage:', error)
    }
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to achievement events
   */
  on(eventType: AchievementEventType, callback: AchievementEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(callback)
  }

  /**
   * Unsubscribe from achievement events
   */
  off(eventType: AchievementEventType, callback: AchievementEventCallback): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: AchievementEventType, data: AchievementEventData): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  // ============================================
  // Statistics Gathering
  // ============================================

  /**
   * Get the current value for an achievement's tracked stat
   */
  private getStatValue(statKey: string): number {
    const stats = saveManager.getStatistics()
    const heroes = saveManager.getAllHeroes()
    const equipped = saveManager.getData().equipped
    const talents = saveManager.getData().talents

    switch (statKey) {
      case 'totalKills':
        return stats.totalKills
      case 'totalRuns':
        return stats.totalRuns
      case 'bossesDefeated':
        return stats.bossesDefeated
      case 'totalPlayTimeMinutes':
        // Convert milliseconds to minutes
        return Math.floor(stats.totalPlayTimeMs / 60000)
      case 'unlockedHeroes':
        // Count unlocked heroes
        return Object.values(heroes).filter((h) => h.unlocked).length
      case 'equippedSlots':
        // Count equipped slots
        return Object.values(EquipmentSlot).filter((slot) => equipped[slot] !== null).length
      case 'unlockedTalents':
        // Count unique talents unlocked
        return talents.filter((t) => t.level > 0).length
      default:
        console.warn(`AchievementManager: Unknown stat key "${statKey}"`)
        return 0
    }
  }

  // ============================================
  // Progress and Status
  // ============================================

  /**
   * Get progress for a specific achievement
   */
  getProgress(achievementId: string): AchievementProgress | null {
    const achievement = getAchievementById(achievementId)
    if (!achievement) return null

    const currentValue = this.getStatValue(achievement.statKey)
    const highestClaimedTier = this.claimedTiers.get(achievementId) ?? -1

    // Calculate highest completed tier
    let highestCompletedTier = -1
    for (let i = 0; i < achievement.tiers.length; i++) {
      if (currentValue >= achievement.tiers[i].requirement) {
        highestCompletedTier = i
      } else {
        break
      }
    }

    return {
      achievementId,
      currentValue,
      highestCompletedTier,
      highestClaimedTier,
    }
  }

  /**
   * Get progress for all achievements
   */
  getAllProgress(): AchievementProgress[] {
    return ACHIEVEMENTS.map((a) => this.getProgress(a.id)).filter(
      (p): p is AchievementProgress => p !== null
    )
  }

  /**
   * Get list of achievements with unclaimed rewards
   */
  getUnclaimedRewards(): { achievement: Achievement; unclaimedTiers: number[] }[] {
    const unclaimed: { achievement: Achievement; unclaimedTiers: number[] }[] = []

    for (const achievement of ACHIEVEMENTS) {
      const progress = this.getProgress(achievement.id)
      if (!progress) continue

      const unclaimedTiers: number[] = []
      for (let i = 0; i <= progress.highestCompletedTier; i++) {
        if (i > progress.highestClaimedTier) {
          unclaimedTiers.push(i)
        }
      }

      if (unclaimedTiers.length > 0) {
        unclaimed.push({ achievement, unclaimedTiers })
      }
    }

    return unclaimed
  }

  /**
   * Check if there are any unclaimed rewards
   */
  hasUnclaimedRewards(): boolean {
    return this.getUnclaimedRewards().length > 0
  }

  /**
   * Get count of total unclaimed rewards
   */
  getUnclaimedRewardsCount(): number {
    return this.getUnclaimedRewards().reduce((total, item) => total + item.unclaimedTiers.length, 0)
  }

  // ============================================
  // Achievement Checking
  // ============================================

  /**
   * Check all achievements and emit events for newly completed tiers
   * Call this after stat changes (e.g., in GameOverScene)
   */
  checkAchievements(): void {
    for (const achievement of ACHIEVEMENTS) {
      const progress = this.getProgress(achievement.id)
      if (!progress) continue

      const highestClaimedTier = this.claimedTiers.get(achievement.id) ?? -1

      // Check for newly completed tiers
      for (let i = highestClaimedTier + 1; i <= progress.highestCompletedTier; i++) {
        // Only emit for newly discovered completions (not previously seen)
        this.emit('achievementUnlocked', {
          achievementId: achievement.id,
          tierIndex: i,
        })
      }
    }

    this.emit('progressUpdated', { achievementId: '' })
  }

  // ============================================
  // Reward Claiming
  // ============================================

  /**
   * Claim reward for a specific achievement tier
   * @param achievementId The achievement ID
   * @param tierIndex The tier index to claim (0-based)
   * @returns true if claim was successful
   */
  claimReward(achievementId: string, tierIndex: number): boolean {
    const achievement = getAchievementById(achievementId)
    if (!achievement) {
      console.warn(`AchievementManager: Unknown achievement "${achievementId}"`)
      return false
    }

    if (tierIndex < 0 || tierIndex >= achievement.tiers.length) {
      console.warn(`AchievementManager: Invalid tier index ${tierIndex} for "${achievementId}"`)
      return false
    }

    const progress = this.getProgress(achievementId)
    if (!progress) return false

    // Check if tier is completed
    if (tierIndex > progress.highestCompletedTier) {
      console.warn(`AchievementManager: Tier ${tierIndex} not yet completed for "${achievementId}"`)
      return false
    }

    // Check if tier is already claimed
    if (tierIndex <= progress.highestClaimedTier) {
      console.warn(`AchievementManager: Tier ${tierIndex} already claimed for "${achievementId}"`)
      return false
    }

    // Get reward
    const tier = achievement.tiers[tierIndex]
    const reward = tier.reward

    // Award currencies
    if (reward.gold && reward.gold > 0) {
      currencyManager.add('gold', reward.gold)
      this.totalGoldEarned += reward.gold
    }
    if (reward.gems && reward.gems > 0) {
      currencyManager.add('gems', reward.gems)
      this.totalGemsEarned += reward.gems
    }

    // Update claimed tier
    this.claimedTiers.set(achievementId, tierIndex)
    this.saveToStorage()

    // Emit event
    this.emit('rewardClaimed', {
      achievementId,
      tierIndex,
      reward,
    })

    console.log(
      `AchievementManager: Claimed "${achievement.name}" tier ${tierIndex + 1} - ` +
        `Gold: ${reward.gold ?? 0}, Gems: ${reward.gems ?? 0}`
    )

    return true
  }

  /**
   * Claim all available rewards for an achievement
   * @returns Total rewards claimed
   */
  claimAllRewardsForAchievement(achievementId: string): AchievementReward {
    const achievement = getAchievementById(achievementId)
    if (!achievement) return { gold: 0, gems: 0 }

    const progress = this.getProgress(achievementId)
    if (!progress) return { gold: 0, gems: 0 }

    let totalGold = 0
    let totalGems = 0

    for (let i = progress.highestClaimedTier + 1; i <= progress.highestCompletedTier; i++) {
      if (this.claimReward(achievementId, i)) {
        const tier = achievement.tiers[i]
        totalGold += tier.reward.gold ?? 0
        totalGems += tier.reward.gems ?? 0
      }
    }

    return { gold: totalGold, gems: totalGems }
  }

  /**
   * Claim all available rewards across all achievements
   */
  claimAllRewards(): AchievementReward {
    let totalGold = 0
    let totalGems = 0

    for (const achievement of ACHIEVEMENTS) {
      const reward = this.claimAllRewardsForAchievement(achievement.id)
      totalGold += reward.gold ?? 0
      totalGems += reward.gems ?? 0
    }

    return { gold: totalGold, gems: totalGems }
  }

  // ============================================
  // Statistics
  // ============================================

  /**
   * Get total gold earned from achievements
   */
  getTotalGoldEarned(): number {
    return this.totalGoldEarned
  }

  /**
   * Get total gems earned from achievements
   */
  getTotalGemsEarned(): number {
    return this.totalGemsEarned
  }

  // ============================================
  // Save/Load Integration
  // ============================================

  /**
   * Get data for external save system
   */
  toSaveData(): AchievementSaveData {
    return {
      claimedTiers: Object.fromEntries(this.claimedTiers),
      totalGoldEarned: this.totalGoldEarned,
      totalGemsEarned: this.totalGemsEarned,
    }
  }

  /**
   * Load data from external save system
   */
  fromSaveData(data: AchievementSaveData): void {
    if (data.claimedTiers) {
      this.claimedTiers = new Map(Object.entries(data.claimedTiers))
    }
    this.totalGoldEarned = data.totalGoldEarned ?? 0
    this.totalGemsEarned = data.totalGemsEarned ?? 0
    this.saveToStorage()
  }

  /**
   * Reset all achievement progress
   */
  reset(): void {
    this.claimedTiers.clear()
    this.totalGoldEarned = 0
    this.totalGemsEarned = 0
    this.saveToStorage()
  }
}

// ============================================
// Singleton Instance
// ============================================

export const achievementManager = new AchievementManager()
