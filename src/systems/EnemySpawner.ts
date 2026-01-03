import Phaser from 'phaser'
import Enemy, { EnemyOptions } from '../entities/Enemy'
import RangedShooterEnemy from '../entities/RangedShooterEnemy'
import SpreaderEnemy from '../entities/SpreaderEnemy'
import BomberEnemy from '../entities/BomberEnemy'
import TankEnemy from '../entities/TankEnemy'
import ChargerEnemy from '../entities/ChargerEnemy'
import HealerEnemy from '../entities/HealerEnemy'
import SpawnerEnemy from '../entities/SpawnerEnemy'
import Boss from '../entities/Boss'
import type EnemyBulletPool from './EnemyBulletPool'
import type BombPool from './BombPool'
import { chapterManager } from './ChapterManager'
import { getChapterDefinition, getRandomBossForChapter, getEnemyModifiers, type BossType, type ChapterId, type EnemyType as ChapterEnemyType } from '../config/chapterData'
import type { DifficultyConfig } from '../config/difficulty'
import { createBoss, getBossDisplaySize, getBossHitboxRadius } from '../entities/bosses/BossFactory'
import type { RoomGenerator, GeneratedRoom, SpawnPosition } from './RoomGenerator'
import type { SeededRandom } from './SeededRandom'

export interface EnemySpawnerCallbacks {
  handleBombExplosion: (x: number, y: number, radius: number, damage: number) => void
}

/**
 * EnemySpawner handles all enemy and boss creation.
 * Extracted from GameScene to centralize spawning logic.
 */
export class EnemySpawner {
  private scene: Phaser.Scene
  private enemies: Phaser.Physics.Arcade.Group
  private enemyBulletPool: EnemyBulletPool
  private bombPool: BombPool
  private difficultyConfig: DifficultyConfig
  private roomGenerator: RoomGenerator
  private runRng: SeededRandom
  private callbacks!: EnemySpawnerCallbacks

  private activeWaveTimers: Phaser.Time.TimerEvent[] = []
  private pendingEnemySpawns: number = 0

  constructor(
    scene: Phaser.Scene,
    enemies: Phaser.Physics.Arcade.Group,
    enemyBulletPool: EnemyBulletPool,
    bombPool: BombPool,
    difficultyConfig: DifficultyConfig,
    roomGenerator: RoomGenerator,
    runRng: SeededRandom
  ) {
    this.scene = scene
    this.enemies = enemies
    this.enemyBulletPool = enemyBulletPool
    this.bombPool = bombPool
    this.difficultyConfig = difficultyConfig
    this.roomGenerator = roomGenerator
    this.runRng = runRng
  }

  /**
   * Set callbacks for enemy spawner events
   */
  setCallbacks(callbacks: EnemySpawnerCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Get the number of pending enemy spawns
   */
  getPendingSpawns(): number {
    return this.pendingEnemySpawns
  }

  /**
   * Cancel all wave timers
   */
  cancelWaveTimers(): void {
    this.activeWaveTimers.forEach((timer) => timer.remove(false))
    this.activeWaveTimers = []
    this.pendingEnemySpawns = 0
  }

  /**
   * Spawn a single enemy from a spawn position
   */
  spawnEnemyFromPosition(spawn: SpawnPosition, enemyOptions: EnemyOptions): void {
    const { x, y, enemyType } = spawn
    let enemy: Enemy

    switch (enemyType) {
      case 'ranged':
        enemy = new RangedShooterEnemy(this.scene, x, y, this.enemyBulletPool, enemyOptions)
        break
      case 'spreader':
        enemy = new SpreaderEnemy(this.scene, x, y, this.enemyBulletPool, enemyOptions)
        break
      case 'bomber':
        enemy = new BomberEnemy(
          this.scene, x, y, this.bombPool, enemyOptions,
          (bx, by, radius, damage) => this.callbacks.handleBombExplosion(bx, by, radius, damage)
        )
        break
      case 'tank':
        enemy = new TankEnemy(this.scene, x, y, this.enemyBulletPool, enemyOptions)
        break
      case 'charger':
        enemy = new ChargerEnemy(this.scene, x, y, enemyOptions)
        break
      case 'healer':
        enemy = new HealerEnemy(this.scene, x, y, enemyOptions)
        break
      case 'spawner':
        enemy = new SpawnerEnemy(this.scene, x, y, enemyOptions)
        break
      default:
        enemy = new Enemy(this.scene, x, y, enemyOptions)
    }

    this.scene.add.existing(enemy)
    this.scene.physics.add.existing(enemy)

    // Set enemy group reference for healer and spawner enemies
    if (enemy instanceof HealerEnemy) {
      enemy.setEnemyGroup(this.enemies)
    }
    if (enemy instanceof SpawnerEnemy) {
      enemy.setEnemyGroup(this.enemies)
    }

    // Set up physics body with centered circular hitbox
    const body = enemy.body as Phaser.Physics.Arcade.Body
    if (body) {
      const displaySize = enemy.displayWidth
      const radius = Math.floor(displaySize * 0.4)
      const offset = (displaySize - radius * 2) / 2
      body.setSize(displaySize, displaySize)
      body.setCircle(radius, offset, offset)
      body.setCollideWorldBounds(true)
    }

    this.enemies.add(enemy)
  }

  /**
   * Spawn enemies from a generated room
   */
  spawnFromGeneration(generatedRoom: GeneratedRoom, checkRoomCleared: () => void): void {
    // Create enemy textures first (if needed)
    if (!this.scene.textures.exists('enemy')) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(0xff4444, 1)
      graphics.fillCircle(0, 0, 15)
      graphics.generateTexture('enemy', 30, 30)
      graphics.destroy()
    }

    // Get chapter for enemy modifiers
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId
    const chapterDef = getChapterDefinition(selectedChapter)

    this.pendingEnemySpawns = generatedRoom.enemySpawns.length
    if (this.pendingEnemySpawns === 0) {
      console.log(`Room: No enemies to spawn`)
      return
    }

    const totalSpawns = generatedRoom.enemySpawns.length
    const waveCount = totalSpawns <= 6 ? 2 : 3
    const chunkSize = Math.ceil(totalSpawns / waveCount)
    const waveDelay = 1500 // ms between waves

    for (let i = 0; i < waveCount; i++) {
      const waveSpawns = generatedRoom.enemySpawns.slice(i * chunkSize, (i + 1) * chunkSize)
      if (waveSpawns.length === 0) continue

      const delay = i === 0 ? 0 : waveDelay * i
      const timer = this.scene.time.delayedCall(delay, () => {
        waveSpawns.forEach((spawn) => {
          // Get chapter-specific modifiers for this enemy type
          const chapterModifiers = getEnemyModifiers(selectedChapter, spawn.enemyType as ChapterEnemyType)

          // Combine difficulty config with chapter modifiers and chapter scaling
          const enemyOptions = {
            healthMultiplier: this.difficultyConfig.enemyHealthMultiplier * chapterDef.scaling.enemyHpMultiplier,
            damageMultiplier: this.difficultyConfig.enemyDamageMultiplier * chapterDef.scaling.enemyDamageMultiplier,
            speedMultiplier: chapterModifiers.speedMultiplier,
            attackCooldownMultiplier: chapterModifiers.attackCooldownMultiplier,
            projectileSpeedMultiplier: chapterModifiers.projectileSpeedMultiplier,
            abilityIntensityMultiplier: chapterModifiers.abilityIntensityMultiplier,
          }

          this.spawnEnemyFromPosition(spawn, enemyOptions)
          this.pendingEnemySpawns = Math.max(0, this.pendingEnemySpawns - 1)
        })
        checkRoomCleared()
      })

      this.activeWaveTimers.push(timer)
    }

    console.log(`Scheduled ${totalSpawns} enemies across ${waveCount} waves`)
  }

