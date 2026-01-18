import Phaser from "phaser";
import OrbitalShield from "../entities/OrbitalShield";

/**
 * OrbitalShieldPool - Object pool for orbital shields
 */
export default class OrbitalShieldPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: OrbitalShield,
      maxSize: 3, // Max 3 shields
      runChildUpdate: false, // We update manually
    });
  }

  /**
   * Spawn or get a shield for the given orbit index
   */
  getShield(orbitIndex: number): OrbitalShield | null {
    // First check if we already have a shield at this index
    let existingShield: OrbitalShield | null = null;
    this.children.iterate((child) => {
      const shield = child as OrbitalShield;
      if (shield.active && shield.getOrbitIndex() === orbitIndex) {
        existingShield = shield;
      }
      return true;
    });

    if (existingShield) {
      return existingShield;
    }

    // Get a new shield from pool
    const shield = this.get(0, 0) as OrbitalShield | null;
    if (shield) {
      shield.activate(orbitIndex);
    }
    return shield;
  }

  /**
   * Update all active shields
   */
  updateAll(playerX: number, playerY: number, time: number, totalShields: number): void {
    this.children.iterate((child) => {
      const shield = child as OrbitalShield;
      if (shield.active) {
        shield.updateOrbitPosition(playerX, playerY, time, totalShields);
      }
      return true;
    });
  }

  /**
   * Get the number of active shields
   */
  getActiveCount(): number {
    let count = 0;
    this.children.iterate((child) => {
      if ((child as OrbitalShield).active) {
        count++;
      }
      return true;
    });
    return count;
  }

  /**
   * Sync shields to target count, spawning new ones if needed
   */
  syncShieldCount(targetCount: number): void {
    const activeCount = this.getActiveCount();

    // Spawn new shields if needed
    for (let i = activeCount; i < targetCount; i++) {
      this.getShield(i);
    }

    // Deactivate excess if target count decreased
    if (activeCount > targetCount) {
      const shields: OrbitalShield[] = [];
      this.children.iterate((child) => {
        const shield = child as OrbitalShield;
        if (shield.active) {
          shields.push(shield);
        }
        return true;
      });

      shields.sort((a, b) => a.getOrbitIndex() - b.getOrbitIndex());
      while (shields.length > targetCount) {
        const shield = shields.pop();
        shield?.deactivate();
      }
    }
  }
}
