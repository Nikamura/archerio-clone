import Phaser from 'phaser'

export default class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 200
  private lifetime: number = 3000 // 3 seconds
  private spawnTime: number = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemyBullet')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set small circular hitbox for precise collision
    if (this.body) {
      this.body.setCircle(5) // Small 5-pixel radius for enemy bullet
    }

    this.setActive(false)
    this.setVisible(false)
  }

  fire(x: number, y: number, angle: number, speed: number = 200) {
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