  /**
   * Generate and spawn enemies for a room
   */
  spawnForRoom(
    currentRoom: number,
    playerX: number,
    playerY: number,
    checkRoomCleared: () => void
  ): GeneratedRoom {
    this.cancelWaveTimers()

    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId
    const chapterDef = getChapterDefinition(selectedChapter)

    // Calculate base enemy count
    const baseEnemies = 4
    const scaledBase = Math.round(baseEnemies * this.difficultyConfig.enemySpawnMultiplier) + this.difficultyConfig.extraEnemyCount

    // Generate the room
    const generatedRoom = this.roomGenerator.generateRoom(
      selectedChapter,
      currentRoom,
      playerX,
      playerY,
      scaledBase,
      chapterDef.scaling.extraEnemiesPerRoom
    )

    // Log room generation details
    const layoutName = generatedRoom.layout.name
    const comboName = generatedRoom.combination?.name || 'Random Mix'
    console.log(`Room ${currentRoom}: Layout "${layoutName}", Combo "${comboName}", Enemies: ${generatedRoom.enemySpawns.length}`)

    // Spawn enemies
    this.spawnFromGeneration(generatedRoom, checkRoomCleared)

    return generatedRoom
  }

  /**
   * Spawn a boss for the current chapter
   */
  spawnBoss(): Boss {
    const width = this.scene.cameras.main.width
    const height = this.scene.cameras.main.height

    // Spawn boss at center-top of screen
    const bossX = width / 2
    const bossY = height / 3

    // Get current chapter and select a boss from its pool
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId
    const bossType: BossType = getRandomBossForChapter(selectedChapter, this.runRng)

    // Difficulty modifiers for boss
    const chapterDef = getChapterDefinition(selectedChapter)
    const bossOptions = {
      healthMultiplier: this.difficultyConfig.bossHealthMultiplier * chapterDef.scaling.bossHpMultiplier,
      damageMultiplier: this.difficultyConfig.bossDamageMultiplier * chapterDef.scaling.bossDamageMultiplier,
    }

    // Create the boss using the factory
    const newBoss = createBoss(this.scene, bossX, bossY, bossType, this.enemyBulletPool, bossOptions)
    const boss = newBoss as Boss
    this.scene.add.existing(boss)
    this.scene.physics.add.existing(boss)

    // Set up physics body with centered circular hitbox
    const body = boss.body as Phaser.Physics.Arcade.Body
    if (body) {
      const displaySize = getBossDisplaySize(bossType)
      const radius = getBossHitboxRadius(bossType)
      const offset = (displaySize - radius * 2) / 2
      body.setSize(displaySize, displaySize)
      body.setCircle(radius, offset, offset)
      body.setCollideWorldBounds(true)
    }

    this.enemies.add(boss)

    console.log(`Boss spawned: ${bossType} for chapter ${selectedChapter} at ${bossX}, ${bossY}`)

    return boss
  }
}
