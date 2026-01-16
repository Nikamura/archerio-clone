/**
 * Unit tests for ChapterManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ChapterManager } from "./ChapterManager";
import { ROOMS_PER_CHAPTER } from "../config/chapterData";

// Mock localStorage (ChapterManager doesn't use it directly but may be needed for dependencies)
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

describe("ChapterManager", () => {
  let manager: ChapterManager;

  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    manager = new ChapterManager();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("initialization", () => {
    it("should create with chapter 1 selected and unlocked", () => {
      expect(manager.getSelectedChapter()).toBe(1);
      expect(manager.isChapterUnlocked(1)).toBe(true);
    });

    it("should have only chapter 1 unlocked initially", () => {
      const unlocked = manager.getUnlockedChapters();
      expect(unlocked).toEqual([1]);
    });

    it("should have chapters 2-5 locked initially", () => {
      expect(manager.isChapterUnlocked(2)).toBe(false);
      expect(manager.isChapterUnlocked(3)).toBe(false);
      expect(manager.isChapterUnlocked(4)).toBe(false);
      expect(manager.isChapterUnlocked(5)).toBe(false);
    });

    it("should initialize progress for chapter 1", () => {
      const progress = manager.getChapterProgress(1);
      expect(progress).toBeDefined();
      expect(progress!.highestRoom).toBe(0);
      expect(progress!.completed).toBe(false);
      expect(progress!.bestStars).toBe(0);
    });
  });

  describe("chapter selection", () => {
    it("should select an unlocked chapter", () => {
      const result = manager.selectChapter(1);
      expect(result).toBe(true);
      expect(manager.getSelectedChapter()).toBe(1);
    });

    it("should not select a locked chapter", () => {
      const result = manager.selectChapter(2);
      expect(result).toBe(false);
      expect(manager.getSelectedChapter()).toBe(1);
    });

    it("should get selected chapter definition", () => {
      const def = manager.getSelectedChapterDefinition();
      expect(def).toBeDefined();
      expect(def.id).toBe(1);
      expect(def.name).toBeDefined();
    });
  });

  describe("chapter unlocking", () => {
    it("should unlock next chapter after completion", () => {
      manager.startChapter(1);
      // Fast forward to room 20
      for (let i = 1; i < ROOMS_PER_CHAPTER; i++) {
        manager.advanceRoom();
      }

      manager.completeChapter(100, 100);

      expect(manager.isChapterUnlocked(2)).toBe(true);
    });

    it("should get highest unlocked chapter", () => {
      expect(manager.getHighestUnlockedChapter()).toBe(1);

      manager.forceUnlockChapter(3);
      expect(manager.getHighestUnlockedChapter()).toBe(3);
    });

    it("should emit chapterUnlocked event on completion", () => {
      const callback = vi.fn();
      manager.on("chapterUnlocked", callback);

      // Unlock via completion which uses internal unlockChapter that emits
      manager.startChapter(1);
      for (let i = 1; i < ROOMS_PER_CHAPTER; i++) {
        manager.advanceRoom();
      }
      manager.completeChapter(100, 100);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chapterUnlocked",
          chapterId: 2,
        }),
      );
    });
  });

  describe("run management", () => {
    it("should start a chapter run", () => {
      const result = manager.startChapter(1);

      expect(result).toBe(true);
      expect(manager.getCurrentRun()).not.toBeNull();
      expect(manager.getCurrentRoom()).toBe(1);
    });

    it("should not start a locked chapter", () => {
      const result = manager.startChapter(2);

      expect(result).toBe(false);
      expect(manager.getCurrentRun()).toBeNull();
    });

    it("should emit chapterStarted event", () => {
      const callback = vi.fn();
      manager.on("chapterStarted", callback);

      manager.startChapter(1);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chapterStarted",
          chapterId: 1,
          roomNumber: 1,
        }),
      );
    });

    it("should end existing run when starting new one", () => {
      manager.startChapter(1);
      const firstRun = manager.getCurrentRun();

      manager.startChapter(1);
      const secondRun = manager.getCurrentRun();

      expect(firstRun).not.toBe(secondRun);
      expect(firstRun?.isActive).toBe(false);
    });
  });

  describe("room progression", () => {
    beforeEach(() => {
      manager.startChapter(1);
    });

    it("should advance to next room", () => {
      expect(manager.getCurrentRoom()).toBe(1);

      const result = manager.advanceRoom();

      expect(result).toBe(true);
      expect(manager.getCurrentRoom()).toBe(2);
    });

    it("should not advance beyond total rooms", () => {
      // Advance to last room
      for (let i = 1; i < ROOMS_PER_CHAPTER; i++) {
        manager.advanceRoom();
      }
      expect(manager.getCurrentRoom()).toBe(ROOMS_PER_CHAPTER);

      const result = manager.advanceRoom();
      expect(result).toBe(false);
    });

    it("should update highest room in progress", () => {
      manager.advanceRoom();
      manager.advanceRoom();
      manager.advanceRoom();

      const progress = manager.getChapterProgress(1);
      expect(progress!.highestRoom).toBe(4); // Started at 1, advanced 3 times
    });

    it("should emit roomEntered event", () => {
      const callback = vi.fn();
      manager.on("roomEntered", callback);

      manager.advanceRoom();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "roomEntered",
          chapterId: 1,
          roomNumber: 2,
        }),
      );
    });

    it("should mark room as cleared", () => {
      const callback = vi.fn();
      manager.on("roomCleared", callback);

      manager.clearRoom();

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "roomCleared",
          chapterId: 1,
          roomNumber: 1,
        }),
      );
    });

    it("should get total rooms", () => {
      expect(manager.getTotalRooms()).toBe(ROOMS_PER_CHAPTER);
    });

    it("should get room type", () => {
      const roomType = manager.getRoomType(5);
      expect(roomType).toBeDefined();
    });
  });

  describe("death tracking", () => {
    beforeEach(() => {
      manager.startChapter(1);
    });

    it("should record deaths during run", () => {
      manager.recordDeath();
      manager.recordDeath();

      const run = manager.getCurrentRun();
      expect(run?.deathsDuringRun).toBe(2);
    });

    it("should not record death without active run", () => {
      manager.endRun(true);

      // This should not throw
      manager.recordDeath();
    });
  });

  describe("chapter completion", () => {
    beforeEach(() => {
      manager.startChapter(1);
      // Advance to last room
      for (let i = 1; i < ROOMS_PER_CHAPTER; i++) {
        manager.advanceRoom();
      }
    });

    it("should complete chapter with star rating", () => {
      const result = manager.completeChapter(100, 100);

      expect(result).not.toBeNull();
      expect(result!.chapterId).toBe(1);
      expect(result!.stars).toBeGreaterThanOrEqual(1);
      expect(result!.stars).toBeLessThanOrEqual(3);
    });

    it("should calculate rewards on completion", () => {
      const result = manager.completeChapter(100, 100);

      expect(result!.rewards).toBeDefined();
      expect(result!.rewards.gold).toBeGreaterThan(0);
    });

    it("should mark chapter as completed", () => {
      manager.completeChapter(100, 100);

      const progress = manager.getChapterProgress(1);
      expect(progress!.completed).toBe(true);
      expect(progress!.completionCount).toBe(1);
    });

    it("should track first completion", () => {
      const first = manager.completeChapter(100, 100);
      expect(first!.isFirstCompletion).toBe(true);

      // Start another run
      manager.startChapter(1);
      for (let i = 1; i < ROOMS_PER_CHAPTER; i++) {
        manager.advanceRoom();
      }
      const second = manager.completeChapter(100, 100);
      expect(second!.isFirstCompletion).toBe(false);
    });

    it("should unlock next chapter on first completion", () => {
      const result = manager.completeChapter(100, 100);

      expect(result!.newChapterUnlocked).toBe(2);
      expect(manager.isChapterUnlocked(2)).toBe(true);
    });

    it("should update best stars", () => {
      manager.completeChapter(50, 100); // Low HP, probably 1-2 stars

      expect(manager.getBestStars(1)).toBeGreaterThanOrEqual(1);
    });

    it("should emit chapterCompleted event", () => {
      const callback = vi.fn();
      manager.on("chapterCompleted", callback);

      manager.completeChapter(100, 100);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chapterCompleted",
          chapterId: 1,
        }),
      );
    });

    it("should emit starRatingAchieved event", () => {
      const callback = vi.fn();
      manager.on("starRatingAchieved", callback);

      manager.completeChapter(100, 100);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "starRatingAchieved",
          chapterId: 1,
        }),
      );
    });

    it("should return null without active run", () => {
      manager.endRun(true);

      const result = manager.completeChapter(100, 100);
      expect(result).toBeNull();
    });
  });

  describe("run failure", () => {
    beforeEach(() => {
      manager.startChapter(1);
      manager.advanceRoom();
      manager.advanceRoom();
    });

    it("should end run on failure", () => {
      manager.endRun(true);

      expect(manager.getCurrentRun()?.isActive).toBe(false);
    });

    it("should update highest room on failure", () => {
      manager.endRun(true);

      const progress = manager.getChapterProgress(1);
      expect(progress!.highestRoom).toBe(3);
    });

    it("should emit chapterFailed event", () => {
      const callback = vi.fn();
      manager.on("chapterFailed", callback);

      manager.endRun(true);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "chapterFailed",
          chapterId: 1,
          roomNumber: 3,
        }),
      );
    });

    it("should not emit event on non-failure end", () => {
      const callback = vi.fn();
      manager.on("chapterFailed", callback);

      manager.endRun(false);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("enemy pool and difficulty", () => {
    it("should get enemy pool for chapter", () => {
      const pool = manager.getEnemyPoolForChapter(1);
      expect(pool).toBeDefined();
      expect(pool.length).toBeGreaterThan(0);
    });

    it("should get current enemy pool", () => {
      manager.startChapter(1);
      const pool = manager.getCurrentEnemyPool();
      expect(pool).toBeDefined();
    });

    it("should get chapter scaling", () => {
      const scaling = manager.getChapterScaling(1);
      expect(scaling).toBeDefined();
      expect(scaling.enemyHpMultiplier).toBeGreaterThanOrEqual(1);
    });
  });

  describe("reward calculations", () => {
    it("should calculate potential rewards", () => {
      const rewards = manager.calculatePotentialRewards(1, 3);
      expect(rewards).toBeDefined();
      expect(rewards.gold).toBeGreaterThan(0);
    });

    it("should get star multiplier", () => {
      expect(manager.getStarMultiplier(1)).toBe(1);
      expect(manager.getStarMultiplier(2)).toBeGreaterThan(1);
      expect(manager.getStarMultiplier(3)).toBeGreaterThan(manager.getStarMultiplier(2));
    });
  });

  describe("event system", () => {
    it("should allow subscribing to events", () => {
      const callback = vi.fn();
      manager.on("chapterStarted", callback);

      manager.startChapter(1);

      expect(callback).toHaveBeenCalled();
    });

    it("should allow unsubscribing from events", () => {
      const callback = vi.fn();
      manager.on("chapterStarted", callback);
      manager.off("chapterStarted", callback);

      manager.startChapter(1);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("persistence", () => {
    it("should save and load data correctly", () => {
      manager.forceUnlockChapter(3);
      manager.forceCompleteChapter(1, 3);

      const saveData = manager.toSaveData();
      expect(saveData.unlockedChapters).toContain(3);
      expect(saveData.chapterProgress[1]?.completed).toBe(true);

      // Create new manager and load data
      const newManager = new ChapterManager();
      newManager.fromSaveData(saveData);

      expect(newManager.isChapterUnlocked(3)).toBe(true);
      expect(newManager.isChapterCompleted(1)).toBe(true);
    });

    it("should ensure chapter 1 is always unlocked on load", () => {
      const saveData = {
        chapterProgress: {},
        unlockedChapters: [], // Empty - should still unlock 1
        selectedChapter: 1 as const,
      };

      const newManager = new ChapterManager();
      newManager.fromSaveData(saveData);

      expect(newManager.isChapterUnlocked(1)).toBe(true);
    });

    it("should handle partial save data", () => {
      const partialData = {
        chapterProgress: {},
        unlockedChapters: [1, 2],
        selectedChapter: 2 as const,
      };

      const newManager = new ChapterManager();
      newManager.fromSaveData(partialData);

      expect(newManager.getSelectedChapter()).toBe(2);
      expect(newManager.isChapterUnlocked(2)).toBe(true);
    });
  });

  describe("reset()", () => {
    it("should reset all progress", () => {
      manager.forceUnlockChapter(5);
      manager.forceCompleteChapter(1, 3);
      manager.forceCompleteChapter(2, 2);

      manager.reset();

      expect(manager.getUnlockedChapters()).toEqual([1]);
      expect(manager.isChapterCompleted(1)).toBe(false);
      expect(manager.getSelectedChapter()).toBe(1);
      expect(manager.getCurrentRun()).toBeNull();
    });
  });

  describe("debug methods", () => {
    it("should return debug snapshot", () => {
      manager.startChapter(1);
      manager.advanceRoom();

      const snapshot = manager.getDebugSnapshot();

      expect(snapshot.selectedChapter).toBe(1);
      expect(snapshot.unlockedChapters).toContain(1);
      expect(snapshot.currentRun).not.toBeNull();
      expect(snapshot.chapterProgress.length).toBeGreaterThan(0);
    });

    it("should force unlock chapters", () => {
      manager.forceUnlockChapter(4);
      expect(manager.isChapterUnlocked(4)).toBe(true);
    });

    it("should force complete chapters", () => {
      // Need to unlock chapter 2 first before we can force complete it
      manager.forceUnlockChapter(2);
      manager.forceCompleteChapter(2, 2);

      expect(manager.isChapterUnlocked(2)).toBe(true);
      expect(manager.isChapterCompleted(2)).toBe(true);
      expect(manager.getBestStars(2)).toBe(2);
      expect(manager.isChapterUnlocked(3)).toBe(true); // Next chapter unlocked
    });
  });

  describe("progress tracking", () => {
    it("should get all chapter progress", () => {
      const allProgress = manager.getAllChapterProgress();
      expect(allProgress.length).toBeGreaterThan(0);
    });

    it("should return undefined for non-initialized chapter", () => {
      // Chapter 5 should not have progress until unlocked
      const progress = manager.getChapterProgress(5);
      expect(progress).toBeUndefined();
    });

    it("should track best completion time", () => {
      manager.startChapter(1);
      for (let i = 1; i < ROOMS_PER_CHAPTER; i++) {
        manager.advanceRoom();
      }

      const result = manager.completeChapter(100, 100);
      // Time might be 0 if test runs too fast, so check for >= 0
      expect(result!.completionTimeMs).toBeGreaterThanOrEqual(0);

      const progress = manager.getChapterProgress(1);
      expect(progress!.bestTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
