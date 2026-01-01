import Phaser from 'phaser'

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health: number = 30
  private maxHealth: number = 30

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy')

    // Ensure enemy is visible and active
    this.setActive(true)
    this.setVisible(true)
    this.setDepth(1) // Make sure enemy renders above background

    console.log('Enemy constructor called at', x, y)
  }

  takeDamage(amount: number): boolean {
    this.health -= amount

    // Flash effect
    this.setTint(0xffffff)
    this.scene.time.delayedCall(100, () => {
      this.clearTint()
    })

    if (this.health <= 0) {
      return true // Enemy died
    }
    return false
  }

  resetHealth() {
    this.health = this.maxHealth
    this.clearTint()
  }

  update(_time: number, _delta: number, playerX: number, playerY: number) {
    if (!this.active || !this.body) {
      return
    }

    // Simple AI: move toward player
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    const speed = 80

    this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
  }
}
