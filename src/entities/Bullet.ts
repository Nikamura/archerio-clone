import Phaser from 'phaser'

export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 400
  private lifetime: number = 2000 // 2 seconds
  private spawnTime: number = 0

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

  fire(x: number, y: number, angle: number, speed: number = 400) {
    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)

    this.speed = speed
    this.spawnTime = this.scene.time.now

    // Set velocity based on angle
    const vx = Math.cos(angle) * this.speed
    const vy = Math.sin(angle) * this.speed
    this.setVelocity(vx, vy)

    // Rotate bullet to face direction
    this.setRotation(angle)
  }

  update(time: number) {
    // Deactivate bullet after lifetime expires
    if (this.active && time - this.spawnTime > this.lifetime) {
      this.setActive(false)
      this.setVisible(false)
      this.setVelocity(0, 0)
    }
  }
}
