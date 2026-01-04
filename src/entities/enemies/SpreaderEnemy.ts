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
  private hasValidatedPosition: boolean = false

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

    // On first update with wall group, validate position and push out of walls
    if (!this.hasValidatedPosition && this.wallGroup) {
      this.hasValidatedPosition = true
      this.pushOutOfWalls()
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

  /**
   * Push enemy out of walls if it spawned inside one.
   * Searches in cardinal directions for a valid position.
   */
  private pushOutOfWalls(): void {
    if (!this.isPositionBlockedByWall(this.x, this.y)) {
      return // Not inside a wall, nothing to do
    }

    console.log(`SpreaderEnemy: Spawned inside wall at (${this.x}, ${this.y}), finding valid position`)

    // Try to find a valid position by stepping in each direction
    const stepSize = 20
    const maxSteps = 10
    const directions = [
      { dx: 1, dy: 0 }, // Right
      { dx: -1, dy: 0 }, // Left
      { dx: 0, dy: 1 }, // Down
      { dx: 0, dy: -1 }, // Up
      { dx: 1, dy: 1 }, // Diagonal
      { dx: -1, dy: 1 },
      { dx: 1, dy: -1 },
      { dx: -1, dy: -1 },
    ]

    for (const dir of directions) {
      for (let step = 1; step <= maxSteps; step++) {
        const testX = this.x + dir.dx * stepSize * step
        const testY = this.y + dir.dy * stepSize * step

        // Check bounds
        if (testX < 30 || testX > 345 || testY < 30 || testY > 637) continue

        if (!this.isPositionBlockedByWall(testX, testY)) {
          console.log(`SpreaderEnemy: Moved to valid position (${testX}, ${testY})`)
          this.setPosition(testX, testY)
          return
        }
      }
    }

    console.warn('SpreaderEnemy: Could not find valid position, may be stuck in wall')
  }
}
