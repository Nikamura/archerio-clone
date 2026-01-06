import Phaser from 'phaser'
import type Player from '../../entities/Player'
import type Enemy from '../../entities/Enemy'
import type BaseBoss from '../../entities/bosses/BaseBoss'
import type EnemyBulletPool from '../../systems/EnemyBulletPool'
import type BombPool from '../../systems/BombPool'
import type { ParticleManager } from '../../systems/ParticleManager'
import type { AbilitySystem } from './AbilitySystem'
import type { DropManager } from './DropManager'
import type InputSystem from './InputSystem'
import type { DifficultyConfig } from '../../config/difficulty'
import { audioManager } from '../../systems/AudioManager'
import { chapterManager } from '../../systems/ChapterManager'
import { saveManager } from '../../systems/SaveManager'
import { hapticManager } from '../../systems/HapticManager'
import { getBossDefinition, type BossId } from '../../config/bossData'
import type { BossType } from '../../config/chapterData'

/**
 * Enemy respawn state for room restoration
 */
export interface EnemyRespawnState {
  x: number
  y: number
  health: number
  maxHealth: number
  type: string
}

/**
 * Room state saved for player respawn
 */
export interface RespawnRoomState {
  enemies: EnemyRespawnState[]
  bossHealth?: number
  bossMaxHealth?: number
}

/**
 * Event handlers for game mode transitions and UI updates
 */
export interface GameModeManagerEventHandlers {
  onVictory: () => void
  onGameOver: () => void
  onRespawn: (roomState: RespawnRoomState) => void
  onSkipRun: () => void
  onUpdateHealthUI: () => void
  onUpdateRoomUI: () => void
}

/**
 * Configuration for GameModeManager initialization
 */
export interface GameModeManagerConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  enemyBulletPool: EnemyBulletPool
  bombPool: BombPool | null
  particles: ParticleManager
  abilitySystem: AbilitySystem
  dropManager: DropManager
  difficultyConfig: DifficultyConfig
  eventHandlers: GameModeManagerEventHandlers
  getInputSystem: () => InputSystem | null
  getBoss: () => BaseBoss | null
  getCurrentBossType: () => BossType | null
  getCurrentRoom: () => number
  getTotalRooms: () => number
  getEndlessWave: () => number
  getAcquiredAbilitiesArray: () => string[]
  getRunSeedString: () => string
}

/**
 * GameModeManager - Manages game mode state and victory/defeat/respawn logic
 *
 * Key responsibilities:
 * - Track game mode state (endless, daily challenge, game over)
 * - Handle victory conditions (chapter completion)
 * - Handle defeat conditions (player death, extra life, respawn)
 * - Handle respawn mechanics (save/restore room state)
 * - Handle skip run functionality (debug)
 * - Manage run timing
 */
export class GameModeManager {
  private scene: Phaser.Scene
  private player: Player
  private enemies: Phaser.Physics.Arcade.Group
  private enemyBulletPool: EnemyBulletPool
  private bombPool: BombPool | null
  private particles: ParticleManager
  private abilitySystem: AbilitySystem
  private dropManager: DropManager
  private difficultyConfig: DifficultyConfig
  private eventHandlers: GameModeManagerEventHandlers
  private getInputSystem: () => InputSystem | null
  private getBoss: () => BaseBoss | null
  private getCurrentBossType: () => BossType | null
  private getCurrentRoom: () => number
  private getTotalRooms: () => number
  private getEndlessWave: () => number
  private getAcquiredAbilitiesArray: () => string[]
  private getRunSeedString: () => string

  // Game mode state
  private isEndlessMode: boolean = false
  private isDailyChallengeMode: boolean = false
  private isGameOverState: boolean = false
  private respawnUsed: boolean = false
  private runStartTime: number = 0

