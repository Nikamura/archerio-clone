import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getBossDefinition } from '../../config/bossData'

/**
 * Forest Spirit Boss - Chapter 2 Forest Ruins
 *
 * Attack Patterns:
 * 1. Teleport - Disappears and reappears at random position
 * 2. Homing Orbs - Fires orbs that slowly track the player
 * 3. Mirror Images - Creates decoy copies that confuse the player
 */
export default class ForestSpiritBoss extends BaseBoss {
  // Teleport attack
  private teleportDestination: { x: number; y: number } | null = null

  // Homing orbs
  private homingOrbs: Phaser.GameObjects.Arc[] = []
  private readonly maxOrbs = 4
  private readonly orbSpeed = 60 // Slow homing speed

  // Mirror images (decoys)
  private mirrorImages: Phaser.GameObjects.Sprite[] = []
  private readonly maxMirrors = 2

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, getBossDefinition('forest_spirit'), options)

    // Make the spirit slightly transparent
    this.setAlpha(0.9)
  }

  protected handleIdlePhase(time: number, _playerX: number, _playerY: number): void {
    // Forest Spirit floats instead of walking - sinusoidal movement
    const floatOffset = Math.sin(time / 500) * 20
    this.y = this.getData('baseY') ?? this.y
    if (!this.getData('baseY')) {
      this.setData('baseY', this.y)
    }
    this.y = this.getData('baseY') + floatOffset

    // Slight horizontal drift toward center
    const centerX = 375 / 2
    if (Math.abs(this.x - centerX) > 30) {
      const direction = this.x < centerX ? 1 : -1
      this.x += direction * 0.5
    }

    // Start next attack after cooldown
    if (time - this.lastAttackTime > this.attackCooldown) {
      this.startNextAttack(time, _playerX, _playerY)
    }
  }

  protected selectAttackPhase(pattern: number, _playerX: number, _playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'teleport'
        break
      case 1:
        this.phase = 'homing_orbs'
        break
      case 2:
        this.phase = 'mirror_images'
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    switch (this.phase) {
      // Teleport Attack
      case 'teleport':
        this.handleTeleportFadeOut(time)
        break
      case 'teleport_move':
        this.handleTeleportMove(time)
        break
      case 'teleport_fade_in':
        this.handleTeleportFadeIn(time)
        break

      // Homing Orbs Attack
      case 'homing_orbs':
        this.handleHomingOrbsSpawn(time)
        break
      case 'homing_orbs_active':
        this.handleHomingOrbsUpdate(time, playerX, playerY)
        break

      // Mirror Images Attack
      case 'mirror_images':
        this.handleMirrorImagesSpawn(time)
        break
      case 'mirror_images_active':
        this.handleMirrorImagesUpdate(time, playerX, playerY)
        break

      default:
        this.finishAttack(time)
    }
  }

  // ==========================================
  // Teleport Attack
  // ==========================================

  private handleTeleportFadeOut(time: number): void {
    const fadeDuration = 400
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / fadeDuration

    // Fade out with sparkle effect
    this.setAlpha(0.9 - progress * 0.9)
    this.setScale(1 - progress * 0.3)

    // Sparkle particles
    if (elapsed % 50 < 16) {
      this.createSparkle(this.x, this.y)
    }

    if (progress >= 1) {
      // Choose teleport destination
      const angle = Math.random() * Math.PI * 2
      const distance = Phaser.Math.Between(100, 200)
      const centerX = 375 / 2
      const centerY = 667 / 2

      this.teleportDestination = {
        x: Phaser.Math.Clamp(centerX + Math.cos(angle) * distance, 50, 325),
        y: Phaser.Math.Clamp(centerY + Math.sin(angle) * distance, 80, 580)
      }

      this.phase = 'teleport_move'
      this.phaseStartTime = time
      this.setVisible(false)
    }
  }

  private handleTeleportMove(time: number): void {
    const moveDuration = 200 // Brief invisible period
    const elapsed = time - this.phaseStartTime

    if (elapsed >= moveDuration && this.teleportDestination) {
      // Move to destination
      this.x = this.teleportDestination.x
      this.y = this.teleportDestination.y
      this.setData('baseY', this.y) // Update float base

      this.phase = 'teleport_fade_in'
      this.phaseStartTime = time
      this.setVisible(true)
      this.setAlpha(0)
      this.setScale(0.7)
    }
  }

  private handleTeleportFadeIn(time: number): void {
    const fadeDuration = 300
    const elapsed = time - this.phaseStartTime
    const progress = elapsed / fadeDuration

    // Fade in with sparkle effect
    this.setAlpha(progress * 0.9)
    this.setScale(0.7 + progress * 0.3)

    // Sparkle particles
    if (elapsed % 40 < 16) {
      this.createSparkle(this.x, this.y)
    }

    if (progress >= 1) {
      this.setAlpha(0.9)
      this.setScale(1)
      this.teleportDestination = null
      this.finishAttack(time)
    }
  }

  private createSparkle(x: number, y: number): void {
    const sparkle = this.scene.add.star(
      x + Phaser.Math.Between(-20, 20),
      y + Phaser.Math.Between(-20, 20),
      5, 3, 6, 0x98fb98, 1
    )
    sparkle.setDepth(5)

    this.scene.tweens.add({
      targets: sparkle,
      alpha: 0,
      scale: 0,
      rotation: Math.PI,
      duration: 300,
      onComplete: () => sparkle.destroy()
    })
  }

  // ==========================================
  // Homing Orbs Attack
  // ==========================================

  private handleHomingOrbsSpawn(time: number): void {
    const spawnDuration = 600
    const elapsed = time - this.phaseStartTime

    // Charging effect
    this.setScale(1 + Math.sin(elapsed / 50) * 0.1)
    this.setTint(0x98fb98) // Green glow

    if (elapsed >= spawnDuration) {
      this.clearWarningPulse()
      this.setScale(1)

      // Spawn orbs
      for (let i = 0; i < this.maxOrbs; i++) {
        const angle = (Math.PI * 2 * i) / this.maxOrbs
        const orbX = this.x + Math.cos(angle) * 40
        const orbY = this.y + Math.sin(angle) * 40

        const orb = this.scene.add.circle(orbX, orbY, 12, 0x98fb98, 0.8)
        orb.setStrokeStyle(2, 0xffffff, 0.6)
        orb.setDepth(5)
        orb.setData('velocity', { x: 0, y: 0 })

        this.homingOrbs.push(orb)
      }

      this.phase = 'homing_orbs_active'
      this.phaseStartTime = time
    }
  }

  private handleHomingOrbsUpdate(time: number, playerX: number, playerY: number): void {
    const maxDuration = 5000 // Orbs last 5 seconds
    const elapsed = time - this.phaseStartTime

    // Update each orb to home toward player
    this.homingOrbs = this.homingOrbs.filter(orb => {
      if (!orb.active) return false

      // Calculate homing direction
      const angle = Phaser.Math.Angle.Between(orb.x, orb.y, playerX, playerY)
      const velocity = orb.getData('velocity') as { x: number; y: number }

      // Smooth acceleration toward player
      const accel = 0.5
      velocity.x += Math.cos(angle) * accel
      velocity.y += Math.sin(angle) * accel

      // Limit speed
      const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2)
      if (speed > this.orbSpeed) {
        velocity.x = (velocity.x / speed) * this.orbSpeed
        velocity.y = (velocity.y / speed) * this.orbSpeed
      }

      orb.setData('velocity', velocity)
      orb.x += velocity.x * 0.016 // Assuming ~60fps
      orb.y += velocity.y * 0.016

      // Trail effect
      if (elapsed % 100 < 16) {
        const trail = this.scene.add.circle(orb.x, orb.y, 6, 0x98fb98, 0.3)
        trail.setDepth(4)
        this.scene.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 0,
          duration: 200,
          onComplete: () => trail.destroy()
        })
      }

      return true
    })

    if (elapsed >= maxDuration || this.homingOrbs.length === 0) {
      // Clean up remaining orbs
      this.homingOrbs.forEach(orb => {
        this.scene.tweens.add({
          targets: orb,
          alpha: 0,
          scale: 0,
          duration: 150,
          onComplete: () => orb.destroy()
        })
      })
      this.homingOrbs = []
      this.finishAttack(time)
    }
  }

  /**
   * Get homing orbs for external collision detection
   */
  getHomingOrbs(): Phaser.GameObjects.Arc[] {
    return this.homingOrbs
  }

  /**
   * Remove an orb when it hits the player
   */
  removeOrb(orb: Phaser.GameObjects.Arc): void {
    const index = this.homingOrbs.indexOf(orb)
    if (index !== -1) {
      this.homingOrbs.splice(index, 1)
      orb.destroy()
    }
  }

  // ==========================================
  // Mirror Images Attack
  // ==========================================

  private handleMirrorImagesSpawn(time: number): void {
    const spawnDuration = 500
    const elapsed = time - this.phaseStartTime

    // Flickering effect during spawn
    this.setAlpha(0.5 + Math.sin(elapsed / 30) * 0.4)

    if (elapsed >= spawnDuration) {
      this.setAlpha(0.9)

      // Create mirror images at different positions
      for (let i = 0; i < this.maxMirrors; i++) {
        const angle = (Math.PI * 2 * (i + 1)) / (this.maxMirrors + 1)
        const distance = 100
        const mirrorX = Phaser.Math.Clamp(this.x + Math.cos(angle) * distance, 50, 325)
        const mirrorY = Phaser.Math.Clamp(this.y + Math.sin(angle) * distance, 80, 580)

        // Create mirror image using same texture/appearance
        const mirror = this.scene.add.sprite(mirrorX, mirrorY, this.texture.key)
        mirror.setDisplaySize(this.displaySize, this.displaySize)
        mirror.setAlpha(0.6)
        mirror.setTint(0x98fb98) // Slight green tint to differentiate
        mirror.setDepth(3)
        mirror.setData('baseY', mirrorY)

        // Spawn effect
        mirror.setScale(0)
        this.scene.tweens.add({
          targets: mirror,
          scale: 1,
          duration: 200,
          ease: 'Back.easeOut'
        })

        this.mirrorImages.push(mirror)
      }

      this.phase = 'mirror_images_active'
      this.phaseStartTime = time
    }
  }

  private handleMirrorImagesUpdate(time: number, playerX: number, playerY: number): void {
    const maxDuration = 4000 // Mirrors last 4 seconds
    const elapsed = time - this.phaseStartTime

    // Animate mirrors similarly to main boss
    this.mirrorImages.forEach((mirror, index) => {
      const floatOffset = Math.sin(time / 500 + index) * 15
      const baseY = mirror.getData('baseY') as number
      mirror.y = baseY + floatOffset

      // Occasional projectile from mirrors
      if (elapsed > 1000 && elapsed % 1500 < 16 && index === Math.floor((elapsed / 1500) % this.maxMirrors)) {
        const angle = Phaser.Math.Angle.Between(mirror.x, mirror.y, playerX, playerY)
        this.bulletPool.spawn(mirror.x, mirror.y, angle, 150)
      }
    })

    if (elapsed >= maxDuration) {
      // Fade out mirrors
      this.mirrorImages.forEach(mirror => {
        this.scene.tweens.add({
          targets: mirror,
          alpha: 0,
          scale: 0,
          duration: 200,
          onComplete: () => mirror.destroy()
        })
      })
      this.mirrorImages = []
      this.finishAttack(time)
    }
  }

  /**
   * Get mirror images for external use (e.g., to confuse targeting)
   */
  getMirrorImages(): Phaser.GameObjects.Sprite[] {
    return this.mirrorImages
  }

  destroy(fromScene?: boolean): void {
    // Clean up orbs
    this.homingOrbs.forEach(orb => orb.destroy())
    this.homingOrbs = []

    // Clean up mirrors
    this.mirrorImages.forEach(mirror => mirror.destroy())
    this.mirrorImages = []

    super.destroy(fromScene)
  }
}
