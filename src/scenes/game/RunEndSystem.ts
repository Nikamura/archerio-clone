import Phaser from "phaser";
import type Player from "../../entities/Player";
import type { InputSystem } from "./InputSystem";
import type { RoomManager } from "./RoomManager";
import type { AbilitySystem, AcquiredAbility } from "./AbilitySystem";
import type { EnemyDeathHandler } from "./EnemyDeathHandler";
import type { LevelUpSystem } from "./LevelUpSystem";
import type { PickupSystem } from "./PickupSystem";
import type { DifficultyConfig } from "../../config/difficulty";
import { audioManager } from "../../systems/AudioManager";
import { chapterManager } from "../../systems/ChapterManager";
import type { ChapterCompletionResult } from "../../systems/ChapterManager";

/**
 * Data passed to GameOverScene
 */
interface GameOverData {
  roomsCleared: number;
  enemiesKilled: number;
  isVictory: boolean;
  playTimeMs: number;
  abilitiesGained: number;
  goldEarned: number;
  completionResult?: ChapterCompletionResult;
  runSeed: string;
  acquiredAbilities: AcquiredAbility[];
  heroXPEarned: number;
  isEndlessMode?: boolean;
  endlessWave?: number;
  chapterId: number;
  difficulty: string;
}

/**
 * Event handlers for run end events
 */
export interface RunEndEventHandlers {
  /** Called when input system needs to be destroyed */
  onDestroyInput: () => void;
}

/**
 * Configuration for RunEndSystem
 */
export interface RunEndSystemConfig {
  scene: Phaser.Scene;
  player: Player;
  getInputSystem: () => InputSystem | null;
  getRoomManager: () => RoomManager;
  getAbilitySystem: () => AbilitySystem;
  getEnemyDeathHandler: () => EnemyDeathHandler;
  getLevelUpSystem: () => LevelUpSystem;
  getPickupSystem: () => PickupSystem;
  getIsGameOver: () => boolean;
  setIsGameOver: (value: boolean) => void;
  difficultyConfig: DifficultyConfig;
  runStartTime: number;
  runSeedString: string;
  isEndlessMode: boolean;
  eventHandlers: RunEndEventHandlers;
}

/**
 * RunEndSystem - Manages run lifecycle (victory, skip, pause, quit)
 *
 * Extracted from GameScene to consolidate run-ending logic and reduce
 * code duplication between triggerVictory() and handleSkipRun().
 *
 * Handles:
 * - Victory flow (chapter completion, rewards)
 * - Skip run flow (abandon run, collect partial rewards)
 * - Pause handling
 * - Quit from pause
 */
export class RunEndSystem {
  private scene: Phaser.Scene;
  private player: Player;
  private getInputSystem: () => InputSystem | null;
  private getRoomManager: () => RoomManager;
  private getAbilitySystem: () => AbilitySystem;
  private getEnemyDeathHandler: () => EnemyDeathHandler;
  private getLevelUpSystem: () => LevelUpSystem;
  private getPickupSystem: () => PickupSystem;
  private gameOverGetter: () => boolean;
  private gameOverSetter: (value: boolean) => void;
  private difficultyConfig: DifficultyConfig;
  private runStartTime: number;
  private runSeedString: string;
  private isEndlessMode: boolean;
  private eventHandlers: RunEndEventHandlers;

