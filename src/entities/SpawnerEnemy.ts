import Phaser from 'phaser'
import Enemy, { EnemyOptions } from './Enemy'

/**
 * Small minion enemy spawned by SpawnerEnemy
 * Weak, fast melee enemy that rushes the player
 */
export class MinionEnemy extends Enemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: EnemyOptions
  ) {
    // Minions have very low health (30% of normal) and low damage (50%)
    const minionOptions: EnemyOptions = {
      ...options,
      healthMultiplier: (options?.healthMultiplier ?? 1.0) * 0.3,
      damageMultiplier: (options?.damageMultiplier ?? 1.0) * 0.5,
    }
    super(scene, x, y, minionOptions)

    // Use minion texture or fallback to melee enemy
    if (scene.textures.exists('enemyMinion')) {
      this.setTexture('enemyMinion')
    }
    this.setDisplaySize(20, 20) // Very small

    // Slightly transparent to show they're weak
    this.setAlpha(0.85)
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update fire DOT from parent class
    const diedFromFire = super.update(time, _delta, playerX, playerY)
    if (diedFromFire) {
      return true
    }

    // Validate player position before calculating angle
    if (!isFinite(playerX) || !isFinite(playerY)) {
      return false
    }

    // Simple AI: rush toward player faster than normal enemies
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    const speed = 100 // Faster than normal melee (80)

    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)

    // Ensure minion stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 10
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    // Ensure minion position stays valid
    if (!isFinite(this.x) || !isFinite(this.y)) {
      console.warn('MinionEnemy: Position became invalid, resetting to center')
      const worldBounds = this.scene.physics.world.bounds
      this.x = worldBounds.centerX
      this.y = worldBounds.centerY
    }

    return false
  }
}

/**
 * SpawnerEnemy - Stationary enemy that periodically spawns minions
 * High health but doesn't move or directly attack
 */
export default class SpawnerEnemy extends Enemy {
  private lastSpawnTime: number = 0
  private spawnInterval: number = 4000 // Base spawn every 4 seconds
  private maxMinions: number = 3 // Base max minions alive at once
  private spawnedMinions: MinionEnemy[] = []

  // Visual effects
  private spawnAura: Phaser.GameObjects.Graphics | null = null
  private spawnParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private isSpawning: boolean = false

  // Reference to enemy group for adding spawned minions
  private enemyGroup: Phaser.Physics.Arcade.Group | null = null

