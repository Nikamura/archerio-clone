import Phaser from "phaser";
import type Player from "../../entities/Player";
import type Enemy from "../../entities/Enemy";
import type Boss from "../../entities/Boss";
import type { InputSystem } from "./InputSystem";
import type { LevelUpSystem } from "./LevelUpSystem";
import type { PassiveEffectSystem } from "./PassiveEffectSystem";
import type { RoomManager } from "./RoomManager";
import type { EnemyDeathHandler } from "./EnemyDeathHandler";
import type { PickupSystem } from "./PickupSystem";
import type { RunEndSystem } from "./RunEndSystem";
import type { RespawnSystem } from "./RespawnSystem";
import type { CombatSystem } from "./CombatSystem";
import type { ShootingSystem } from "./ShootingSystem";
import type { GameSceneEventHandlers } from "./InitializationSystem";

/**
 * Dependencies needed by event handlers
 * Uses getters for circular dependencies (systems not yet created when factory runs)
 */
export interface EventHandlerDependencies {
  scene: Phaser.Scene;
  getPlayer: () => Player;
  getBoss: () => Boss | null;
  setBoss: (boss: Boss | null) => void;
  getIsGameOver: () => boolean;
  setIsGameOver: (value: boolean) => void;
  getInputSystem: () => InputSystem | null;
  setInputSystem: (system: InputSystem | null) => void;
  getLevelUpSystem: () => LevelUpSystem;
  getPassiveEffectSystem: () => PassiveEffectSystem;
  getRoomManager: () => RoomManager;
  getEnemyDeathHandler: () => EnemyDeathHandler;
  getCombatSystem: () => CombatSystem;
  getShootingSystem: () => ShootingSystem;
  getPickupSystem: () => PickupSystem;
  getRunEndSystem: () => RunEndSystem;
  getRespawnSystem: () => RespawnSystem;
  updatePlayerHealthUI: (player: Player) => void;
  updateXPUI: () => void;
  resetJoystickState: () => void;
  handleBombExplosion: (x: number, y: number, radius: number, damage: number) => void;
}

/**
 * Configuration for EventHandlerFactory
 */
export interface EventHandlerFactoryConfig {
  dependencies: EventHandlerDependencies;
}

/**
 * EventHandlerFactory - Creates event handlers for GameScene
 *
 * Extracts the ~135-line createEventHandlers() method from GameScene into a
 * focused factory class. Organizes 35+ event handlers across 10 categories:
 * - Combat (6 handlers)
 * - Room (7 handlers)
 * - Level up (6 handlers)
 * - Enemy death (4 handlers)
 * - Respawn (2 handlers)
 * - Passive effects (2 handlers)
 * - Tutorial (2 handlers)
 * - Ability (3 handlers)
 * - Run end (1 handler)
 * - Game state (2 handlers)
 */
export class EventHandlerFactory {
  private deps: EventHandlerDependencies;

  constructor(config: EventHandlerFactoryConfig) {
    this.deps = config.dependencies;
  }

  /**
   * Create all event handlers for GameScene
   */
  createHandlers(): GameSceneEventHandlers {
    return {
      // Combat handlers
      ...this.createCombatHandlers(),

      // Room handlers
      ...this.createRoomHandlers(),

      // Level up handlers
      ...this.createLevelUpHandlers(),

      // Enemy death handlers
      ...this.createEnemyDeathHandlers(),

      // Respawn handlers
      ...this.createRespawnHandlers(),

      // Passive effects handlers
      ...this.createPassiveEffectHandlers(),

      // Tutorial handlers
      ...this.createTutorialHandlers(),

      // Ability handlers
      ...this.createAbilityHandlers(),

      // Run end handlers
      ...this.createRunEndHandlers(),

      // Game state handlers
      ...this.createGameStateHandlers(),
    };
  }

