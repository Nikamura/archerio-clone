import Phaser from "phaser";
import EnemyBullet from "../entities/EnemyBullet";

export default class EnemyBulletPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: EnemyBullet,
      maxSize: 1000,
      runChildUpdate: true,
    });

    // Create enemy bullet texture
    this.createEnemyBulletTexture();
  }

  private createEnemyBulletTexture() {
    // Enemy bullet texture now loaded from PreloaderScene as 'enemyBulletSprite'
    // No need to generate it here
  }

  spawn(x: number, y: number, angle: number, speed: number = 170): EnemyBullet | null {
    let bullet = this.get(x, y) as EnemyBullet | null;

    // If pool is exhausted, recycle the oldest active bullet
    if (!bullet) {
      bullet = this.recycleOldestBullet();
    }

    if (bullet) {
      bullet.fire(x, y, angle, speed);
    }
    return bullet;
  }

  /**
   * Recycle the oldest active bullet when pool is exhausted.
   * This ensures gameplay continues smoothly even with high bullet counts.
   * Only recycles bullets that have lived at least 300ms to prevent visible pop-in.
   */
  private recycleOldestBullet(): EnemyBullet | null {
    let oldest: EnemyBullet | null = null;
    let oldestSpawnTime = Infinity;
    const currentTime = this.scene.time.now;
    const minLifetime = 300; // Don't recycle bullets younger than 300ms

    this.children.iterate((child) => {
      const bullet = child as EnemyBullet;
      if (bullet.active) {
        const spawnTime = bullet.getSpawnTime();
        const bulletAge = currentTime - spawnTime;
        // Only consider bullets that have lived long enough
        if (bulletAge >= minLifetime && spawnTime < oldestSpawnTime) {
          oldestSpawnTime = spawnTime;
          oldest = bullet;
        }
      }
      return true;
    });

    if (oldest !== null) {
      (oldest as EnemyBullet).deactivate();
      return oldest;
    }
    return null;
  }
}
