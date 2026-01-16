import Phaser from "phaser";

/**
 * PooledSprite interface - requirements for sprites managed by BasePool
 */
export interface PooledSprite extends Phaser.Physics.Arcade.Sprite {
  /** Get the time this sprite was spawned/activated */
  getSpawnTime?(): number;
  /** Deactivate and return to pool */
  deactivate(): void;
}

/**
 * Configuration for BasePool
 */
export interface BasePoolConfig<T extends PooledSprite> {
  scene: Phaser.Scene;
  classType: new (...args: unknown[]) => T;
  maxSize: number;
  runChildUpdate?: boolean;
  createTexture?: boolean;
}

/**
 * BasePool - Abstract base class for object pools
 *
 * Provides common functionality for BulletPool, EnemyBulletPool, GoldPool,
 * HealthPool, BombPool, and SpiritCatPool.
 */
export abstract class BasePool<T extends PooledSprite> extends Phaser.Physics.Arcade.Group {
  protected poolScene: Phaser.Scene;

  constructor(config: BasePoolConfig<T>) {
    super(config.scene.physics.world, config.scene, {
      classType: config.classType,
      maxSize: config.maxSize,
      runChildUpdate: config.runChildUpdate ?? true,
    });

    this.poolScene = config.scene;

    // Create texture if needed
    if (config.createTexture !== false) {
      this.createTexture();
    }
  }

  /**
   * Override to create custom texture for pool items
   * Default implementation does nothing
   */
  protected createTexture(): void {
    // Override in subclass if needed
  }

  /**
   * Recycle the oldest active item when pool is exhausted
   * @param minAge Minimum age in ms before an item can be recycled
   * @returns The recycled item or null
   */
  protected recycleOldest(minAge: number = 500): T | null {
    let oldest: T | null = null;
    let oldestSpawnTime = Infinity;
    const currentTime = this.poolScene.time.now;

    this.children.iterate((child) => {
      const item = child as T;
      if (item.active && item.getSpawnTime) {
        const spawnTime = item.getSpawnTime();
        const itemAge = currentTime - spawnTime;
        if (itemAge >= minAge && spawnTime < oldestSpawnTime) {
          oldestSpawnTime = spawnTime;
          oldest = item;
        }
      }
      return true;
    });

    if (oldest !== null) {
      (oldest as T).deactivate();
      return oldest;
    }
    return null;
  }

  /**
   * Get count of active items in the pool
   */
  getActiveCount(): number {
    let count = 0;
    this.children.iterate((child) => {
      if (child.active) count++;
      return true;
    });
    return count;
  }

  /**
   * Deactivate all items in the pool
   */
  cleanup(): void {
    this.children.iterate((child) => {
      const item = child as T;
      if (item.active) {
        item.deactivate();
      }
      return true;
    });
  }

  /**
   * Get an item from the pool
   */
  protected getFromPool(x: number, y: number): T | null {
    let item = this.get(x, y) as T | null;

    // If pool is exhausted, try to recycle oldest
    if (!item) {
      item = this.recycleOldest();
    }

    return item;
  }
}

export default BasePool;
