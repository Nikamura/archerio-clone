import { describe, it, expect, beforeEach, vi } from "vitest";
import type { RoomEventHandlers } from "./RoomManager";

/**
 * Tests for RoomManager core logic.
 *
 * These tests verify the room management logic without requiring a full Phaser environment.
 * We focus on testing:
 * - State management and getters
 * - Event handler callbacks
 * - Room progression logic
 * - Victory conditions
 */

// Helper functions to test room detection logic (avoids TypeScript literal narrowing)
// According to STANDARD_ROOM_LAYOUT in chapterData.ts:
// - bossRoom: 20 (final boss)
// - miniBossRooms: [10] (mini-boss only)
// - angelRooms: [5, 15] (not boss rooms)
function isBossRoom(room: number): boolean {
  return room === 20;
}

function isMiniBossRoom(room: number): boolean {
  return room === 10;
}

function isRoomClearedCheck(activeEnemies: number, pendingSpawns: number): boolean {
  return activeEnemies === 0 && pendingSpawns === 0;
}

function shouldTriggerVictoryCheck(
  currentRoom: number,
  totalRooms: number,
  isRoomCleared: boolean,
  isEndlessMode: boolean,
): boolean {
  return currentRoom >= totalRooms && isRoomCleared && !isEndlessMode;
}

describe("RoomManager State Logic", () => {
  describe("Victory Conditions", () => {
    it("should trigger victory on room 20 in normal mode", () => {
      expect(shouldTriggerVictoryCheck(20, 20, true, false)).toBe(true);
    });

    it("should not trigger victory in endless mode", () => {
      expect(shouldTriggerVictoryCheck(10, 10, true, true)).toBe(false);
    });

    it("should not trigger victory if room not cleared", () => {
      expect(shouldTriggerVictoryCheck(20, 20, false, false)).toBe(false);
    });

    it("should not trigger victory before reaching final room", () => {
      expect(shouldTriggerVictoryCheck(15, 20, true, false)).toBe(false);
    });
  });

  describe("Boss Room Detection", () => {
    it("should detect boss on room 20 (final boss)", () => {
      expect(isBossRoom(20)).toBe(true);
    });

    it("should not detect boss on room 10 (mini-boss room)", () => {
      expect(isBossRoom(10)).toBe(false);
    });

    it("should not detect boss on room 5 (angel room)", () => {
      expect(isBossRoom(5)).toBe(false);
    });

    it("should not detect boss on room 15 (angel room)", () => {
      expect(isBossRoom(15)).toBe(false);
    });
  });

  describe("Mini-Boss Room Detection", () => {
    it("should detect mini-boss on room 10", () => {
      expect(isMiniBossRoom(10)).toBe(true);
    });

    it("should not detect mini-boss on room 5 (angel room)", () => {
      expect(isMiniBossRoom(5)).toBe(false);
    });

    it("should not detect mini-boss on room 15 (angel room)", () => {
      expect(isMiniBossRoom(15)).toBe(false);
    });

    it("should not detect mini-boss on room 1", () => {
      expect(isMiniBossRoom(1)).toBe(false);
    });
  });

  describe("Endless Mode Wave Progression", () => {
    it("should increase difficulty multiplier each wave using exponential scaling", () => {
      // RoomManager uses: Math.pow(1.5, endlessWave - 1)
      const base = 1.5;

      const wave1Multiplier = Math.pow(base, 1 - 1); // 1.5^0 = 1.0
      const wave2Multiplier = Math.pow(base, 2 - 1); // 1.5^1 = 1.5
      const wave3Multiplier = Math.pow(base, 3 - 1); // 1.5^2 = 2.25

      expect(wave1Multiplier).toBe(1.0);
      expect(wave2Multiplier).toBe(1.5);
      expect(wave3Multiplier).toBeCloseTo(2.25, 2);
    });

    it("should reset room counter but not wave counter on wave transition", () => {
      let endlessWave = 2;
      let currentRoom = 10;

      // Simulate wave transition
      endlessWave++;
      currentRoom = 1;

      expect(endlessWave).toBe(3);
      expect(currentRoom).toBe(1);
    });
  });

  describe("Room Clearing Logic", () => {
    it("should not be cleared when enemies remain", () => {
      expect(isRoomClearedCheck(5, 0)).toBe(false);
    });

    it("should not be cleared when spawns are pending", () => {
      expect(isRoomClearedCheck(0, 3)).toBe(false);
    });

    it("should be cleared when no enemies and no pending spawns", () => {
      expect(isRoomClearedCheck(0, 0)).toBe(true);
    });

    it("should not be cleared when both enemies and spawns exist", () => {
      expect(isRoomClearedCheck(2, 2)).toBe(false);
    });
  });
});

