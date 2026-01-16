/**
 * SpreaderEnemy - Stationary enemy that fires projectiles in 4 cardinal directions
 *
 * Behavior:
 * - Stationary (doesn't move)
 * - Fires spread pattern in 4 cardinal directions periodically
 */

import Phaser from 'phaser'
import RangedEnemy from './RangedEnemy'
import { EnemyOptions, EnemyUpdateResult } from '../Enemy'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getEnemySpriteKey } from '../../config/themeData'

export default class SpreaderEnemy extends RangedEnemy {
  private hasValidatedPosition: boolean = false

  // Hopping movement state
  private isHopping: boolean = false
  private hopCooldown: number = 2500 // Time between hops
  private lastHopTime: number = 0
  private hopDuration: number = 400 // How long the hop takes
  private hopStartTime: number = 0
  private hopStartX: number = 0
  private hopStartY: number = 0
  private hopTargetX: number = 0
  private hopTargetY: number = 0

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
    const spriteKey = getEnemySpriteKey('spreader')
    this.setTexture(spriteKey)
    this.setDisplaySize(36, 36) // Slightly larger than others

    console.log('SpreaderEnemy created at', x, y)
  }

  update(time: number, _delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    if (!this.active || !this.body) {
      return { died: false, dotDamage: 0 }
    }

    // On first update with wall group, validate position and push out of walls
    if (!this.hasValidatedPosition && this.wallGroup) {
      this.hasValidatedPosition = true
      this.pushOutOfWalls()
    }

    // Update fire DOT from parent class
    const effectResult = super.update(time, _delta, playerX, playerY)
    if (effectResult.died) {
      return effectResult
    }

    // Handle hopping movement
    if (this.isHopping) {
      this.updateHop(time)
    } else {
      // Stationary when not hopping
      this.setVelocity(0, 0)

      // Check if we should start a new hop
      if (time - this.lastHopTime > this.hopCooldown) {
        this.startHop(time, playerX, playerY)
      }
    }

    // Fire 4-direction spread periodically (only when not hopping)
    if (!this.isHopping && this.canFire(time)) {
      this.shootSpread()
      this.recordShot(time)
    }

    // Ensure enemy stays within world bounds
    this.clampToWorldBounds(18)

    return effectResult
  }

  /**
   * Start a hop to a new position
   */
  private startHop(time: number, playerX: number, playerY: number): void {
    this.isHopping = true
    this.hopStartTime = time
    this.hopStartX = this.x
    this.hopStartY = this.y

    // Calculate hop direction - tend to hop away from player or to a random nearby position
    const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)
    const hopDistance = 40 + Math.random() * 30 // 40-70 pixels

    let hopAngle: number
    if (distToPlayer < 120) {
      // Too close to player - hop away
      hopAngle = Phaser.Math.Angle.Between(playerX, playerY, this.x, this.y)
      hopAngle += (Math.random() - 0.5) * Math.PI * 0.5 // Add some randomness
    } else {
      // Random direction
      hopAngle = Math.random() * Math.PI * 2
    }

    // Calculate target position
    let targetX = this.x + Math.cos(hopAngle) * hopDistance
    let targetY = this.y + Math.sin(hopAngle) * hopDistance

    // Clamp to world bounds with margin
    const worldBounds = this.scene.physics.world.bounds
    const margin = 30
    targetX = Phaser.Math.Clamp(targetX, worldBounds.left + margin, worldBounds.right - margin)
    targetY = Phaser.Math.Clamp(targetY, worldBounds.top + margin, worldBounds.bottom - margin)

    // Check if target is in a wall, if so try alternate positions
    if (this.isPositionBlockedByWall(targetX, targetY)) {
      // Try a few alternate angles
      for (let i = 0; i < 4; i++) {
        const altAngle = hopAngle + (Math.PI / 2) * (i + 1)
        const altX = this.x + Math.cos(altAngle) * hopDistance
        const altY = this.y + Math.sin(altAngle) * hopDistance
        const clampedAltX = Phaser.Math.Clamp(altX, worldBounds.left + margin, worldBounds.right - margin)
        const clampedAltY = Phaser.Math.Clamp(altY, worldBounds.top + margin, worldBounds.bottom - margin)

        if (!this.isPositionBlockedByWall(clampedAltX, clampedAltY)) {
          targetX = clampedAltX
          targetY = clampedAltY
          break
        }
      }
    }

    this.hopTargetX = targetX
    this.hopTargetY = targetY

    // Visual feedback - squash before jump
    this.scene.tweens.add({
      targets: this,
      scaleY: 0.7,
      scaleX: 1.3,
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
    })
  }

  /**
   * Update hop animation
   */
  private updateHop(time: number): void {
    const elapsed = time - this.hopStartTime
    const progress = Math.min(elapsed / this.hopDuration, 1)

    // Ease in-out for smooth movement
    const easedProgress = progress < 0.5
      ? 2 * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 2) / 2

    // Interpolate position
    this.x = Phaser.Math.Linear(this.hopStartX, this.hopTargetX, easedProgress)
    this.y = Phaser.Math.Linear(this.hopStartY, this.hopTargetY, easedProgress)

    // Add a jump arc effect using scale (squash/stretch)
    const arcHeight = Math.sin(progress * Math.PI)
    this.setScale(1 - arcHeight * 0.2, 1 + arcHeight * 0.3)

    // Finish hop
    if (progress >= 1) {
      this.isHopping = false
      this.lastHopTime = time
      this.setScale(1, 1)

      // Landing squash effect
      this.scene.tweens.add({
        targets: this,
        scaleY: 0.8,
        scaleX: 1.2,
        duration: 60,
        yoyo: true,
        ease: 'Quad.easeOut',
      })
    }
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
