import Phaser from "phaser";
import RotatingOrb from "../entities/RotatingOrb";

/**
 * RotatingOrbPool - Object pool for rotating orbs
 */
export default class RotatingOrbPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: RotatingOrb,
      maxSize: 5, // Max 5 orbs
      runChildUpdate: false, // We update manually
    });
  }

  /**
   * Spawn or get an orb for the given orbit index
   */
  getOrb(orbitIndex: number, damage: number): RotatingOrb | null {
    // First check if we already have an orb at this index
    let existingOrb: RotatingOrb | null = null;
    this.children.iterate((child) => {
      const orb = child as RotatingOrb;
      if (orb.active && orb.getOrbitIndex() === orbitIndex) {
        existingOrb = orb;
      }
      return true;
    });

    if (existingOrb) {
      return existingOrb;
    }

    // Get a new orb from pool
    const orb = this.get(0, 0) as RotatingOrb | null;
    if (orb) {
      orb.activate(orbitIndex, damage);
    }
    return orb;
  }

  /**
   * Update all active orbs
   */
  updateAll(playerX: number, playerY: number, time: number, totalOrbs: number): void {
    this.children.iterate((child) => {
      const orb = child as RotatingOrb;
      if (orb.active) {
        orb.updateOrbitPosition(playerX, playerY, time, totalOrbs);
      }
      return true;
    });
  }

  /**
   * Get the number of active orbs
   */
  getActiveCount(): number {
    let count = 0;
    this.children.iterate((child) => {
      if ((child as RotatingOrb).active) {
        count++;
      }
      return true;
    });
    return count;
  }

  /**
   * Deactivate excess orbs if orb count decreased
   */
  syncOrbCount(targetCount: number): void {
    const activeOrbs: RotatingOrb[] = [];
    this.children.iterate((child) => {
      const orb = child as RotatingOrb;
      if (orb.active) {
        activeOrbs.push(orb);
      }
      return true;
    });

    // Sort by orbit index
    activeOrbs.sort((a, b) => a.getOrbitIndex() - b.getOrbitIndex());

    // Deactivate excess
    while (activeOrbs.length > targetCount) {
      const orb = activeOrbs.pop();
      orb?.deactivate();
    }
  }
}