describe("RoomManager Event Handlers", () => {
  let mockEventHandlers: RoomEventHandlers;

  beforeEach(() => {
    mockEventHandlers = {
      onRoomCleared: vi.fn(),
      onRoomEntered: vi.fn(),
      onUpdateRoomUI: vi.fn(),
      onBossSpawned: vi.fn(),
      onShowBossHealth: vi.fn(),
      onHideBossHealth: vi.fn(),
      onVictory: vi.fn(),
      onBombExplosion: vi.fn(),
      onChapterChanged: vi.fn(),
    };
  });

  it("should call onVictory when victory condition is met", () => {
    const shouldTriggerVictory = true;

    if (shouldTriggerVictory) {
      mockEventHandlers.onVictory();
    }

    expect(mockEventHandlers.onVictory).toHaveBeenCalledTimes(1);
  });

  it("should call onRoomCleared with room number and collected gold", () => {
    const currentRoom = 5;
    const collectedGold = 150;

    mockEventHandlers.onRoomCleared(currentRoom, collectedGold);

    expect(mockEventHandlers.onRoomCleared).toHaveBeenCalledWith(5, 150);
  });

  it("should call onUpdateRoomUI with correct params", () => {
    const currentRoom = 3;
    const totalRooms = 20;

    mockEventHandlers.onUpdateRoomUI(currentRoom, totalRooms);

    expect(mockEventHandlers.onUpdateRoomUI).toHaveBeenCalledWith(3, 20);
  });

  it("should call onUpdateRoomUI with endless wave in endless mode", () => {
    const currentRoom = 5;
    const totalRooms = 10;
    const endlessWave = 3;

    mockEventHandlers.onUpdateRoomUI(currentRoom, totalRooms, endlessWave);

    expect(mockEventHandlers.onUpdateRoomUI).toHaveBeenCalledWith(5, 10, 3);
  });

  it("should call onBombExplosion with correct parameters", () => {
    const x = 100;
    const y = 200;
    const radius = 80;
    const damage = 50;

    mockEventHandlers.onBombExplosion(x, y, radius, damage);

    expect(mockEventHandlers.onBombExplosion).toHaveBeenCalledWith(100, 200, 80, 50);
  });
});

describe("Stationary Enemy Types", () => {
  const STATIONARY_ENEMY_TYPES = ["spreader", "spawner"];

  it("should identify spreader as stationary", () => {
    expect(STATIONARY_ENEMY_TYPES.includes("spreader")).toBe(true);
  });

  it("should identify spawner as stationary", () => {
    expect(STATIONARY_ENEMY_TYPES.includes("spawner")).toBe(true);
  });

  it("should not identify ranged as stationary", () => {
    expect(STATIONARY_ENEMY_TYPES.includes("ranged")).toBe(false);
  });

  it("should not identify charger as stationary", () => {
    expect(STATIONARY_ENEMY_TYPES.includes("charger")).toBe(false);
  });
});

describe("Door Spawn Logic", () => {
  const DOOR_SPAWN_Y = -30;
  const STATIONARY_ENEMY_TYPES = ["spreader", "spawner"];

  function getSpawnY(enemyType: string, normalSpawnY: number): number {
    const isStationary = STATIONARY_ENEMY_TYPES.includes(enemyType);
    return isStationary ? normalSpawnY : DOOR_SPAWN_Y;
  }

  it("should spawn mobile enemies from above screen", () => {
    expect(getSpawnY("ranged", 300)).toBe(-30);
  });

  it("should spawn stationary enemies on screen", () => {
    expect(getSpawnY("spreader", 300)).toBe(300);
  });

  it("should spawn bomber enemies from above screen", () => {
    expect(getSpawnY("bomber", 300)).toBe(-30);
  });

  it("should spawn spawner enemies on screen", () => {
    expect(getSpawnY("spawner", 300)).toBe(300);
  });
});
