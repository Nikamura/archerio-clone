import Phaser from 'phaser'
import EnemyBullet from '../entities/EnemyBullet'

export default class EnemyBulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: EnemyBullet,
      maxSize: 1000,
      runChildUpdate: true,
    })

    // Create enemy bullet texture
    this.createEnemyBulletTexture()
  }

  private createEnemyBulletTexture() {
    // Enemy bullet texture now loaded from PreloaderScene as 'enemyBulletSprite'
    // No need to generate it here
  }

  spawn(x: number, y: number, angle: number, speed: number = 200): EnemyBullet | null {
    const bullet = this.get(x, y) as EnemyBullet
    if (bullet) {
      bullet.fire(x, y, angle, speed)
    }
    return bullet
  }
}
