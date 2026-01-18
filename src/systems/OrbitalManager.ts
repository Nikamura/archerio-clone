import Phaser from "phaser";
import Player from "../entities/Player";
import RotatingOrbPool from "./RotatingOrbPool";
import OrbitalShieldPool from "./OrbitalShieldPool";

/**
 * OrbitalManager - Manages rotating orbs and orbital shields around the player
 */
export class OrbitalManager {
  private player: Player;
  private rotatingOrbPool: RotatingOrbPool;
  private orbitalShieldPool: OrbitalShieldPool;

  // Track last known ability levels to detect changes
  private lastOrbCount: number = 0;
  private lastShieldCount: number = 0;

  constructor(scene: Phaser.Scene, player: Player) {
    this.player = player;
    this.rotatingOrbPool = new RotatingOrbPool(scene);
    this.orbitalShieldPool = new OrbitalShieldPool(scene);
  }

  /**
   * Update all orbital entities
   */
  update(time: number, _delta: number): void {
    const playerX = this.player.x;
    const playerY = this.player.y;

    // Check for ability level changes and spawn/despawn entities
    this.syncOrbs();
    this.syncShields();

    // Update positions
    const orbCount = this.player.getRotatingOrbCount();
    const shieldCount = this.player.getOrbitalShieldCount();

    if (orbCount > 0) {
      this.rotatingOrbPool.updateAll(playerX, playerY, time, orbCount);
    }

    if (shieldCount > 0) {
      this.orbitalShieldPool.updateAll(playerX, playerY, time, shieldCount);
    }
  }

  /**
   * Sync rotating orbs to player's ability level
   */
  private syncOrbs(): void {
    const targetCount = this.player.getRotatingOrbCount();

    if (targetCount !== this.lastOrbCount) {
      this.lastOrbCount = targetCount;

      // Calculate orb damage (50% of player damage)
      const orbDamage = Math.floor(this.player.getDamage() * 0.5);

      // Spawn orbs up to target count
      for (let i = 0; i < targetCount; i++) {
        this.rotatingOrbPool.getOrb(i, orbDamage);
      }

      // Remove excess orbs
      this.rotatingOrbPool.syncOrbCount(targetCount);
    }
  }

  /**
   * Sync orbital shields to player's ability level
   */
  private syncShields(): void {
    const targetCount = this.player.getOrbitalShieldCount();

    if (targetCount !== this.lastShieldCount) {
      this.lastShieldCount = targetCount;
      this.orbitalShieldPool.syncShieldCount(targetCount);
    }
  }

  /**
   * Get the rotating orb pool (for physics collisions)
   */
  getRotatingOrbPool(): RotatingOrbPool {
    return this.rotatingOrbPool;
  }

  /**
   * Get the orbital shield pool (for physics collisions)
   */
  getOrbitalShieldPool(): OrbitalShieldPool {
    return this.orbitalShieldPool;
  }

  /**
   * Clean up
   */
  destroy(): void {
    this.rotatingOrbPool.destroy(true);
    this.orbitalShieldPool.destroy(true);
  }
}