  /**
   * Combat event handlers (6 handlers)
   */
  private createCombatHandlers(): Pick<
    GameSceneEventHandlers,
    | "onEnemyKilled"
    | "onPlayerDamaged"
    | "onPlayerHealed"
    | "onPlayerDeath"
    | "onBossHealthUpdate"
    | "onBossKilled"
  > {
    return {
      onEnemyKilled: (enemy, isBoss) => {
        const enemyDeathHandler = this.deps.getEnemyDeathHandler();
        enemyDeathHandler.handleCombatDeath(enemy as Enemy, isBoss);
      },
      onPlayerDamaged: (_damage) => {
        this.deps.updatePlayerHealthUI(this.deps.getPlayer());
      },
      onPlayerHealed: (_amount) => {
        this.deps.updatePlayerHealthUI(this.deps.getPlayer());
      },
      onPlayerDeath: () => {
        this.deps.getRespawnSystem().triggerGameOver();
      },
      onBossHealthUpdate: (health, maxHealth) => {
        this.deps.scene.scene.get("UIScene").events.emit("updateBossHealth", health, maxHealth);
      },
      onBossKilled: () => {
        this.deps.setBoss(null);
        this.deps.getRoomManager().clearBoss();
        this.deps.scene.scene.get("UIScene").events.emit("hideBossHealth");
      },
    };
  }

  /**
   * Room event handlers (8 handlers)
   */
  private createRoomHandlers(): Pick<
    GameSceneEventHandlers,
    | "onRoomCleared"
    | "onRoomEntered"
    | "onUpdateRoomUI"
    | "onBossSpawned"
    | "onShowBossHealth"
    | "onHideBossHealth"
    | "onVictory"
    | "onBombExplosion"
    | "onChapterChanged"
  > {
    return {
      onRoomCleared: (roomNumber, collectedGold) => {
        this.deps.getPickupSystem().addGoldEarned(collectedGold);
        this.deps.scene.scene.get("UIScene").events.emit("roomCleared");
        const player = this.deps.getPlayer();
        this.deps.scene.scene
          .get("UIScene")
          .events.emit("updateHealth", player.getHealth(), player.getMaxHealth());

        // Update score display with cumulative rooms cleared
        const roomManager = this.deps.getRoomManager();
        const totalRooms = roomManager.getTotalRooms();
        const endlessWave = roomManager.getEndlessWave();
        const cumulativeRooms = (endlessWave - 1) * totalRooms + roomNumber;
        this.deps.scene.scene.get("UIScene").events.emit("scoreRoom", cumulativeRooms);

        console.log("Room", roomNumber, "cleared - UI notified, gold collected:", collectedGold);
      },
      onRoomEntered: (roomNumber, endlessWave) => {
        this.deps.scene.scene.get("UIScene").events.emit("roomEntered");
        if (endlessWave) {
          console.log(`Entered room ${roomNumber} (Wave ${endlessWave})`);
        }
      },
      onUpdateRoomUI: (currentRoom, totalRooms, endlessWave) => {
        if (endlessWave !== undefined) {
          this.deps.scene.scene
            .get("UIScene")
            .events.emit("updateRoom", currentRoom, totalRooms, endlessWave);
        } else {
          this.deps.scene.scene.get("UIScene").events.emit("updateRoom", currentRoom, totalRooms);
        }
      },
      onBossSpawned: (boss, _bossType, _bossName) => {
        this.deps.setBoss(boss);
        this.deps.getCombatSystem().setBoss(boss);
        this.deps.getEnemyDeathHandler()?.setBoss(boss);
      },
      onShowBossHealth: (health, maxHealth, name) => {
        this.deps.scene.scene.get("UIScene").events.emit("showBossHealth", health, maxHealth, name);
      },
      onHideBossHealth: () => {
        this.deps.scene.scene.get("UIScene").events.emit("hideBossHealth");
      },
      onVictory: () => {
        this.deps.getRunEndSystem().triggerVictory();
      },
      onBombExplosion: (x, y, radius, damage) => {
        this.deps.handleBombExplosion(x, y, radius, damage);
      },
      onChapterChanged: (newChapter) => {
        // Notify UIScene of chapter change for any UI updates
        this.deps.scene.scene.get("UIScene").events.emit("chapterChanged", newChapter);
        console.log(`Chapter changed to ${newChapter}`);
      },
    };
  }

