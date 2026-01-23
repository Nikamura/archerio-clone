import Phaser from "phaser";
import Player from "../../entities/Player";
import type { AbilitySystem } from "./AbilitySystem";
import type { InputSystem } from "./InputSystem";
import type { RoomManager } from "./RoomManager";
import type EnemyBulletPool from "../../systems/EnemyBulletPool";
import type { ParticleManager } from "../../systems/ParticleManager";
import type { TalentBonuses } from "../../config/talentData";
import type { SeededRandom } from "../../systems/SeededRandom";
import { ABILITIES, type AbilityData } from "../../config/abilityData";
import { saveManager } from "../../systems/SaveManager";
import { audioManager } from "../../systems/AudioManager";
import { hapticManager } from "../../systems/HapticManager";
import { abilityPriorityManager } from "../../systems/AbilityPriorityManager";

/**
 * Event handlers for level-up related events
 */
export interface LevelUpEventHandlers {
  onLevelUpStarted: () => void;
  onLevelUpCompleted: () => void;
  onAbilityApplied: (abilityId: string) => void;
  onStartingAbilitiesComplete: () => void;
  onAutoLevelUp: (ability: AbilityData) => void;
  onCheckIronWill: () => void;
}

/**
 * Configuration for LevelUpSystem
 */
export interface LevelUpSystemConfig {
  scene: Phaser.Scene;
  game: Phaser.Game;
  player: Player;
  abilitySystem: AbilitySystem;
  inputSystem: InputSystem;
  roomManager: RoomManager;
  enemyBulletPool: EnemyBulletPool;
  particles: ParticleManager;
  talentBonuses: TalentBonuses;
  runRng: SeededRandom;
  eventHandlers: LevelUpEventHandlers;
}

/**
 * LevelUpSystem - Manages level-up flow and ability selection
 *
 * Extracted from GameScene to provide focused level-up handling.
 * Manages level-up UI launch, auto level-up, and starting ability selection.
 */
export class LevelUpSystem {
  private scene: Phaser.Scene;
  private game: Phaser.Game;
  private player: Player;
  private abilitySystem: AbilitySystem;
  private inputSystem: InputSystem;
  private roomManager: RoomManager;
  private enemyBulletPool: EnemyBulletPool;
  private particles: ParticleManager;
  private talentBonuses: TalentBonuses;
  private runRng: SeededRandom;
  private eventHandlers: LevelUpEventHandlers;

  private _isLevelingUp: boolean = false;