  // Options to pass to spawned minions
  private spawnOptions: EnemyOptions

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: EnemyOptions
  ) {
    // Spawners have high health (150% of normal)
    const spawnerOptions: EnemyOptions = {
      ...options,
      healthMultiplier: (options?.healthMultiplier ?? 1.0) * 1.5,
    }
    super(scene, x, y, spawnerOptions)

    this.spawnOptions = options ?? {}

    // Apply chapter-specific modifiers
    this.spawnInterval = 4000 * (options?.attackCooldownMultiplier ?? 1.0)
    // Ability intensity increases max minions (rounded up)
    const intensityMultiplier = options?.abilityIntensityMultiplier ?? 1.0
    this.maxMinions = Math.max(3, Math.ceil(3 * intensityMultiplier))

    // Use texture (will be set externally or fallback to generated)
    if (scene.textures.exists('enemySpawner')) {
      this.setTexture('enemySpawner')
    }
    this.setDisplaySize(40, 40) // Larger than normal enemies

    // Create spawn aura visual
    this.createSpawnAura()

    // Create spawn particles
    this.createSpawnParticles()

    console.log('SpawnerEnemy created at', x, y)
  }

  /**
   * Set the enemy group for adding spawned minions
   */
  setEnemyGroup(group: Phaser.Physics.Arcade.Group): void {
    this.enemyGroup = group
  }

  private createSpawnAura(): void {
    this.spawnAura = this.scene.add.graphics()
    this.spawnAura.setDepth(0)
    this.updateSpawnAura()
  }

  private createSpawnParticles(): void {
    // Create spawn particle texture if it doesn't exist
    if (!this.scene.textures.exists('spawnParticle')) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(0x9944ff, 1) // Purple spawn color
      graphics.fillCircle(4, 4, 4)
      graphics.generateTexture('spawnParticle', 8, 8)
      graphics.destroy()
    }

    this.spawnParticles = this.scene.add.particles(0, 0, 'spawnParticle', {
      lifespan: 600,
      speed: { min: 30, max: 80 },
      scale: { start: 1, end: 0 },
      alpha: { start: 0.9, end: 0 },
      angle: { min: 0, max: 360 },
      emitting: false,
    })
    this.spawnParticles.setDepth(5)
  }

  private updateSpawnAura(): void {
    if (!this.spawnAura) return

    this.spawnAura.clear()

    // Draw spawn indicator
    const radius = 25

    if (this.isSpawning) {
      // Pulsing purple aura when spawning
      this.spawnAura.lineStyle(3, 0x9944ff, 0.8)
      this.spawnAura.strokeCircle(this.x, this.y, radius)

      // Inner glow
      this.spawnAura.fillStyle(0x9944ff, 0.3)
      this.spawnAura.fillCircle(this.x, this.y, radius * 0.8)
    } else {
      // Subtle indicator when not spawning
      this.spawnAura.lineStyle(2, 0x9944ff, 0.3)
      this.spawnAura.strokeCircle(this.x, this.y, radius)
    }

    // Show minion count indicator
    const aliveMinions = this.getAliveMinionsCount()
    for (let i = 0; i < this.maxMinions; i++) {
      const indicatorAngle = (Math.PI * 2 * i) / this.maxMinions - Math.PI / 2
      const indicatorX = this.x + Math.cos(indicatorAngle) * 35
      const indicatorY = this.y + Math.sin(indicatorAngle) * 35

      if (i < aliveMinions) {
        this.spawnAura.fillStyle(0x9944ff, 0.8)
      } else {
        this.spawnAura.fillStyle(0x444444, 0.4)
      }
      this.spawnAura.fillCircle(indicatorX, indicatorY, 4)
    }
  }

  private getAliveMinionsCount(): number {
    // Clean up dead minions from our tracking array
    this.spawnedMinions = this.spawnedMinions.filter(minion => minion.active)
    return this.spawnedMinions.length
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update fire DOT from parent class
    const diedFromFire = super.update(time, _delta, playerX, playerY)
    if (diedFromFire) {
      // When spawner dies, all its minions die too
      this.destroyAllMinions()
      return true
    }

    // Spawner is stationary
    this.setVelocity(0, 0)

    // Check if we can spawn
    const aliveMinions = this.getAliveMinionsCount()

    if (aliveMinions < this.maxMinions && time - this.lastSpawnTime > this.spawnInterval) {
      this.spawnMinion(playerX, playerY)
      this.lastSpawnTime = time
    }

    // Update spawn aura position
    this.updateSpawnAura()

    // Fade spawning indicator
    if (this.isSpawning && time - this.lastSpawnTime > 500) {
      this.isSpawning = false
      this.updateSpawnAura()
    }

    // Ensure enemy stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 20
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return false
  }

  private spawnMinion(_playerX: number, _playerY: number): void {
    if (!this.enemyGroup) {
      console.warn('SpawnerEnemy: No enemy group set, cannot spawn minions')
      return
    }

    // Spawn at random position around the spawner
    const spawnAngle = Math.random() * Math.PI * 2
    const spawnDistance = 30 + Math.random() * 20
    const spawnX = this.x + Math.cos(spawnAngle) * spawnDistance
    const spawnY = this.y + Math.sin(spawnAngle) * spawnDistance

    // Create minion
    const minion = new MinionEnemy(this.scene, spawnX, spawnY, this.spawnOptions)
    this.scene.add.existing(minion)
    this.scene.physics.add.existing(minion)

    // Set up physics body with centered circular hitbox
    const body = minion.body as Phaser.Physics.Arcade.Body
    if (body) {
      const displaySize = minion.displayWidth
      const radius = Math.floor(displaySize * 0.4)
      const offset = (displaySize - radius * 2) / 2
      body.setSize(displaySize, displaySize)
      body.setCircle(radius, offset, offset)
      body.setCollideWorldBounds(true)
    }

    // Add to enemy group
    this.enemyGroup.add(minion)

    // Track this minion
    this.spawnedMinions.push(minion)

    // Visual feedback
    this.isSpawning = true
    this.updateSpawnAura()

    // Spawn particles
    if (this.spawnParticles) {
      this.spawnParticles.setPosition(spawnX, spawnY)
      this.spawnParticles.explode(10)
    }

    // Visual pulse on spawner
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })

    console.log(`SpawnerEnemy spawned minion at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)}). Active minions: ${this.spawnedMinions.length}`)
  }

  private destroyAllMinions(): void {
    this.spawnedMinions.forEach(minion => {
      if (minion.active) {
        minion.destroy()
      }
    })
    this.spawnedMinions = []
  }

  destroy(fromScene?: boolean): void {
    // Destroy all minions when spawner dies
    this.destroyAllMinions()

    if (this.spawnAura) {
      this.spawnAura.destroy()
      this.spawnAura = null
    }
    if (this.spawnParticles) {
      this.spawnParticles.destroy()
      this.spawnParticles = null
    }
    super.destroy(fromScene)
  }
}
