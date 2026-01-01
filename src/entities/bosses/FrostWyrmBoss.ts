import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getBossDefinition } from '../../config/bossData'

/**
 * Frost Wyrm Boss - Chapter 3 Frozen Caves
 *
 * Attack Patterns:
 * 1. Dive Attack - Disappears off-screen then dives at player
 * 2. Ice Barrage - Rapid fire of ice projectiles
 * 3. Freezing Roar - Player frozen for 1 second if in range
 */
export default class FrostWyrmBoss extends BaseBoss {
  // Dive attack
  private diveTarget: { x: number; y: number } = { x: 0, y: 0 }
  private diveTrail: Phaser.GameObjects.Arc[] = []
  private diveShadow: Phaser.GameObjects.Ellipse | null = null

  // Ice barrage attack
  private barrageProjectilesFired: number = 0
  private readonly maxBarrageProjectiles = 12
  private lastBarrageTime: number = 0
  private readonly barrageInterval = 150 // ms between shots

  // Freezing roar attack
  private roarWave: Phaser.GameObjects.Arc | null = null
  private readonly roarRange = 120
  private roarDamageApplied: boolean = false

  // Freeze player callback
  private onFreezePlayer?: (duration: number) => void

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, getBossDefinition('frost_wyrm'), options)

    // Wyrm is more serpentine
    this.setDisplaySize(72, 48) // Wider than tall
  }

  /**
   * Set callback for freezing player (called by GameScene)
   */
  setFreezePlayerCallback(callback: (duration: number) => void): void {
    this.onFreezePlayer = callback
  }

  protected selectAttackPhase(pattern: number, _playerX: number, _playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'dive_attack'
        break
      case 1:
        this.phase = 'ice_barrage'
        break
      case 2:
        this.phase = 'freezing_roar'
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    this.handleCustomPhase(time, playerX, playerY)
  }

  protected handleIdlePhase(time: number, _playerX: number, _playerY: number): void {
    // Wyrm moves in serpentine pattern
    const centerX = 375 / 2
    const centerY = 667 / 3

    const sineOffset = Math.sin(time / 400) * 60
    const targetX = centerX + sineOffset
    const targetY = centerY + Math.cos(time / 600) * 30

    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    const speed = 60 // Base speed for wyrm

    this.setVelocity(
      Math.cos(angle) * speed * 0.5,
      Math.sin(angle) * speed * 0.5
    )

    // Rotate to face movement direction
    const targetRotation = angle + Math.PI / 2
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetRotation, 0.05)

    // Start next attack after cooldown
    if (time - this.lastAttackTime > this.attackCooldown) {
      this.startNextAttack(time, _playerX, _playerY)
    }
  }

  protected handleCustomPhase(time: number, playerX: number, playerY: number): void {
    switch (this.phase) {
      // Dive Attack
      case 'dive_attack':
        this.handleDiveWindup(time, playerX, playerY)
        break
      case 'dive_rising':
        this.handleDiveRising(time)
        break
      case 'dive_falling':
        this.handleDiveFalling(time)
        break
      case 'dive_landing':
        this.handleDiveLanding(time)
        break

      // Ice Barrage Attack
      case 'ice_barrage':
        this.handleIceBarrage(time, playerX, playerY)
        break

      // Freezing Roar Attack
      case 'freezing_roar':
        this.handleFreezingRoarWindup(time)
        break
      case 'roar_active':
        this.handleRoarActive(time, playerX, playerY)
        break

      default:
        this.finishAttack(time)
    }
  }

  protected onAttackStart(patternName: string): void {
    if (patternName === 'ice_barrage') {
      this.barrageProjectilesFired = 0
      this.lastBarrageTime = 0
    }
  }

  // ==========================================
  // Dive Attack
  // ==========================================

  private handleDiveWindup(time: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)
    const windupDuration = 500

    const elapsed = time - this.phaseStartTime

    // Mark target position
    this.diveTarget = { x: playerX, y: playerY }

    // Create/update shadow at target
    if (!this.diveShadow) {
      this.diveShadow = this.scene.add.ellipse(playerX, playerY, 60, 30, 0x000000, 0.3)
      this.diveShadow.setDepth(0)
    }
    this.diveShadow.setPosition(playerX, playerY)

    // Pulsing shadow
    const pulse = 1 + Math.sin(time / 50) * 0.2
    this.diveShadow.setScale(pulse)

    // Warning effect on boss
    this.showWarningPulse(elapsed)
    this.setScale(1 + (elapsed / windupDuration) * 0.2)

    if (elapsed >= windupDuration) {
      this.clearWarningPulse()
      this.phase = 'dive_rising'
      this.phaseStartTime = time
    }
  }

  private handleDiveRising(time: number): void {
    const riseDuration = 400
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / riseDuration

    // Rise up and fade out
    this.y -= 5
    this.setAlpha(1 - progress)
    this.setScale(1.2 - progress * 0.5)

    // Update shadow to grow
    if (this.diveShadow) {
      this.diveShadow.setScale(0.5 + progress * 0.5)
      this.diveShadow.setAlpha(0.2 + progress * 0.3)
    }

    if (progress >= 1) {
      this.setVisible(false)
      this.phase = 'dive_falling'
      this.phaseStartTime = time

      // Move to above target
      this.x = this.diveTarget.x
      this.y = this.diveTarget.y - 200
    }
  }

  private handleDiveFalling(time: number): void {
    const fallDuration = 300 // Quick dive
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / fallDuration

    // Show again as diving
    if (progress > 0.2 && !this.visible) {
      this.setVisible(true)
      this.setAlpha(progress)
      this.setScale(0.5 + progress * 0.7)
    }

    // Dive toward target
    const startY = this.diveTarget.y - 200
    this.y = startY + (this.diveTarget.y - startY + 20) * progress

    // Rotation pointing down
    this.rotation = Math.PI / 2

    // Speed trail
    if (elapsed % 30 < 16) {
      const trail = this.scene.add.circle(
        this.x + Phaser.Math.Between(-10, 10),
        this.y - 20,
        8,
        0x87ceeb,
        0.6
      )
      trail.setDepth(4)
      this.diveTrail.push(trail)

      this.scene.tweens.add({
        targets: trail,
        alpha: 0,
        scale: 0.5,
        y: trail.y - 30,
        duration: 200,
        onComplete: () => {
          const index = this.diveTrail.indexOf(trail)
          if (index !== -1) this.diveTrail.splice(index, 1)
          trail.destroy()
        }
      })
    }

    // Shadow shrinking as wyrm approaches
    if (this.diveShadow) {
      this.diveShadow.setScale(1 - progress * 0.5)
    }

    if (progress >= 1) {
      this.phase = 'dive_landing'
      this.phaseStartTime = time
      this.y = this.diveTarget.y

      // Impact effect
      this.scene.cameras.main.shake(200, 0.02)
    }
  }

  private handleDiveLanding(time: number): void {
    const landDuration = 300
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / landDuration

    // Recovery animation
    this.setAlpha(1)
    this.setScale(1)
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, 0, 0.1)

    // Impact wave
    if (progress < 0.5) {
      const wave = this.scene.add.circle(this.x, this.y, 20 + progress * 100, 0x87ceeb, 0)
      wave.setStrokeStyle(3, 0x87ceeb, 0.5 - progress)
      wave.setDepth(0)
      this.scene.tweens.add({
        targets: wave,
        alpha: 0,
        duration: 100,
        onComplete: () => wave.destroy()
      })
    }

    // Clean up shadow
    if (this.diveShadow) {
      this.diveShadow.destroy()
      this.diveShadow = null
    }

    if (progress >= 1) {
      this.finishAttack(time)
    }
  }

  // ==========================================
  // Ice Barrage Attack
  // ==========================================

  private handleIceBarrage(time: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Initial windup
    if (this.barrageProjectilesFired === 0 && time - this.phaseStartTime < 300) {
      this.showWarningPulse(time - this.phaseStartTime)
      return
    }
    this.clearWarningPulse()

    // Fire projectiles rapidly
    if (
      this.barrageProjectilesFired < this.maxBarrageProjectiles &&
      time - this.lastBarrageTime > this.barrageInterval
    ) {
      const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)

      // Add some spread/randomness
      const spread = (Math.random() - 0.5) * 0.4 // +/- 0.2 radians
      const speed = 250 + Math.random() * 50

      this.bulletPool.spawn(this.x, this.y, baseAngle + spread, speed)

      // Muzzle flash effect
      const flash = this.scene.add.circle(
        this.x + Math.cos(baseAngle) * 30,
        this.y + Math.sin(baseAngle) * 30,
        10,
        0x87ceeb,
        0.8
      )
      flash.setDepth(5)
      this.scene.tweens.add({
        targets: flash,
        scale: 0,
        alpha: 0,
        duration: 100,
        onComplete: () => flash.destroy()
      })

      this.barrageProjectilesFired++
      this.lastBarrageTime = time

      // Slight recoil
      this.x -= Math.cos(baseAngle) * 3
      this.y -= Math.sin(baseAngle) * 3
    }

    // Done firing
    if (this.barrageProjectilesFired >= this.maxBarrageProjectiles) {
      this.finishAttack(time)
    }
  }

  // ==========================================
  // Freezing Roar Attack
  // ==========================================

  private handleFreezingRoarWindup(time: number): void {
    this.setVelocity(0, 0)
    const windupDuration = 600

    const elapsed = time - this.phaseStartTime
    const progress = elapsed / windupDuration

    // Inhale effect
    this.setScale(1 + progress * 0.3)
    this.setTint(0x4169e1) // Deep blue

    // Gathering frost particles
    if (elapsed % 60 < 16) {
      const angle = Math.random() * Math.PI * 2
      const distance = 100
      const particle = this.scene.add.circle(
        this.x + Math.cos(angle) * distance,
        this.y + Math.sin(angle) * distance,
        5,
        0x87ceeb,
        0.8
      )
      particle.setDepth(5)

      this.scene.tweens.add({
        targets: particle,
        x: this.x,
        y: this.y,
        scale: 0,
        duration: 300,
        onComplete: () => particle.destroy()
      })
    }

    if (elapsed >= windupDuration) {
      this.setScale(1)
      this.clearWarningPulse()
      this.phase = 'roar_active'
      this.phaseStartTime = time
      this.roarDamageApplied = false

      // Create roar wave
      this.roarWave = this.scene.add.arc(this.x, this.y, 10, 0, 360, false, 0x4169e1, 0.4)
      this.roarWave.setStrokeStyle(4, 0xffffff, 0.8)
      this.roarWave.setDepth(5)

      // Screen shake
      this.scene.cameras.main.shake(150, 0.01)
    }
  }

  private handleRoarActive(time: number, playerX: number, playerY: number): void {
    const roarDuration = 400
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / roarDuration

    // Expand roar wave
    if (this.roarWave) {
      const currentRadius = 10 + this.roarRange * progress
      this.roarWave.setRadius(currentRadius)
      this.roarWave.setPosition(this.x, this.y)
      this.roarWave.setAlpha(0.4 - progress * 0.3)
    }

    // Check if player is in range
    if (!this.roarDamageApplied) {
      const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)
      if (distToPlayer <= this.roarRange * progress) {
        this.roarDamageApplied = true

        // Freeze player for 1 second
        if (this.onFreezePlayer) {
          this.onFreezePlayer(1000)
        }
      }
    }

    // Frost particles expanding outward
    if (elapsed % 50 < 16) {
      const angle = Math.random() * Math.PI * 2
      const dist = this.roarRange * progress
      const particle = this.scene.add.star(
        this.x + Math.cos(angle) * dist,
        this.y + Math.sin(angle) * dist,
        6, 3, 6, 0x87ceeb, 0.7
      )
      particle.setDepth(4)
      this.scene.tweens.add({
        targets: particle,
        alpha: 0,
        scale: 0.5,
        x: particle.x + Math.cos(angle) * 20,
        y: particle.y + Math.sin(angle) * 20,
        duration: 200,
        onComplete: () => particle.destroy()
      })
    }

    if (elapsed >= roarDuration) {
      // Clean up
      if (this.roarWave) {
        this.roarWave.destroy()
        this.roarWave = null
      }
      this.finishAttack(time)
    }
  }

  /**
   * Get roar info for external damage/freeze check
   */
  getRoarInfo(): { active: boolean; x: number; y: number; radius: number } {
    const progress = this.phase === 'roar_active'
      ? (this.scene.time.now - this.phaseStartTime) / 400
      : 0
    return {
      active: this.phase === 'roar_active',
      x: this.x,
      y: this.y,
      radius: this.roarRange * progress
    }
  }

  destroy(fromScene?: boolean): void {
    this.diveTrail.forEach(trail => trail.destroy())
    this.diveTrail = []
    if (this.diveShadow) {
      this.diveShadow.destroy()
      this.diveShadow = null
    }
    if (this.roarWave) {
      this.roarWave.destroy()
      this.roarWave = null
    }
    super.destroy(fromScene)
  }
}
