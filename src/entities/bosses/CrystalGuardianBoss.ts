import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getBossDefinition } from '../../config/bossData'

/**
 * Crystal Guardian Boss - Chapter 3 Frozen Caves
 *
 * Attack Patterns:
 * 1. Laser Beam - Sweeping laser beam attack
 * 2. Spawn Turrets - Creates crystal turrets that fire at player
 * 3. Crystal Shatter - Shatters when damaged, fragments hurt player
 */
export default class CrystalGuardianBoss extends BaseBoss {
  // Laser beam attack
  private laserBeam: Phaser.GameObjects.Graphics | null = null
  private laserAngle: number = 0
  private laserSweepDirection: number = 1
  private readonly laserLength = 400
  private readonly laserWidth = 8

  // Crystal turrets
  private turrets: CrystalTurret[] = []
  private readonly maxTurrets = 3
  private turretFireInterval = 1500 // ms between turret shots

  // Crystal shatter
  private fragments: Phaser.GameObjects.Polygon[] = []
  private readonly shatterThreshold = 0.25 // Shatter at every 25% health lost

  // Callback for damage from fragments
  private onFragmentHit?: () => void

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, getBossDefinition('crystal_guardian'), options)

    // Crystal appearance - more angular
    this.setDisplaySize(68, 68)
  }

  /**
   * Set callback for fragment damage (called by GameScene)
   */
  setFragmentHitCallback(callback: () => void): void {
    this.onFragmentHit = callback
  }

  takeDamage(amount: number): boolean {
    const previousHealth = this.bossHealth
    const result = super.takeDamage(amount)

    // Check if we crossed a shatter threshold
    if (!result) { // Still alive
      const previousPercent = previousHealth / this.bossMaxHealth
      const currentPercent = this.bossHealth / this.bossMaxHealth
      const threshold = Math.floor(previousPercent / this.shatterThreshold) * this.shatterThreshold
      const currentThreshold = Math.floor(currentPercent / this.shatterThreshold) * this.shatterThreshold

      if (currentThreshold < threshold) {
        this.triggerShatter()
      }
    }

    return result
  }

  protected selectAttackPhase(pattern: number, _playerX: number, _playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'laser_beam'
        break
      case 1:
        this.phase = 'spawn_turrets'
        break
      case 2:
        this.phase = 'crystal_shatter'
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    this.handleCustomPhase(time, playerX, playerY)
  }

  private handleCustomPhase(time: number, playerX: number, playerY: number): void {
    // Always update turrets
    this.updateTurrets(time, playerX, playerY)

    switch (this.phase) {
      // Laser Beam Attack
      case 'laser_beam':
        this.handleLaserWindup(time, playerX, playerY)
        break
      case 'laser_active':
        this.handleLaserActive(time)
        break

      // Spawn Turrets Attack
      case 'spawn_turrets':
        this.handleSpawnTurrets(time)
        break

      // Crystal Shatter Attack
      case 'crystal_shatter':
        this.handleCrystalShatter(time, playerX, playerY)
        break

      default:
        this.finishAttack(time)
    }

    // Update fragments
    this.updateFragments(time, playerX, playerY)
  }

  // ==========================================
  // Laser Beam Attack
  // ==========================================

  private handleLaserWindup(time: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)
    const windupDuration = 700

    const elapsed = time - this.phaseStartTime
    const progress = elapsed / windupDuration

    // Calculate initial laser direction toward player
    this.laserAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    // Start sweep from one side
    this.laserAngle -= Math.PI / 4
    this.laserSweepDirection = 1

    // Create/update laser telegraph
    if (!this.laserBeam) {
      this.laserBeam = this.scene.add.graphics()
      this.laserBeam.setDepth(5)
    }

    // Draw thin telegraph line
    this.laserBeam.clear()
    const alpha = progress * 0.5
    this.laserBeam.lineStyle(2, 0xe0ffff, alpha)
    this.laserBeam.beginPath()
    this.laserBeam.moveTo(this.x, this.y)
    this.laserBeam.lineTo(
      this.x + Math.cos(this.laserAngle) * this.laserLength,
      this.y + Math.sin(this.laserAngle) * this.laserLength
    )
    this.laserBeam.strokePath()

    // Charging effect
    this.setTint(0xe0ffff)
    this.setScale(1 + progress * 0.1)

    // Gathering particles
    if (elapsed % 80 < 16) {
      this.createChargeParticle()
    }

    if (elapsed >= windupDuration) {
      this.clearWarningPulse()
      this.setScale(1)
      this.phase = 'laser_active'
      this.phaseStartTime = time
    }
  }

  private handleLaserActive(time: number): void {
    const sweepDuration = 1200
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / sweepDuration

    // Sweep the laser
    const sweepAngle = Math.PI / 2 // Total sweep angle
    this.laserAngle += (sweepAngle / sweepDuration) * 16 * this.laserSweepDirection

    // Draw active laser
    if (this.laserBeam) {
      this.laserBeam.clear()

      // Outer glow
      this.laserBeam.lineStyle(this.laserWidth * 2, 0xe0ffff, 0.3)
      this.laserBeam.beginPath()
      this.laserBeam.moveTo(this.x, this.y)
      this.laserBeam.lineTo(
        this.x + Math.cos(this.laserAngle) * this.laserLength,
        this.y + Math.sin(this.laserAngle) * this.laserLength
      )
      this.laserBeam.strokePath()

      // Core beam
      this.laserBeam.lineStyle(this.laserWidth, 0xffffff, 0.9)
      this.laserBeam.beginPath()
      this.laserBeam.moveTo(this.x, this.y)
      this.laserBeam.lineTo(
        this.x + Math.cos(this.laserAngle) * this.laserLength,
        this.y + Math.sin(this.laserAngle) * this.laserLength
      )
      this.laserBeam.strokePath()
    }

    // Spark particles along beam
    if (elapsed % 30 < 16) {
      const dist = Phaser.Math.Between(50, this.laserLength)
      const sparkX = this.x + Math.cos(this.laserAngle) * dist
      const sparkY = this.y + Math.sin(this.laserAngle) * dist

      const spark = this.scene.add.circle(sparkX, sparkY, 4, 0xffffff, 1)
      spark.setDepth(6)
      this.scene.tweens.add({
        targets: spark,
        alpha: 0,
        scale: 0,
        duration: 100,
        onComplete: () => spark.destroy()
      })
    }

    if (progress >= 1) {
      // Fade out laser
      if (this.laserBeam) {
        this.scene.tweens.add({
          targets: this.laserBeam,
          alpha: 0,
          duration: 150,
          onComplete: () => {
            this.laserBeam?.clear()
          }
        })
      }
      this.finishAttack(time)
    }
  }

  private createChargeParticle(): void {
    const angle = Math.random() * Math.PI * 2
    const distance = 60
    const particle = this.scene.add.circle(
      this.x + Math.cos(angle) * distance,
      this.y + Math.sin(angle) * distance,
      4,
      0xe0ffff,
      0.8
    )
    particle.setDepth(4)

    this.scene.tweens.add({
      targets: particle,
      x: this.x,
      y: this.y,
      scale: 0,
      duration: 300,
      onComplete: () => particle.destroy()
    })
  }

  /**
   * Get laser info for external collision detection
   */
  getLaserInfo(): {
    active: boolean
    x: number
    y: number
    angle: number
    length: number
    width: number
  } {
    return {
      active: this.phase === 'laser_active',
      x: this.x,
      y: this.y,
      angle: this.laserAngle,
      length: this.laserLength,
      width: this.laserWidth
    }
  }

  // ==========================================
  // Spawn Turrets Attack
  // ==========================================

  private handleSpawnTurrets(time: number): void {
    this.setVelocity(0, 0)
    const spawnDuration = 800

    const elapsed = time - this.phaseStartTime

    // Summoning animation
    if (elapsed < 400) {
      this.setScale(1 + Math.sin(elapsed / 30) * 0.1)
      this.setTint(0xe0ffff)
    }

    // Spawn turrets at midpoint
    if (elapsed >= 400 && this.turrets.length < this.maxTurrets) {
      const turretsToSpawn = Math.min(this.maxTurrets - this.turrets.length, 2)

      for (let i = 0; i < turretsToSpawn; i++) {
        // Spawn at random position near edges
        const side = Math.floor(Math.random() * 4)
        let turretX: number, turretY: number

        switch (side) {
          case 0: // Top
            turretX = Phaser.Math.Between(50, 325)
            turretY = Phaser.Math.Between(60, 120)
            break
          case 1: // Bottom
            turretX = Phaser.Math.Between(50, 325)
            turretY = Phaser.Math.Between(500, 580)
            break
          case 2: // Left
            turretX = Phaser.Math.Between(30, 80)
            turretY = Phaser.Math.Between(100, 500)
            break
          default: // Right
            turretX = Phaser.Math.Between(295, 345)
            turretY = Phaser.Math.Between(100, 500)
            break
        }

        this.spawnTurret(turretX, turretY)
      }
    }

    this.clearWarningPulse()
    this.setScale(1)

    if (elapsed >= spawnDuration) {
      this.finishAttack(time)
    }
  }

  private spawnTurret(x: number, y: number): void {
    const turret: CrystalTurret = {
      sprite: this.scene.add.polygon(x, y, [
        { x: 0, y: -20 },
        { x: 15, y: 10 },
        { x: -15, y: 10 }
      ], 0xe0ffff, 0.8),
      health: 30,
      lastFireTime: 0,
      x,
      y
    }

    turret.sprite.setStrokeStyle(2, 0xffffff, 0.9)
    turret.sprite.setDepth(2)

    // Spawn animation
    turret.sprite.setScale(0)
    this.scene.tweens.add({
      targets: turret.sprite,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    })

    // Add physics for collision
    this.scene.physics.add.existing(turret.sprite, true)

    this.turrets.push(turret)
  }

  private updateTurrets(time: number, playerX: number, playerY: number): void {
    this.turrets = this.turrets.filter(turret => {
      if (turret.health <= 0) {
        // Destroy turret with effect
        this.createTurretDestroyEffect(turret.x, turret.y)
        turret.sprite.destroy()
        return false
      }

      // Rotate to face player
      const angleToPlayer = Phaser.Math.Angle.Between(turret.x, turret.y, playerX, playerY)
      turret.sprite.rotation = angleToPlayer + Math.PI / 2

      // Fire at player
      if (time - turret.lastFireTime > this.turretFireInterval) {
        this.bulletPool.spawn(turret.x, turret.y, angleToPlayer, 200)
        turret.lastFireTime = time

        // Muzzle flash
        const flash = this.scene.add.circle(
          turret.x + Math.cos(angleToPlayer) * 20,
          turret.y + Math.sin(angleToPlayer) * 20,
          8,
          0xffffff,
          0.8
        )
        flash.setDepth(3)
        this.scene.tweens.add({
          targets: flash,
          scale: 0,
          alpha: 0,
          duration: 80,
          onComplete: () => flash.destroy()
        })
      }

      return true
    })
  }

  private createTurretDestroyEffect(x: number, y: number): void {
    // Crystal shatter particles
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6
      const shard = this.scene.add.triangle(
        x, y,
        0, 0, 8, 0, 4, 12,
        0xe0ffff, 0.8
      )
      shard.setDepth(5)

      this.scene.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        rotation: Math.PI * 2,
        alpha: 0,
        scale: 0,
        duration: 300,
        onComplete: () => shard.destroy()
      })
    }
  }

  /**
   * Get turrets for external collision/damage
   */
  getTurrets(): CrystalTurret[] {
    return this.turrets
  }

  /**
   * Damage a turret
   */
  damageTurret(turret: CrystalTurret, amount: number): void {
    turret.health -= amount

    // Flash effect
    turret.sprite.setFillStyle(0xffffff, 1)
    this.scene.time.delayedCall(100, () => {
      if (turret.health > 0) {
        turret.sprite.setFillStyle(0xe0ffff, 0.8)
      }
    })
  }

  // ==========================================
  // Crystal Shatter Attack
  // ==========================================

  private triggerShatter(): void {
    // Create fragments flying outward
    const numFragments = 6
    for (let i = 0; i < numFragments; i++) {
      const angle = (Math.PI * 2 * i) / numFragments + Math.random() * 0.3
      this.createFragment(angle)
    }

    // Visual effect on boss
    this.scene.cameras.main.shake(100, 0.01)

    // Flash
    this.setTint(0xffffff)
    this.scene.time.delayedCall(100, () => {
      this.clearWarningPulse()
    })
  }

  private handleCrystalShatter(time: number, _playerX: number, _playerY: number): void {
    // Manual shatter attack (in addition to auto-shatter on damage)
    const shatterDuration = 600
    const elapsed = time - this.phaseStartTime

    if (elapsed < 300) {
      // Charge up
      this.setScale(1 + (elapsed / 300) * 0.2)
      this.setTint(0xe0ffff)
    } else if (elapsed === 300 || (elapsed > 300 && this.fragments.length === 0)) {
      // Release shatter
      this.setScale(1)
      this.triggerShatter()
    }

    if (elapsed >= shatterDuration) {
      this.finishAttack(time)
    }
  }

  private createFragment(angle: number): void {
    // Small crystal shard
    const fragment = this.scene.add.polygon(this.x, this.y, [
      { x: 0, y: -10 },
      { x: 8, y: 5 },
      { x: -8, y: 5 }
    ], 0xe0ffff, 0.9)

    fragment.setStrokeStyle(1, 0xffffff, 1)
    fragment.setDepth(6)
    fragment.rotation = angle

    // Store velocity data
    fragment.setData('velocity', {
      x: Math.cos(angle) * 200,
      y: Math.sin(angle) * 200
    })
    fragment.setData('lifetime', 0)

    // Add physics
    this.scene.physics.add.existing(fragment)

    this.fragments.push(fragment)
  }

  private updateFragments(_time: number, playerX: number, playerY: number): void {
    this.fragments = this.fragments.filter(fragment => {
      const velocity = fragment.getData('velocity') as { x: number; y: number }
      let lifetime = fragment.getData('lifetime') as number
      lifetime += 16 // Approximate frame time

      // Move fragment
      fragment.x += velocity.x * 0.016
      fragment.y += velocity.y * 0.016

      // Slow down over time
      velocity.x *= 0.98
      velocity.y *= 0.98

      // Rotate
      fragment.rotation += 0.1

      fragment.setData('velocity', velocity)
      fragment.setData('lifetime', lifetime)

      // Check collision with player (simple distance check)
      const distToPlayer = Phaser.Math.Distance.Between(fragment.x, fragment.y, playerX, playerY)
      if (distToPlayer < 25) {
        // Hit player
        if (this.onFragmentHit) {
          this.onFragmentHit()
        }
        fragment.destroy()
        return false
      }

      // Remove after 2 seconds or if off screen
      if (
        lifetime > 2000 ||
        fragment.x < -50 || fragment.x > 425 ||
        fragment.y < -50 || fragment.y > 717
      ) {
        fragment.destroy()
        return false
      }

      // Fade out near end of life
      if (lifetime > 1500) {
        fragment.setAlpha(1 - (lifetime - 1500) / 500)
      }

      return true
    })
  }

  /**
   * Get fragments for external collision detection
   */
  getFragments(): Phaser.GameObjects.Polygon[] {
    return this.fragments
  }

  destroy(fromScene?: boolean): void {
    if (this.laserBeam) {
      this.laserBeam.destroy()
      this.laserBeam = null
    }
    this.turrets.forEach(turret => turret.sprite.destroy())
    this.turrets = []
    this.fragments.forEach(fragment => fragment.destroy())
    this.fragments = []
    super.destroy(fromScene)
  }
}

/**
 * Crystal turret spawned by Crystal Guardian
 */
interface CrystalTurret {
  sprite: Phaser.GameObjects.Polygon
  health: number
  lastFireTime: number
  x: number
  y: number
}
