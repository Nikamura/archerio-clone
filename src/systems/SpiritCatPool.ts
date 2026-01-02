import Phaser from 'phaser'
import SpiritCat from '../entities/SpiritCat'
import Enemy from '../entities/Enemy'

export default class SpiritCatPool extends Phaser.Physics.Arcade.Group {
  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: SpiritCat,
      maxSize: 20, // Max cats at once (3 cats * ~6 cycles visible)
      runChildUpdate: true,
    })
  }

  spawn(
    x: number,
    y: number,
    target: Enemy,
    damage: number,
    canCrit: boolean
  ): SpiritCat | null {
    let cat = this.get(x, y) as SpiritCat | null

    // If pool is exhausted, recycle oldest
    if (!cat) {
      cat = this.recycleOldest()
    }

    if (cat) {
      cat.fire(x, y, target, damage, canCrit)
    }
    return cat
  }

  private recycleOldest(): SpiritCat | null {
    let oldest: SpiritCat | null = null
    let oldestSpawnTime = Infinity

    this.children.iterate((child) => {
      const cat = child as SpiritCat
      if (cat.active) {
        const spawnTime = cat.getSpawnTime()
        if (spawnTime < oldestSpawnTime) {
          oldestSpawnTime = spawnTime
          oldest = cat
        }
      }
      return true
    })

    if (oldest !== null) {
      (oldest as SpiritCat).deactivate()
      return oldest
    }
    return null
  }
}