  constructor(config: LevelUpSystemConfig) {
    this.scene = config.scene;
    this.game = config.game;
    this.player = config.player;
    this.abilitySystem = config.abilitySystem;
    this.inputSystem = config.inputSystem;
    this.roomManager = config.roomManager;
    this.enemyBulletPool = config.enemyBulletPool;
    this.particles = config.particles;
    this.talentBonuses = config.talentBonuses;
    this.runRng = config.runRng;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Check if player is currently in the level-up selection process or has immunity
   */
  get isLevelingUp(): boolean {
    return this._isLevelingUp;
  }

  /**
   * Set the leveling up state (used for external immunity like respawn)
   */
  setLevelingUp(value: boolean): void {
    this._isLevelingUp = value;
  }

  /**
   * Handle the level-up flow
   * Called when player gains enough XP to level up
   */
  handleLevelUp(isGameOver: boolean): void {
    // Don't allow level up if player is dead or game is over
    if (isGameOver || this.player.isDead()) {
      console.log("LevelUpSystem: handleLevelUp blocked - player is dead or game over");
      return;
    }

    console.log("LevelUpSystem: handleLevelUp called");
    audioManager.playLevelUp();
    hapticManager.levelUp();

    // Mark player as leveling up (immune to damage during selection)
    this._isLevelingUp = true;

    // Clear any enemy bullets that might be mid-flight
    this.enemyBulletPool.clear(true, true);

    // Level up celebration particles
    this.particles.emitLevelUp(this.player.x, this.player.y);

    // Apply heal on level up talent bonus
    if (this.talentBonuses.flatHealOnLevel > 0) {
      this.player.heal(this.talentBonuses.flatHealOnLevel);
      // Check Iron Will (may deactivate if healed above threshold)
      this.eventHandlers.onCheckIronWill();
      console.log("LevelUpSystem: Healed", this.talentBonuses.flatHealOnLevel, "HP from talent");
    }

    // Check if auto level up is enabled
    if (saveManager.getAutoLevelUp()) {
      this.handleAutoLevelUp();
      return;
    }

    // Reset joystick state before pausing to prevent stuck input
    this.eventHandlers.onLevelUpStarted();

    // Pause game physics
    this.scene.physics.pause();

    // Hide joystick so it doesn't block the UI
    console.log("LevelUpSystem: hiding joystick");
    this.inputSystem.hide();

    // Clean up any existing listeners to prevent multiple applications
    this.game.events.off("abilitySelected");

    // Listen for ability selection using global game events (more reliable than scene events)
    this.game.events.once("abilitySelected", (abilityId: string) => {
      console.log("LevelUpSystem: received abilitySelected", abilityId);
      try {
        this.applyAbility(abilityId);
        console.log("LevelUpSystem: resuming physics and showing joystick");
        // Ensure joystick state is reset before resuming
        this.eventHandlers.onLevelUpCompleted();
        this.scene.physics.resume();
        this.inputSystem.show();
        // Add brief immunity period (1 second) after level up to allow dodging
        this.scene.time.delayedCall(1000, () => {
          this._isLevelingUp = false;
        });
      } catch (error) {
        console.error("LevelUpSystem: Error applying ability:", error);
        this.eventHandlers.onLevelUpCompleted(); // Reset even on error
        this.scene.physics.resume(); // Resume anyway to prevent soft-lock
        this.inputSystem.show();
        this._isLevelingUp = false; // Reset flag on error too
      }
    });

    // Launch level up scene with ability choices
    if (this.scene.scene.isActive("LevelUpScene")) {
      console.log("LevelUpSystem: LevelUpScene already active, restarting it");
      this.scene.scene.stop("LevelUpScene");
    }

    // Build ability levels record from ability system
    const abilityLevels: Record<string, number> = {};
    for (const ability of this.abilitySystem.getAcquiredAbilitiesArray()) {
      abilityLevels[ability.id] = ability.level;
    }

    this.scene.scene.launch("LevelUpScene", {
      playerLevel: this.player.getLevel(),
      abilityLevels,
      hasExtraLife: this.player.hasExtraLife(),
    });
  }

  /**
   * Launch the starting ability selection UI for Glory talent bonus
   */
  launchStartingAbilitySelection(): void {
    const totalSelections = this.talentBonuses.startingAbilities;

    // Check if auto level up is enabled - if so, auto-select starting abilities
    if (saveManager.getAutoLevelUp()) {
      this.handleAutoStartingAbilities(totalSelections);
      return;
    }

    // Physics already paused in create() - hide joystick now that inputSystem exists
    this.inputSystem.hide();
    // Clean up any existing listeners to prevent multiple applications
    this.game.events.off("startingAbilitySelected");

    // Listen for starting ability selection using global game events
    this.game.events.on(
      "startingAbilitySelected",
      (data: { abilityId: string; remainingSelections: number; rngState: number }) => {
        console.log("LevelUpSystem: received startingAbilitySelected", data.abilityId);
        try {
          this.applyAbility(data.abilityId);
          console.log(`LevelUpSystem: Starting ability applied: ${data.abilityId}`);

          if (data.remainingSelections > 0) {
            // More selections to make - launch again with updated state
            console.log(
              `LevelUpSystem: ${data.remainingSelections} more starting abilities to select`,
            );
            this.scene.time.delayedCall(200, () => {
              this.scene.scene.launch("StartingAbilityScene", {
                remainingSelections: data.remainingSelections,
                currentSelection: totalSelections - data.remainingSelections + 1,
                totalSelections: totalSelections,
                rngState: data.rngState,
              });
            });
          } else {
            // All starting abilities selected - resume gameplay
            console.log("LevelUpSystem: All starting abilities selected, resuming gameplay");
            this.game.events.off("startingAbilitySelected");
            this.eventHandlers.onStartingAbilitiesComplete();
            this.inputSystem.show();
            // Spawn enemies now that ability selection is complete
            this.roomManager.spawnEnemiesForRoom();
            this.scene.physics.resume();
          }
        } catch (error) {
          console.error("LevelUpSystem: Error applying starting ability:", error);
          this.game.events.off("startingAbilitySelected");
          this.eventHandlers.onStartingAbilitiesComplete();
          this.inputSystem.show();
          // Spawn enemies even on error to prevent stuck game
          this.roomManager.spawnEnemiesForRoom();
          this.scene.physics.resume();
        }
      },
    );

    // Launch the starting ability selection scene
    if (this.scene.scene.isActive("StartingAbilityScene")) {
      console.log("LevelUpSystem: StartingAbilityScene already active, restarting it");
      this.scene.scene.stop("StartingAbilityScene");
    }

    this.scene.scene.launch("StartingAbilityScene", {
      remainingSelections: totalSelections,
      currentSelection: 1,
      totalSelections: totalSelections,
      rngState: this.runRng.getState(),
    });
  }

  /**
   * Get acquired abilities as array for passing to other scenes
   */
  getAcquiredAbilitiesArray(): { id: string; level: number }[] {
    return this.abilitySystem.getAcquiredAbilitiesArray();
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    this.game.events.off("abilitySelected");
    this.game.events.off("startingAbilitySelected");
  }

  /**
   * Get available abilities (not at max level)
   */
  private getAvailableAbilities(): AbilityData[] {
    return ABILITIES.filter((ability) => {
      const currentLevel = this.abilitySystem.getAbilityLevel(ability.id);

      // Special case for extra_life: only available if player doesn't have one
      if (ability.id === "extra_life") {
        return !this.player.hasExtraLife();
      }

      // Check max level for ALL abilities with a defined maxLevel
      // This prevents one-time abilities (like through_wall) from being offered again
      if (ability.maxLevel !== undefined && currentLevel >= ability.maxLevel) {
        return false;
      }

      return true;
    });
  }

  /**
   * Handle auto level up - select the highest priority ability without showing the selection UI
   */
  private handleAutoLevelUp(): void {
    // Get abilities that aren't maxed
    const availableAbilities = this.getAvailableAbilities();

    if (availableAbilities.length === 0) {
      console.log("LevelUpSystem: No available abilities for auto level up");
      this._isLevelingUp = false;
      return;
    }

    // Build ability levels record from ability system
    const abilityLevels: Record<string, number> = {};
    for (const ability of this.abilitySystem.getAcquiredAbilitiesArray()) {
      abilityLevels[ability.id] = ability.level;
    }

    // Select the highest priority ability from ALL available abilities (not just 3 random)
    // This ensures priority system works as expected
    const selectedAbility = abilityPriorityManager.getHighestPriorityAbility(
      availableAbilities,
      abilityLevels,
    );

    if (!selectedAbility) {
      console.log("LevelUpSystem: No ability could be selected");
      this._isLevelingUp = false;
      return;
    }

    // Apply the ability
    this.applyAbility(selectedAbility.id);

    console.log("LevelUpSystem: Auto level up selected (priority):", selectedAbility.id);

    // Notify UIScene to show the auto level up notification
    this.eventHandlers.onAutoLevelUp(selectedAbility);

    // Brief immunity period after auto level up
    this.scene.time.delayedCall(500, () => {
      this._isLevelingUp = false;
    });
  }

  /**
   * Handle auto starting abilities - select abilities using priority without showing UI
   */
  private handleAutoStartingAbilities(totalSelections: number): void {
    console.log(
      `LevelUpSystem: Auto-selecting ${totalSelections} starting abilities from Glory talent`,
    );

    // Build ability levels record from ability system
    const abilityLevels: Record<string, number> = {};
    for (const ability of this.abilitySystem.getAcquiredAbilitiesArray()) {
      abilityLevels[ability.id] = ability.level;
    }

    // Select and apply abilities one by one
    for (let i = 0; i < totalSelections; i++) {
      // Get abilities that aren't maxed (re-check each time as levels change)
      const availableAbilities = this.getAvailableAbilities();

      if (availableAbilities.length === 0) {
        console.log("LevelUpSystem: No more available abilities for auto starting selection");
        break;
      }

      // Select highest priority ability from ALL available abilities (not just 3 random)
      // This ensures priority system works as expected for starting abilities
      const selectedAbility = abilityPriorityManager.getHighestPriorityAbility(
        availableAbilities,
        abilityLevels,
      );

      if (!selectedAbility) {
        console.log("LevelUpSystem: No ability could be selected for starting ability");
        break;
      }

      // Apply the ability
      this.applyAbility(selectedAbility.id);

      // Update the ability levels record
      abilityLevels[selectedAbility.id] = (abilityLevels[selectedAbility.id] || 0) + 1;

      console.log(
        `LevelUpSystem: Auto starting ability ${i + 1}/${totalSelections} selected: ${selectedAbility.id}`,
      );

      // Show notification for each auto-selected starting ability
      this.eventHandlers.onAutoLevelUp(selectedAbility);
    }

    // Complete the starting abilities flow and resume gameplay
    console.log("LevelUpSystem: All auto starting abilities selected, resuming gameplay");
    this.eventHandlers.onStartingAbilitiesComplete();
    this.roomManager.spawnEnemiesForRoom();
    this.scene.physics.resume();
  }

  /**
   * Apply an ability to the player via the ability system
   */
  private applyAbility(abilityId: string): void {
    this.abilitySystem.applyAbility(abilityId);
    this.eventHandlers.onAbilityApplied(abilityId);
  }
}