  constructor(config: GameModeManagerConfig) {
    this.scene = config.scene
    this.player = config.player
    this.enemies = config.enemies
    this.enemyBulletPool = config.enemyBulletPool
    this.bombPool = config.bombPool
    this.particles = config.particles
    this.abilitySystem = config.abilitySystem
    this.dropManager = config.dropManager
    this.difficultyConfig = config.difficultyConfig
    this.eventHandlers = config.eventHandlers
    this.getInputSystem = config.getInputSystem
    this.getBoss = config.getBoss
    this.getCurrentBossType = config.getCurrentBossType
    this.getCurrentRoom = config.getCurrentRoom
    this.getTotalRooms = config.getTotalRooms
    this.getEndlessWave = config.getEndlessWave
    this.getAcquiredAbilitiesArray = config.getAcquiredAbilitiesArray
    this.getRunSeedString = config.getRunSeedString
  }

  /**
   * Initialize game mode state for new run
   */
  initialize(isEndless: boolean, isDailyChallenge: boolean): void {
    this.isEndlessMode = isEndless
    this.isDailyChallengeMode = isDailyChallenge
    this.isGameOverState = false
    this.respawnUsed = false
    this.runStartTime = Date.now()
  }

  /**
   * Check if game is over
   */
  isGameOver(): boolean {
    return this.isGameOverState
  }

  /**
   * Get run start time
   */
  getRunStartTime(): number {
    return this.runStartTime
  }

  /**
   * Check if endless mode is active
   */
  isEndless(): boolean {
    return this.isEndlessMode
  }

  /**
   * Check if daily challenge mode is active
   */
  isDailyChallenge(): boolean {
    return this.isDailyChallengeMode
  }

  /**
   * Check if respawn is available
   */
  canRespawn(): boolean {
    return !this.respawnUsed
  }

