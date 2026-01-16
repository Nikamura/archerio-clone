/**
 * BomberEnemy - Throws explosive bombs at the player
 *
 * Behavior:
 * - Maintains preferred distance from player (not too close, not too far)
 * - Wind-up animation before throwing
 * - Uses BombPool for AOE explosive projectiles
 *
 * Note: Uses BombPool instead of EnemyBulletPool, so doesn't extend RangedEnemy
 */

import Phaser from 'phaser'
import Enemy, { EnemyOptions, EnemyUpdateResult } from '../Enemy'
import BombPool from '../../systems/BombPool'
import { getEnemySpriteKey } from '../../config/themeData'

export default class BomberEnemy extends Enemy {
  private lastThrowTime: number = 0
  private throwCooldown: number = 2500 // Base 2.5 seconds between throws
  private bombPool: BombPool
  private isWindingUp: boolean = false
  private windUpStartTime: number = 0
  private windUpDuration: number = 600 // 0.6 seconds warning before throw
  private targetX: number = 0
  private targetY: number = 0

  // Callback for explosion damage check
  private onBombExplode?: (x: number, y: number, radius: number, damage: number) => void

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bombPool: BombPool,
    options?: EnemyOptions,
    onBombExplode?: (x: number, y: number, radius: number, damage: number) => void
  ) {
    super(scene, x, y, options)

    this.bombPool = bombPool
    this.onBombExplode = onBombExplode

    // Apply chapter-specific modifiers
    this.throwCooldown = 2500 * (options?.attackCooldownMultiplier ?? 1.0)
    // abilityIntensityMultiplier could be used for explosion radius in the future

    // Apply damage multiplier to bomb pool
    if (options?.damageMultiplier) {
      this.bombPool.setDamageMultiplier(options.damageMultiplier)
    }

    // Use themed bomber enemy sprite
    const spriteKey = getEnemySpriteKey('bomber')
    if (scene.textures.exists(spriteKey)) {
      this.setTexture(spriteKey)
    } else {
      // Fallback: tint melee sprite orange
      this.setTint(0xff8800)
    }
    this.setDisplaySize(32, 32)

    console.log('BomberEnemy created at', x, y)
  }

  setOnBombExplode(callback: (x: number, y: number, radius: number, damage: number) => void) {
    this.onBombExplode = callback
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

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      playerX,
      playerY
    )

    // Preferred throw distance - not too close, not too far
    const minDistance = 120
    const maxDistance = 220

    if (!this.isWindingUp) {
      const baseRetreatSpeed = 70
      const baseApproachSpeed = 60
      const retreatSpeed = baseRetreatSpeed * this.speedMultiplier
      const approachSpeed = baseApproachSpeed * this.speedMultiplier

      if (distanceToPlayer < minDistance) {
        // Too close - retreat using bounds-aware flee
        const fleeAngle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y)
        const fleeVelocity = this.calculateBoundsAwareFleeVelocity(fleeAngle, retreatSpeed)
        this.setVelocity(fleeVelocity.vx, fleeVelocity.vy)
      } else if (distanceToPlayer > maxDistance) {
        // Too far - approach
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        this.setVelocity(Math.cos(angle) * approachSpeed, Math.sin(angle) * approachSpeed)
      } else {
        // Good distance - stop and throw
        this.setVelocity(0, 0)

        if (time - this.lastThrowTime > this.throwCooldown) {
          this.startWindUp(time, playerX, playerY)
        }
      }
    } else {
      // Winding up - stand still and show warning
      this.setVelocity(0, 0)

      // Visual warning - scale pulse
      const elapsed = time - this.windUpStartTime
      const progress = elapsed / this.windUpDuration
      const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.15
      this.setScale(scale)

      // Throw bomb after wind-up
      if (elapsed > this.windUpDuration) {
        this.throwBomb()
        this.isWindingUp = false
        this.lastThrowTime = time
        this.setScale(1) // Reset scale
      }
    }

    // Ensure enemy stays within world bounds
    this.clampToWorldBounds(16)

    return effectResult
  }

  private startWindUp(time: number, playerX: number, playerY: number) {
    this.isWindingUp = true
    this.windUpStartTime = time
    // Store target position at start of wind-up (leads the throw slightly)
    this.targetX = playerX
    this.targetY = playerY
  }

  private throwBomb() {
    this.bombPool.spawn(
      this.x,
      this.y,
      this.targetX,
      this.targetY,
      150,
      this.onBombExplode
    )
  }

  /**
   * Clamp position to world bounds
   */
  private clampToWorldBounds(margin: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }
  }
}
