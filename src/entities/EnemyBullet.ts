import Phaser from 'phaser'

export default class EnemyBullet extends Phaser.Physics.Arcade.Sprite {
  private speed: number = 200
  private lifetime: number = 3000 // 3 seconds
  private spawnTime: number = 0

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemyBulletSprite')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set display size for the fireball sprite - match player bullet size
    this.setDisplaySize(24, 24)

    // Set circular hitbox centered on the sprite
    // Must sync body size with display size, then center the circle
    if (this.body) {
      const displaySize = 24
      const radius = 10 // Larger hitbox for more reliable hit detection
      const offset = (displaySize - radius * 2) / 2
      this.body.setSize(displaySize, displaySize)
      this.body.setCircle(radius, offset, offset)
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
    if (!this.active) return

    // Deactivate bullet after lifetime expires
    if (time - this.spawnTime > this.lifetime) {
      this.deactivate()
      return
    }

    // Deactivate bullet if it goes off screen (with margin)
    const margin = 50
    const gameWidth = this.scene.scale.width
    const gameHeight = this.scene.scale.height
    if (this.x < -margin || this.x > gameWidth + margin ||
        this.y < -margin || this.y > gameHeight + margin) {
      this.deactivate()
    }
  }

  deactivate() {
    this.setActive(false)
    this.setVisible(false)
    this.setVelocity(0, 0)
  }
}
