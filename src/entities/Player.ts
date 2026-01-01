import Phaser from 'phaser'

export default class Player extends Phaser.Physics.Arcade.Sprite {
  private health: number = 100
  private maxHealth: number = 100
  private isMoving: boolean = false

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, '')

    // Add to scene
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Create a simple circle for the player
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(0x4a9eff, 1)
    graphics.fillCircle(0, 0, 20)

    // Draw a direction indicator
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(8, 0, 5)

    graphics.generateTexture('player', 40, 40)
    graphics.destroy()

    this.setTexture('player')
    this.setCollideWorldBounds(true)
    this.setDrag(800, 800)

    console.log('Player created at', x, y)
  }

  update(time: number, delta: number) {
    // Check if player is moving
    const velocity = this.body?.velocity
    if (velocity) {
      this.isMoving = Math.abs(velocity.x) > 10 || Math.abs(velocity.y) > 10
    }

    // Rotate player to face movement direction
    if (this.isMoving && velocity) {
      this.rotation = Math.atan2(velocity.y, velocity.x)
    }
  }

  setVelocity(x: number, y: number): this {
    if (this.body) {
      this.body.velocity.x = x
      this.body.velocity.y = y
    }
    return this
  }

  takeDamage(amount: number) {
    this.health = Math.max(0, this.health - amount)
    // TODO: Emit event for UI update
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount)
    // TODO: Emit event for UI update
  }

  getHealth(): number {
    return this.health
  }

  getMaxHealth(): number {
    return this.maxHealth
  }

  isPlayerMoving(): boolean {
    return this.isMoving
  }
}
