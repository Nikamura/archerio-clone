/**
 * RangedShooterEnemy - Shoots projectiles with telegraph aiming
 *
 * Behavior:
 * - Maintains preferred distance from player (kite behavior)
 * - Shows telegraph line during aim phase
 * - Uses predictive aiming to lead shots
 */

import Phaser from 'phaser'
import RangedEnemy from './RangedEnemy'
import { EnemyOptions, EnemyUpdateResult } from '../Enemy'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getEnemySpriteKey } from '../../config/themeData'
import { themeManager } from '../../systems/ThemeManager'

export default class RangedShooterEnemy extends RangedEnemy {
  private isAiming: boolean = false
  private aimDuration: number = 500 // 0.5 seconds to aim
  private aimStartTime: number = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: EnemyOptions
  ) {
    // Base fire rate is 2000ms
    super(scene, x, y, bulletPool, 2000, options)

    // Use themed ranged enemy sprite
    const spriteKey = getEnemySpriteKey('ranged', themeManager.getAssets())
    this.setTexture(spriteKey)
    this.setDisplaySize(30, 30)

    // Create telegraph line (initially hidden)
    this.createTelegraph(0xff0000, 0.6)

    console.log('RangedShooterEnemy created at', x, y)
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

    // Stay at a distance from player (kite behavior)
    const preferredDistance = 250

    if (!this.isAiming) {
      const baseSpeed = 50
      const speed = baseSpeed * this.speedMultiplier
      if (distanceToPlayer > preferredDistance + 50) {
        // Move closer with wall avoidance
        if (this.wallGroup) {
          const movement = this.calculateMovementWithWallAvoidance(playerX, playerY, speed, time)
          this.setVelocity(movement.vx, movement.vy)
        } else {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
          this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
        }
      } else if (distanceToPlayer < preferredDistance - 50) {
        // Move away using bounds-aware flee to avoid getting stuck at screen edges
        const fleeAngle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y)
        const fleeVelocity = this.calculateBoundsAwareFleeVelocity(fleeAngle, speed)
        this.setVelocity(fleeVelocity.vx, fleeVelocity.vy)
      } else {
        // Stop and prepare to shoot
        this.setVelocity(0, 0)

        if (this.canFire(time)) {
          this.startAiming(time)
        }
      }
    } else {
      // Aiming - show telegraph line
      this.setVelocity(0, 0)
      this.showTelegraph(playerX, playerY, 300)

      // Check if aiming is complete
      if (time - this.aimStartTime > this.aimDuration) {
        this.shoot(time, playerX, playerY)
        this.isAiming = false
        this.hideTelegraph()
      }
    }

    // Ensure enemy stays within world bounds
    this.clampToWorldBounds(15)

    return effectResult
  }

  private startAiming(time: number) {
    this.isAiming = true
    this.aimStartTime = time
  }

  private shoot(time: number, targetX: number, targetY: number) {
    const baseSpeed = 300 // Faster bullets for better chance to hit

    // Calculate predictive aim
    const predicted = this.calculatePredictiveTarget(targetX, targetY, baseSpeed)

    this.fireAtTarget(predicted.x, predicted.y, baseSpeed)
    this.recordShot(time)
  }
}
