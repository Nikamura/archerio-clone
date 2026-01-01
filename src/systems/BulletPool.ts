import Phaser from 'phaser'
import Bullet from '../entities/Bullet'

export default class BulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      maxSize: 100,
      runChildUpdate: true,
    })

    // Create bullet texture
    this.createBulletTexture()
  }

  private createBulletTexture() {
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)

    // Draw a simple arrow bullet
    graphics.fillStyle(0xffff00, 1)
    graphics.fillCircle(0, 0, 4)
    graphics.fillTriangle(4, 0, 8, -3, 8, 3)

    graphics.generateTexture('bullet', 16, 16)
    graphics.destroy()
  }

  spawn(x: number, y: number, angle: number, speed: number = 400): Bullet | null {
    const bullet = this.get(x, y) as Bullet
    if (bullet) {
      bullet.fire(x, y, angle, speed)
    }
    return bullet
  }
}
