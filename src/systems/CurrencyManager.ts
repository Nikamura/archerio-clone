/**
 * CurrencyManager - Manages all in-game currencies with persistence support.
 * No Phaser dependencies for core logic - fully unit testable.
 * Uses EventEmitter pattern for UI updates.
 */

// ============================================
// Types and Interfaces
// ============================================

/** Currency types available in the game */
export type CurrencyType = 'gold' | 'gems' | 'scrolls' | 'energy';

/** Current state of all currencies */
export interface CurrencyState {
  gold: number;
  gems: number;
  scrolls: number;
  energy: number;
}

/** Data structure for save/load persistence */
export interface CurrencySaveData {
  currencies: CurrencyState;
  lastEnergyUpdate: number;
}

/** Enemy types for gold drop calculations */
export type EnemyType = 'melee' | 'ranged' | 'spreader' | 'boss';

/** Gold drop ranges per enemy type */
interface GoldDropRange {
  min: number;
  max: number;
}

/** Event types emitted by CurrencyManager */
export type CurrencyEventType =
  | 'currencyChanged'
  | 'energyRegenerated'
  | 'insufficientFunds';

/** Event listener callback type */
export type CurrencyEventCallback = (data: CurrencyEventData) => void;

/** Event data passed to listeners */
export interface CurrencyEventData {
  type: CurrencyType;
  oldValue: number;
  newValue: number;
  delta: number;
}

// ============================================
// Constants
// ============================================

/** Maximum energy capacity */
const MAX_ENERGY = 20;

/** Energy regeneration interval in milliseconds (12 minutes) */
const ENERGY_REGEN_INTERVAL_MS = 12 * 60 * 1000; // 720000ms

/** Gold drop ranges per enemy type */
const GOLD_DROP_RANGES: Record<EnemyType, GoldDropRange> = {
  melee: { min: 5, max: 10 },
  ranged: { min: 8, max: 15 },
  spreader: { min: 10, max: 20 },
  boss: { min: 50, max: 100 },
};

/** Default starting currency values */
const DEFAULT_CURRENCIES: CurrencyState = {
  gold: 0,
  gems: 0,
  scrolls: 0,
  energy: 5, // Start with 5 energy for runs
};

/** LocalStorage key for currency data persistence */
const CURRENCY_STORAGE_KEY = 'archerio_currency_data';

// ============================================
// CurrencyManager Class
// ============================================

export class CurrencyManager {
  private currencies: CurrencyState;
  private lastEnergyUpdate: number;
  private eventListeners: Map<CurrencyEventType, Set<CurrencyEventCallback>>;

  constructor() {
    this.currencies = { ...DEFAULT_CURRENCIES };
    this.lastEnergyUpdate = Date.now();
    this.eventListeners = new Map();

    // Load persisted data on initialization
    this.loadFromStorage();
  }

  // ============================================
  // Persistence (LocalStorage)
  // ============================================

