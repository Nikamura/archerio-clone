import Phaser from 'phaser'
import Enemy from './Enemy'
import EnemyBulletPool from '../systems/EnemyBulletPool'

export default class SpreaderEnemy extends Enemy {
  private lastShotTime: number = 0
  private fireRate: number = 3000 // 3 seconds between spreads
  private bulletPool: EnemyBulletPool

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: {
      healthMultiplier?: number
      damageMultiplier?: number
    }
  ) {
    super(scene, x, y, options)

    this.bulletPool = bulletPool

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

    directions.forEach((angle) => {
      this.bulletPool.spawn(this.x, this.y, angle, 150) // Slower bullets
    })
  }
}
