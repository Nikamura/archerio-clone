import Phaser from 'phaser'

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 400
  private lifetime: number = 2000 // 2 seconds
  private spawnTime: number = 0

  // Ability tracking
  private hitCount: number = 0 // How many enemies this bullet has hit (for piercing)
  private bounceCount: number = 0 // How many times this bullet has ricocheted
  private maxPierces: number = 0 // Maximum number of enemies it can pierce through
  private maxBounces: number = 0 // Maximum number of ricochet bounces
  private fireDamage: number = 0 // Fire DOT damage to apply on hit
  private isCrit: boolean = false // Whether this bullet is a critical hit

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set small circular hitbox for precise collision
    if (this.body) {
      this.body.setCircle(4) // Small 4-pixel radius for bullet
    }

    this.setActive(false)
    this.setVisible(false)
  }

  fire(x: number, y: number, angle: number, speed: number = 400, options?: {
    maxPierces?: number
    maxBounces?: number
    fireDamage?: number
    isCrit?: boolean
  }) {
    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)

    this.speed = speed
    this.spawnTime = this.scene.time.now

    // Reset ability tracking
    this.hitCount = 0
    this.bounceCount = 0
    this.maxPierces = options?.maxPierces ?? 0
    this.maxBounces = options?.maxBounces ?? 0
    this.fireDamage = options?.fireDamage ?? 0
    this.isCrit = options?.isCrit ?? false

    // Set velocity based on angle
    const vx = Math.cos(angle) * this.speed
    const vy = Math.sin(angle) * this.speed
    this.setVelocity(vx, vy)

    // Rotate bullet to face direction
    this.setRotation(angle)

    // Visual indicator for critical hit (slightly larger and different color)
    if (this.isCrit) {
      this.setTint(0xffff00) // Yellow tint for crits
      this.setScale(1.3)
    } else {
      this.clearTint()
      this.setScale(1)
    }
  }

  update(time: number) {
    // Deactivate bullet after lifetime expires
    if (this.active && time - this.spawnTime > this.lifetime) {
      this.setActive(false)
      this.setVisible(false)
      this.setVelocity(0, 0)
    }
  }

  /**
   * Called when bullet hits an enemy
   * @returns true if bullet should be deactivated (no piercing/ricochet)
   */
  onHit(): boolean {
    this.hitCount++

    // Check if bullet can pierce through
    if (this.maxPierces > 0 && this.hitCount <= this.maxPierces) {
      return false // Don't deactivate, keep going
    }

    // Check if bullet can ricochet
    if (this.maxBounces > 0 && this.bounceCount < this.maxBounces) {
      return false // Don't deactivate yet, will ricochet
    }

    return true // Deactivate bullet
  }

  /**
   * Redirect bullet to a new target (for ricochet)
   */
  redirectTo(targetX: number, targetY: number) {
    this.bounceCount++

    // Calculate new angle to target
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)

    // Set new velocity
    const vx = Math.cos(angle) * this.speed
    const vy = Math.sin(angle) * this.speed
    this.setVelocity(vx, vy)

    // Rotate to face new direction
    this.setRotation(angle)
  }

  // Getters for ability tracking
  getHitCount(): number {
    return this.hitCount
  }

  getBounceCount(): number {
    return this.bounceCount
  }

  getMaxPierces(): number {
    return this.maxPierces
  }

  getMaxBounces(): number {
    return this.maxBounces
  }

  getFireDamage(): number {
    return this.fireDamage
  }

  isCriticalHit(): boolean {
    return this.isCrit
  }
}
