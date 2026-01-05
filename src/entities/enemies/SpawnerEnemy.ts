import Phaser from 'phaser'
import Enemy, { EnemyOptions, EnemyUpdateResult } from '../Enemy'
import { getEnemySpriteKey } from '../../config/themeData'
import { themeManager } from '../../systems/ThemeManager'

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

    // Use themed minion sprite
    const spriteKey = getEnemySpriteKey('minion', themeManager.getAssets())
    if (scene.textures.exists(spriteKey)) {
      this.setTexture(spriteKey)
    }
    this.setDisplaySize(20, 20) // Very small

    // Slightly transparent to show they're weak
    this.setAlpha(0.85)
  }

  update(time: number, _delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    if (!this.active || !this.body) {
      return { died: false, dotDamage: 0 }
    }

    // Update fire DOT from parent class
    const effectResult = super.update(time, _delta, playerX, playerY)
    if (effectResult.died) {
      return effectResult
    }

    // Validate player position before calculating angle
    if (!isFinite(playerX) || !isFinite(playerY)) {
      return effectResult
    }

    // Rush toward player faster than normal enemies, with wall avoidance
    const speed = 100 // Faster than normal melee (80)

    if (this.wallGroup) {
      const movement = this.calculateMovementWithWallAvoidance(playerX, playerY, speed, time)
      this.setVelocity(movement.vx, movement.vy)
    } else {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    }

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

    return effectResult
  }
}

/**
 * SpawnerEnemy - Slow-moving enemy that periodically spawns minions
 * High health, moves cautiously to stay away from player
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

  // Movement behavior - slow, cautious retreat from player
  private readonly preferredDistance: number = 180 // Try to stay this far from player
  private readonly retreatSpeed: number = 35 // Slow movement speed
  private readonly approachSpeed: number = 20 // Even slower approach if too far

  // Minion spawn configuration - spawn from top of screen and walk in
  private readonly MINION_SPAWN_Y = -30 // Above screen edge so they walk in

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

    // Use themed spawner sprite
    const spriteKey = getEnemySpriteKey('spawner', themeManager.getAssets())
    if (scene.textures.exists(spriteKey)) {
      this.setTexture(spriteKey)
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

  update(time: number, _delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    if (!this.active || !this.body) {
      return { died: false, dotDamage: 0 }
    }

    // Update fire DOT from parent class
    const effectResult = super.update(time, _delta, playerX, playerY)
    if (effectResult.died) {
      // When spawner dies, all its minions die too
      this.destroyAllMinions()
      return effectResult
    }

    // Slow, cautious movement - try to maintain distance from player
    this.updateMovement(time, playerX, playerY)

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

    return effectResult
  }

  /**
   * Handle slow, cautious movement behavior
   */
  private updateMovement(time: number, playerX: number, playerY: number): void {
    const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)

    if (distanceToPlayer < this.preferredDistance - 30) {
      // Too close to player - retreat slowly using bounds-aware flee
      const fleeAngle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y)
      const fleeVelocity = this.calculateBoundsAwareFleeVelocity(fleeAngle, this.retreatSpeed)

      // Use wall avoidance if available and not blocked by bounds
      if (this.wallGroup && (fleeVelocity.vx !== 0 || fleeVelocity.vy !== 0)) {
        // Calculate a target point in the flee direction
        const retreatTargetX = this.x + fleeVelocity.vx * 2
        const retreatTargetY = this.y + fleeVelocity.vy * 2
        const movement = this.calculateMovementWithWallAvoidance(
          retreatTargetX,
          retreatTargetY,
          this.retreatSpeed,
          time
        )
        this.setVelocity(movement.vx, movement.vy)
      } else {
        this.setVelocity(fleeVelocity.vx, fleeVelocity.vy)
      }
    } else if (distanceToPlayer > this.preferredDistance + 80) {
      // Too far from player - slowly approach to stay in the fight
      if (this.wallGroup) {
        const movement = this.calculateMovementWithWallAvoidance(
          playerX,
          playerY,
          this.approachSpeed,
          time
        )
        this.setVelocity(movement.vx, movement.vy)
      } else {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        this.setVelocity(
          Math.cos(angle) * this.approachSpeed,
          Math.sin(angle) * this.approachSpeed
        )
      }
    } else {
      // At comfortable distance - slow wobble/drift
      const wobbleAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY) + Math.PI / 2
      const wobble = Math.sin(time * 0.001) * 15
      this.setVelocity(
        Math.cos(wobbleAngle) * wobble,
        Math.sin(wobbleAngle) * wobble
      )
    }
  }

  private spawnMinion(_playerX: number, _playerY: number): void {
    if (!this.enemyGroup) {
      console.warn('SpawnerEnemy: No enemy group set, cannot spawn minions')
      return
    }

    // Always spawn minions from top of screen - they walk in naturally
    const width = this.scene.cameras.main.width
    const margin = 50
    const spawnX = margin + Math.random() * (width - margin * 2)
    const spawnY = this.MINION_SPAWN_Y

    // Create minion
    const minion = new MinionEnemy(this.scene, spawnX, spawnY, this.spawnOptions)
    this.scene.add.existing(minion)
    this.scene.physics.add.existing(minion)

    // Ensure minion is properly activated for lightning chain targeting
    minion.setActive(true)
    minion.setVisible(true)

    // Set wall group for pathfinding (inherited from spawner)
    if (this.wallGroup) {
      minion.setWallGroup(this.wallGroup)
    }

    // Set up physics body with centered circular hitbox
    const body = minion.body as Phaser.Physics.Arcade.Body
    if (body) {
      const displaySize = minion.displayWidth
      const radius = Math.floor(displaySize * 0.4)
      const offset = (displaySize - radius * 2) / 2
      body.setSize(displaySize, displaySize)
      body.setCircle(radius, offset, offset)
      // Don't collide with world bounds initially - let them walk in from top
      body.setCollideWorldBounds(false)
    }

    // Add to enemy group
    this.enemyGroup.add(minion)

    // Track this minion
    this.spawnedMinions.push(minion)

    // Enable world bounds once minion enters the screen
    this.enableWorldBoundsWhenOnScreen(minion)

    // Visual feedback
    this.isSpawning = true
    this.updateSpawnAura()

    // Spawn particles at spawner location (minion spawns off-screen)
    if (this.spawnParticles) {
      this.spawnParticles.setPosition(this.x, this.y)
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

    console.log(`SpawnerEnemy spawned minion from top at (${spawnX.toFixed(0)}, ${spawnY.toFixed(0)}). Active minions: ${this.spawnedMinions.length}`)
  }

  /**
   * Enable world bounds collision once minion enters the visible screen area
   */
  private enableWorldBoundsWhenOnScreen(minion: MinionEnemy): void {
    const checkInterval = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        if (!minion.active) {
          checkInterval.remove()
          return
        }
        // Once minion is on screen, enable world bounds
        if (minion.y > 0) {
          const body = minion.body as Phaser.Physics.Arcade.Body
          if (body) {
            body.setCollideWorldBounds(true)
          }
          checkInterval.remove()
        }
      },
      loop: true
    })
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
