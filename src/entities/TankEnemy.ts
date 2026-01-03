import Phaser from 'phaser'
import Enemy, { EnemyOptions } from './Enemy'
import EnemyBulletPool from '../systems/EnemyBulletPool'

export default class TankEnemy extends Enemy {
  private lastShotTime: number = 0
  private fireRate: number = 3500 // Base 3.5 seconds between shots (slower than spreader)
  private bulletPool: EnemyBulletPool
  private isCharging: boolean = false
  private chargeStartTime: number = 0
  private chargeDuration: number = 800 // 0.8 seconds to charge up
  private projectileSpeedMultiplier: number = 1.0

  // Tank has 3x normal health (handled by passing healthMultiplier * 3)
  private static readonly TANK_HEALTH_MULTIPLIER = 3.0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: EnemyOptions
  ) {
    // Apply tank's 3x health multiplier on top of difficulty multiplier
    const tankOptions: EnemyOptions = {
      healthMultiplier: (options?.healthMultiplier ?? 1.0) * TankEnemy.TANK_HEALTH_MULTIPLIER,
      damageMultiplier: options?.damageMultiplier ?? 1.0,
      speedMultiplier: options?.speedMultiplier ?? 1.0,
      attackCooldownMultiplier: options?.attackCooldownMultiplier ?? 1.0,
      projectileSpeedMultiplier: options?.projectileSpeedMultiplier ?? 1.0,
    }
    super(scene, x, y, tankOptions)

    this.bulletPool = bulletPool

    // Apply chapter-specific modifiers
    this.fireRate = 3500 * (options?.attackCooldownMultiplier ?? 1.0)
    this.projectileSpeedMultiplier = options?.projectileSpeedMultiplier ?? 1.0

    // Use tank enemy sprite (fallback to melee if not loaded)
    if (scene.textures.exists('enemyTank')) {
      this.setTexture('enemyTank')
    } else {
      // Fallback: tint melee sprite purple and make it larger
      this.setTint(0x8800ff)
    }

    // Larger sprite size (48x48)
    this.setDisplaySize(48, 48)

    console.log('TankEnemy created at', x, y, 'with 3x health multiplier')
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

    // Tank moves very slowly toward player
    const baseSpeed = 30 // Very slow base movement
    const slowSpeed = baseSpeed * this.speedMultiplier

    if (!this.isCharging) {
      // Move toward player slowly with wall avoidance
      if (distanceToPlayer > 100) {
        if (this.wallGroup) {
          const movement = this.calculateMovementWithWallAvoidance(
            playerX,
            playerY,
            slowSpeed,
            time
          )
          this.setVelocity(movement.vx, movement.vy)
        } else {
          const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
          this.setVelocity(Math.cos(angle) * slowSpeed, Math.sin(angle) * slowSpeed)
        }
      } else {
        // Close enough - stop moving
        this.setVelocity(0, 0)
      }

      // Start charging for shot
      if (time - this.lastShotTime > this.fireRate) {
        this.startCharging(time)
      }
    } else {
      // Charging up - stand still
      this.setVelocity(0, 0)

      const elapsed = time - this.chargeStartTime

      // Visual charging effect - pulse and glow
      const progress = elapsed / this.chargeDuration
      const pulseFreq = 4 + progress * 8 // Faster pulsing as charge completes
      const scale = 1 + Math.sin(time * pulseFreq * 0.01) * 0.1

      // Change tint during charge (purple -> red)
      const color1 = new Phaser.Display.Color(136, 0, 255)
      const color2 = new Phaser.Display.Color(255, 0, 0)
      const chargeColor = Phaser.Display.Color.Interpolate.ColorWithColor(
        color1,
        color2,
        100,
        Math.floor(progress * 100)
      )
      this.setTint(Phaser.Display.Color.GetColor(chargeColor.r, chargeColor.g, chargeColor.b))
      this.setScale(scale)

      // Fire after charge completes
      if (elapsed > this.chargeDuration) {
        this.fireSpread()
        this.isCharging = false
        this.lastShotTime = time
        this.setScale(1) // Reset scale

        // Reset tint (or keep purple if no custom texture)
        if (!this.scene.textures.exists('enemyTank')) {
          this.setTint(0x8800ff)
        } else {
          this.clearTint()
        }
      }
    }

    // Ensure enemy stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 24 // Half of tank size (48x48)
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return false
  }

  private startCharging(time: number) {
    this.isCharging = true
    this.chargeStartTime = time
  }

  private fireSpread() {
    // Fire 8 projectiles in all directions
    const numProjectiles = 8
    const baseSpeed = 180
    const speed = baseSpeed * this.projectileSpeedMultiplier

    for (let i = 0; i < numProjectiles; i++) {
      const angle = (Math.PI * 2 * i) / numProjectiles
      this.bulletPool.spawn(this.x, this.y, angle, speed)
    }

    console.log('TankEnemy fired 8-way spread')
  }

  /**
   * Override getDamage for higher contact damage
   */
  getDamage(): number {
    // Tank deals 1.5x normal melee damage on contact
    const baseDamage = 24 // Higher than normal enemy's 15 (increased by 200%)
    return Math.round(baseDamage * this.damageMultiplier)
  }
}
