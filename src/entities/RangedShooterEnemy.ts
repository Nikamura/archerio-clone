import Phaser from 'phaser'
import Enemy, { EnemyOptions } from './Enemy'
import EnemyBulletPool from '../systems/EnemyBulletPool'

export default class RangedShooterEnemy extends Enemy {
  private lastShotTime: number = 0
  private fireRate: number = 2000 // Base 2 seconds between shots
  private isAiming: boolean = false
  private aimDuration: number = 500 // 0.5 seconds to aim
  private aimStartTime: number = 0
  private bulletPool: EnemyBulletPool
  private telegraphLine?: Phaser.GameObjects.Line
  private projectileSpeedMultiplier: number = 1.0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: EnemyOptions
  ) {
    super(scene, x, y, options)

    this.bulletPool = bulletPool

    // Apply chapter-specific modifiers
    this.fireRate = 2000 * (options?.attackCooldownMultiplier ?? 1.0)
    this.projectileSpeedMultiplier = options?.projectileSpeedMultiplier ?? 1.0

    // Use ranged enemy sprite
    this.setTexture('enemyRanged')
    this.setDisplaySize(30, 30)

    // Create telegraph line (initially hidden)
    this.telegraphLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.6)
    this.telegraphLine.setOrigin(0, 0)
    this.telegraphLine.setVisible(false)
    this.telegraphLine.setDepth(0)

    console.log('RangedShooterEnemy created at', x, y)
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

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      playerX,
      playerY
    )

    // Stay at a distance from player (kite behavior)
    const preferredDistance = 250

    if (!this.isAiming) {
      const baseSpeed = 60
      const speed = baseSpeed * this.speedMultiplier
      if (distanceToPlayer > preferredDistance + 50) {
        // Move closer
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      } else if (distanceToPlayer < preferredDistance - 50) {
        // Move away
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        this.setVelocity(-Math.cos(angle) * speed, -Math.sin(angle) * speed)
      } else {
        // Stop and prepare to shoot
        this.setVelocity(0, 0)

        if (time - this.lastShotTime > this.fireRate) {
          this.startAiming(time)
        }
      }
    } else {
      // Aiming - show telegraph line
      this.setVelocity(0, 0)

      if (this.telegraphLine) {
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        const lineLength = 300
        const endX = this.x + Math.cos(angle) * lineLength
        const endY = this.y + Math.sin(angle) * lineLength

        this.telegraphLine.setTo(this.x, this.y, endX, endY)
        this.telegraphLine.setVisible(true)
      }

      // Check if aiming is complete
      if (time - this.aimStartTime > this.aimDuration) {
        this.shoot(playerX, playerY)
        this.isAiming = false
        this.lastShotTime = time
        if (this.telegraphLine) {
          this.telegraphLine.setVisible(false)
        }
      }
    }

    // Ensure enemy stays within world bounds (extra safety check)
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      // Clamp position to world bounds with a small margin
      const margin = 15 // Half of enemy size
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return false
  }

  private startAiming(time: number) {
    this.isAiming = true
    this.aimStartTime = time
  }

  private shoot(targetX: number, targetY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    const baseSpeed = 250
    const bulletSpeed = baseSpeed * this.projectileSpeedMultiplier
    this.bulletPool.spawn(this.x, this.y, angle, bulletSpeed)
  }

  destroy(fromScene?: boolean) {
    if (this.telegraphLine) {
      this.telegraphLine.destroy()
    }
    super.destroy(fromScene)
  }
}
