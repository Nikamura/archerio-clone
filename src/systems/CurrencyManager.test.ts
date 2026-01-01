/**
 * Unit tests for CurrencyManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CurrencyManager } from './CurrencyManager'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('CurrencyManager', () => {
  let manager: CurrencyManager

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    manager = new CurrencyManager()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('initialization', () => {
    it('should create with default currency values', () => {
      const state = manager.getAll()

      expect(state.gold).toBe(0)
      expect(state.gems).toBe(0)
      expect(state.scrolls).toBe(0)
      expect(state.energy).toBe(5) // Default starting energy
    })

    it('should load persisted data from localStorage', () => {
      const savedData = {
        currencies: { gold: 500, gems: 50, scrolls: 10, energy: 15 },
        lastEnergyUpdate: Date.now(),
      }
      localStorageMock.setItem('arrow_game_currency_data', JSON.stringify(savedData))

      const newManager = new CurrencyManager()
      expect(newManager.get('gold')).toBe(500)
      expect(newManager.get('gems')).toBe(50)
      expect(newManager.get('scrolls')).toBe(10)
      expect(newManager.get('energy')).toBe(15)
    })
  })

  describe('add()', () => {
    it('should add positive amount of currency', () => {
      const result = manager.add('gold', 100)
      expect(result).toBe(100)
      expect(manager.get('gold')).toBe(100)
    })

    it('should accumulate currency on multiple adds', () => {
      manager.add('gold', 100)
      manager.add('gold', 50)
      expect(manager.get('gold')).toBe(150)
    })

    it('should not add negative amounts', () => {
      manager.add('gold', 100)
      const result = manager.add('gold', -50)
      expect(result).toBe(100) // Returns current value unchanged
      expect(manager.get('gold')).toBe(100)
    })

    it('should cap energy at maximum', () => {
      manager.add('energy', 100)
      expect(manager.get('energy')).toBe(20) // MAX_ENERGY
    })

    it('should emit currencyChanged event on add', () => {
      const callback = vi.fn()
      manager.on('currencyChanged', callback)

      manager.add('gold', 100)

      expect(callback).toHaveBeenCalledWith({
        type: 'gold',
        oldValue: 0,
        newValue: 100,
        delta: 100,
      })
    })

    it('should persist changes to localStorage', () => {
      manager.add('gold', 100)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('spend()', () => {
    it('should spend currency when sufficient funds', () => {
      manager.add('gold', 100)
      const result = manager.spend('gold', 50)

      expect(result).toBe(true)
      expect(manager.get('gold')).toBe(50)
    })

    it('should return false and not spend when insufficient funds', () => {
      manager.add('gold', 30)
      const result = manager.spend('gold', 50)

      expect(result).toBe(false)
      expect(manager.get('gold')).toBe(30)
    })

    it('should not spend negative amounts', () => {
      manager.add('gold', 100)
      const result = manager.spend('gold', -50)

      expect(result).toBe(false)
      expect(manager.get('gold')).toBe(100)
    })

    it('should emit insufficientFunds event when cannot afford', () => {
      const callback = vi.fn()
      manager.on('insufficientFunds', callback)

      manager.spend('gold', 50)

      expect(callback).toHaveBeenCalledWith({
        type: 'gold',
        oldValue: 0,
        newValue: 0,
        delta: 0,
      })
    })

    it('should emit currencyChanged event on successful spend', () => {
      manager.add('gold', 100)

      const callback = vi.fn()
      manager.on('currencyChanged', callback)

      manager.spend('gold', 40)

      expect(callback).toHaveBeenCalledWith({
        type: 'gold',
        oldValue: 100,
        newValue: 60,
        delta: -40,
      })
    })
  })

  describe('canAfford()', () => {
    it('should return true when currency is sufficient', () => {
      manager.add('gold', 100)
      expect(manager.canAfford('gold', 50)).toBe(true)
      expect(manager.canAfford('gold', 100)).toBe(true)
    })

    it('should return false when currency is insufficient', () => {
      manager.add('gold', 30)
      expect(manager.canAfford('gold', 50)).toBe(false)
    })
  })

  describe('get() and getAll()', () => {
    it('should return correct currency values', () => {
      manager.add('gold', 100)
      manager.add('gems', 50)

      expect(manager.get('gold')).toBe(100)
      expect(manager.get('gems')).toBe(50)
      expect(manager.get('scrolls')).toBe(0)
    })

    it('should return a copy of currency state', () => {
      manager.add('gold', 100)
      const state = manager.getAll()

      // Modifying the returned object should not affect internal state
      state.gold = 999
      expect(manager.get('gold')).toBe(100)
    })
  })

  describe('energy system', () => {
    it('should spend energy successfully', () => {
      const result = manager.spendEnergy(1)

      expect(result).toBe(true)
      expect(manager.get('energy')).toBe(4) // Default is 5, spent 1
    })

    it('should fail to spend energy when insufficient', () => {
      // Spend all energy
      for (let i = 0; i < 5; i++) {
        manager.spendEnergy(1)
      }

      const result = manager.spendEnergy(1)
      expect(result).toBe(false)
      expect(manager.get('energy')).toBe(0)
    })

    it('should regenerate energy based on time passed', () => {
      // Spend all energy first
      for (let i = 0; i < 5; i++) {
        manager.spendEnergy(1)
      }
      expect(manager.get('energy')).toBe(0)

      // Simulate 24 minutes passing (2 energy intervals of 12 min each)
      const futureTime = Date.now() + 2 * 12 * 60 * 1000

      const regenerated = manager.updateEnergyRegeneration(futureTime)
      expect(regenerated).toBe(2)
      expect(manager.get('energy')).toBe(2)
    })

    it('should not regenerate energy beyond maximum', () => {
      // Already at max (add up to max first)
      manager.add('energy', 100) // Will cap at 20

      const futureTime = Date.now() + 60 * 60 * 1000 // 1 hour
      const regenerated = manager.updateEnergyRegeneration(futureTime)

      expect(regenerated).toBe(0)
      expect(manager.get('energy')).toBe(20)
    })

    it('should return correct time until next energy', () => {
      // At max energy, time should be 0
      manager.add('energy', 100)
      expect(manager.getTimeUntilNextEnergy()).toBe(0)

      // Not at max, should return time remaining
      manager.spend('energy', 5)
      const timeRemaining = manager.getTimeUntilNextEnergy()
      expect(timeRemaining).toBeGreaterThan(0)
      expect(timeRemaining).toBeLessThanOrEqual(12 * 60 * 1000) // 12 minutes max
    })

    it('should format time until next energy correctly', () => {
      manager.add('energy', 100)
      expect(manager.getFormattedTimeUntilNextEnergy()).toBe('--:--')

      // Spend some energy to get a timer
      manager.spend('energy', 5)
      const formatted = manager.getFormattedTimeUntilNextEnergy()
      expect(formatted).toMatch(/^\d{2}:\d{2}$/)
    })

    it('should return max energy and regen interval', () => {
      expect(manager.getMaxEnergy()).toBe(20)
      expect(manager.getEnergyRegenInterval()).toBe(12 * 60 * 1000)
    })
  })

  describe('gold drop calculations', () => {
    it('should calculate gold drops within valid ranges', () => {
      // Test multiple times due to randomness
      for (let i = 0; i < 50; i++) {
        const meleeGold = manager.calculateEnemyGoldDrop('melee')
        expect(meleeGold).toBeGreaterThanOrEqual(5)
        expect(meleeGold).toBeLessThanOrEqual(10)

        const rangedGold = manager.calculateEnemyGoldDrop('ranged')
        expect(rangedGold).toBeGreaterThanOrEqual(8)
        expect(rangedGold).toBeLessThanOrEqual(15)

        const spreaderGold = manager.calculateEnemyGoldDrop('spreader')
        expect(spreaderGold).toBeGreaterThanOrEqual(10)
        expect(spreaderGold).toBeLessThanOrEqual(20)

        const bossGold = manager.calculateEnemyGoldDrop('boss')
        expect(bossGold).toBeGreaterThanOrEqual(50)
        expect(bossGold).toBeLessThanOrEqual(100)
      }
    })

    it('should return 0 for unknown enemy type', () => {
      // @ts-expect-error - Testing invalid input
      const gold = manager.calculateEnemyGoldDrop('unknown')
      expect(gold).toBe(0)
    })

    it('should award enemy gold and add to balance', () => {
      const awarded = manager.awardEnemyGold('melee')
      expect(awarded).toBeGreaterThanOrEqual(5)
      expect(awarded).toBeLessThanOrEqual(10)
      expect(manager.get('gold')).toBe(awarded)
    })

    it('should return gold drop ranges', () => {
      const meleeRange = manager.getGoldDropRange('melee')
      expect(meleeRange).toEqual({ min: 5, max: 10 })

      const bossRange = manager.getGoldDropRange('boss')
      expect(bossRange).toEqual({ min: 50, max: 100 })
    })
  })

  describe('event system', () => {
    it('should allow subscribing to events', () => {
      const callback = vi.fn()
      manager.on('currencyChanged', callback)

      manager.add('gold', 100)

      expect(callback).toHaveBeenCalled()
    })

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn()
      manager.on('currencyChanged', callback)
      manager.off('currencyChanged', callback)

      manager.add('gold', 100)

      expect(callback).not.toHaveBeenCalled()
    })

    it('should emit energyRegenerated event', () => {
      const callback = vi.fn()
      manager.on('energyRegenerated', callback)

      // Spend energy first
      manager.spend('energy', 3)

      // Simulate time passing
      const futureTime = Date.now() + 15 * 60 * 1000 // 15 minutes
      manager.updateEnergyRegeneration(futureTime)

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'energy',
          delta: expect.any(Number),
        })
      )
    })
  })

  describe('persistence', () => {
    it('should save and load data correctly', () => {
      manager.add('gold', 500)
      manager.add('gems', 100)

      const saveData = manager.toSaveData()
      expect(saveData.currencies.gold).toBe(500)
      expect(saveData.currencies.gems).toBe(100)

      // Create new manager and load data
      const newManager = new CurrencyManager()
      newManager.fromSaveData(saveData)

      expect(newManager.get('gold')).toBe(500)
      expect(newManager.get('gems')).toBe(100)
    })

    it('should handle missing fields in save data', () => {
      const partialData = {
        currencies: { gold: 100 },
        lastEnergyUpdate: Date.now(),
      }

      const newManager = new CurrencyManager()
      // @ts-expect-error - Testing partial data
      newManager.fromSaveData(partialData)

      expect(newManager.get('gold')).toBe(100)
      expect(newManager.get('gems')).toBe(0) // Default value
    })
  })

  describe('reset()', () => {
    it('should reset all currencies to defaults', () => {
      manager.add('gold', 1000)
      manager.add('gems', 500)
      manager.add('scrolls', 50)
      manager.add('energy', 100)

      manager.reset()

      expect(manager.get('gold')).toBe(0)
      expect(manager.get('gems')).toBe(0)
      expect(manager.get('scrolls')).toBe(0)
      expect(manager.get('energy')).toBe(5) // Default starting energy
    })
  })

  describe('debug snapshot', () => {
    it('should return debug information', () => {
      manager.add('gold', 100)
      manager.add('gems', 50)

      const snapshot = manager.getDebugSnapshot()

      expect(snapshot.currencies.gold).toBe(100)
      expect(snapshot.currencies.gems).toBe(50)
      expect(snapshot.maxEnergy).toBe(20)
      expect(snapshot.timeUntilNextEnergy).toBeDefined()
    })
  })
})
