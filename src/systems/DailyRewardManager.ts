/**
 * DailyRewardManager - Manages the 7-day daily reward calendar system.
 * Tracks consecutive login days and handles reward claiming.
 * No Phaser dependencies - fully unit testable.
 */

import { currencyManager } from './CurrencyManager'

// ============================================
// Types and Interfaces
// ============================================

/** Reward types that can be given */
export type RewardType = 'gold' | 'gems' | 'energy'

/** Single reward entry */
export interface Reward {
  type: RewardType
  amount: number
}

/** Daily reward configuration */
export interface DailyReward {
  day: number // 1-7
  rewards: Reward[]
  description: string
}

/** Save data structure for persistence */
export interface DailyRewardSaveData {
  lastClaimTimestamp: number | null
  currentDay: number // 1-7
  claimedToday: boolean
}

/** Event types emitted by DailyRewardManager */
export type DailyRewardEventType =
  | 'rewardClaimed'
  | 'streakReset'
  | 'cycleCompleted'

/** Event listener callback type */
export type DailyRewardEventCallback = (data: DailyRewardEventData) => void

/** Event data passed to listeners */
export interface DailyRewardEventData {
  day: number
  rewards?: Reward[]
  streakBroken?: boolean
}

// ============================================
// Constants
// ============================================

/** LocalStorage key for daily reward data */
const DAILY_REWARD_STORAGE_KEY = 'archerio_daily_rewards'

/** Maximum hours allowed between claims before streak resets (48 hours) */
const STREAK_TIMEOUT_HOURS = 48

/** Milliseconds in an hour */
const MS_PER_HOUR = 60 * 60 * 1000

/** Maximum energy value for full refill */
const MAX_ENERGY = 20

/**
 * Daily reward configuration for 7-day cycle
 * Day 7 includes a full energy refill (20 energy)
 */
export const DAILY_REWARDS: DailyReward[] = [
  {
    day: 1,
    rewards: [{ type: 'gold', amount: 100 }],
    description: '100 Gold',
  },
  {
    day: 2,
    rewards: [{ type: 'gold', amount: 200 }],
    description: '200 Gold',
  },
  {
    day: 3,
    rewards: [{ type: 'gems', amount: 10 }],
    description: '10 Gems',
  },
  {
    day: 4,
    rewards: [{ type: 'gold', amount: 500 }],
    description: '500 Gold',
  },
  {
    day: 5,
    rewards: [{ type: 'gems', amount: 20 }],
    description: '20 Gems',
  },
  {
    day: 6,
    rewards: [{ type: 'gold', amount: 1000 }],
    description: '1000 Gold',
  },
  {
    day: 7,
    rewards: [
      { type: 'gems', amount: 50 },
      { type: 'energy', amount: MAX_ENERGY },
    ],
    description: '50 Gems + Full Energy',
  },
]

// ============================================
// DailyRewardManager Class
// ============================================

export class DailyRewardManager {
  private lastClaimTimestamp: number | null = null
  private currentDay: number = 1
  private claimedToday: boolean = false
  private eventListeners: Map<DailyRewardEventType, Set<DailyRewardEventCallback>> = new Map()

  constructor() {
    this.loadFromStorage()
    this.checkStreakStatus()
  }

  // ============================================
  // Persistence (LocalStorage)
  // ============================================

  /**
   * Load daily reward data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(DAILY_REWARD_STORAGE_KEY)
      if (!stored) {
        return
      }

      const data = JSON.parse(stored) as DailyRewardSaveData
      this.lastClaimTimestamp = data.lastClaimTimestamp ?? null
      this.currentDay = data.currentDay ?? 1
      this.claimedToday = data.claimedToday ?? false
    } catch (error) {
      console.warn('DailyRewardManager: Failed to load from storage:', error)
    }
  }

  /**
   * Save daily reward data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: DailyRewardSaveData = {
        lastClaimTimestamp: this.lastClaimTimestamp,
        currentDay: this.currentDay,
        claimedToday: this.claimedToday,
      }
      localStorage.setItem(DAILY_REWARD_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('DailyRewardManager: Failed to save to storage:', error)
    }
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to daily reward events
   */
  on(eventType: DailyRewardEventType, callback: DailyRewardEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(callback)
  }