  /**
   * Trigger victory - player completed all rooms
   */
  triggerVictory(): void {
    this.isGameOverState = true
    audioManager.playVictory()
    console.log('Victory! All rooms cleared!')

    // Complete chapter in manager to unlock next chapter and calculate rewards
    // Pass difficulty gold multiplier for reward scaling
    const completionResult = chapterManager.completeChapter(
      this.player.getHealth(),
      this.player.getMaxHealth(),
      this.difficultyConfig.goldMultiplier
    )

    // Clean up input system
    const inputSystem = this.getInputSystem()
    if (inputSystem) {
      inputSystem.destroy()
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime

    // Brief delay before showing victory screen
    this.scene.time.delayedCall(500, () => {
      // Stop UIScene first
      this.scene.scene.stop('UIScene')

      // Launch victory scene (reusing GameOverScene for now)
      this.scene.scene.launch('GameOverScene', {
        roomsCleared: this.getTotalRooms(),
        enemiesKilled: this.dropManager.getEnemiesKilled(),
        isVictory: true,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.dropManager.getGoldEarned(),
        completionResult: completionResult ?? undefined,
        runSeed: this.getRunSeedString(),
        acquiredAbilities: this.getAcquiredAbilitiesArray(),
        heroXPEarned: this.dropManager.getHeroXPEarned(),
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
      })

      // Stop GameScene last - this prevents texture issues when restarting
      this.scene.scene.stop('GameScene')
    })
  }

  /**
   * Trigger game over - player died
   */
  triggerGameOver(): void {
    if (this.isGameOverState) return

    // Check for Extra Life before dying
    if (this.player.hasExtraLife()) {
      if (this.player.useExtraLife()) {
        console.log('Extra Life used! Reviving at 30% HP')
        // Remove extra life from skills bar
        this.abilitySystem.consumeAbility('extra_life')
        // Show revive effect
        this.player.clearTint()
        this.scene.cameras.main.flash(500, 255, 215, 0) // Golden flash
        audioManager.playLevelUp() // Triumphant sound
        hapticManager.levelUp()
        // Update health UI
        this.eventHandlers.onUpdateHealthUI()
        // Brief invincibility after revive
        this.player.setTint(0xffffff)
        this.scene.time.delayedCall(100, () => {
          if (this.player && this.player.active) {
            this.player.clearTint()
          }
        })
        return // Don't trigger game over
      }
    }

    this.isGameOverState = true
    audioManager.playDeath()
    hapticManager.death() // Haptic feedback for player death
    console.log('Game Over! Enemies killed:', this.dropManager.getEnemiesKilled())

    // Stop LevelUpScene if it's active (handles race condition edge cases)
    if (this.scene.scene.isActive('LevelUpScene')) {
      this.scene.scene.stop('LevelUpScene')
      this.scene.game.events.off('abilitySelected') // Clean up listener
    }

    // Check if respawn is available (one-time use per run)
    const canRespawn = !this.respawnUsed

    // Save room state for respawn (enemy and boss HP)
    const respawnRoomState = canRespawn ? this.saveRoomStateForRespawn() : undefined

    // Only end run if respawn is not available
    if (!canRespawn) {
      chapterManager.endRun(true)
    }

    // Stop player movement
    this.player.setVelocity(0, 0)

    // Flash player red and fade out
    this.player.setTint(0xff0000)

    // Only destroy input system if respawn is not available
    const inputSystem = this.getInputSystem()
    if (!canRespawn && inputSystem) {
      inputSystem.destroy()
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime

    // Brief delay before showing game over screen
    this.scene.time.delayedCall(500, () => {
      // Stop UIScene first (but keep GameScene if respawn is available)
      this.scene.scene.stop('UIScene')

      // Calculate total rooms cleared in endless mode (across all waves)
      const currentRoom = this.getCurrentRoom()
      const totalRooms = this.getTotalRooms()
      const endlessWave = this.getEndlessWave()
      const totalRoomsCleared = this.isEndlessMode
        ? (endlessWave - 1) * totalRooms + currentRoom - 1
        : currentRoom - 1

      // Record daily challenge completion if applicable
      if (this.isDailyChallengeMode) {
        saveManager.recordDailyChallengeCompletion(endlessWave)
      }

      // Launch game over scene with stats
      this.scene.scene.launch('GameOverScene', {
        roomsCleared: totalRoomsCleared,
        enemiesKilled: this.dropManager.getEnemiesKilled(),
        isVictory: false,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.dropManager.getGoldEarned(),
        runSeed: this.getRunSeedString(),
        acquiredAbilities: this.getAcquiredAbilitiesArray(),
        heroXPEarned: this.dropManager.getHeroXPEarned(),
        isEndlessMode: this.isEndlessMode,
        endlessWave,
        isDailyChallengeMode: this.isDailyChallengeMode,
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
        canRespawn,
        respawnRoomState,
      })

      // Only stop GameScene if respawn is NOT available
      // When respawn is available, keep the scene running so we can resume
      if (!canRespawn) {
        this.scene.scene.stop('GameScene')
      }
    })
  }

  /**
   * Save current room state for respawn (enemy and boss HP)
   */
  private saveRoomStateForRespawn(): RespawnRoomState {
    const enemies: EnemyRespawnState[] = []

    // Save all active enemies' HP and position
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy
      if (enemy.active) {
        enemies.push({
          x: enemy.x,
          y: enemy.y,
          health: enemy.getHealth(),
          maxHealth: enemy.getMaxHealth(),
          type: enemy.constructor.name,
        })
      }
    })

    // Save boss HP if present
    const boss = this.getBoss()
    const bossHealth = boss?.getHealth()
    const bossMaxHealth = boss?.getMaxHealth()

    console.log(`GameModeManager: Saved room state - ${enemies.length} enemies, boss HP: ${bossHealth ?? 'N/A'}`)

    return {
      enemies,
      bossHealth,
      bossMaxHealth,
    }
  }

