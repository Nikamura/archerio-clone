/**
 * ChestManager - Manages chest inventory with persistence support
 *
 * Handles:
 * - Tracking owned chests by type
 * - Adding/removing chests
 * - Save/load integration with localStorage
 * - Event emitting for UI updates
 */

import { ChestType, ChestRewards, CHEST_ORDER } from '../data/chestData'

// ============================================
// Types
// ============================================

/**
 * Chest inventory state
 */
export interface ChestInventory {
  wooden: number
  silver: number
  golden: number
}

/**
 * Event types emitted by ChestManager
 */
export type ChestEventType = 'chestAdded' | 'chestRemoved' | 'inventoryChanged'

/**
 * Event callback type
 */
export type ChestEventCallback = (data: ChestEventData) => void

/**
 * Event data passed to listeners
 */
export interface ChestEventData {
  chestType?: ChestType
  amount?: number
  inventory: ChestInventory
}

/**
 * Save data structure for persistence
 */
export interface ChestSaveData {
  inventory: ChestInventory
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'aura_archer_chest_data'

const DEFAULT_INVENTORY: ChestInventory = {
  wooden: 0,
  silver: 0,
  golden: 0,
}

// ============================================
// ChestManager Class
// ============================================

export class ChestManager {
  private inventory: ChestInventory
  private eventListeners: Map<ChestEventType, Set<ChestEventCallback>>

  constructor() {
    this.inventory = { ...DEFAULT_INVENTORY }
    this.eventListeners = new Map()

    // Load persisted data on initialization
    this.loadFromStorage()
  }

  // ============================================
  // Persistence (LocalStorage)
  // ============================================

  /**
   * Load chest data from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        return
      }

      const data = JSON.parse(stored) as ChestSaveData
      if (data.inventory) {
        this.inventory = {
          wooden: data.inventory.wooden ?? 0,
          silver: data.inventory.silver ?? 0,
          golden: data.inventory.golden ?? 0,
        }
      }
    } catch (error) {
      console.warn('ChestManager: Failed to load from storage:', error)
    }
  }

  /**
   * Save chest data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: ChestSaveData = {
        inventory: { ...this.inventory },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      console.warn('ChestManager: Failed to save to storage:', error)
    }
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to chest events
   */
  on(eventType: ChestEventType, callback: ChestEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set())
    }
    this.eventListeners.get(eventType)!.add(callback)
  }

  /**
   * Unsubscribe from chest events
   */
  off(eventType: ChestEventType, callback: ChestEventCallback): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.delete(callback)
    }
  }

  /**
   * Emit an event to all listeners
   */
  private emit(eventType: ChestEventType, data: ChestEventData): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach((callback) => callback(data))
    }
  }

  // ============================================
  // Core Operations
  // ============================================

  /**
   * Add a chest to inventory
   */
  addChest(type: ChestType, amount: number = 1): void {
    if (amount <= 0) {
      console.warn('ChestManager.addChest: amount must be positive')
      return
    }

    this.inventory[type] += amount

    this.emit('chestAdded', {
      chestType: type,
      amount,
      inventory: { ...this.inventory },
    })

    this.emit('inventoryChanged', {
      inventory: { ...this.inventory },
    })

    this.saveToStorage()
  }

  /**
   * Add multiple chest types at once (from rewards)
   */
  addChests(rewards: ChestRewards): void {
    let changed = false

    for (const type of CHEST_ORDER) {
      const amount = rewards[type]
      if (amount > 0) {
        this.inventory[type] += amount
        changed = true

        this.emit('chestAdded', {
          chestType: type,
          amount,
          inventory: { ...this.inventory },
        })
      }
    }

    if (changed) {
      this.emit('inventoryChanged', {
        inventory: { ...this.inventory },
      })

      this.saveToStorage()
    }
  }

  /**
   * Remove a chest from inventory
   * Returns false if not enough chests
   */
  removeChest(type: ChestType, amount: number = 1): boolean {
    if (amount <= 0) {
      console.warn('ChestManager.removeChest: amount must be positive')
      return false
    }

    if (this.inventory[type] < amount) {
      return false
    }

    this.inventory[type] -= amount

    this.emit('chestRemoved', {
      chestType: type,
      amount,
      inventory: { ...this.inventory },
    })

    this.emit('inventoryChanged', {
      inventory: { ...this.inventory },
    })

    this.saveToStorage()
    return true
  }

  /**
   * Get the count of a specific chest type
   */
  getChestCount(type: ChestType): number {
    return this.inventory[type]
  }

  /**
   * Get all chest counts
   */
  getInventory(): ChestInventory {
    return { ...this.inventory }
  }

  /**
   * Get total number of chests owned
   */
  getTotalChests(): number {
    return this.inventory.wooden + this.inventory.silver + this.inventory.golden
  }

  /**
   * Check if player has at least one chest of a type
   */
  hasChest(type: ChestType): boolean {
    return this.inventory[type] > 0
  }

  // ============================================
  // Persistence (Save/Load)
  // ============================================

  /**
   * Get data for saving
   */
  toSaveData(): ChestSaveData {
    return {
      inventory: { ...this.inventory },
    }
  }

  /**
   * Load data from save
   */
  fromSaveData(data: ChestSaveData): void {
    if (data.inventory) {
      this.inventory = {
        wooden: data.inventory.wooden ?? 0,
        silver: data.inventory.silver ?? 0,
        golden: data.inventory.golden ?? 0,
      }
    }

    this.emit('inventoryChanged', {
      inventory: { ...this.inventory },
    })
  }

  /**
   * Reset all chests
   */
  reset(): void {
    this.inventory = { ...DEFAULT_INVENTORY }
    this.saveToStorage()

    this.emit('inventoryChanged', {
      inventory: { ...this.inventory },
    })
  }

  // ============================================
  // Debug/Utility
  // ============================================

  /**
   * Get a snapshot for debugging
   */
  getDebugSnapshot(): {
    inventory: ChestInventory
    totalChests: number
  } {
    return {
      inventory: this.getInventory(),
      totalChests: this.getTotalChests(),
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

/**
 * Global singleton instance
 */
export const chestManager = new ChestManager()
