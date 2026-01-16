import Phaser from 'phaser'
import Enemy, { EnemyUpdateResult } from '../Enemy'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getEnemySpriteKey } from '../../config/themeData'

type BurrowerPhase = 'burrowed' | 'surfacing' | 'attacking' | 'burrowing'

export default class BurrowerEnemy extends Enemy {
  private bulletPool: EnemyBulletPool
  private phase: BurrowerPhase = 'burrowed'
  private phaseStartTime: number = 0

  // Timing constants
  private readonly burrowDuration: number = 2000 // Time spent underground
  private readonly surfaceDuration: number = 500 // Time to surface
  private readonly attackDuration: number = 1500 // Time visible before burrowing
  private readonly burrowingDuration: number = 500 // Time to burrow back down

  // Visual effects
  private dustParticles: Phaser.GameObjects.Particles.ParticleEmitter | null = null

  // Track original body for collision toggling
  private originalBodyEnabled: boolean = true

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: {
      healthMultiplier?: number
      damageMultiplier?: number
    }
  ) {
    super(scene, x, y, options)

    this.bulletPool = bulletPool

    // Use themed burrower enemy sprite
    const spriteKey = getEnemySpriteKey('burrower')
    if (scene.textures.exists(spriteKey)) {
      this.setTexture(spriteKey)
    }
    this.setDisplaySize(32, 32)

    // Start burrowed
    this.phase = 'burrowed'
    this.setAlpha(0.3)
    this.phaseStartTime = scene.time.now

    // Create dust particle effect
    this.createDustParticles()

    console.log('BurrowerEnemy created at', x, y)
  }

  private createDustParticles(): void {
    // Create a simple dust texture if it doesn't exist
    if (!this.scene.textures.exists('dustParticle')) {
      const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(0x8b7355, 1) // Brown/tan dust color
      graphics.fillCircle(4, 4, 4)
      graphics.generateTexture('dustParticle', 8, 8)
      graphics.destroy()
    }

    // Create particle manager and emitter
    this.dustParticles = this.scene.add.particles(0, 0, 'dustParticle', {
      lifespan: 500,
      speed: { min: 20, max: 60 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      angle: { min: 0, max: 360 },
      emitting: false,
    })
    this.dustParticles.setDepth(5)
  }

  private emitDust(): void {
    if (this.dustParticles) {
      this.dustParticles.setPosition(this.x, this.y)
      this.dustParticles.explode(8) // Emit 8 dust particles
    }
  }

  update(time: number, _delta: number, playerX: number, playerY: number): EnemyUpdateResult {
    if (!this.active || !this.body) {
      return { died: false, dotDamage: 0 }
    }

    // Update fire DOT from parent class (but only if not burrowed)
    let effectResult: EnemyUpdateResult = { died: false, dotDamage: 0 }
    if (this.phase !== 'burrowed' && this.phase !== 'burrowing') {
      effectResult = super.update(time, _delta, playerX, playerY)
      if (effectResult.died) {
        return effectResult
      }
    }

    switch (this.phase) {
      case 'burrowed':
        this.handleBurrowedPhase(time, playerX, playerY)
        break
      case 'surfacing':
        this.handleSurfacingPhase(time)
        break
      case 'attacking':
        this.handleAttackingPhase(time)
        break
      case 'burrowing':
        this.handleBurrowingPhase(time)
        break
    }

    // Ensure enemy stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 16
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return effectResult
  }

  private handleBurrowedPhase(time: number, playerX: number, playerY: number): void {
    // While burrowed: invisible, invulnerable, moving toward player
    this.setAlpha(0.3)
    this.setVelocity(0, 0)

    // Disable collision while burrowed
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body && this.originalBodyEnabled) {
      body.checkCollision.none = true
      this.originalBodyEnabled = false
    }

    // Move underground toward player position (slowly)
    const targetX = playerX + Phaser.Math.Between(-50, 50)
    const targetY = playerY + Phaser.Math.Between(-50, 50)
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY)
    const speed = 40 // Slow underground movement

    this.x += Math.cos(angle) * speed * 0.016 // Approximate 60fps
    this.y += Math.sin(angle) * speed * 0.016

    // Surface after burrow duration
    if (time - this.phaseStartTime > this.burrowDuration) {
      this.phase = 'surfacing'
      this.phaseStartTime = time
      this.emitDust()
    }
  }

  private handleSurfacingPhase(time: number): void {
    const elapsed = time - this.phaseStartTime
    const progress = Math.min(elapsed / this.surfaceDuration, 1)

    // Fade in as surfacing
    this.setAlpha(0.3 + progress * 0.7)

    // Re-enable collision when surfaced
    if (progress >= 1) {
      const body = this.body as Phaser.Physics.Arcade.Body
      if (body) {
        body.checkCollision.none = false
        this.originalBodyEnabled = true
      }

      this.phase = 'attacking'
      this.phaseStartTime = time
      this.emitDust()
      this.fireSpreadAttack()
    }
  }

  private handleAttackingPhase(time: number): void {
    // Visible and vulnerable, stay still
    this.setAlpha(1)
    this.setVelocity(0, 0)

    // After attack duration, start burrowing
    if (time - this.phaseStartTime > this.attackDuration) {
      this.phase = 'burrowing'
      this.phaseStartTime = time
      this.emitDust()
    }
  }

  private handleBurrowingPhase(time: number): void {
    const elapsed = time - this.phaseStartTime
    const progress = Math.min(elapsed / this.burrowingDuration, 1)

    // Fade out as burrowing
    this.setAlpha(1 - progress * 0.7)

    // Disable collision when starting to burrow
    if (progress >= 0.5 && this.originalBodyEnabled) {
      const body = this.body as Phaser.Physics.Arcade.Body
      if (body) {
        body.checkCollision.none = true
        this.originalBodyEnabled = false
      }
    }

    if (progress >= 1) {
      this.phase = 'burrowed'
      this.phaseStartTime = time
      this.emitDust()
    }
  }

  private fireSpreadAttack(): void {
    // Fire 6 projectiles in a spread pattern
    const numProjectiles = 6
    const speed = 130 // Moderate speed

    for (let i = 0; i < numProjectiles; i++) {
      const angle = (Math.PI * 2 * i) / numProjectiles
      this.bulletPool.spawn(this.x, this.y, angle, speed)
    }
  }

  /**
   * Check if the burrower is currently vulnerable to damage
   */
  isVulnerable(): boolean {
    return this.phase === 'attacking' || this.phase === 'surfacing'
  }

  /**
   * Override takeDamage to apply reduced damage when burrowed
   */
  takeDamage(amount: number): boolean {
    // Take reduced damage when underground, full damage when surfaced
    const damageMultiplier = this.isVulnerable() ? 1.0 : 0.3
    const actualDamage = amount * damageMultiplier

    // Add brief flash even when underground to give feedback
    if (!this.isVulnerable()) {
      this.setTint(0xff9999)
      this.scene.time.delayedCall(100, () => {
        this.clearTint()
      })
    }

    return super.takeDamage(actualDamage)
  }

  destroy(fromScene?: boolean): void {
    if (this.dustParticles) {
      this.dustParticles.destroy()
      this.dustParticles = null
    }
    super.destroy(fromScene)
  }
}