  /**
   * Handle player respawn from GameOverScene (after watching ad)
   */
  handleRespawn(roomState: RespawnRoomState): void {
    console.log('GameModeManager: Handling respawn')

    // Mark respawn as used (one-time per run)
    this.respawnUsed = true

    // Reset game over state
    this.isGameOverState = false

    // Grant temporary immunity (2 seconds to escape danger)
    // This will be handled by GameScene via event handler

    // Restore player to 50% HP
    const maxHealth = this.player.getMaxHealth()
    const healAmount = Math.floor(maxHealth * 0.5)
    this.player.heal(healAmount)

    // Clear dead state visual
    this.player.clearTint()

    // Show respawn visual effect - expanding ring
    this.showRespawnEffect()

    // Push all enemies away from player
    this.pushEnemiesAway()

    // Show revive effect
    this.scene.cameras.main.flash(500, 255, 215, 0) // Golden flash
    audioManager.playLevelUp()
    hapticManager.levelUp()

    // Enemies and boss keep their current HP since we didn't destroy GameScene
    // The room state was passed for potential future use, but enemies are already in place

    // Restart UIScene
    this.scene.scene.launch('UIScene')

    // Re-show boss health bar if we're in a boss room
    const boss = this.getBoss()
    if (boss && boss.active) {
      const currentBossType = this.getCurrentBossType()
      const bossDef = getBossDefinition(currentBossType as BossId)
      const bossName = bossDef?.name || currentBossType?.replace(/_/g, ' ') || 'Boss'
      // Delay slightly to ensure UIScene is ready
      this.scene.time.delayedCall(50, () => {
        this.scene.scene.get('UIScene').events.emit('showBossHealth', boss.getHealth(), boss.getMaxHealth(), bossName)
      })
    }

    // Notify GameScene to re-initialize input system
    this.eventHandlers.onRespawn(roomState)

    // Update health UI
    this.eventHandlers.onUpdateHealthUI()

    console.log('GameModeManager: Respawn complete - Player HP:', this.player.getHealth())
  }

  /**
   * Show visual effect for respawn (expanding golden ring)
   */
  private showRespawnEffect(): void {
    const graphics = this.scene.add.graphics()
    graphics.setDepth(50)

    const playerX = this.player.x
    const playerY = this.player.y
    const maxRadius = 150
    const duration = 400

    // Animate expanding ring
    let elapsed = 0
    const timer = this.scene.time.addEvent({
      delay: 16, // ~60fps
      repeat: Math.floor(duration / 16),
      callback: () => {
        elapsed += 16
        const progress = elapsed / duration
        const radius = maxRadius * progress
        const alpha = 1 - progress

        graphics.clear()
        graphics.lineStyle(4, 0xffd700, alpha) // Gold color
        graphics.strokeCircle(playerX, playerY, radius)

        // Inner glow
        graphics.lineStyle(8, 0xffaa00, alpha * 0.5)
        graphics.strokeCircle(playerX, playerY, radius * 0.8)

        if (progress >= 1) {
          graphics.destroy()
          timer.destroy()
        }
      },
    })

    // Add particle burst effect
    if (this.particles) {
      this.particles.emitLevelUp(playerX, playerY)
    }
  }