  /**
   * Level up event handlers (6 handlers)
   */
  private createLevelUpHandlers(): Pick<
    GameSceneEventHandlers,
    | "onLevelUp"
    | "onXPGained"
    | "onLevelUpStarted"
    | "onLevelUpCompleted"
    | "onAbilityApplied"
    | "onStartingAbilitiesComplete"
    | "onAutoLevelUp"
    | "onCheckIronWill"
  > {
    return {
      onLevelUp: () => {
        this.deps.getLevelUpSystem().handleLevelUp(this.deps.getIsGameOver());
      },
      onXPGained: (xp) => {
        const player = this.deps.getPlayer();
        const leveledUp = player.addXP(xp);
        this.deps.updateXPUI();
        if (leveledUp && !player.isDead() && !this.deps.getIsGameOver()) {
          this.deps.getLevelUpSystem().handleLevelUp(this.deps.getIsGameOver());
        }
      },
      onLevelUpStarted: () => {
        this.deps.resetJoystickState();
      },
      onLevelUpCompleted: () => {
        this.deps.resetJoystickState();
      },
      onAbilityApplied: (_abilityId) => {},
      onStartingAbilitiesComplete: () => {
        this.deps.resetJoystickState();
      },
      onAutoLevelUp: (ability) => {
        this.deps.scene.scene.get("UIScene").events.emit("showAutoLevelUp", ability);
      },
      onCheckIronWill: () => {
        this.deps.getPassiveEffectSystem().checkIronWillStatus();
      },
    };
  }

  /**
   * Enemy death event handlers (4 handlers)
   */
  private createEnemyDeathHandlers(): Pick<
    GameSceneEventHandlers,
    "onKillRecorded" | "onPlayerHealthUpdated" | "onXPUIUpdated" | "onEnemyCacheInvalidated"
  > {
    return {
      onKillRecorded: () => {},
      onPlayerHealthUpdated: () => {
        this.deps.updatePlayerHealthUI(this.deps.getPlayer());
      },
      onXPUIUpdated: () => {
        this.deps.updateXPUI();
      },
      onEnemyCacheInvalidated: () => {
        this.deps.getShootingSystem().invalidateTargetCache();
      },
    };
  }

  /**
   * Respawn event handlers (2 handlers)
   */
  private createRespawnHandlers(): Pick<
    GameSceneEventHandlers,
    "onRespawnComplete" | "onUpdateHealthUI"
  > {
    return {
      onRespawnComplete: (newInputSystem: InputSystem) => {
        this.deps.setInputSystem(newInputSystem);
        this.deps.resetJoystickState();
      },
      onUpdateHealthUI: () => {
        this.deps.updatePlayerHealthUI(this.deps.getPlayer());
      },
    };
  }

  /**
   * Passive effect event handlers (2 handlers)
   */
  private createPassiveEffectHandlers(): Pick<
    GameSceneEventHandlers,
    "onIronWillActivated" | "onIronWillDeactivated"
  > {
    return {
      onIronWillActivated: (bonusHP) => {
        console.log(`GameScene: Iron Will activated! +${bonusHP} max HP`);
      },
      onIronWillDeactivated: (bonusHP) => {
        console.log(`GameScene: Iron Will deactivated, removed ${bonusHP} bonus HP`);
      },
    };
  }

  /**
   * Tutorial event handlers (2 handlers)
   */
  private createTutorialHandlers(): Pick<
    GameSceneEventHandlers,
    "onTutorialShown" | "onTutorialDismissed"
  > {
    return {
      onTutorialShown: () => {
        this.deps.scene.physics.pause();
      },
      onTutorialDismissed: () => {
        this.deps.scene.physics.resume();
      },
    };
  }

  /**
   * Ability event handlers (2 handlers)
   */
  private createAbilityHandlers(): Pick<
    GameSceneEventHandlers,
    "onAbilitiesUpdated" | "onHealthUpdated"
  > {
    return {
      onAbilitiesUpdated: (abilities) => {
        this.deps.scene.scene.get("UIScene").events.emit("updateAbilities", abilities);
      },
      onHealthUpdated: (current, max) => {
        this.deps.scene.scene.get("UIScene").events.emit("updateHealth", current, max);
      },
    };
  }

  /**
   * Run end event handlers (1 handler)
   */
  private createRunEndHandlers(): Pick<GameSceneEventHandlers, "onInputDestroyed"> {
    return {
      onInputDestroyed: () => {
        this.deps.setInputSystem(null);
      },
    };
  }

  /**
   * Game state handlers (2 handlers)
   */
  private createGameStateHandlers(): Pick<
    GameSceneEventHandlers,
    "getIsGameOver" | "setIsGameOver"
  > {
    return {
      getIsGameOver: () => this.deps.getIsGameOver(),
      setIsGameOver: (value: boolean) => {
        this.deps.setIsGameOver(value);
      },
    };
  }
}
