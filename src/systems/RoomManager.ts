import Phaser from 'phaser'
import type Player from '../entities/Player'
import type Boss from '../entities/Boss'
import { audioManager } from './AudioManager'
import { chapterManager } from './ChapterManager'
import { errorReporting } from './ErrorReportingManager'
import type { EnemySpawner } from './EnemySpawner'
import type { PickupManager } from './PickupManager'
import type BulletPool from './BulletPool'
import type EnemyBulletPool from './EnemyBulletPool'
import type { SpiritCatSystem } from './SpiritCatSystem'

export interface RoomManagerCallbacks {
  onRoomCleared: () => void
  onVictory: (completionResult: unknown) => void
  onRoomTransition: (newRoom: number) => void
  updateRoomUI: () => void
  getPlayer: () => Player
  getEnemies: () => Phaser.Physics.Arcade.Group
  getBoss: () => Boss | null
  setBoss: (boss: Boss | null) => void
  hideBossHealth: () => void
  showBossHealth: (current: number, max: number) => void
  collectPickups: () => number
  healPlayer: (amount: number) => void
}

/**
 * RoomManager handles room state, transitions, and door spawning.
 * Extracted from GameScene to centralize room logic.
 */
export class RoomManager {
  private scene: Phaser.Scene
  private enemySpawner: EnemySpawner
  private pickupManager: PickupManager
  private bulletPool: BulletPool
  private enemyBulletPool: EnemyBulletPool
  private spiritCatSystem: SpiritCatSystem | null
  private callbacks!: RoomManagerCallbacks

  private currentRoom: number = 1
  private totalRooms: number = 20
  private isRoomCleared: boolean = false
  private isTransitioning: boolean = false
  private doorSprite: Phaser.GameObjects.Sprite | null = null
  private doorText: Phaser.GameObjects.Text | null = null

  constructor(
    scene: Phaser.Scene,
    enemySpawner: EnemySpawner,
    pickupManager: PickupManager,
    bulletPool: BulletPool,
    enemyBulletPool: EnemyBulletPool,
    spiritCatSystem: SpiritCatSystem | null
  ) {
    this.scene = scene
    this.enemySpawner = enemySpawner
    this.pickupManager = pickupManager
    this.bulletPool = bulletPool
    this.enemyBulletPool = enemyBulletPool
    this.spiritCatSystem = spiritCatSystem
    this.totalRooms = chapterManager.getTotalRooms()
  }

