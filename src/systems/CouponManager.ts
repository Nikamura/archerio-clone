/**
 * CouponManager - Manages one-time compensation coupons for players.
 * Tracks redeemed coupons and handles reward distribution.
 * No Phaser dependencies - fully unit testable.
 */

import { currencyManager } from './CurrencyManager'

// ============================================
// Types and Interfaces
// ============================================

/** Reward types that can be given by coupons */
export type CouponRewardType = 'gold' | 'gems' | 'energy'

/** Single reward entry */
export interface CouponReward {
  type: CouponRewardType
  amount: number
}

/** Coupon definition */
export interface CouponDefinition {
  code: string
  rewards: CouponReward[]
  description: string
  /** Optional teaser text shown before reveal (for dramatic effect) */
  teaserDescription?: string
  /** If true, shows teaser first then reveals real reward */
  hasReveal?: boolean
}

/** Save data structure for persistence */
export interface CouponSaveData {
  redeemedCoupons: string[]
}

/** Result of a coupon redemption attempt */
export interface CouponRedemptionResult {
  success: boolean
  error?: 'invalid_code' | 'already_redeemed'
  coupon?: CouponDefinition
  rewards?: CouponReward[]
}

/** Event types emitted by CouponManager */
export type CouponEventType = 'couponRedeemed'

/** Event listener callback type */
export type CouponEventCallback = (data: CouponEventData) => void

/** Event data passed to listeners */
export interface CouponEventData {
  code: string
  rewards: CouponReward[]
}

// ============================================
// Constants
// ============================================

/** LocalStorage key for coupon data */
const COUPON_STORAGE_KEY = 'aura_archer_coupon_data'

/**
 * Available compensation coupons
 * Add new coupons here when needed
 */
export const COUPONS: CouponDefinition[] = [
  {
    code: 'BAD_MIGRATION',
    rewards: [
      { type: 'gold', amount: 100000 },
      { type: 'gems', amount: 600 },
      { type: 'energy', amount: 100 },
    ],
    description: '100K Gold + 600 Gems + 100 Energy',
    teaserDescription: '100,000,000 Gold!!!',
    hasReveal: true,
  },
]

// ============================================
// CouponManager Class
// ============================================

export class CouponManager {
  private static _instance: CouponManager
  private redeemedCoupons: Set<string> = new Set()
  private eventListeners: Map<CouponEventType, Set<CouponEventCallback>> = new Map()

  private constructor() {
    this.loadFromStorage()
  }

  static get instance(): CouponManager {
    if (!CouponManager._instance) {
      CouponManager._instance = new CouponManager()
    }
    return CouponManager._instance
  }

  // ============================================
  // Persistence (LocalStorage)
  // ============================================

  /**
   * Load coupon data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(COUPON_STORAGE_KEY)
      if (!stored) {
        return
      }

      const data = JSON.parse(stored) as CouponSaveData
      this.redeemedCoupons = new Set(data.redeemedCoupons ?? [])
    } catch (error) {
      console.warn('CouponManager: Failed to load from storage:', error)
    }
  }

  /**
   * Save coupon data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: CouponSaveData = {
        redeemedCoupons: Array.from(this.redeemedCoupons),
      }
      localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('CouponManager: Failed to save to storage:', error)
    }
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to coupon events
   */
  on(eventType: CouponEventType, callback: CouponEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(callback)
  }

  /**
   * Unsubscribe from coupon events
   */
  off(eventType: CouponEventType, callback: CouponEventCallback): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: CouponEventType, data: CouponEventData): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach(callback => callback(data))
    }
  }

  // ============================================
  // Core Logic
  // ============================================

  /**
   * Find a coupon by its code (case-insensitive)
   */
  getCoupon(code: string): CouponDefinition | undefined {
    const normalizedCode = code.toUpperCase().trim()
    return COUPONS.find(c => c.code === normalizedCode)
  }

  /**
   * Check if a coupon code has already been redeemed
   */
  isRedeemed(code: string): boolean {
    const normalizedCode = code.toUpperCase().trim()
    return this.redeemedCoupons.has(normalizedCode)
  }

  /**
   * Attempt to redeem a coupon code
   * @returns Result indicating success/failure and rewards if successful
   */
  redeemCoupon(code: string): CouponRedemptionResult {
    const normalizedCode = code.toUpperCase().trim()

    // Check if coupon exists
    const coupon = this.getCoupon(normalizedCode)
    if (!coupon) {
      return { success: false, error: 'invalid_code' }
    }

    // Check if already redeemed
    if (this.isRedeemed(normalizedCode)) {
      return { success: false, error: 'already_redeemed' }
    }

    // Grant rewards
    const grantedRewards: CouponReward[] = []
    for (const reward of coupon.rewards) {
      currencyManager.add(reward.type, reward.amount)
      grantedRewards.push({ ...reward })
    }

    // Mark as redeemed
    this.redeemedCoupons.add(normalizedCode)
    this.saveToStorage()

    // Emit event
    this.emit('couponRedeemed', {
      code: normalizedCode,
      rewards: grantedRewards,
    })

    return {
      success: true,
      coupon,
      rewards: grantedRewards,
    }
  }

  /**
   * Get all available (not yet redeemed) coupons
   * Note: This is for internal/debug use - don't expose to players
   */
  getAvailableCoupons(): CouponDefinition[] {
    return COUPONS.filter(c => !this.isRedeemed(c.code))
  }

  /**
   * Get count of redeemed coupons
   */
  getRedeemedCount(): number {
    return this.redeemedCoupons.size
  }

  // ============================================
  // Persistence (Save/Load) - For SaveManager integration
  // ============================================

  /**
   * Get data for saving to storage
   */
  toSaveData(): CouponSaveData {
    return {
      redeemedCoupons: Array.from(this.redeemedCoupons),
    }
  }

  /**
   * Load data from storage
   */
  fromSaveData(data: CouponSaveData): void {
    this.redeemedCoupons = new Set(data.redeemedCoupons ?? [])
  }

  /**
   * Reset all coupon data (for testing or new game)
   */
  reset(): void {
    this.redeemedCoupons.clear()
    this.saveToStorage()
  }

  // ============================================
  // Debug/Utility
  // ============================================

  /**
   * Get a snapshot of current state for debugging
   */
  getDebugSnapshot(): {
    redeemedCoupons: string[]
    availableCount: number
    totalCoupons: number
  } {
    return {
      redeemedCoupons: Array.from(this.redeemedCoupons),
      availableCount: this.getAvailableCoupons().length,
      totalCoupons: COUPONS.length,
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

/** Global singleton instance for use throughout the game */
export const couponManager = CouponManager.instance
