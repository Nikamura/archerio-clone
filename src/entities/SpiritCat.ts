import Phaser from 'phaser'
import Enemy from './Enemy'

export default class SpiritCat extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 300
  private lifetime: number = 3000 // 3 seconds max
  private spawnTime: number = 0
  private damage: number = 0
  private isCrit: boolean = false
  private target: Enemy | null = null
  private homingStrength: number = 0.15 // How sharply it turns toward target

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'spiritCatSprite')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set display size (cat should be visible but not huge)
    this.setDisplaySize(32, 32)

    // Set circular hitbox centered on the sprite
    if (this.body) {
      const displaySize = 32
      const radius = 10
      const offset = (displaySize - radius * 2) / 2
      this.body.setSize(displaySize, displaySize)
      this.body.setCircle(radius, offset, offset)
    }

    this.setActive(false)
    this.setVisible(false)
  }

  fire(
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    canCrit: boolean
  ): void {
    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)

    this.target = target
    this.damage = damage
    this.isCrit = canCrit && Math.random() < 0.1 // 10% base crit chance for cats
    this.spawnTime = this.scene.time.now

    // Initial velocity toward target
    const angle = Phaser.Math.Angle.Between(x, y, target.x, target.y)
    this.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed
    )
    this.setRotation(angle)

    // Visual tint for crit cats
    if (this.isCrit) {
      this.setTint(0xffff00) // Yellow glow for crit
      this.setScale(1.2)
    } else {
      this.setTint(0x88ccff) // Blue/purple ghost tint
      this.setScale(1.0)
    }
  }

  update(time: number): void {
    if (!this.active) return

    // Deactivate after lifetime expires
    if (time - this.spawnTime > this.lifetime) {
      this.deactivate()
      return
    }

    // If target is gone, continue in current direction (will deactivate if off-screen)
    if (!this.target || !this.target.active) {
      this.target = null
    }

    // Homing behavior toward target
    if (this.target && this.body) {
      const currentAngle = Math.atan2(this.body.velocity.y, this.body.velocity.x)
      const targetAngle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.target.x,
        this.target.y
      )

      // Smooth rotation toward target
      const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - currentAngle)
      const newAngle = currentAngle + angleDiff * this.homingStrength

      this.setVelocity(
        Math.cos(newAngle) * this.speed,
        Math.sin(newAngle) * this.speed
      )
      this.setRotation(newAngle)
    }

    // Deactivate if off screen
    const margin = 50
    const gameWidth = this.scene.scale.width
    const gameHeight = this.scene.scale.height
    if (
      this.x < -margin ||
      this.x > gameWidth + margin ||
      this.y < -margin ||
      this.y > gameHeight + margin
    ) {
      this.deactivate()
    }
  }

  getDamage(): number {
    return this.isCrit ? Math.floor(this.damage * 2) : this.damage
  }

  isCriticalHit(): boolean {
    return this.isCrit
  }

  deactivate(): void {
    this.setActive(false)
    this.setVisible(false)
    this.setVelocity(0, 0)
    this.target = null
    this.clearTint()
    this.setScale(1.0)
  }

  getSpawnTime(): number {
    return this.spawnTime
  }
}
