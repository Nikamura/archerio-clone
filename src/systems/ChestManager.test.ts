/**
 * Unit tests for ChestManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChestManager } from './ChestManager'

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

describe('ChestManager', () => {
  let manager: ChestManager

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    manager = new ChestManager()
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('initialization', () => {
    it('should create with empty chest inventory', () => {
      const inventory = manager.getInventory()

      expect(inventory.wooden).toBe(0)
      expect(inventory.silver).toBe(0)
      expect(inventory.golden).toBe(0)
    })

    it('should load persisted data from localStorage', () => {
      const savedData = {
        inventory: { wooden: 5, silver: 3, golden: 1 },
      }
      localStorageMock.setItem('aura_archer_chest_data', JSON.stringify(savedData))

      const newManager = new ChestManager()
      const inventory = newManager.getInventory()

      expect(inventory.wooden).toBe(5)
      expect(inventory.silver).toBe(3)
      expect(inventory.golden).toBe(1)
    })
  })

  describe('addChest()', () => {
    it('should add a single chest', () => {
      manager.addChest('wooden')
      expect(manager.getChestCount('wooden')).toBe(1)
    })

    it('should add multiple chests at once', () => {
      manager.addChest('silver', 5)
      expect(manager.getChestCount('silver')).toBe(5)
    })

    it('should accumulate chests on multiple adds', () => {
      manager.addChest('golden', 2)
      manager.addChest('golden', 3)
      expect(manager.getChestCount('golden')).toBe(5)
    })

    it('should not add zero or negative amounts', () => {
      manager.addChest('wooden', 0)
      manager.addChest('wooden', -5)
      expect(manager.getChestCount('wooden')).toBe(0)
    })

    it('should emit chestAdded event', () => {
      const callback = vi.fn()
      manager.on('chestAdded', callback)

      manager.addChest('wooden', 3)

      expect(callback).toHaveBeenCalledWith({
        chestType: 'wooden',
        amount: 3,
        inventory: { wooden: 3, silver: 0, golden: 0 },
      })
    })

    it('should emit inventoryChanged event', () => {
      const callback = vi.fn()
      manager.on('inventoryChanged', callback)

      manager.addChest('silver', 1)

      expect(callback).toHaveBeenCalledWith({
        inventory: { wooden: 0, silver: 1, golden: 0 },
      })
    })

    it('should persist changes to localStorage', () => {
      manager.addChest('golden', 1)
      expect(localStorageMock.setItem).toHaveBeenCalled()
    })
  })

  describe('addChests()', () => {
    it('should add multiple chest types from rewards', () => {
      manager.addChests({ wooden: 2, silver: 1, golden: 0 })

      expect(manager.getChestCount('wooden')).toBe(2)
      expect(manager.getChestCount('silver')).toBe(1)
      expect(manager.getChestCount('golden')).toBe(0)
    })

    it('should emit chestAdded for each type added', () => {
      const callback = vi.fn()
      manager.on('chestAdded', callback)

      manager.addChests({ wooden: 1, silver: 2, golden: 0 })

      expect(callback).toHaveBeenCalledTimes(2) // Only wooden and silver
    })

    it('should emit inventoryChanged only once', () => {
      const callback = vi.fn()
      manager.on('inventoryChanged', callback)

      manager.addChests({ wooden: 1, silver: 1, golden: 1 })

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('should not emit events if all amounts are zero', () => {
      const callback = vi.fn()
      manager.on('inventoryChanged', callback)

      manager.addChests({ wooden: 0, silver: 0, golden: 0 })

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('removeChest()', () => {
    it('should remove a single chest', () => {
      manager.addChest('wooden', 5)
      const result = manager.removeChest('wooden')

      expect(result).toBe(true)
      expect(manager.getChestCount('wooden')).toBe(4)
    })

    it('should remove multiple chests at once', () => {
      manager.addChest('silver', 10)
      const result = manager.removeChest('silver', 3)

      expect(result).toBe(true)
      expect(manager.getChestCount('silver')).toBe(7)
    })

    it('should fail to remove when not enough chests', () => {
      manager.addChest('golden', 2)
      const result = manager.removeChest('golden', 5)

      expect(result).toBe(false)
      expect(manager.getChestCount('golden')).toBe(2)
    })

    it('should not remove zero or negative amounts', () => {
      manager.addChest('wooden', 5)

      const result1 = manager.removeChest('wooden', 0)
      const result2 = manager.removeChest('wooden', -3)

      expect(result1).toBe(false)
      expect(result2).toBe(false)
      expect(manager.getChestCount('wooden')).toBe(5)
    })

    it('should emit chestRemoved event', () => {
      manager.addChest('silver', 5)
      const callback = vi.fn()
      manager.on('chestRemoved', callback)

      manager.removeChest('silver', 2)

      expect(callback).toHaveBeenCalledWith({
        chestType: 'silver',
        amount: 2,
        inventory: { wooden: 0, silver: 3, golden: 0 },
      })
    })

    it('should emit inventoryChanged event', () => {
      manager.addChest('golden', 3)
      const callback = vi.fn()
      manager.on('inventoryChanged', callback)

      manager.removeChest('golden', 1)

      expect(callback).toHaveBeenCalledWith({
        inventory: { wooden: 0, silver: 0, golden: 2 },
      })
    })
  })

  describe('getters', () => {
    it('should get correct chest count for each type', () => {
      manager.addChest('wooden', 10)
      manager.addChest('silver', 5)
      manager.addChest('golden', 2)

      expect(manager.getChestCount('wooden')).toBe(10)
      expect(manager.getChestCount('silver')).toBe(5)
      expect(manager.getChestCount('golden')).toBe(2)
    })

    it('should return copy of inventory', () => {
      manager.addChest('wooden', 5)
      const inventory = manager.getInventory()

      // Modifying the returned object should not affect internal state
      inventory.wooden = 999
      expect(manager.getChestCount('wooden')).toBe(5)
    })

    it('should calculate total chests correctly', () => {
      manager.addChest('wooden', 10)
      manager.addChest('silver', 5)
      manager.addChest('golden', 3)

      expect(manager.getTotalChests()).toBe(18)
    })

    it('should check if player has chest', () => {
      expect(manager.hasChest('wooden')).toBe(false)

      manager.addChest('wooden', 1)
      expect(manager.hasChest('wooden')).toBe(true)

      manager.removeChest('wooden', 1)
      expect(manager.hasChest('wooden')).toBe(false)
    })
  })

  describe('event system', () => {
    it('should allow subscribing to events', () => {
      const callback = vi.fn()
      manager.on('chestAdded', callback)

      manager.addChest('wooden', 1)

      expect(callback).toHaveBeenCalled()
    })

    it('should allow unsubscribing from events', () => {
      const callback = vi.fn()
      manager.on('chestAdded', callback)
      manager.off('chestAdded', callback)

      manager.addChest('wooden', 1)

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('persistence', () => {
    it('should save and load data correctly', () => {
      manager.addChest('wooden', 5)
      manager.addChest('silver', 3)
      manager.addChest('golden', 1)

      const saveData = manager.toSaveData()
      expect(saveData.inventory.wooden).toBe(5)
      expect(saveData.inventory.silver).toBe(3)
      expect(saveData.inventory.golden).toBe(1)

      // Create new manager and load data
      const newManager = new ChestManager()
      newManager.fromSaveData(saveData)

      expect(newManager.getChestCount('wooden')).toBe(5)
      expect(newManager.getChestCount('silver')).toBe(3)
      expect(newManager.getChestCount('golden')).toBe(1)
    })

    it('should handle missing fields in save data', () => {
      const partialData = {
        inventory: { wooden: 5 },
      }

      const newManager = new ChestManager()
      // @ts-expect-error - Testing partial data
      newManager.fromSaveData(partialData)

      expect(newManager.getChestCount('wooden')).toBe(5)
      expect(newManager.getChestCount('silver')).toBe(0)
      expect(newManager.getChestCount('golden')).toBe(0)
    })

    it('should emit inventoryChanged on load', () => {
      const callback = vi.fn()
      manager.on('inventoryChanged', callback)

      manager.fromSaveData({
        inventory: { wooden: 5, silver: 3, golden: 1 },
      })

      expect(callback).toHaveBeenCalled()
    })
  })

  describe('reset()', () => {
    it('should reset all chests to zero', () => {
      manager.addChest('wooden', 10)
      manager.addChest('silver', 5)
      manager.addChest('golden', 3)

      manager.reset()

      expect(manager.getChestCount('wooden')).toBe(0)
      expect(manager.getChestCount('silver')).toBe(0)
      expect(manager.getChestCount('golden')).toBe(0)
      expect(manager.getTotalChests()).toBe(0)
    })

    it('should emit inventoryChanged on reset', () => {
      manager.addChest('wooden', 5)
      const callback = vi.fn()
      manager.on('inventoryChanged', callback)

      manager.reset()

      expect(callback).toHaveBeenCalledWith({
        inventory: { wooden: 0, silver: 0, golden: 0 },
      })
    })
  })

  describe('debug snapshot', () => {
    it('should return debug information', () => {
      manager.addChest('wooden', 5)
      manager.addChest('silver', 3)
      manager.addChest('golden', 1)

      const snapshot = manager.getDebugSnapshot()

      expect(snapshot.inventory.wooden).toBe(5)
      expect(snapshot.inventory.silver).toBe(3)
      expect(snapshot.inventory.golden).toBe(1)
      expect(snapshot.totalChests).toBe(9)
    })
  })
})
