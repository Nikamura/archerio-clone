import Phaser from 'phaser'
import EnemyBullet from '../entities/EnemyBullet'

export default class EnemyBulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: EnemyBullet,
      maxSize: 100,
      runChildUpdate: true,
    })

    // Create enemy bullet texture
    this.createEnemyBulletTexture()
  }

  private createEnemyBulletTexture() {
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)

    // Draw a red/orange bullet
    graphics.fillStyle(0xff4444, 1)
    graphics.fillCircle(0, 0, 5)
    graphics.fillStyle(0xff8844, 1)
    graphics.fillCircle(-2, 0, 3)

    graphics.generateTexture('enemyBullet', 16, 16)
    graphics.destroy()
  }

  spawn(x: number, y: number, angle: number, speed: number = 200): EnemyBullet | null {
    const bullet = this.get(x, y) as EnemyBullet
    if (bullet) {
      bullet.fire(x, y, angle, speed)
    }
    return bullet
  }
}
