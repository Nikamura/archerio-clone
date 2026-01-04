/**
 * SpreaderEnemy - Stationary enemy that fires projectiles in 4 cardinal directions
 *
 * Behavior:
 * - Stationary (doesn't move)
 * - Fires spread pattern in 4 cardinal directions periodically
 */

import Phaser from 'phaser'
import RangedEnemy from './RangedEnemy'
import { EnemyOptions } from '../Enemy'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getEnemySpriteKey } from '../../config/themeData'
import { themeManager } from '../../systems/ThemeManager'

export default class SpreaderEnemy extends RangedEnemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: EnemyOptions
  ) {
    // Base fire rate is 3000ms
    super(scene, x, y, bulletPool, 3000, options)

    // Use themed spreader enemy sprite
    const spriteKey = getEnemySpriteKey('spreader', themeManager.getAssets())
    this.setTexture(spriteKey)
    this.setDisplaySize(36, 36) // Slightly larger than others

    console.log('SpreaderEnemy created at', x, y)
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update fire DOT from parent class
    const diedFromFire = super.update(time, _delta, playerX, playerY)
    if (diedFromFire) {
      return true
    }

    // Spreader is stationary
    this.setVelocity(0, 0)

    // Fire 4-direction spread periodically
    if (this.canFire(time)) {
      this.shootSpread()
      this.recordShot(time)
    }

    // Ensure enemy stays within world bounds
    this.clampToWorldBounds(18)

    return false
  }

  private shootSpread() {
    // Fire in 4 cardinal directions
    const directions = [
      0, // Right
      Math.PI / 2, // Down
      Math.PI, // Left
      (Math.PI * 3) / 2, // Up
    ]

    const baseSpeed = 150
    this.fireSpread(directions, baseSpeed)
  }
}
