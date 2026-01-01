import Phaser from 'phaser'
import BombProjectile from '../entities/BombProjectile'

export default class BombPool extends Phaser.Physics.Arcade.Group {
  private damageMultiplier: number = 1.0

  constructor(scene: Phaser.Scene) {
    super(scene.physics.world, scene, {
      classType: BombProjectile,
      maxSize: 20,
      runChildUpdate: true,
    })
  }

  setDamageMultiplier(multiplier: number) {
    this.damageMultiplier = multiplier
  }

  spawn(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    speed: number = 150,
    onExplode?: (x: number, y: number, radius: number, damage: number) => void
  ): BombProjectile | null {
    const bomb = this.get(x, y) as BombProjectile
    if (bomb) {
      bomb.setDamageMultiplier(this.damageMultiplier)
      if (onExplode) {
        bomb.setOnExplode(onExplode)
      }
      bomb.fire(x, y, targetX, targetY, speed)
    }
    return bomb
  }
}