  constructor(config: RunEndSystemConfig) {
    this.scene = config.scene;
    this.player = config.player;
    this.getInputSystem = config.getInputSystem;
    this.getRoomManager = config.getRoomManager;
    this.getAbilitySystem = config.getAbilitySystem;
    this.getEnemyDeathHandler = config.getEnemyDeathHandler;
    this.getLevelUpSystem = config.getLevelUpSystem;
    this.getPickupSystem = config.getPickupSystem;
    this.gameOverGetter = config.getIsGameOver;
    this.gameOverSetter = config.setIsGameOver;
    this.difficultyConfig = config.difficultyConfig;
    this.runStartTime = config.runStartTime;
    this.runSeedString = config.runSeedString;
    this.isEndlessMode = config.isEndlessMode;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Trigger victory - called when all rooms are cleared
   */
  triggerVictory(): void {
    this.gameOverSetter(true);
    audioManager.playVictory();
    console.log("Victory! All rooms cleared!");

    // Complete chapter in manager to unlock next chapter and calculate rewards
    // Pass difficulty gold multiplier for reward scaling
    const completionResult = chapterManager.completeChapter(
      this.player.getHealth(),
      this.player.getMaxHealth(),
      this.difficultyConfig.goldMultiplier,
    );

    // Clean up input system
    this.destroyInputSystem();

    // Build game over data and transition
    const data = this.buildGameOverData(true, completionResult ?? undefined);
    this.transitionToGameOver(data, 500);
  }

  /**
   * Handle skip run - allows player to end run early and collect rewards
   */
  handleSkipRun(): void {
    if (this.gameOverGetter()) return;

    this.gameOverSetter(true);
    console.log("Run skipped! Collecting rewards...");

    // End the chapter run (skipped counts as failed/abandoned)
    chapterManager.endRun(true);

    // Stop player movement
    this.player.setVelocity(0, 0);

    // Clean up input system
    this.destroyInputSystem();

    // Build game over data and transition
    const data = this.buildGameOverData(false);
    this.transitionToGameOver(data, 300);
  }

  /**
   * Handle pause request - pause game and show pause menu
   */
  handlePause(): void {
    if (this.gameOverGetter()) return;

    // Check if scene is running before attempting to pause
    if (!this.scene.scene.isActive("GameScene")) {
      console.log("GameScene: Cannot pause - scene is not active");
      return;
    }

    console.log("GameScene: Pausing game");

    // Pause this scene (freezes physics, tweens, timers)
    this.scene.scene.pause("GameScene");

    // Launch pause scene overlay
    this.scene.scene.launch("PauseScene");
  }

  /**
   * Handle quit from pause menu - end run and return to main menu
   */
  handleQuitFromPause(): void {
    // Resume scene first so we can properly shut it down
    this.scene.scene.resume("GameScene");

    // Use skip run logic to properly end the run
    this.handleSkipRun();
  }

  /**
   * Calculate rooms cleared based on game state
   */
  private calculateRoomsCleared(isVictory: boolean): number {
    const roomManager = this.getRoomManager();

    if (isVictory) {
      return roomManager.getTotalRooms();
    }

    const currentRoom = roomManager.getRoomNumber();
    const totalRooms = roomManager.getTotalRooms();
    const endlessWave = roomManager.getEndlessWave();

    return this.isEndlessMode ? (endlessWave - 1) * totalRooms + currentRoom - 1 : currentRoom - 1;
  }

  /**
   * Build game over data object with all stats
   */
  private buildGameOverData(
    isVictory: boolean,
    completionResult?: ChapterCompletionResult,
  ): GameOverData {
    const roomManager = this.getRoomManager();
    const abilitySystem = this.getAbilitySystem();
    const enemyDeathHandler = this.getEnemyDeathHandler();
    const levelUpSystem = this.getLevelUpSystem();
    const pickupSystem = this.getPickupSystem();

    const playTimeMs = Date.now() - this.runStartTime;
    const roomsCleared = this.calculateRoomsCleared(isVictory);

    const data: GameOverData = {
      roomsCleared,
      enemiesKilled: enemyDeathHandler.getEnemiesKilled(),
      isVictory,
      playTimeMs,
      abilitiesGained: abilitySystem.getTotalAbilitiesGained(),
      goldEarned: pickupSystem.getGoldEarned(),
      runSeed: this.runSeedString,
      acquiredAbilities: levelUpSystem.getAcquiredAbilitiesArray(),
      heroXPEarned: enemyDeathHandler.getHeroXPEarned(),
      chapterId: chapterManager.getSelectedChapter(),
      difficulty: this.difficultyConfig.label.toLowerCase(),
    };

    // Add victory-specific data
    if (isVictory && completionResult) {
      data.completionResult = completionResult;
    }

    // Add endless mode data for non-victory
    if (!isVictory) {
      const endlessWave = roomManager.getEndlessWave();
      data.isEndlessMode = this.isEndlessMode;
      data.endlessWave = endlessWave;
    }

    return data;
  }

  /**
   * Transition to game over scene
   */
  private transitionToGameOver(data: GameOverData, delay: number): void {
    this.scene.time.delayedCall(delay, () => {
      // Stop UIScene first
      this.scene.scene.stop("UIScene");

      // Launch game over scene with stats
      this.scene.scene.launch("GameOverScene", data);

      // Stop GameScene last - this prevents texture issues when restarting
      this.scene.scene.stop("GameScene");
    });
  }

  /**
   * Destroy input system if it exists
   */
  private destroyInputSystem(): void {
    const inputSystem = this.getInputSystem();
    if (inputSystem) {
      inputSystem.destroy();
      this.eventHandlers.onDestroyInput();
    }
  }

  /**
   * Clean up resources (currently no persistent resources to clean)
   */
  destroy(): void {
    // No persistent resources to clean up
  }
}