  /**
   * Load currency data from localStorage
   * Calculates energy regeneration based on time since last save
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (!stored) {
        return;
      }

      const data = JSON.parse(stored) as CurrencySaveData;
      if (data.currencies) {
        this.currencies = {
          gold: data.currencies.gold ?? DEFAULT_CURRENCIES.gold,
          gems: data.currencies.gems ?? DEFAULT_CURRENCIES.gems,
          scrolls: data.currencies.scrolls ?? DEFAULT_CURRENCIES.scrolls,
          energy: data.currencies.energy ?? DEFAULT_CURRENCIES.energy,
        };
      }

      if (data.lastEnergyUpdate) {
        this.lastEnergyUpdate = data.lastEnergyUpdate;
      }

      // Calculate energy regeneration based on time passed since last save
      this.updateEnergyRegeneration();
    } catch (error) {
      console.warn('CurrencyManager: Failed to load from storage:', error);
    }
  }

  /**
   * Save currency data to localStorage
   */
  private saveToStorage(): void {
    try {
      const data: CurrencySaveData = {
        currencies: { ...this.currencies },
        lastEnergyUpdate: this.lastEnergyUpdate,
      };
      localStorage.setItem(CURRENCY_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('CurrencyManager: Failed to save to storage:', error);
    }
  }

  // ============================================
  // Event System
  // ============================================

  /**
   * Subscribe to currency events
   * @param eventType The type of event to listen for
   * @param callback Function to call when event occurs
   */
  on(eventType: CurrencyEventType, callback: CurrencyEventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  /**
   * Unsubscribe from currency events
   * @param eventType The type of event to stop listening for
   * @param callback The callback to remove
   */
  off(eventType: CurrencyEventType, callback: CurrencyEventCallback): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit an event to all listeners
   * @param eventType The type of event
   * @param data Event data to pass to listeners
   */
  private emit(eventType: CurrencyEventType, data: CurrencyEventData): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }

  // ============================================
  // Core Currency Operations
  // ============================================

  /**
   * Add currency of a specific type
   * @param type Currency type to add
   * @param amount Amount to add (must be positive)
   * @returns The new total for that currency
   */
  add(type: CurrencyType, amount: number): number {
    if (amount < 0) {
      console.warn('CurrencyManager.add: amount must be positive, use spend() for deductions');
      return this.currencies[type];
    }

    const oldValue = this.currencies[type];
    let newValue = oldValue + amount;

    // Energy has a maximum cap
    if (type === 'energy') {
      newValue = Math.min(newValue, MAX_ENERGY);
    }

    this.currencies[type] = newValue;

    this.emit('currencyChanged', {
      type,
      oldValue,
      newValue,
      delta: newValue - oldValue,
    });

    // Persist changes to storage
    this.saveToStorage();

    return newValue;
  }

  /**
   * Spend currency of a specific type
   * @param type Currency type to spend
   * @param amount Amount to spend (must be positive)
   * @returns true if successful, false if insufficient funds
   */
  spend(type: CurrencyType, amount: number): boolean {
    if (amount < 0) {
      console.warn('CurrencyManager.spend: amount must be positive');
      return false;
    }

    if (!this.canAfford(type, amount)) {
      this.emit('insufficientFunds', {
        type,
        oldValue: this.currencies[type],
        newValue: this.currencies[type],
        delta: 0,
      });
      return false;
    }

    const oldValue = this.currencies[type];
    const newValue = oldValue - amount;
    this.currencies[type] = newValue;

    this.emit('currencyChanged', {
      type,
      oldValue,
      newValue,
      delta: -amount,
    });

    // Persist changes to storage
    this.saveToStorage();

    return true;
  }

  /**
   * Check if player can afford a specific amount
   * @param type Currency type to check
   * @param amount Amount to check
   * @returns true if player has enough
   */
  canAfford(type: CurrencyType, amount: number): boolean {
    return this.currencies[type] >= amount;
  }

  /**
   * Get current amount of a specific currency
   * @param type Currency type to get
   * @returns Current amount
   */
  get(type: CurrencyType): number {
    return this.currencies[type];
  }

  /**
   * Get all currency amounts
   * @returns Copy of current currency state
   */
  getAll(): CurrencyState {
    return { ...this.currencies };
  }

  // ============================================
  // Energy System
  // ============================================

  /**
   * Spend energy to start a run
   * @param amount Energy cost (default: 1)
   * @returns true if successful, false if insufficient energy
   */
  spendEnergy(amount: number = 1): boolean {
    const success = this.spend('energy', amount);
    if (success) {
      this.lastEnergyUpdate = Date.now();
      // Note: saveToStorage() is already called by spend(), but we call again
      // to ensure lastEnergyUpdate is persisted
      this.saveToStorage();
    }
    return success;
  }

  /**
   * Calculate and apply energy regeneration based on time passed
   * Should be called on game load/resume
   * @param currentTime Current timestamp (defaults to Date.now())
   * @returns Number of energy regenerated
   */
  updateEnergyRegeneration(currentTime: number = Date.now()): number {
    const currentEnergy = this.currencies.energy;

    // No need to regenerate if already at max
    if (currentEnergy >= MAX_ENERGY) {
      this.lastEnergyUpdate = currentTime;
      return 0;
    }

    const timePassed = currentTime - this.lastEnergyUpdate;
    const energyToRegen = Math.floor(timePassed / ENERGY_REGEN_INTERVAL_MS);

    if (energyToRegen <= 0) {
      return 0;
    }

    const oldValue = currentEnergy;
    const newValue = Math.min(currentEnergy + energyToRegen, MAX_ENERGY);
    const actualRegen = newValue - oldValue;

    if (actualRegen > 0) {
      this.currencies.energy = newValue;

      // Update lastEnergyUpdate to account for partial regeneration
      // Keep the remainder time so we don't lose progress
      const timeUsed = energyToRegen * ENERGY_REGEN_INTERVAL_MS;
      this.lastEnergyUpdate = this.lastEnergyUpdate + timeUsed;

      this.emit('energyRegenerated', {
        type: 'energy',
        oldValue,
        newValue,
        delta: actualRegen,
      });

      // Persist the updated energy and timestamp
      this.saveToStorage();
    }

    return actualRegen;
  }

  /**
   * Get time remaining until next energy regeneration (in milliseconds)
   * @param currentTime Current timestamp (defaults to Date.now())
   * @returns Time until next energy in ms, or 0 if at max energy
   */
  getTimeUntilNextEnergy(currentTime: number = Date.now()): number {
    if (this.currencies.energy >= MAX_ENERGY) {
      return 0;
    }

    const timePassed = currentTime - this.lastEnergyUpdate;
    const timeRemaining = ENERGY_REGEN_INTERVAL_MS - (timePassed % ENERGY_REGEN_INTERVAL_MS);

    return timeRemaining;
  }

  /**
   * Get formatted time until next energy (MM:SS)
   * @param currentTime Current timestamp (defaults to Date.now())
   * @returns Formatted string like "05:30" or "--:--" if at max
   */
  getFormattedTimeUntilNextEnergy(currentTime: number = Date.now()): string {
    const timeMs = this.getTimeUntilNextEnergy(currentTime);

    if (timeMs === 0) {
      return '--:--';
    }

    const totalSeconds = Math.ceil(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Get maximum energy capacity
   */
  getMaxEnergy(): number {
    return MAX_ENERGY;
  }

  /**
   * Get energy regeneration interval in milliseconds
   */
  getEnergyRegenInterval(): number {
    return ENERGY_REGEN_INTERVAL_MS;
  }

  // ============================================
  // Gold Drop Calculations
  // ============================================

  /**
   * Calculate gold drop for a defeated enemy
   * @param enemyType Type of enemy defeated
   * @returns Random gold amount within the enemy's drop range
   */
  calculateEnemyGoldDrop(enemyType: EnemyType): number {
    const range = GOLD_DROP_RANGES[enemyType];
    if (!range) {
      console.warn(`CurrencyManager: Unknown enemy type "${enemyType}"`);
      return 0;
    }

    // Random integer between min and max (inclusive)
    return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
  }

  /**
   * Award gold for defeating an enemy (convenience method)
   * @param enemyType Type of enemy defeated
   * @returns Amount of gold awarded
   */
  awardEnemyGold(enemyType: EnemyType): number {
    const amount = this.calculateEnemyGoldDrop(enemyType);
    this.add('gold', amount);
    return amount;
  }

  /**
   * Get gold drop range for an enemy type
   * @param enemyType Type of enemy
   * @returns Object with min and max gold values
   */
  getGoldDropRange(enemyType: EnemyType): GoldDropRange {
    return { ...GOLD_DROP_RANGES[enemyType] };
  }

  // ============================================
  // Persistence (Save/Load)
  // ============================================

  /**
   * Get data for saving to storage
   * @returns Save data object
   */
  toSaveData(): CurrencySaveData {
    return {
      currencies: { ...this.currencies },
      lastEnergyUpdate: this.lastEnergyUpdate,
    };
  }

  /**
   * Load data from storage
   * @param data Saved data object
   */
  fromSaveData(data: CurrencySaveData): void {
    if (data.currencies) {
      this.currencies = {
        gold: data.currencies.gold ?? DEFAULT_CURRENCIES.gold,
        gems: data.currencies.gems ?? DEFAULT_CURRENCIES.gems,
        scrolls: data.currencies.scrolls ?? DEFAULT_CURRENCIES.scrolls,
        energy: data.currencies.energy ?? DEFAULT_CURRENCIES.energy,
      };
    }

    if (data.lastEnergyUpdate) {
      this.lastEnergyUpdate = data.lastEnergyUpdate;
    }

    // Update energy regeneration based on time passed since last save
    this.updateEnergyRegeneration();
  }

  /**
   * Reset all currencies to default values
   * Used for testing or new game
   */
  reset(): void {
    this.currencies = { ...DEFAULT_CURRENCIES };
    this.lastEnergyUpdate = Date.now();
    this.saveToStorage();
  }

  // ============================================
  // Debug/Utility
  // ============================================

  /**
   * Get a snapshot of current state for debugging
   */
  getDebugSnapshot(): {
    currencies: CurrencyState;
    lastEnergyUpdate: number;
    timeUntilNextEnergy: string;
    maxEnergy: number;
  } {
    return {
      currencies: this.getAll(),
      lastEnergyUpdate: this.lastEnergyUpdate,
      timeUntilNextEnergy: this.getFormattedTimeUntilNextEnergy(),
      maxEnergy: MAX_ENERGY,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

/** Global singleton instance for use throughout the game */
export const currencyManager = new CurrencyManager();
