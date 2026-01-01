import Phaser from 'phaser'
import Enemy, { EnemyOptions } from './Enemy'
import EnemyBulletPool from '../systems/EnemyBulletPool'

export default class SpreaderEnemy extends Enemy {
  private lastShotTime: number = 0
  private fireRate: number = 3000 // Base 3 seconds between spreads
  private bulletPool: EnemyBulletPool
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
    this.fireRate = 3000 * (options?.attackCooldownMultiplier ?? 1.0)
    this.projectileSpeedMultiplier = options?.projectileSpeedMultiplier ?? 1.0

    // Use spreader enemy sprite
    this.setTexture('enemySpreader')
    this.setDisplaySize(36, 36) // Slightly larger than others

    console.log('SpreaderEnemy created at', x, y)
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

    // Spreader is stationary
    this.setVelocity(0, 0)

    // Fire 4-direction spread periodically
    if (time - this.lastShotTime > this.fireRate) {
      this.shootSpread()
      this.lastShotTime = time
    }

    // Ensure enemy stays within world bounds (extra safety check)
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      // Clamp position to world bounds with a small margin
      const margin = 18 // Half of spreader size (36x36 display size)
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return false
  }

  private shootSpread() {
    // Fire in 4 cardinal directions
    const directions = [
      0, // Right
      Math.PI / 2, // Down
      Math.PI, // Left
      (Math.PI * 3) / 2, // Up
    ]

    const baseSpeed = 150
    const bulletSpeed = baseSpeed * this.projectileSpeedMultiplier

    directions.forEach((angle) => {
      this.bulletPool.spawn(this.x, this.y, angle, bulletSpeed)
    })
  }
}
