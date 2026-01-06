import Phaser from 'phaser'
import type { SpawnManager } from './SpawnManager'
import type GoldPool from '../../systems/GoldPool'
import type HealthPool from '../../systems/HealthPool'
import { audioManager } from '../../systems/AudioManager'
import { saveManager } from '../../systems/SaveManager'
import { chapterManager } from '../../systems/ChapterManager'
import { errorReporting } from '../../systems/ErrorReportingManager'

/**
 * Configuration for RoomManager initialization
 */
export interface RoomManagerConfig {
  scene: Phaser.Scene
  spawnManager: SpawnManager
  enemies: Phaser.Physics.Arcade.Group
  goldPool: GoldPool
  healthPool: HealthPool
  isEndlessMode: boolean
  eventHandlers: RoomManagerEventHandlers
}

/**
 * Event handlers for RoomManager to communicate with GameScene
 */
export interface RoomManagerEventHandlers {
  onRoomCleared: (goldCollected: number, healthCollected: number) => void
  onEndlessWave: () => void
  onVictory: () => void
  onSpawnEnemies: (roomNumber: number) => void
  onPlayerHealed: (amount: number) => void
  onResetPlayerPosition: () => void
}

/**
 * RoomManager - Responsible for room transition logic and state.
 *
 * Key responsibilities:
 * - Track room progression (currentRoom, totalRooms)
 * - Manage door spawning and interaction
 * - Handle room transitions and cleanup
 * - Detect room clear conditions
 * - Manage endless mode wave progression
 */
export class RoomManager {
  private scene: Phaser.Scene
  private spawnManager: SpawnManager
  private enemies: Phaser.Physics.Arcade.Group
  private goldPool: GoldPool
  private healthPool: HealthPool
  private isEndlessMode: boolean
  private eventHandlers: RoomManagerEventHandlers

  // Room state
  private currentRoom: number = 1
  private totalRooms: number = 20
  private isRoomCleared: boolean = false
  private isTransitioning: boolean = false

  // Door state
  private doorSprite: Phaser.GameObjects.Sprite | null = null
  private doorText: Phaser.GameObjects.Text | null = null
  private doorCollider: Phaser.Physics.Arcade.Collider | null = null

  // Endless mode state
  private endlessWave: number = 1
  private endlessDifficultyMultiplier: number = 1.0

  // Door constants
  private readonly DOOR_SPAWN_Y = 70
  private readonly DOOR_SIZE = 60
  private readonly DOOR_HITBOX_RADIUS = 25

  constructor(config: RoomManagerConfig) {
    this.scene = config.scene
    this.spawnManager = config.spawnManager
    this.enemies = config.enemies
    this.goldPool = config.goldPool
    this.healthPool = config.healthPool
    this.isEndlessMode = config.isEndlessMode
    this.eventHandlers = config.eventHandlers

    // Initialize room count based on mode
    if (this.isEndlessMode) {
      this.totalRooms = 10 // Endless mode uses 10 rooms per wave
    } else {
      this.totalRooms = chapterManager.getTotalRooms()
    }
  }

  /**
   * Get current room number
   */
  getCurrentRoom(): number {
    return this.currentRoom
  }

  /**
   * Get total rooms for this run
   */
  getTotalRooms(): number {
    return this.totalRooms
  }

  /**
   * Check if current room is cleared
   */
  isCleared(): boolean {
    return this.isRoomCleared
  }

  /**
   * Check if transitioning between rooms
   */
  isInTransition(): boolean {
    return this.isTransitioning
  }

  /**
   * Get current endless wave number (only relevant in endless mode)
   */
  getEndlessWave(): number {
    return this.endlessWave
  }

  /**
   * Get endless difficulty multiplier
   */
  getEndlessDifficultyMultiplier(): number {
    return this.endlessDifficultyMultiplier
  }

  /**
   * Initialize room state for new run
   */
  initialize(): void {
    this.currentRoom = 1
    this.isRoomCleared = false
    this.isTransitioning = false
    this.doorSprite = null
    this.doorText = null
    this.doorCollider = null
    this.endlessWave = 1
    this.endlessDifficultyMultiplier = 1.0

    // Update error reporting context
    errorReporting.setProgress(chapterManager.getSelectedChapter(), this.currentRoom)
  }

