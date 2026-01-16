import Phaser from 'phaser'
import Enemy, { EnemyOptions, EnemyUpdateResult } from '../Enemy'
import { getEnemySpriteKey } from '../../config/themeData'

export default class HealerEnemy extends Enemy {
  private lastHealTime: number = 0
  private healInterval: number = 3000 // Base heal every 3 seconds
  private readonly healRange: number = 150 // Range to heal allies
  private healAmount: number = 10 // Base HP healed per tick
  private readonly preferredDistanceFromPlayer: number = 200

  // Visual effects
  private healAura: Phaser.GameObjects.Graphics | null = null
  private healParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null
  private isHealing: boolean = false

  // Reference to enemy group for healing others
  private enemyGroup: Phaser.Physics.Arcade.Group | null = null

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: EnemyOptions
  ) {
    // Healers have low health (60% of normal)
    const healerOptions: EnemyOptions = {
      ...options,
      healthMultiplier: (options?.healthMultiplier ?? 1.0) * 0.6,
    }
    super(scene, x, y, healerOptions)

    // Apply chapter-specific modifiers
    this.healInterval = 3000 * (options?.attackCooldownMultiplier ?? 1.0)
    this.healAmount = Math.round(10 * (options?.abilityIntensityMultiplier ?? 1.0))

    // Use themed healer enemy sprite
    const spriteKey = getEnemySpriteKey('healer')
    if (scene.textures.exists(spriteKey)) {
      this.setTexture(spriteKey)
    }
    this.setDisplaySize(28, 28) // Slightly smaller than normal enemies

    // Create healing aura visual
    this.createHealAura()

    // Create heal particles
    this.createHealParticles()

    console.log('HealerEnemy created at', x, y)
  }

  /**
   * Set the enemy group for healing other enemies
   */
  setEnemyGroup(group: Phaser.Physics.Arcade.Group): void {
    this.enemyGroup = group
  }

  private createHealAura(): void {
    this.healAura = this.scene.add.graphics()
    this.healAura.setDepth(0)
    this.updateHealAura()
  }

  private createHealParticles(): void {
    // Create heal particle texture if it doesn't exist
    if (!this.scene.textures.exists('healParticle')) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(0x00ff88, 1) // Green heal color
      graphics.fillCircle(3, 3, 3)
      graphics.generateTexture('healParticle', 6, 6)
      graphics.destroy()
    }

    this.healParticles = this.scene.add.particles(0, 0, 'healParticle', {
      lifespan: 800,
      speed: { min: 10, max: 30 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.9, end: 0 },
      angle: { min: -90, max: -90 }, // Float upward
      emitting: false,
    })
    this.healParticles.setDepth(5)
  }

  private updateHealAura(): void {
    if (!this.healAura) return

    this.healAura.clear()

    if (this.isHealing) {
      // Draw pulsing heal aura when healing
      this.healAura.lineStyle(2, 0x00ff88, 0.6)
      this.healAura.strokeCircle(this.x, this.y, this.healRange)

      // Inner glow
      this.healAura.lineStyle(1, 0x00ff88, 0.3)
      this.healAura.strokeCircle(this.x, this.y, this.healRange * 0.7)
    } else {
      // Subtle indicator when not healing
      this.healAura.lineStyle(1, 0x00ff88, 0.2)
      this.healAura.strokeCircle(this.x, this.y, this.healRange)
    }
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

    // Movement: Stay away from player
    const distanceToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)
    const speed = 70 // Medium speed

    if (distanceToPlayer < this.preferredDistanceFromPlayer - 30) {
      // Too close - run away from player using bounds-aware flee
      const fleeAngle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y)
      const fleeVelocity = this.calculateBoundsAwareFleeVelocity(fleeAngle, speed)
      this.setVelocity(fleeVelocity.vx, fleeVelocity.vy)
    } else if (distanceToPlayer > this.preferredDistanceFromPlayer + 50) {
      // Too far - move closer with wall avoidance
      if (this.wallGroup) {
        const movement = this.calculateMovementWithWallAvoidance(
          playerX,
          playerY,
          speed * 0.5,
          time
        )
        this.setVelocity(movement.vx, movement.vy)
      } else {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        this.setVelocity(Math.cos(angle) * speed * 0.5, Math.sin(angle) * speed * 0.5)
      }
    } else {
      // Good distance - slow side-to-side movement
      const sideAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY) + Math.PI / 2
      const wobble = Math.sin(time * 0.002) * 30
      this.setVelocity(Math.cos(sideAngle) * wobble, Math.sin(sideAngle) * wobble)
    }

    // Periodic healing
    if (time - this.lastHealTime > this.healInterval) {
      this.performHeal()
      this.lastHealTime = time
    }

    // Update heal aura position
    this.updateHealAura()

    // Fade healing indicator
    if (this.isHealing && time - this.lastHealTime > 500) {
      this.isHealing = false
      this.updateHealAura()
    }

    // Ensure enemy stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 14
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return effectResult
  }

  private performHeal(): void {
    if (!this.enemyGroup) return

    let healedSomething = false

    // Find all enemies within heal range and heal them
    this.enemyGroup.getChildren().forEach((gameObject) => {
      const enemy = gameObject as Enemy
      if (!enemy.active || enemy === this) return

      const distance = Phaser.Math.Distance.Between(this.x, this.y, enemy.x, enemy.y)
      if (distance <= this.healRange) {
        // Heal the enemy (we'll call a heal method if it exists)
        this.healEnemy(enemy)
        healedSomething = true

        // Emit particles at healed enemy
        if (this.healParticles) {
          this.healParticles.setPosition(enemy.x, enemy.y)
          this.healParticles.explode(4)
        }
      }
    })

    if (healedSomething) {
      this.isHealing = true
      this.updateHealAura()

      // Emit particles at healer
      if (this.healParticles) {
        this.healParticles.setPosition(this.x, this.y)
        this.healParticles.explode(6)
      }

      // Visual pulse on healer
      this.scene.tweens.add({
        targets: this,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 150,
        yoyo: true,
        ease: 'Sine.easeInOut',
      })
    }
  }

  /**
   * Heal an enemy by the heal amount
   */
  private healEnemy(enemy: Enemy): void {
    // Heal the enemy
    const healedAmount = enemy.heal(this.healAmount)

    if (healedAmount > 0) {
      // Visual feedback - green tint for healing
      enemy.setTint(0x00ff88)
      this.scene.time.delayedCall(200, () => {
        if (enemy.active) {
          enemy.clearTint()
        }
      })
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.healAura) {
      this.healAura.destroy()
      this.healAura = null
    }
    if (this.healParticles) {
      this.healParticles.destroy()
      this.healParticles = null
    }
    super.destroy(fromScene)
  }
}