  /**
   * Push all enemies away from player on respawn
   */
  private pushEnemiesAway(): void {
    const pushForce = 500
    const minDistance = 150 // Minimum distance to push enemies to

    // Push ALL regular enemies away
    this.enemies.getChildren().forEach((child) => {
      const enemy = child as Enemy
      if (!enemy.active) return

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      )

      // Calculate angle from player to enemy
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      )

      // If enemy is too close, teleport them to minimum distance
      if (distance < minDistance) {
        enemy.x = this.player.x + Math.cos(angle) * minDistance
        enemy.y = this.player.y + Math.sin(angle) * minDistance
      }

      // Apply strong outward velocity
      const body = enemy.body as Phaser.Physics.Arcade.Body
      if (body) {
        body.setVelocity(
          Math.cos(angle) * pushForce,
          Math.sin(angle) * pushForce
        )
      }
    })

    // Push boss if present
    const boss = this.getBoss()
    if (boss && boss.active) {
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        boss.x,
        boss.y
      )

      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        boss.x,
        boss.y
      )

      // If boss is too close, teleport them to minimum distance
      if (distance < minDistance) {
        boss.x = this.player.x + Math.cos(angle) * minDistance
        boss.y = this.player.y + Math.sin(angle) * minDistance
      }

      const body = boss.body as Phaser.Physics.Arcade.Body
      if (body) {
        body.setVelocity(
          Math.cos(angle) * pushForce * 0.7,
          Math.sin(angle) * pushForce * 0.7
        )
      }
    }

    // Clear ALL flying bullets (both enemy and bomb projectiles)
    this.enemyBulletPool.getChildren().forEach((child) => {
      const bullet = child as Phaser.Physics.Arcade.Sprite
      if (bullet.active) {
        bullet.setActive(false)
        bullet.setVisible(false)
        const body = bullet.body as Phaser.Physics.Arcade.Body
        if (body) {
          body.stop()
          body.enable = false
        }
      }
    })

    // Also clear bombs if present
    if (this.bombPool) {
      this.bombPool.getChildren().forEach((child) => {
        const bomb = child as Phaser.Physics.Arcade.Sprite
        if (bomb.active) {
          bomb.setActive(false)
          bomb.setVisible(false)
        }
      })
    }
  }

  /**
   * Handle skip run - allows player to end run early and collect rewards
   */
  handleSkipRun(): void {
    if (this.isGameOverState) return

    this.isGameOverState = true
    console.log('Run skipped! Collecting rewards...')

    // End the chapter run (skipped counts as failed/abandoned)
    chapterManager.endRun(true)

    // Stop player movement
    this.player.setVelocity(0, 0)

    // Clean up input system
    const inputSystem = this.getInputSystem()
    if (inputSystem) {
      inputSystem.destroy()
    }

    // Calculate play time
    const playTimeMs = Date.now() - this.runStartTime

    // Brief delay before showing game over screen
    this.scene.time.delayedCall(300, () => {
      // Stop UIScene first
      this.scene.scene.stop('UIScene')

      // Calculate total rooms cleared in endless mode (across all waves)
      const currentRoom = this.getCurrentRoom()
      const totalRooms = this.getTotalRooms()
      const endlessWave = this.getEndlessWave()
      const totalRoomsCleared = this.isEndlessMode
        ? (endlessWave - 1) * totalRooms + currentRoom - 1
        : currentRoom - 1

      // Record daily challenge completion if applicable
      if (this.isDailyChallengeMode) {
        saveManager.recordDailyChallengeCompletion(endlessWave)
      }

      // Launch game over scene with stats (not a victory, but not a death either)
      this.scene.scene.launch('GameOverScene', {
        roomsCleared: totalRoomsCleared,
        enemiesKilled: this.dropManager.getEnemiesKilled(),
        isVictory: false,
        playTimeMs,
        abilitiesGained: this.abilitySystem.getTotalAbilitiesGained(),
        goldEarned: this.dropManager.getGoldEarned(),
        runSeed: this.getRunSeedString(),
        acquiredAbilities: this.getAcquiredAbilitiesArray(),
        heroXPEarned: this.dropManager.getHeroXPEarned(),
        isEndlessMode: this.isEndlessMode,
        endlessWave,
        isDailyChallengeMode: this.isDailyChallengeMode,
        chapterId: chapterManager.getSelectedChapter(),
        difficulty: this.difficultyConfig.label.toLowerCase(),
      })

      // Stop GameScene last - this prevents texture issues when restarting
      this.scene.scene.stop('GameScene')
    })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    // No cleanup needed
  }
}

export default GameModeManager