  /**
   * Check if room is cleared and trigger room clear events
   */
  checkRoomCleared(): void {
    if (this.isRoomCleared) return

    const enemyCount = this.enemies.getChildren().filter(e => e.active).length
    const pendingSpawns = this.spawnManager.getPendingSpawnCount()

    if (enemyCount === 0 && pendingSpawns === 0) {
      this.isRoomCleared = true
      audioManager.playRoomClear()
      console.log('Room', this.currentRoom, 'cleared!')

      // Clear enemy bullets immediately when room is cleared
      // This is handled by GameScene's enemyBulletPool

      // Notify chapter manager that room was cleared (only in normal mode)
      if (!this.isEndlessMode) {
        chapterManager.clearRoom()
      }

      // Notify UIScene to fade out HUD for cleaner presentation
      this.scene.scene.get('UIScene').events.emit('roomCleared')

      // Magnetically collect all remaining gold and health pickups
      const player = this.scene.children.getByName('player') as Phaser.GameObjects.Sprite
      const playerX = player?.x ?? this.scene.cameras.main.width / 2
      const playerY = player?.y ?? this.scene.cameras.main.height - 100

      const collectedGold = this.goldPool.collectAll(playerX, playerY)
      const collectedHealth = this.healthPool.collectAll(
        playerX,
        playerY,
        (amount) => this.eventHandlers.onPlayerHealed(amount)
      )

      // Notify GameScene of collected items
      this.eventHandlers.onRoomCleared(collectedGold, collectedHealth)

      // Wait 0.8s before spawning door to let magnetic collection finish
      this.scene.time.delayedCall(800, () => {
        // Only spawn door if game hasn't ended
        if (saveManager.getAutoRoomAdvance()) {
          this.enterDoor()
        } else {
          this.spawnDoor()
        }
      })
    }
  }

  /**
   * Update room UI in UIScene
   */
  updateRoomUI(): void {
    if (this.isEndlessMode) {
      // In endless mode, show wave number instead of room/total
      this.scene.scene.get('UIScene').events.emit('updateRoom', this.currentRoom, this.totalRooms, this.endlessWave)
    } else {
      this.scene.scene.get('UIScene').events.emit('updateRoom', this.currentRoom, this.totalRooms)
    }
  }

