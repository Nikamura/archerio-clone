import Phaser from 'phaser'
import Enemy from './Enemy'
import EnemyBulletPool from '../systems/EnemyBulletPool'

export default class RangedShooterEnemy extends Enemy {
  private lastShotTime: number = 0
  private fireRate: number = 2000 // 2 seconds between shots
  private isAiming: boolean = false
  private aimDuration: number = 500 // 0.5 seconds to aim
  private aimStartTime: number = 0
  private bulletPool: EnemyBulletPool
  private telegraphLine?: Phaser.GameObjects.Line

  constructor(scene: Phaser.Scene, x: number, y: number, bulletPool: EnemyBulletPool) {
    super(scene, x, y)

    this.bulletPool = bulletPool

    // Override texture with orange color
    if (!scene.textures.exists('rangedEnemy')) {
      const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(0xff8844, 1)
      graphics.fillCircle(0, 0, 15)
      graphics.generateTexture('rangedEnemy', 30, 30)
      graphics.destroy()
    }

    this.setTexture('rangedEnemy')

    // Create telegraph line (initially hidden)
    this.telegraphLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.6)
    this.telegraphLine.setOrigin(0, 0)
    this.telegraphLine.setVisible(false)
    this.telegraphLine.setDepth(0)

    console.log('RangedShooterEnemy created at', x, y)
  }

  update(time: number, delta: number, playerX: number, playerY: number) {
    if (!this.active || !this.body) {
      return
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
      if (distanceToPlayer > preferredDistance + 50) {
        // Move closer
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        const speed = 60
        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      } else if (distanceToPlayer < preferredDistance - 50) {
        // Move away
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        const speed = 60
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
  }

  private startAiming(time: number) {
    this.isAiming = true
    this.aimStartTime = time
  }

  private shoot(targetX: number, targetY: number) {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    this.bulletPool.spawn(this.x, this.y, angle, 250)
  }

  destroy(fromScene?: boolean) {
    if (this.telegraphLine) {
      this.telegraphLine.destroy()
    }
    super.destroy(fromScene)
  }
}
