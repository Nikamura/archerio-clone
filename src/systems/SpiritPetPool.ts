import Phaser from "phaser";
import SpiritPet from "../entities/SpiritPet";
import Enemy from "../entities/Enemy";

/**
 * SpiritPetPool - Object pool for spirit pet wisps
 */
export default class SpiritPetPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: SpiritPet,
      maxSize: 25, // Max pets at once (5 pets * ~5 cycles visible)
      runChildUpdate: true,
    });
  }

  spawn(x: number, y: number, target: Enemy, damage: number, petIndex: number): SpiritPet | null {
    let pet = this.get(x, y) as SpiritPet | null;

    // If pool is exhausted, recycle oldest
    if (!pet) {
      pet = this.recycleOldest();
    }

    if (pet) {
      pet.fire(x, y, target, damage, petIndex);
    }
    return pet;
  }

  private recycleOldest(): SpiritPet | null {
    let oldest: SpiritPet | null = null;
    let oldestSpawnTime = Infinity;

    this.children.iterate((child) => {
      const pet = child as SpiritPet;
      if (pet.active) {
        const spawnTime = pet.getSpawnTime();
        if (spawnTime < oldestSpawnTime) {
          oldestSpawnTime = spawnTime;
          oldest = pet;
        }
      }
      return true;
    });

    if (oldest !== null) {
      (oldest as SpiritPet).deactivate();
      return oldest;
    }
    return null;
  }
}
