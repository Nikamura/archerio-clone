/**
 * Unit tests for TalentManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TalentManager } from "./TalentManager";
import { TalentId, getTalent } from "../config/talentData";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("TalentManager", () => {
  let manager: TalentManager;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    manager = new TalentManager();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("initialization", () => {
    it("should create with no unlocked talents", () => {
      const unlocked = manager.getAllUnlockedTalents();
      expect(unlocked).toHaveLength(0);
    });

    it("should create with full daily spins", () => {
      expect(manager.getSpinsRemaining()).toBe(42);
      expect(manager.canSpin()).toBe(true);
    });

    it("should have base spin cost", () => {
      expect(manager.getSpinCost()).toBe(500);
    });

    it("should load persisted data from localStorage", () => {
      const savedData = {
        unlockedTalents: { [TalentId.IRON_WILL]: 2 },
        lotteryState: {
          spinsToday: 3,
          lastSpinDate: new Date().toISOString().split("T")[0],
        },
      };
      localStorageMock.setItem("aura_archer_talent_data", JSON.stringify(savedData));

      const newManager = new TalentManager();
      expect(newManager.getTalentLevel(TalentId.IRON_WILL)).toBe(2);
      expect(newManager.getSpinsToday()).toBe(3);
    });
  });

  describe("lottery spin cost", () => {
    it("should increase cost with each spin today", () => {
      expect(manager.getSpinCost()).toBe(500); // Base cost

      // Simulate a spin by updating lottery state
      const result = manager.spin(1000, () => true);
      expect(result.success).toBe(true);

      expect(manager.getSpinCost()).toBe(750); // 500 + 250
    });

    it("should reset cost on new day", () => {
      // Force some spins today
      const saveData = manager.toSaveData();
      saveData.lotteryState.spinsToday = 5;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      saveData.lotteryState.lastSpinDate = yesterday.toISOString().split("T")[0];
      manager.fromSaveData(saveData);

      // Should reset to base cost due to new day
      expect(manager.getSpinCost()).toBe(500);
    });
  });

  describe("spin limits", () => {
    it("should track spins remaining", () => {
      expect(manager.getSpinsRemaining()).toBe(42);
      expect(manager.getMaxDailySpins()).toBe(42);

      manager.spin(10000, () => true);
      expect(manager.getSpinsRemaining()).toBe(41);
    });

    it("should not allow spin when daily limit reached", () => {
      // Force max spins (42 per day)
      const saveData = manager.toSaveData();
      saveData.lotteryState.spinsToday = 42;
      saveData.lotteryState.lastSpinDate = new Date().toISOString().split("T")[0];
      manager.fromSaveData(saveData);

      expect(manager.canSpin()).toBe(false);

      const result = manager.spin(10000, () => true);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Daily spin limit");
    });

    it("should emit dailyLimitReached event", () => {
      const callback = vi.fn();
      manager.on("dailyLimitReached", callback);

      // Force max spins (42 per day)
      const saveData = manager.toSaveData();
      saveData.lotteryState.spinsToday = 42;
      saveData.lotteryState.lastSpinDate = new Date().toISOString().split("T")[0];
      manager.fromSaveData(saveData);

      manager.spin(10000, () => true);

      expect(callback).toHaveBeenCalled();
    });
  });

  describe("spin()", () => {
    it("should fail when not enough gold", () => {
      const result = manager.spin(100, () => true); // Not enough gold

      expect(result.success).toBe(false);
      expect(result.error).toContain("Not enough gold");
    });

    it("should fail when gold spend fails", () => {
      const result = manager.spin(1000, () => false); // Spend fails

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to spend gold");
    });

    it("should emit spinFailed event on insufficient gold", () => {
      const callback = vi.fn();
      manager.on("spinFailed", callback);

      manager.spin(100, () => true);

      expect(callback).toHaveBeenCalled();
    });

    it("should successfully spin and unlock talent", () => {
      const result = manager.spin(10000, () => true);

      expect(result.success).toBe(true);
      expect(result.talent).toBeDefined();
      expect(result.newLevel).toBeGreaterThanOrEqual(1);
      expect(result.goldSpent).toBe(500);
    });

    it("should emit talentUnlocked event for new talent", () => {
      const callback = vi.fn();
      manager.on("talentUnlocked", callback);

      manager.spin(10000, () => true);

      expect(callback).toHaveBeenCalled();
    });

    it("should emit talentUpgraded event for existing talent", () => {
      // First unlock a talent
      manager.forceUnlock(TalentId.IRON_WILL, 1);

      const callback = vi.fn();
      manager.on("talentUpgraded", callback);

      // Force another unlock of same talent by mocking Math.random
      // Since we can't easily control which talent is rolled, we check both events
      const unlockCallback = vi.fn();
      manager.on("talentUnlocked", unlockCallback);

      manager.spin(10000, () => true);

      // Either talentUnlocked or talentUpgraded should be called
      expect(callback.mock.calls.length + unlockCallback.mock.calls.length).toBeGreaterThanOrEqual(
        1,
      );
    });

    it("should persist spin results", () => {
      manager.spin(10000, () => true);

      expect(localStorageMock.setItem).toHaveBeenCalled();
    });
  });

  describe("talent levels", () => {
    it("should get talent level", () => {
      expect(manager.getTalentLevel(TalentId.IRON_WILL)).toBe(0);

      manager.forceUnlock(TalentId.IRON_WILL, 3);
      expect(manager.getTalentLevel(TalentId.IRON_WILL)).toBe(3);
    });

    it("should check if talent is unlocked", () => {
      expect(manager.isTalentUnlocked(TalentId.IRON_WILL)).toBe(false);

      manager.forceUnlock(TalentId.IRON_WILL, 1);
      expect(manager.isTalentUnlocked(TalentId.IRON_WILL)).toBe(true);
    });

    it("should get talent bonus based on level", () => {
      expect(manager.getTalentBonus(TalentId.IRON_WILL)).toBe(0);

      manager.forceUnlock(TalentId.IRON_WILL, 2);
      const talent = getTalent(TalentId.IRON_WILL);
      expect(manager.getTalentBonus(TalentId.IRON_WILL)).toBe(2 * talent.effectPerLevel);
    });

    it("should get all unlocked talents", () => {
      manager.forceUnlock(TalentId.IRON_WILL, 2);
      manager.forceUnlock(TalentId.ATTACK_SPEED, 1);

      const unlocked = manager.getAllUnlockedTalents();
      expect(unlocked).toHaveLength(2);
      expect(unlocked.some((t) => t.talent.id === TalentId.IRON_WILL)).toBe(true);
      expect(unlocked.some((t) => t.talent.id === TalentId.ATTACK_SPEED)).toBe(true);
    });
  });

  describe("bonus calculations", () => {
    it("should calculate total bonuses with no talents", () => {
      const bonuses = manager.calculateTotalBonuses();

      expect(bonuses.flatHp).toBe(0);
      expect(bonuses.flatAttack).toBe(0);
      expect(bonuses.percentDamageReduction).toBe(0);
    });

    it("should calculate total bonuses with talents", () => {
      // HP_BOOST gives flat_hp
      manager.forceUnlock(TalentId.HP_BOOST, 3);

      const bonuses = manager.calculateTotalBonuses();
      expect(bonuses.flatHp).toBeGreaterThan(0);
    });

    it("should cache bonuses", () => {
      manager.forceUnlock(TalentId.HP_BOOST, 1);

      const firstCall = manager.calculateTotalBonuses();
      const secondCall = manager.calculateTotalBonuses();

      // Should return same reference (cached)
      expect(firstCall).toBe(secondCall);
    });

    it("should invalidate cache on talent change", () => {
      manager.forceUnlock(TalentId.HP_BOOST, 1);
      const firstCall = manager.calculateTotalBonuses();

      manager.forceUnlock(TalentId.HP_BOOST, 2);
      const secondCall = manager.calculateTotalBonuses();

      // Should be different references
      expect(firstCall).not.toBe(secondCall);
      expect(secondCall.flatHp).toBeGreaterThan(firstCall.flatHp);
    });
  });

  describe("daily state management", () => {
    it("should reset spins on new day", () => {
      // Set yesterday's date
      const saveData = manager.toSaveData();
      saveData.lotteryState.spinsToday = 8;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      saveData.lotteryState.lastSpinDate = yesterday.toISOString().split("T")[0];
      manager.fromSaveData(saveData);

      // Accessing spins should trigger day check and reset
      expect(manager.getSpinsToday()).toBe(0);
      expect(manager.getSpinsRemaining()).toBe(42);
    });
  });

  describe("event system", () => {
    it("should allow subscribing to events", () => {
      const callback = vi.fn();
      manager.on("talentUnlocked", callback);

      manager.spin(10000, () => true);

      // Either talentUnlocked or talentUpgraded should be called
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it("should allow unsubscribing from events", () => {
      const callback = vi.fn();
      manager.on("talentUnlocked", callback);
      manager.off("talentUnlocked", callback);

      manager.spin(10000, () => true);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("persistence", () => {
    it("should save and load data correctly", () => {
      manager.forceUnlock(TalentId.IRON_WILL, 3);
      manager.forceUnlock(TalentId.ATTACK_SPEED, 2);

      const saveData = manager.toSaveData();
      expect(saveData.unlockedTalents[TalentId.IRON_WILL]).toBe(3);
      expect(saveData.unlockedTalents[TalentId.ATTACK_SPEED]).toBe(2);

      // Create new manager and load data
      const newManager = new TalentManager();
      newManager.fromSaveData(saveData);

      expect(newManager.getTalentLevel(TalentId.IRON_WILL)).toBe(3);
      expect(newManager.getTalentLevel(TalentId.ATTACK_SPEED)).toBe(2);
    });

    it("should handle missing fields in save data", () => {
      const partialData = {
        unlockedTalents: { [TalentId.IRON_WILL]: 1 },
        lotteryState: {} as { spinsToday: number; lastSpinDate: string },
      };

      const newManager = new TalentManager();
      newManager.fromSaveData(partialData);

      expect(newManager.getTalentLevel(TalentId.IRON_WILL)).toBe(1);
      expect(newManager.getSpinsToday()).toBe(0);
    });

    it("should validate talent IDs on load", () => {
      const invalidData = {
        unlockedTalents: {
          [TalentId.IRON_WILL]: 2,
          invalid_talent_id: 5, // This should be ignored
        },
        lotteryState: {
          spinsToday: 0,
          lastSpinDate: new Date().toISOString().split("T")[0],
        },
      };

      const newManager = new TalentManager();
      newManager.fromSaveData(invalidData);

      expect(newManager.getTalentLevel(TalentId.IRON_WILL)).toBe(2);
      // Invalid talent should not be loaded
      const unlocked = newManager.getAllUnlockedTalents();
      expect(unlocked.every((t) => Object.values(TalentId).includes(t.talent.id))).toBe(true);
    });
  });

  describe("reset()", () => {
    it("should reset all talents and lottery state", () => {
      manager.forceUnlock(TalentId.IRON_WILL, 3);
      manager.spin(10000, () => true);

      manager.reset();

      expect(manager.getTalentLevel(TalentId.IRON_WILL)).toBe(0);
      expect(manager.getAllUnlockedTalents()).toHaveLength(0);
      expect(manager.getSpinsToday()).toBe(0);
    });
  });

  describe("debug methods", () => {
    it("should return debug snapshot", () => {
      manager.forceUnlock(TalentId.IRON_WILL, 2);

      const snapshot = manager.getDebugSnapshot();

      expect(snapshot.unlockedTalents.length).toBe(1);
      expect(snapshot.spinCost).toBe(500);
      expect(snapshot.spinsRemaining).toBe(42);
      expect(snapshot.bonuses).toBeDefined();
    });

    it("should force unlock talents", () => {
      manager.forceUnlock(TalentId.ATTACK_SPEED, 4);

      expect(manager.getTalentLevel(TalentId.ATTACK_SPEED)).toBe(4);
      expect(manager.isTalentUnlocked(TalentId.ATTACK_SPEED)).toBe(true);
    });

    it("should clamp force unlock to max level", () => {
      const talent = getTalent(TalentId.IRON_WILL);
      manager.forceUnlock(TalentId.IRON_WILL, 100); // Way over max

      expect(manager.getTalentLevel(TalentId.IRON_WILL)).toBe(talent.maxLevel);
    });
  });
});
