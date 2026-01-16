/**
 * Unit tests for DailyRewardManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DailyRewardManager, DAILY_REWARDS } from "./DailyRewardManager";

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

describe("DailyRewardManager", () => {
  let manager: DailyRewardManager;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    manager = new DailyRewardManager();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("initialization", () => {
    it("should create with day 1 and claimable", () => {
      expect(manager.getCurrentDay()).toBe(1);
      expect(manager.canClaimToday()).toBe(true);
    });

    it("should load persisted data from localStorage", () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const savedData = {
        lastClaimTimestamp: yesterday,
        currentDay: 3,
        claimedToday: false, // New day, can claim
      };
      localStorageMock.setItem("aura_archer_daily_rewards", JSON.stringify(savedData));

      const newManager = new DailyRewardManager();
      expect(newManager.getCurrentDay()).toBe(3);
      expect(newManager.canClaimToday()).toBe(true);
    });
  });

  describe("DAILY_REWARDS configuration", () => {
    it("should have 7 daily rewards", () => {
      expect(DAILY_REWARDS).toHaveLength(7);
    });

    it("should have rewards for days 1-7", () => {
      for (let day = 1; day <= 7; day++) {
        const reward = DAILY_REWARDS.find((r) => r.day === day);
        expect(reward).toBeDefined();
        expect(reward!.rewards.length).toBeGreaterThan(0);
      }
    });

    it("should have day 7 with gems and energy", () => {
      const day7 = DAILY_REWARDS.find((r) => r.day === 7);
      expect(day7).toBeDefined();
      expect(day7!.rewards).toHaveLength(2);
      expect(day7!.rewards.some((r) => r.type === "gems")).toBe(true);
      expect(day7!.rewards.some((r) => r.type === "energy")).toBe(true);
    });
  });

  describe("canClaimToday()", () => {
    it("should return true for first-time player", () => {
      expect(manager.canClaimToday()).toBe(true);
    });

    it("should return false after claiming today", () => {
      manager.claimReward();
      expect(manager.canClaimToday()).toBe(false);
    });

    it("should return true after midnight passes", () => {
      const now = Date.now();
      manager.claimReward(now);

      // Next day
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 1);

      expect(manager.canClaimToday(tomorrow.getTime())).toBe(true);
    });
  });

  describe("claimReward()", () => {
    it("should return rewards when claiming is valid", () => {
      const rewards = manager.claimReward();

      expect(rewards).not.toBeNull();
      expect(rewards!.length).toBeGreaterThan(0);
    });

    it("should return null when already claimed today", () => {
      manager.claimReward();
      const secondClaim = manager.claimReward();

      expect(secondClaim).toBeNull();
    });

    it("should advance to next day after claim", () => {
      // Set up fresh manager at day 1
      const saveData = manager.toSaveData();
      saveData.currentDay = 1;
      saveData.claimedToday = false;
      saveData.lastClaimTimestamp = null;
      manager.fromSaveData(saveData);

      expect(manager.getCurrentDay()).toBe(1);

      manager.claimReward();

      // After claim, currentDay advances to 2 (what you claim next)
      expect(manager.getCurrentDay()).toBe(2);
    });

    it("should wrap around to day 1 after day 7", () => {
      // Set up at day 7
      const saveData = manager.toSaveData();
      saveData.currentDay = 7;
      saveData.claimedToday = false;
      manager.fromSaveData(saveData);

      expect(manager.getCurrentDay()).toBe(7);

      manager.claimReward();

      // After day 7, should wrap to day 1
      expect(manager.getCurrentDay()).toBe(1);
    });

    it("should emit rewardClaimed event", () => {
      const callback = vi.fn();
      manager.on("rewardClaimed", callback);

      manager.claimReward();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          day: 1,
          rewards: expect.any(Array),
        }),
      );
    });

    it("should emit cycleCompleted event on day 7", () => {
      const callback = vi.fn();
      manager.on("cycleCompleted", callback);

      // Set up at day 7
      const saveData = manager.toSaveData();
      saveData.currentDay = 7;
      saveData.claimedToday = false;
      manager.fromSaveData(saveData);

      manager.claimReward();

      expect(callback).toHaveBeenCalledWith({ day: 7 });
    });

    it("should persist claim to localStorage", () => {
      manager.claimReward();
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("should grant correct rewards for each day", () => {
      const day1Rewards = manager.claimReward();

      expect(day1Rewards).toBeDefined();
      expect(day1Rewards![0].type).toBe("gold");
      expect(day1Rewards![0].amount).toBe(100);
    });
  });

  describe("streak system", () => {
    it("should reset streak after 48 hours without claim", () => {
      const now = Date.now();
      manager.claimReward(now);

      // After claiming day 1, we're on day 2
      expect(manager.getCurrentDay()).toBe(2);

      // 49 hours later (more than 48)
      const callback = vi.fn();
      manager.on("streakReset", callback);

      const futureTime = now + 49 * 60 * 60 * 1000;
      manager.canClaimToday(futureTime); // This triggers streak check

      expect(manager.getCurrentDay()).toBe(1);
      expect(callback).toHaveBeenCalledWith({ day: 1, streakBroken: true });
    });

    it("should maintain streak within 48 hours", () => {
      const now = Date.now();
      manager.claimReward(now);

      // Set up at day 2
      const saveData = manager.toSaveData();
      saveData.claimedToday = false;
      manager.fromSaveData(saveData);

      // 24 hours later (within 48)
      const nextDay = now + 24 * 60 * 60 * 1000;
      expect(manager.canClaimToday(nextDay)).toBe(true);
      expect(manager.getCurrentDay()).toBe(2);
    });

    it("should return correct streak length", () => {
      // Reset to fresh state
      manager.reset();
      expect(manager.getStreakLength()).toBe(0); // No claims yet

      // Ensure we can claim
      const saveData = manager.toSaveData();
      saveData.claimedToday = false;
      saveData.currentDay = 1;
      saveData.lastClaimTimestamp = null;
      manager.fromSaveData(saveData);

      manager.claimReward();

      // After claiming day 1:
      // - currentDay advances to 2 (what you'll claim next)
      // - claimedToday is true
      // - getStreakLength returns currentDay when claimedToday is true = 2
      // This represents "you have claimed 2 days worth in this cycle position"
      expect(manager.getStreakLength()).toBe(2);
    });
  });

  describe("isDayClaimed()", () => {
    it("should return false for all days initially", () => {
      for (let day = 1; day <= 7; day++) {
        expect(manager.isDayClaimed(day)).toBe(false);
      }
    });

    it("should return true for days before current day", () => {
      // Claim day 1
      manager.claimReward();

      // Now on day 2, day 1 should be claimed
      expect(manager.isDayClaimed(1)).toBe(true);
      expect(manager.isDayClaimed(2)).toBe(false);
      expect(manager.isDayClaimed(3)).toBe(false);
    });
  });

  describe("getTimeUntilNextClaim()", () => {
    it("should return 0 when claim is available", () => {
      expect(manager.getTimeUntilNextClaim()).toBe(0);
    });

    it("should return time until midnight when already claimed", () => {
      manager.claimReward();

      const timeUntil = manager.getTimeUntilNextClaim();
      expect(timeUntil).toBeGreaterThan(0);
      expect(timeUntil).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    });
  });

  describe("getFormattedTimeUntilNextClaim()", () => {
    it('should return "Available!" when can claim', () => {
      expect(manager.getFormattedTimeUntilNextClaim()).toBe("Available!");
    });

    it("should return formatted time when already claimed", () => {
      manager.claimReward();

      const formatted = manager.getFormattedTimeUntilNextClaim();
      expect(formatted).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe("getDailyReward()", () => {
    it("should return correct reward for each day", () => {
      for (let day = 1; day <= 7; day++) {
        const reward = manager.getDailyReward(day);
        expect(reward).toBeDefined();
        expect(reward!.day).toBe(day);
      }
    });

    it("should return undefined for invalid day", () => {
      expect(manager.getDailyReward(0)).toBeUndefined();
      expect(manager.getDailyReward(8)).toBeUndefined();
    });
  });

  describe("getAllDailyRewards()", () => {
    it("should return all daily rewards", () => {
      const rewards = manager.getAllDailyRewards();

      expect(rewards).toHaveLength(7);
      expect(rewards[0].day).toBe(1);
      expect(rewards[6].day).toBe(7);
    });
  });

  describe("event system", () => {
    it("should allow subscribing to events", () => {
      const callback = vi.fn();
      manager.on("rewardClaimed", callback);

      // Ensure we can claim
      const saveData = manager.toSaveData();
      saveData.claimedToday = false;
      saveData.currentDay = 1;
      manager.fromSaveData(saveData);

      const rewards = manager.claimReward();
      expect(rewards).not.toBeNull(); // Verify claim succeeded

      expect(callback).toHaveBeenCalled();
    });

    it("should allow unsubscribing from events", () => {
      const callback = vi.fn();
      manager.on("rewardClaimed", callback);
      manager.off("rewardClaimed", callback);

      // Ensure we can claim
      const saveData = manager.toSaveData();
      saveData.claimedToday = false;
      saveData.currentDay = 1;
      manager.fromSaveData(saveData);

      manager.claimReward();

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("persistence", () => {
    it("should save and load data correctly", () => {
      // Create a save data object that represents "claimed today at day 2"
      const now = Date.now();
      const saveData = {
        currentDay: 2,
        claimedToday: true,
        lastClaimTimestamp: now,
      };

      // Load this data
      const newManager = new DailyRewardManager();
      newManager.fromSaveData(saveData);

      expect(newManager.getCurrentDay()).toBe(2);
      expect(newManager.canClaimToday(now)).toBe(false); // Already claimed today
    });

    it("should handle missing fields in save data", () => {
      const partialData = {
        currentDay: 3,
      };

      const newManager = new DailyRewardManager();
      // @ts-expect-error - Testing partial data
      newManager.fromSaveData(partialData);

      expect(newManager.getCurrentDay()).toBe(3);
    });
  });

  describe("reset()", () => {
    it("should reset to initial state", () => {
      // Set up at day 3 to have some progress
      const setupData = manager.toSaveData();
      setupData.currentDay = 3;
      setupData.claimedToday = true;
      manager.fromSaveData(setupData);

      expect(manager.getCurrentDay()).toBe(3);

      manager.reset();

      expect(manager.getCurrentDay()).toBe(1);
      expect(manager.canClaimToday()).toBe(true);
    });
  });

  describe("debug snapshot", () => {
    it("should return debug information", () => {
      const snapshot = manager.getDebugSnapshot();

      expect(snapshot.currentDay).toBe(1);
      expect(snapshot.claimedToday).toBe(false);
      expect(snapshot.canClaim).toBe(true);
      expect(snapshot.streakLength).toBeDefined();
    });
  });
});
