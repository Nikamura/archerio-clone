import Phaser from 'phaser'
import Bullet from '../entities/Bullet'

export default class BulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      maxSize: 1000,
      runChildUpdate: true,
    })

    // Create bullet texture
    this.createBulletTexture()
  }

  private createBulletTexture() {
    // Bullet texture now loaded from PreloaderScene as 'bulletSprite'
    // No need to generate it here
  }

  spawn(x: number, y: number, angle: number, speed: number = 400, options?: {
    maxPierces?: number
    maxBounces?: number
    fireDamage?: number
    isCrit?: boolean
  }): Bullet | null {
    const bullet = this.get(x, y) as Bullet
    if (bullet) {
      bullet.fire(x, y, angle, speed, options)
    }
    return bullet
  }
}