  /**
   * Spawn door for player to enter next room
   */
  spawnDoor(): void {
    if (this.doorSprite) return

    const width = this.scene.cameras.main.width

    // Create door at top center of the room
    const doorX = width / 2
    const doorY = this.DOOR_SPAWN_Y

    // Create the door sprite directly (not in a container - containers break physics)
    // Portal image is 1408x768, scale to ~60px wide
    this.doorSprite = this.scene.add.sprite(doorX, doorY, 'portal')
    const targetSize = this.DOOR_SIZE
    const scale = targetSize / this.doorSprite.width
    this.doorSprite.setScale(scale)

    // Add physics body for collision detection
    this.scene.physics.add.existing(this.doorSprite, true) // static body
    const doorBody = this.doorSprite.body as Phaser.Physics.Arcade.StaticBody
    // Set hitbox to match scaled size - offset to center the circle
    const hitboxRadius = this.DOOR_HITBOX_RADIUS
    const offsetX = (this.doorSprite.width * scale) / 2 - hitboxRadius
    const offsetY = (this.doorSprite.height * scale) / 2 - hitboxRadius
    doorBody.setCircle(hitboxRadius, offsetX, offsetY)

    // Set up overlap with player
    const player = this.scene.children.getByName('player') as Phaser.GameObjects.Sprite
    this.doorCollider = this.scene.physics.add.overlap(
      player,
      this.doorSprite,
      this.enterDoor as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Add "ENTER" text below door
    this.doorText = this.scene.add.text(doorX, doorY + 45, 'ENTER', {
      fontSize: '12px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Glow animation - pulse scale and alpha
    this.scene.tweens.add({
      targets: this.doorSprite,
      scale: { from: scale * 0.9, to: scale * 1.1 },
      alpha: { from: 0.8, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Text fade animation
    this.scene.tweens.add({
      targets: this.doorText,
      alpha: { from: 0.7, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    console.log('Door spawned at', doorX, doorY)
  }

  /**
   * Player enters door to transition to next room
   */
  private enterDoor(): void {
    if (this.isTransitioning) return

    // Safety check: door must still exist
    if (!this.doorSprite || !this.doorSprite.active) {
      console.warn('RoomManager: enterDoor called but door is destroyed')
      return
    }

    this.isTransitioning = true
    console.log('Entering door to room', this.currentRoom + 1)

    // Immediately destroy door collider to prevent double-triggers during fade
    if (this.doorCollider) {
      this.doorCollider.destroy()
      this.doorCollider = null
    }

    // Fade out
    this.scene.cameras.main.fadeOut(300, 0, 0, 0)

    this.scene.time.delayedCall(300, () => {
      this.transitionToNextRoom()
    })
  }

  /**
   * Transition to next room
   */
  private transitionToNextRoom(): void {
    this.currentRoom++

    // Check for victory or wave completion
    if (this.currentRoom > this.totalRooms) {
      if (this.isEndlessMode) {
        // Endless mode: Start next wave with increased difficulty
        this.startNextEndlessWave()
        return
      } else {
        this.eventHandlers.onVictory()
        return
      }
    }

    // Notify chapter manager of room advancement (only in normal mode)
    if (!this.isEndlessMode) {
      const advanced = chapterManager.advanceRoom()
      if (!advanced) {
        console.warn('RoomManager: Failed to advance room in chapter manager')
      }
    }

    // Clean up current room
    this.cleanupRoom()

    // Reset player position to bottom center for new room
    this.eventHandlers.onResetPlayerPosition()

    // Spawn new enemies
    this.eventHandlers.onSpawnEnemies(this.currentRoom)

    // Reset room state
    this.isRoomCleared = false
    this.isTransitioning = false

    // Update UI
    this.updateRoomUI()

    // Notify UIScene to fade in HUD when entering new room
    this.scene.scene.get('UIScene').events.emit('roomEntered')

    // Fade back in
    this.scene.cameras.main.fadeIn(300, 0, 0, 0)

    // Update error reporting context for new room
    errorReporting.setProgress(chapterManager.getSelectedChapter(), this.currentRoom)
    errorReporting.addBreadcrumb('game', `Entered room ${this.currentRoom}`)

    console.log('Entered room', this.currentRoom)
  }

  /**
   * Start the next wave in endless mode
   * Increases difficulty and resets room counter
   */
  private startNextEndlessWave(): void {
    this.endlessWave++
    this.currentRoom = 1

    // Exponential scaling: difficulty increases 1.5x each wave
    this.endlessDifficultyMultiplier = Math.pow(1.5, this.endlessWave - 1)

    // Update spawn manager with new difficulty
    this.spawnManager.setEndlessMode(true, this.endlessDifficultyMultiplier)

    // Clean up current room
    this.cleanupRoom()

    // Reset player position to bottom center for new wave
    this.eventHandlers.onResetPlayerPosition()

    // Show wave notification
    this.showEndlessWaveNotification()

    // Spawn new enemies with increased difficulty
    this.eventHandlers.onSpawnEnemies(this.currentRoom)

    // Reset room state
    this.isRoomCleared = false
    this.isTransitioning = false

    // Update UI
    this.updateRoomUI()

    // Notify UIScene to fade in HUD when entering new room
    this.scene.scene.get('UIScene').events.emit('roomEntered')

    // Fade back in
    this.scene.cameras.main.fadeIn(300, 0, 0, 0)

    // Notify GameScene
    this.eventHandlers.onEndlessWave()

    console.log(`Endless Mode: Starting Wave ${this.endlessWave} (difficulty x${this.endlessDifficultyMultiplier.toFixed(2)})`)
  }

  /**
   * Show wave notification in endless mode
   */
  private showEndlessWaveNotification(): void {
    const width = this.scene.cameras.main.width
    const height = this.scene.cameras.main.height

    // Wave text
    const waveText = this.scene.add.text(width / 2, height / 2 - 50, `WAVE ${this.endlessWave}`, {
      fontSize: '48px',
      color: '#ffdd00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    })
    waveText.setOrigin(0.5)
    waveText.setDepth(100)

    // Difficulty text
    const diffText = this.scene.add.text(width / 2, height / 2 + 10, `Difficulty x${this.endlessDifficultyMultiplier.toFixed(1)}`, {
      fontSize: '20px',
      color: '#ff6666',
      stroke: '#000000',
      strokeThickness: 3,
    })
    diffText.setOrigin(0.5)
    diffText.setDepth(100)

    // Fade in
    this.scene.tweens.add({
      targets: [waveText, diffText],
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Power2',
    })

    // Fade out and destroy after 2 seconds
    this.scene.time.delayedCall(2000, () => {
      this.scene.tweens.add({
        targets: [waveText, diffText],
        alpha: 0,
        duration: 500,
        onComplete: () => {
          waveText.destroy()
          diffText.destroy()
        }
      })
    })
  }

  /**
   * Clean up current room (door, enemies, boss state)
   */
  cleanupRoom(): void {
    // Destroy door first
    if (this.doorSprite) {
      this.doorSprite.destroy()
      this.doorSprite = null
    }
    if (this.doorText) {
      this.doorText.destroy()
      this.doorText = null
    }
    if (this.doorCollider) {
      this.doorCollider.destroy()
      this.doorCollider = null
    }

    // Cancel pending spawns BEFORE clearing enemies (prevents mid-spawn crashes)
    this.spawnManager.cancelWaveTimers()
    this.spawnManager.resetPendingSpawns()

    // Clear boss reference BEFORE clearing enemies group (prevents collision crashes)
    const boss = this.spawnManager.getBoss()
    if (boss && boss.active) {
      boss.destroy()
      this.spawnManager.setBoss(null)
    }
    this.scene.scene.get('UIScene').events.emit('hideBossHealth')

    // NOW destroy all enemies (boss already cleared above)
    this.enemies.clear(true, true)

    console.log('Room cleaned up')
  }

  /**
   * Reset room state back to room 1 (for level reset feature)
   */
  resetToRoom1(): void {
    this.currentRoom = 1
    this.isRoomCleared = false
    this.isTransitioning = false

    // Clean up any existing door
    this.cleanupRoom()

    // Update UI
    this.updateRoomUI()

    // Chapter manager doesn't have resetToRoom1 - just update current room context
    errorReporting.setProgress(chapterManager.getSelectedChapter(), this.currentRoom)

    console.log('Room state reset to room 1')
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.cleanupRoom()
  }
}

export default RoomManager
