import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { EnemyUpdateResult } from '../Enemy'

type LavaGolemPhase = 'idle' | 'lava_pool' | 'meteor_shower' | 'fire_wave'

/**
 * Chapter 4 Boss 1: Lava Golem
 * A fire elemental that controls lava and fire.
 *
 * Attack Patterns:
 * 1. Lava Pool Creation - Creates DOT zones that damage the player
 * 2. Meteor Shower - Random falling projectiles across the arena
 * 3. Fire Wave - Expanding ring of fire
 */
export default class LavaGolemBoss extends BaseBoss {
  protected phase: LavaGolemPhase = 'idle'

  // Lava pool tracking
  private lavaPools: Phaser.GameObjects.Graphics[] = []
  private lavaPoolPositions: { x: number; y: number; createdAt: number }[] = []
  private lavaPoolDuration: number = 5000 // 5 seconds
  private lavaPoolRadius: number = 40

  // Meteor shower tracking
  private meteorTargets: { x: number; y: number }[] = []
  private meteorsFired: number = 0
  private meteorsTotal: number = 8

  // Fire wave tracking
  private fireWaveRadius: number = 0
  private fireWaveMaxRadius: number = 300
  private fireWaveSpeed: number = 150 // pixels per second

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, 'boss_lava_golem', options)

    this.baseHealth = 250
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0))
    this.bossHealth = this.bossMaxHealth
    this.attackCooldown = 2500
    this.attackPatternCount = 3
    this.displaySize = 72

    this.setDisplaySize(this.displaySize, this.displaySize)
  }

  protected getPlaceholderColor(): number {
    return 0xff4500 // Orange-red for lava golem
  }

  protected selectAttackPhase(pattern: number, _playerX: number, _playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'lava_pool'
        break
      case 1:
        this.phase = 'meteor_shower'
        this.prepareMeteorShower()
        break
      case 2:
        this.phase = 'fire_wave'
        this.fireWaveRadius = 0
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime

    switch (this.phase) {
      case 'lava_pool':
        this.handleLavaPoolPhase(time, elapsed, playerX, playerY)
        break
      case 'meteor_shower':
        this.handleMeteorShowerPhase(time, elapsed)
        break
      case 'fire_wave':
        this.handleFireWavePhase(time, elapsed)
        break
    }
  }

  private handleLavaPoolPhase(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Telegraph phase (0-500ms)
    if (elapsed < 500) {
      this.pulseWarning(elapsed, 100)
      return
    }

    // Create lava pools near player position
    if (elapsed >= 500 && elapsed < 600) {
      this.clearTint()

      // Create 3 lava pools in a triangle around player
      const offsets = [
        { x: 0, y: -50 },
        { x: -40, y: 40 },
        { x: 40, y: 40 },
      ]

      for (const offset of offsets) {
        const poolX = Phaser.Math.Clamp(playerX + offset.x, 50, 325)
        const poolY = Phaser.Math.Clamp(playerY + offset.y, 100, 600)
        this.createLavaPool(poolX, poolY, time)
      }
    }

    // Finish attack after pools are created
    if (elapsed > 700) {
      this.finishAttack(time)
    }
  }

  private createLavaPool(x: number, y: number, time: number): void {
    const pool = this.scene.add.graphics()
    pool.setDepth(0)

    // Draw lava pool with glowing effect
    pool.fillStyle(0xff2200, 0.6)
    pool.fillCircle(x, y, this.lavaPoolRadius)
    pool.lineStyle(2, 0xff6600, 0.8)
    pool.strokeCircle(x, y, this.lavaPoolRadius)

    // Inner glow
    pool.fillStyle(0xffaa00, 0.4)
    pool.fillCircle(x, y, this.lavaPoolRadius * 0.6)

    this.lavaPools.push(pool)
    this.lavaPoolPositions.push({ x, y, createdAt: time })
  }

  private prepareMeteorShower(): void {
    this.meteorsFired = 0
    this.meteorTargets = []

    // Generate random target positions for meteors
    for (let i = 0; i < this.meteorsTotal; i++) {
      this.meteorTargets.push({
        x: Phaser.Math.Between(50, 325),
        y: Phaser.Math.Between(100, 550),
      })
    }
  }

  private handleMeteorShowerPhase(time: number, elapsed: number): void {
    this.setVelocity(0, 0)

    // Telegraph phase - show all meteor targets
    if (elapsed < 800) {
      this.clearTelegraphs()
      const alpha = 0.3 + (elapsed / 800) * 0.4
      for (const target of this.meteorTargets) {
        this.drawTelegraphCircle(target.x, target.y, 25, alpha)
      }
      return
    }

    // Fire meteors one by one
    const fireInterval = 150 // ms between each meteor
    const expectedFired = Math.floor((elapsed - 800) / fireInterval)

    while (this.meteorsFired < expectedFired && this.meteorsFired < this.meteorsTotal) {
      const target = this.meteorTargets[this.meteorsFired]
      // Fire a meteor (projectile from above the target)
      this.bulletPool.spawn(target.x, target.y - 100, Math.PI / 2, 300)
      this.meteorsFired++
    }

    // Finish after all meteors fired
    if (elapsed > 800 + this.meteorsTotal * fireInterval + 200) {
      this.clearTelegraphs()
      this.finishAttack(time)
    }
  }

  private handleFireWavePhase(time: number, elapsed: number): void {
    this.setVelocity(0, 0)

    // Charge up phase
    if (elapsed < 600) {
      this.pulseWarning(elapsed, 80)
      // Show expanding circle telegraph
      const previewRadius = (elapsed / 600) * 50
      this.clearTelegraphs()
      this.drawTelegraphCircle(this.x, this.y, previewRadius, 0.5)
      return
    }

    this.clearTint()

    // Expand fire wave
    const delta = (elapsed - 600) / 1000 * this.fireWaveSpeed
    this.fireWaveRadius = Math.min(delta * 2, this.fireWaveMaxRadius)

    // Draw expanding fire ring
    this.clearTelegraphs()
    if (this.telegraphGraphics) {
      this.telegraphGraphics.lineStyle(8, 0xff4400, 0.7)
      this.telegraphGraphics.strokeCircle(this.x, this.y, this.fireWaveRadius)
      this.telegraphGraphics.lineStyle(4, 0xffaa00, 0.9)
      this.telegraphGraphics.strokeCircle(this.x, this.y, this.fireWaveRadius - 4)
    }

    // Fire projectiles at the edge of the wave periodically
    if (elapsed % 100 < 20 && this.fireWaveRadius > 20 && this.fireWaveRadius < this.fireWaveMaxRadius) {
      this.fireSpread(8, 150, (elapsed / 50))
    }

    // Finish when wave reaches max radius
    if (this.fireWaveRadius >= this.fireWaveMaxRadius) {
      this.clearTelegraphs()
      this.finishAttack(time)
    }
  }

  update(time: number, delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    const effectResult = super.update(time, delta, playerX, playerY)

    // Update lava pools - check for expiration and player damage
    this.updateLavaPools(time, playerX, playerY)

    return effectResult
  }

  private updateLavaPools(time: number, playerX: number, playerY: number): void {
    // Check each pool for expiration
    for (let i = this.lavaPoolPositions.length - 1; i >= 0; i--) {
      const pool = this.lavaPoolPositions[i]
      const age = time - pool.createdAt

      if (age > this.lavaPoolDuration) {
        // Remove expired pool
        this.lavaPools[i]?.destroy()
        this.lavaPools.splice(i, 1)
        this.lavaPoolPositions.splice(i, 1)
        continue
      }

      // Check if player is in pool (for visual feedback)
      const distToPlayer = Phaser.Math.Distance.Between(pool.x, pool.y, playerX, playerY)
      if (distToPlayer < this.lavaPoolRadius) {
        // Player is in lava - fire a bullet at them to deal damage
        // Only do this occasionally to prevent overwhelming damage
        if (Math.random() < 0.02) { // ~2% chance per frame
          const angle = Math.random() * Math.PI * 2
          this.bulletPool.spawn(pool.x + Math.cos(angle) * 10, pool.y + Math.sin(angle) * 10,
            Phaser.Math.Angle.Between(pool.x, pool.y, playerX, playerY), 50)
        }
      }

      // Fade out pools as they expire
      if (this.lavaPools[i] && age > this.lavaPoolDuration * 0.7) {
        const fadeAlpha = 1 - ((age - this.lavaPoolDuration * 0.7) / (this.lavaPoolDuration * 0.3))
        this.lavaPools[i].setAlpha(fadeAlpha)
      }
    }
  }

  destroy(fromScene?: boolean): void {
    // Clean up lava pools
    for (const pool of this.lavaPools) {
      pool?.destroy()
    }
    this.lavaPools = []
    this.lavaPoolPositions = []

    super.destroy(fromScene)
  }
}
