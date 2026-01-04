/**
 * AbilityPriorityManager - Manages ability priority order for auto-learning.
 *
 * When auto-learning triggers (either via auto-level-up mode or timeout),
 * the system selects the highest-priority available ability instead of random.
 *
 * Features:
 * - Drag-and-drop reorderable priority list
 * - Persistent save/load support
 * - Handles new abilities added in updates (appended to end)
 */

import { ABILITIES, AbilityData } from '../config/abilityData'

// ============================================
// Type Definitions
// ============================================

/**
 * Save data structure for AbilityPriorityManager
 */
export interface AbilityPrioritySaveData {
  /** Array of ability IDs in priority order (first = highest priority) */
  priorityOrder: string[]
}

/**
 * Event types emitted by AbilityPriorityManager
 */
export type AbilityPriorityEventType = 'priorityChanged'

/**
 * Event listener callback type
 */
export type AbilityPriorityEventCallback = (priorityOrder: string[]) => void

// ============================================
// Constants
// ============================================

/** localStorage key for ability priority data persistence */
const STORAGE_KEY = 'aura_archer_ability_priority_data'

// ============================================
// AbilityPriorityManager Class
// ============================================

class AbilityPriorityManager {
  private static _instance: AbilityPriorityManager

  /** Array of ability IDs in priority order (first = highest priority) */
  private priorityOrder: string[] = []

  /** Event listeners */
  private listeners: Map<AbilityPriorityEventType, AbilityPriorityEventCallback[]> = new Map()

  private constructor() {
    this.loadFromStorage()
  }

  /**
   * Get the singleton instance
   */
  static get instance(): AbilityPriorityManager {
    if (!AbilityPriorityManager._instance) {
      AbilityPriorityManager._instance = new AbilityPriorityManager()
    }
    return AbilityPriorityManager._instance
  }

  // ============================================
  // Public API
  // ============================================

  /**
   * Get the current priority order
   * @returns Array of ability IDs in priority order (first = highest)
   */
  getPriorityOrder(): string[] {
    return [...this.priorityOrder]
  }

  /**
   * Set a new priority order
   * @param order Array of ability IDs in desired priority order
   */
  setPriorityOrder(order: string[]): void {
    this.priorityOrder = [...order]
    this.saveToStorage()
    this.emit('priorityChanged', this.priorityOrder)
  }

  /**
   * Get the highest priority ability from a list of available abilities
   * @param availableAbilities List of abilities to choose from
   * @returns The highest priority ability, or null if list is empty
   */
  getHighestPriorityAbility(availableAbilities: AbilityData[]): AbilityData | null {
    if (availableAbilities.length === 0) {
      return null
    }

    // Find the ability with the lowest index in priority order
    let highestPriority: AbilityData | null = null
    let highestPriorityIndex = Infinity

    for (const ability of availableAbilities) {
      const priorityIndex = this.priorityOrder.indexOf(ability.id)

      if (priorityIndex === -1) {
        // Ability not in priority list (new ability), treat as lowest priority
        // but still consider it if nothing else is found
        if (highestPriority === null) {
          highestPriority = ability
        }
      } else if (priorityIndex < highestPriorityIndex) {
        highestPriorityIndex = priorityIndex
        highestPriority = ability
      }
    }

    return highestPriority
  }

  /**
   * Move an ability to a new position in the priority list
   * @param abilityId The ability to move
   * @param toIndex The target index
   */
  moveAbility(abilityId: string, toIndex: number): void {
    const fromIndex = this.priorityOrder.indexOf(abilityId)
    if (fromIndex === -1) return

    // Remove from current position
    this.priorityOrder.splice(fromIndex, 1)

    // Insert at new position
    this.priorityOrder.splice(toIndex, 0, abilityId)

    this.saveToStorage()
    this.emit('priorityChanged', this.priorityOrder)
  }

  /**
   * Reset to default priority order (order from ABILITIES array)
   */
  resetToDefault(): void {
    this.priorityOrder = ABILITIES.map((a) => a.id)
    this.saveToStorage()
    this.emit('priorityChanged', this.priorityOrder)
  }

  /**
   * Get ability data by ID
   */
  getAbilityById(abilityId: string): AbilityData | undefined {
    return ABILITIES.find((a) => a.id === abilityId)
  }

  /**
   * Get all abilities in priority order with their data
   */
  getAbilitiesInPriorityOrder(): AbilityData[] {
    return this.priorityOrder
      .map((id) => this.getAbilityById(id))
      .filter((a): a is AbilityData => a !== undefined)
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to events
   */
  on(event: AbilityPriorityEventType, callback: AbilityPriorityEventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, [])
    }
    this.listeners.get(event)!.push(callback)
  }

  /**
   * Unsubscribe from events
   */
  off(event: AbilityPriorityEventType, callback: AbilityPriorityEventCallback): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      const index = callbacks.indexOf(callback)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
    }
  }

  /**
   * Emit an event
   */
  private emit(event: AbilityPriorityEventType, data: string[]): void {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => callback(data))
    }
  }

  // ============================================
  // Persistence
  // ============================================

  /**
   * Save current state to localStorage
   */
  private saveToStorage(): void {
    const saveData: AbilityPrioritySaveData = {
      priorityOrder: this.priorityOrder,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData))
  }

  /**
   * Load state from localStorage
   */
  private loadFromStorage(): void {
    const stored = localStorage.getItem(STORAGE_KEY)

    if (stored) {
      try {
        const saveData: AbilityPrioritySaveData = JSON.parse(stored)
        this.priorityOrder = saveData.priorityOrder || []

        // Sync with master ABILITIES list - add any new abilities at the end
        this.syncWithMasterList()
      } catch (e) {
        console.error('AbilityPriorityManager: Failed to parse saved data', e)
        this.resetToDefault()
      }
    } else {
      // No saved data, use default order
      this.resetToDefault()
    }
  }

  /**
   * Sync priority list with master ABILITIES array
   * Adds any new abilities to the end of the priority list
   * Removes any abilities that no longer exist
   */
  private syncWithMasterList(): void {
    const masterIds = new Set(ABILITIES.map((a) => a.id))
    const currentIds = new Set(this.priorityOrder)

    // Remove abilities that no longer exist
    this.priorityOrder = this.priorityOrder.filter((id) => masterIds.has(id))

    // Add new abilities at the end
    for (const ability of ABILITIES) {
      if (!currentIds.has(ability.id)) {
        this.priorityOrder.push(ability.id)
      }
    }

    // Save the synced list
    this.saveToStorage()
  }

  // ============================================
  // Debug / Dev Tools
  // ============================================

  /**
   * Clear all saved data (for testing)
   */
  clearSaveData(): void {
    localStorage.removeItem(STORAGE_KEY)
    this.resetToDefault()
  }
}

// Export singleton instance
export const abilityPriorityManager = AbilityPriorityManager.instance