  /**
   * Set callbacks for room manager events
   */
  setCallbacks(callbacks: RoomManagerCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Get current room number
   */
  getCurrentRoom(): number {
    return this.currentRoom
  }

  /**
   * Get total rooms
   */
  getTotalRooms(): number {
    return this.totalRooms
  }

  /**
   * Check if room is cleared
   */
  getIsRoomCleared(): boolean {
    return this.isRoomCleared
  }

  /**
   * Check if transitioning between rooms
   */
  getIsTransitioning(): boolean {
    return this.isTransitioning
  }

  /**
   * Set transitioning state
   */
  setIsTransitioning(value: boolean): void {
    this.isTransitioning = value
  }

  /**
   * Reset room state for a new run
   */
  reset(): void {
    this.currentRoom = 1
    this.isRoomCleared = false
    this.isTransitioning = false
  }

  /**
   * Spawn the door after room is cleared
   */
  spawnDoor(): void {
    if (this.doorSprite) return

    const width = this.scene.cameras.main.width
    const doorX = width / 2
    const doorY = 70

    // Create the door sprite
    this.doorSprite = this.scene.add.sprite(doorX, doorY, 'portal')
    const targetSize = 60
    const scale = targetSize / this.doorSprite.width
    this.doorSprite.setScale(scale)

    // Add physics body for collision detection
    this.scene.physics.add.existing(this.doorSprite, true)
    const doorBody = this.doorSprite.body as Phaser.Physics.Arcade.StaticBody
    const hitboxRadius = 25
    const offsetX = (this.doorSprite.width * scale) / 2 - hitboxRadius
    const offsetY = (this.doorSprite.height * scale) / 2 - hitboxRadius
    doorBody.setCircle(hitboxRadius, offsetX, offsetY)

    // Add overlap with player
    const player = this.callbacks.getPlayer()
    this.scene.physics.add.overlap(
      player,
      this.doorSprite,
      () => this.enterDoor(),
      undefined,
      this
    )

    // Add "ENTER" text below door
    this.doorText = this.scene.add.text(doorX, doorY + 45, 'ENTER', {
      fontSize: '12px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Glow animation
    this.scene.tweens.add({
      targets: this.doorSprite,
      scale: { from: scale * 0.9, to: scale * 1.1 },
      alpha: { from: 0.8, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Text pulse animation
    this.scene.tweens.add({
      targets: this.doorText,
      alpha: { from: 0.6, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    })

    console.log('Door spawned at', doorX, doorY)
  }

  /**
   * Enter the door to transition to next room
   */
  private enterDoor(): void {
    if (this.isTransitioning) return

    this.isTransitioning = true
    console.log('Entering door to room', this.currentRoom + 1)

    // Fade out
    this.scene.cameras.main.fadeOut(300, 0, 0, 0)

    this.scene.time.delayedCall(300, () => {
      this.transitionToNextRoom()
    })
  }

  /**
   * Transition to the next room
   */
  private transitionToNextRoom(): void {
    this.currentRoom++

    // Check for victory
    if (this.currentRoom > this.totalRooms) {
      this.triggerVictory()
      return
    }

    // Notify chapter manager of room advancement
    const advanced = chapterManager.advanceRoom()
    if (!advanced) {
      console.warn('RoomManager: Failed to advance room in chapter manager')
    }

    // Clean up current room
    this.cleanupRoom()

    // Spawn new enemies
    this.spawnEnemiesForRoom()

    // Reset room state
    this.isRoomCleared = false
    this.isTransitioning = false

    // Update UI
    this.callbacks.updateRoomUI()
    this.callbacks.onRoomTransition(this.currentRoom)

    // Fade back in
    this.scene.cameras.main.fadeIn(300, 0, 0, 0)

    // Update error reporting context
    errorReporting.setProgress(chapterManager.getSelectedChapter(), this.currentRoom)
    errorReporting.addBreadcrumb('game', `Entered room ${this.currentRoom}`)

    console.log('Entered room', this.currentRoom)
  }

  /**
   * Clean up the current room
   */
  cleanupRoom(): void {
    // Destroy door
    if (this.doorSprite) {
      this.doorSprite.destroy()
      this.doorSprite = null
    }
    if (this.doorText) {
      this.doorText.destroy()
      this.doorText = null
    }

    this.enemySpawner.cancelWaveTimers()

    // Reset boss state
    this.callbacks.setBoss(null)
    this.callbacks.hideBossHealth()

    // Destroy all enemies
    const enemies = this.callbacks.getEnemies()
    enemies.clear(true, true)

    // Clear all bullets
    this.bulletPool.clear(true, true)
    this.enemyBulletPool.clear(true, true)

    // Clear spirit cats
    if (this.spiritCatSystem) {
      this.spiritCatSystem.cleanup()
    }

    // Clean up pickups
    this.pickupManager.cleanup()

    // Reset player position
    const width = this.scene.cameras.main.width
    const height = this.scene.cameras.main.height
    const player = this.callbacks.getPlayer()
    player.setPosition(width / 2, height - 100)
    player.setVelocity(0, 0)
  }

  /**
   * Spawn enemies for the current room
   */
  spawnEnemiesForRoom(): void {
    // Boss room
    if (this.currentRoom === this.totalRooms) {
      const boss = this.enemySpawner.spawnBoss()
      this.callbacks.setBoss(boss)
      this.callbacks.showBossHealth(boss.getHealth(), boss.getMaxHealth())
      return
    }

    const player = this.callbacks.getPlayer()
    this.enemySpawner.spawnForRoom(
      this.currentRoom,
      player.x,
      player.y,
      () => this.checkRoomCleared()
    )
  }

  /**
   * Check if the room is cleared
   */
  checkRoomCleared(): void {
    if (this.isRoomCleared) return

    const enemies = this.callbacks.getEnemies()
    const enemyCount = enemies.getChildren().filter(e => e.active).length
    const pendingSpawns = this.enemySpawner.getPendingSpawns()

    if (enemyCount === 0 && pendingSpawns === 0) {
      this.isRoomCleared = true
      audioManager.playRoomClear()
      console.log('Room', this.currentRoom, 'cleared!')

      // Notify chapter manager
      chapterManager.clearRoom()

      // Notify callback
      this.callbacks.onRoomCleared()

      // Collect all remaining pickups
      const player = this.callbacks.getPlayer()
      const collectedGold = this.pickupManager.collectAll(
        player.x,
        player.y,
        (healAmount) => this.callbacks.healPlayer(healAmount)
      )
      if (collectedGold > 0) {
        this.callbacks.collectPickups()
      }

      // Show door after brief delay
      this.scene.time.delayedCall(500, () => {
        if (!this.isTransitioning) {
          this.spawnDoor()
        }
      })
    }
  }

  /**
   * Trigger victory
   */
  private triggerVictory(): void {
    // Complete chapter
    const player = this.callbacks.getPlayer()
    const completionResult = chapterManager.completeChapter(
      player.getHealth(),
      player.getMaxHealth()
    )

    this.callbacks.onVictory(completionResult)
  }

  /**
   * Debug: Skip to next level
   */
  debugSkipLevel(): void {
    if (this.isTransitioning) return

    console.log('Debug: Skipping level', this.currentRoom)

    // Collect pickups before skipping
    const player = this.callbacks.getPlayer()
    this.pickupManager.collectAll(
      player.x,
      player.y,
      (healAmount) => this.callbacks.healPlayer(healAmount)
    )

    this.transitionToNextRoom()
  }

  /**
   * Reset level back to room 1 (keeping upgrades)
   */
  resetLevel(runRng: { reset: () => void }): void {
    if (this.isTransitioning) return

    console.log('Resetting level - keeping all upgrades!')

    this.isTransitioning = true

    // Collect pickups before reset
    const player = this.callbacks.getPlayer()
    this.pickupManager.collectAll(
      player.x,
      player.y,
      (healAmount) => this.callbacks.healPlayer(healAmount)
    )

    // Fade out
    this.scene.cameras.main.fadeOut(300, 0, 0, 0)

    this.scene.time.delayedCall(300, () => {
      // Restart chapter run
      const selectedChapter = chapterManager.getSelectedChapter()
      chapterManager.startChapter(selectedChapter)

      // Reset to room 1
      this.currentRoom = 1

      // Reset RNG
      runRng.reset()

      // Clean up room
      this.cleanupRoom()

      // Reset player position and heal
      const width = this.scene.cameras.main.width
      const height = this.scene.cameras.main.height
      player.setPosition(width / 2, height - 100)
      player.setVelocity(0, 0)
      player.heal(player.getMaxHealth())

      // Spawn enemies for room 1
      this.spawnEnemiesForRoom()

      // Reset room state
      this.isRoomCleared = false
      this.isTransitioning = false

      // Update UI
      this.callbacks.updateRoomUI()

      // Fade back in
      this.scene.cameras.main.fadeIn(300, 0, 0, 0)

      console.log('Level reset complete! Starting room 1')
    })
  }
}