  /**
   * Unsubscribe from daily reward events
   */
  off(eventType: DailyRewardEventType, callback: DailyRewardEventCallback): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: DailyRewardEventType, data: DailyRewardEventData): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach(callback => callback(data))
    }
  }

  // ============================================
  // Core Logic
  // ============================================

  /**
   * Check if streak has been broken and reset if necessary
   * Called on initialization and when checking claim status
   */
  private checkStreakStatus(currentTime: number = Date.now()): void {
    if (this.lastClaimTimestamp === null) {
      // First time player - no streak to check
      return
    }

    const hoursSinceLastClaim = (currentTime - this.lastClaimTimestamp) / MS_PER_HOUR

    // Reset streak if more than 48 hours have passed
    if (hoursSinceLastClaim > STREAK_TIMEOUT_HOURS) {
      this.resetStreak()
      this.emit('streakReset', { day: 1, streakBroken: true })
      return
    }

    // Check if it's a new day (past midnight)
    const lastClaimDate = new Date(this.lastClaimTimestamp)
    const currentDate = new Date(currentTime)

    // Compare dates (ignore time)
    const lastClaimDay = new Date(
      lastClaimDate.getFullYear(),
      lastClaimDate.getMonth(),
      lastClaimDate.getDate()
    ).getTime()

    const currentDay = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate()
    ).getTime()

    // If it's a different day, reset claimedToday
    if (currentDay > lastClaimDay) {
      this.claimedToday = false
      this.saveToStorage()
    }
  }

  /**
   * Reset streak back to day 1
   */
  private resetStreak(): void {
    this.currentDay = 1
    this.claimedToday = false
    this.lastClaimTimestamp = null
    this.saveToStorage()
  }

  /**
   * Check if player can claim today's reward
   */
  canClaimToday(currentTime: number = Date.now()): boolean {
    // Re-check streak status to handle edge cases
    this.checkStreakStatus(currentTime)
    return !this.claimedToday
  }

  /**
   * Claim today's reward
   * @returns The rewards that were granted, or null if claim failed
   */
  claimReward(currentTime: number = Date.now()): Reward[] | null {
    // Verify claim is valid
    if (!this.canClaimToday(currentTime)) {
      return null
    }

    // Get today's reward
    const dailyReward = this.getDailyReward(this.currentDay)
    if (!dailyReward) {
      console.error('DailyRewardManager: Invalid day configuration')
      return null
    }

    // Grant rewards
    const grantedRewards: Reward[] = []
    for (const reward of dailyReward.rewards) {
      currencyManager.add(reward.type, reward.amount)
      grantedRewards.push({ ...reward })
    }

    // Update state
    this.lastClaimTimestamp = currentTime
    this.claimedToday = true

    // Emit event
    this.emit('rewardClaimed', {
      day: this.currentDay,
      rewards: grantedRewards,
    })

    // Check if cycle completed (day 7)
    if (this.currentDay === 7) {
      this.emit('cycleCompleted', { day: 7 })
    }

    // Advance to next day (wrap around after day 7)
    this.currentDay = this.currentDay >= 7 ? 1 : this.currentDay + 1

    this.saveToStorage()

    return grantedRewards
  }

  /**
   * Get the current day in the 7-day cycle (1-7)
   */
  getCurrentDay(): number {
    return this.currentDay
  }

  /**
   * Get the reward configuration for a specific day
   */
  getDailyReward(day: number): DailyReward | undefined {
    return DAILY_REWARDS.find(r => r.day === day)
  }

  /**
   * Get all daily rewards configuration
   */
  getAllDailyRewards(): DailyReward[] {
    return [...DAILY_REWARDS]
  }

  /**
   * Check if a specific day has been claimed in the current cycle
   * Days less than currentDay have been claimed (unless streak was reset)
   * currentDay and higher are NOT claimed yet (currentDay is what you claim next)
   */
  isDayClaimed(day: number): boolean {
    // Days before currentDay have been claimed in this cycle
    if (day < this.currentDay) {
      return true
    }
    // currentDay and future days have NOT been claimed yet
    // Note: claimedToday is used by canClaimToday() to prevent multiple claims per day,
    // but for display purposes, currentDay is always the "next day to claim"
    return false
  }

  /**
   * Get time until next claim is available (in milliseconds)
   * Returns 0 if claim is available now
   */
  getTimeUntilNextClaim(currentTime: number = Date.now()): number {
    if (this.canClaimToday(currentTime)) {
      return 0
    }

    if (this.lastClaimTimestamp === null) {
      return 0
    }

    // Calculate time until midnight
    const currentDate = new Date(currentTime)
    const tomorrow = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDate.getDate() + 1
    )

    return tomorrow.getTime() - currentTime
  }

  /**
   * Get formatted time until next claim (HH:MM:SS or "Available!")
   */
  getFormattedTimeUntilNextClaim(currentTime: number = Date.now()): string {
    const timeMs = this.getTimeUntilNextClaim(currentTime)

    if (timeMs === 0) {
      return 'Available!'
    }

    const totalSeconds = Math.ceil(timeMs / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  /**
   * Get the current streak length (days claimed in current cycle)
   */
  getStreakLength(): number {
    // If we haven't claimed today, the streak is currentDay - 1
    // If we have claimed today, the streak includes today
    if (this.lastClaimTimestamp === null) {
      return 0
    }
    return this.claimedToday ? this.currentDay : this.currentDay - 1
  }

  // ============================================
  // Persistence (Save/Load) - For SaveManager integration
  // ============================================

  /**
   * Get data for saving to storage
   */
  toSaveData(): DailyRewardSaveData {
    return {
      lastClaimTimestamp: this.lastClaimTimestamp,
      currentDay: this.currentDay,
      claimedToday: this.claimedToday,
    }
  }

  /**
   * Load data from storage
   */
  fromSaveData(data: DailyRewardSaveData): void {
    this.lastClaimTimestamp = data.lastClaimTimestamp ?? null
    this.currentDay = data.currentDay ?? 1
    this.claimedToday = data.claimedToday ?? false

    // Re-check streak status after loading
    this.checkStreakStatus()
  }

  /**
   * Reset all daily reward data (for testing or new game)
   */
  reset(): void {
    this.lastClaimTimestamp = null
    this.currentDay = 1
    this.claimedToday = false
    this.saveToStorage()
  }

  // ============================================
  // Debug/Utility
  // ============================================

  /**
   * Get a snapshot of current state for debugging
   */
  getDebugSnapshot(): {
    currentDay: number
    claimedToday: boolean
    lastClaimTimestamp: number | null
    canClaim: boolean
    timeUntilNextClaim: string
    streakLength: number
  } {
    return {
      currentDay: this.currentDay,
      claimedToday: this.claimedToday,
      lastClaimTimestamp: this.lastClaimTimestamp,
      canClaim: this.canClaimToday(),
      timeUntilNextClaim: this.getFormattedTimeUntilNextClaim(),
      streakLength: this.getStreakLength(),
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

/** Global singleton instance for use throughout the game */
export const dailyRewardManager = new DailyRewardManager()
