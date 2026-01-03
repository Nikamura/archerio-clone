import Phaser from 'phaser'
import Bullet from '../entities/Bullet'

export default class BulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: Bullet,
      maxSize: 2000, // Increased to handle high fire rate + multiple arrow abilities
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
    freezeChance?: number
    poisonDamage?: number
    lightningChainCount?: number
    projectileSprite?: string
    projectileSizeMultiplier?: number
  }): Bullet | null {
    let bullet = this.get(x, y) as Bullet | null

    // If pool is exhausted, recycle the oldest active bullet
    if (!bullet) {
      bullet = this.recycleOldestBullet()
    }

    if (bullet) {
      bullet.fire(x, y, angle, speed, options)
    }
    return bullet
  }

  /**
   * Recycle the oldest active bullet when pool is exhausted.
   * This ensures gameplay continues smoothly even with high bullet counts.
   * Only recycles bullets that have lived at least 500ms to prevent visible pop-in.
   */
  private recycleOldestBullet(): Bullet | null {
    let oldest: Bullet | null = null
    let oldestSpawnTime = Infinity
    const currentTime = this.scene.time.now
    const minLifetime = 500 // Don't recycle bullets younger than 500ms

    this.children.iterate((child) => {
      const bullet = child as Bullet
      if (bullet.active) {
        const spawnTime = bullet.getSpawnTime()
        const bulletAge = currentTime - spawnTime
        // Only consider bullets that have lived long enough
        if (bulletAge >= minLifetime && spawnTime < oldestSpawnTime) {
          oldestSpawnTime = spawnTime
          oldest = bullet
        }
      }
      return true
    })

    if (oldest !== null) {
      (oldest as Bullet).deactivate()
      return oldest
    }
    return null
  }
}
