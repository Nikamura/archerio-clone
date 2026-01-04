import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'

type NightmarePhase = 'idle' | 'distortion' | 'clone_attack' | 'fear_pulse'

interface NightmareClone {
  x: number
  y: number
  graphics: Phaser.GameObjects.Graphics
  targetAngle: number
  isReal: boolean
}

/**
 * Chapter 5 Boss 2: Nightmare
 * A psychic horror that manipulates perception.
 *
 * Attack Patterns:
 * 1. Screen Distortion Effects - Visual disturbance with scattered projectiles
 * 2. Clone Multiplication - Creates fake clones that attack simultaneously
 * 3. Fear Pulse - Slows player and temporarily reverses controls (visual effect only)
 */
export default class NightmareBoss extends BaseBoss {
  protected phase: NightmarePhase = 'idle'

  // Distortion tracking
  private distortionGraphics: Phaser.GameObjects.Graphics | null = null

  // Clone tracking
  private clones: NightmareClone[] = []
  private cloneCount: number = 3
  private cloneAttackFired: boolean = false

  // Fear pulse tracking
  private fearPulseRadius: number = 0
  private fearPulseMaxRadius: number = 350
  private playerFeared: boolean = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, 'boss_nightmare', options)

    this.baseHealth = 380
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0))
    this.bossHealth = this.bossMaxHealth
    this.attackCooldown = 2100
    this.attackPatternCount = 3
    this.displaySize = 68

    this.setDisplaySize(this.displaySize, this.displaySize)

    // Create distortion graphics layer
    this.distortionGraphics = scene.add.graphics()
    this.distortionGraphics.setDepth(5) // Above most things
  }

  protected getPlaceholderColor(): number {
    return 0x2f0f4f // Deep purple for nightmare
  }

  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'distortion'
        break
      case 1:
        this.phase = 'clone_attack'
        this.prepareCloneAttack(playerX, playerY)
        break
      case 2:
        this.phase = 'fear_pulse'
        this.fearPulseRadius = 0
        this.playerFeared = false
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime

    switch (this.phase) {
      case 'distortion':
        this.handleDistortionPhase(time, elapsed, playerX, playerY)
        break
      case 'clone_attack':
        this.handleCloneAttackPhase(time, elapsed, playerX, playerY)
        break
      case 'fear_pulse':
        this.handleFearPulsePhase(time, elapsed, playerX, playerY)
        break
    }
  }

  private handleDistortionPhase(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Clear previous distortion effects
    if (this.distortionGraphics) {
      this.distortionGraphics.clear()
    }

    // Create wavy distortion effect
    const waveCount = 3
    const waveInterval = 400

    if (elapsed < waveCount * waveInterval + 500) {
      // Draw distortion waves
      if (this.distortionGraphics) {
        for (let w = 0; w < waveCount; w++) {
          const waveAge = elapsed - w * waveInterval
          if (waveAge > 0 && waveAge < 600) {
            const waveRadius = waveAge * 0.5
            const alpha = 0.3 * (1 - waveAge / 600)

            // Jagged distortion circle
            this.distortionGraphics.lineStyle(3, 0x6600cc, alpha)
            this.distortionGraphics.beginPath()
            for (let i = 0; i < 32; i++) {
              const angle = (Math.PI * 2 * i) / 32
              const jitter = Math.sin(i * 3 + waveAge / 50) * 10
              const r = waveRadius + jitter
              const px = this.x + Math.cos(angle) * r
              const py = this.y + Math.sin(angle) * r

              if (i === 0) {
                this.distortionGraphics.moveTo(px, py)
              } else {
                this.distortionGraphics.lineTo(px, py)
              }
            }
            this.distortionGraphics.closePath()
            this.distortionGraphics.strokePath()
          }
        }

        // Screen edge distortion effect
        const screenShake = Math.sin(elapsed / 50) * 5
        this.scene.cameras.main.setScroll(screenShake, screenShake * 0.5)
      }

      // Fire random projectiles during distortion
      if (elapsed % 200 < 50) {
        const randomAngle = Math.random() * Math.PI * 2
        this.bulletPool.spawn(this.x, this.y, randomAngle, 160)
        // Also fire at player
        this.fireAtPlayer(playerX, playerY, 1, 200, 0)
      }
    } else {
      // Reset camera shake
      this.scene.cameras.main.setScroll(0, 0)
      if (this.distortionGraphics) {
        this.distortionGraphics.clear()
      }
      this.finishAttack(time)
    }
  }

  private prepareCloneAttack(playerX: number, playerY: number): void {
    this.clones = []
    this.cloneAttackFired = false

    // Create clone positions in a circle around player
    const realPosition = Phaser.Math.Between(0, this.cloneCount)

    for (let i = 0; i <= this.cloneCount; i++) {
      const angle = (Math.PI * 2 * i) / (this.cloneCount + 1)
      const distance = 120

      const cloneX = Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 50, 325)
      const cloneY = Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 100, 550)

      // Calculate attack angle (toward player)
      const attackAngle = Phaser.Math.Angle.Between(cloneX, cloneY, playerX, playerY)

      const clone: NightmareClone = {
        x: cloneX,
        y: cloneY,
        graphics: this.scene.add.graphics(),
        targetAngle: attackAngle,
        isReal: i === realPosition,
      }
      clone.graphics.setDepth(1)

      this.clones.push(clone)
    }

    // Hide real boss and move to real clone position
    this.setAlpha(0.3)
  }

  private handleCloneAttackPhase(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Fade in clones
    if (elapsed < 600) {
      const fadeProgress = elapsed / 600

      for (const clone of this.clones) {
        clone.graphics.clear()

        // Draw clone as a shadowy version of the boss
        const alpha = fadeProgress * 0.8
        clone.graphics.fillStyle(0x2f0f4f, alpha)
        clone.graphics.fillCircle(clone.x, clone.y, 30)
        clone.graphics.lineStyle(2, 0x9932cc, alpha)
        clone.graphics.strokeCircle(clone.x, clone.y, 30)

        // Eyes
        clone.graphics.fillStyle(0xff0066, alpha)
        clone.graphics.fillCircle(clone.x - 8, clone.y - 5, 4)
        clone.graphics.fillCircle(clone.x + 8, clone.y - 5, 4)
      }

      // Pulsing on main boss
      this.pulseWarning(elapsed, 100)
      return
    }

    // Attack phase - all clones fire simultaneously
    if (!this.cloneAttackFired && elapsed >= 600 && elapsed < 700) {
      this.cloneAttackFired = true
      this.clearTint()

      for (const clone of this.clones) {
        // Update target angle to current player position
        clone.targetAngle = Phaser.Math.Angle.Between(clone.x, clone.y, playerX, playerY)

        // Fire from clone position
        this.bulletPool.spawn(clone.x, clone.y, clone.targetAngle, 220)
        // Spread shots
        this.bulletPool.spawn(clone.x, clone.y, clone.targetAngle + 0.15, 200)
        this.bulletPool.spawn(clone.x, clone.y, clone.targetAngle - 0.15, 200)

        // Visual attack flash
        clone.graphics.clear()
        clone.graphics.fillStyle(0xff0066, 0.8)
        clone.graphics.fillCircle(clone.x, clone.y, 35)
      }
    }

    // Fade out clones
    if (elapsed >= 700 && elapsed < 1100) {
      const fadeProgress = (elapsed - 700) / 400

      for (const clone of this.clones) {
        clone.graphics.clear()
        const alpha = (1 - fadeProgress) * 0.8

        clone.graphics.fillStyle(0x2f0f4f, alpha)
        clone.graphics.fillCircle(clone.x, clone.y, 30 * (1 - fadeProgress * 0.5))
      }

      // Move real boss back to real clone's position
      const realClone = this.clones.find(c => c.isReal)
      if (realClone) {
        const moveProgress = fadeProgress
        this.x = Phaser.Math.Linear(this.x, realClone.x, moveProgress * 0.5)
        this.y = Phaser.Math.Linear(this.y, realClone.y, moveProgress * 0.5)
      }

      this.setAlpha(0.3 + fadeProgress * 0.7)
    }

    if (elapsed > 1200) {
      this.cleanupClones()
      this.setAlpha(1)
      this.finishAttack(time)
    }
  }

  private handleFearPulsePhase(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Charge up
    if (elapsed < 500) {
      this.pulseWarning(elapsed, 80)

      // Ominous glow buildup
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        const chargeRadius = 30 + (elapsed / 500) * 20
        this.telegraphGraphics.fillStyle(0x4b0082, 0.5)
        this.telegraphGraphics.fillCircle(this.x, this.y, chargeRadius)
      }
      return
    }

    this.clearTint()

    // Expand fear pulse
    const pulseSpeed = 300 // pixels per second
    this.fearPulseRadius = ((elapsed - 500) / 1000) * pulseSpeed

    if (this.fearPulseRadius < this.fearPulseMaxRadius) {
      // Draw expanding wave
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        // Main wave
        this.telegraphGraphics.lineStyle(8, 0x4b0082, 0.6)
        this.telegraphGraphics.strokeCircle(this.x, this.y, this.fearPulseRadius)

        // Inner glow
        this.telegraphGraphics.lineStyle(4, 0x9932cc, 0.8)
        this.telegraphGraphics.strokeCircle(this.x, this.y, this.fearPulseRadius - 5)

        // Trailing waves
        for (let i = 1; i <= 2; i++) {
          const trailRadius = this.fearPulseRadius - i * 30
          if (trailRadius > 0) {
            this.telegraphGraphics.lineStyle(2, 0x4b0082, 0.3)
            this.telegraphGraphics.strokeCircle(this.x, this.y, trailRadius)
          }
        }
      }

      // Check if player is hit by the wave
      const distToPlayer = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)
      if (!this.playerFeared && Math.abs(distToPlayer - this.fearPulseRadius) < 20) {
        this.playerFeared = true

        // Visual fear effect - tint screen briefly
        this.scene.cameras.main.flash(200, 100, 0, 150)

        // Fire aimed projectiles when fear hits
        this.fireAtPlayer(playerX, playerY, 5, 180, 0.3)
      }

      // Fire projectiles at wave edge
      if (elapsed % 150 < 30) {
        const angle = ((elapsed / 50) % (Math.PI * 2))
        const spawnX = this.x + Math.cos(angle) * (this.fearPulseRadius + 10)
        const spawnY = this.y + Math.sin(angle) * (this.fearPulseRadius + 10)

        // Make sure spawn is in bounds
        if (spawnX > 50 && spawnX < 325 && spawnY > 100 && spawnY < 550) {
          const angleToPlayer = Phaser.Math.Angle.Between(spawnX, spawnY, playerX, playerY)
          this.bulletPool.spawn(spawnX, spawnY, angleToPlayer, 150)
        }
      }
    }

    // Finish when pulse completes
    if (this.fearPulseRadius >= this.fearPulseMaxRadius) {
      this.clearTelegraphs()
      this.finishAttack(time)
    }
  }

  private cleanupClones(): void {
    for (const clone of this.clones) {
      clone.graphics?.destroy()
    }
    this.clones = []
  }

  update(time: number, delta: number, playerX: number, playerY: number): boolean {
    const died = super.update(time, delta, playerX, playerY)

    return died
  }

  destroy(fromScene?: boolean): void {
    // Cleanup
    this.cleanupClones()

    if (this.distortionGraphics) {
      this.distortionGraphics.destroy()
      this.distortionGraphics = null
    }

    // Reset camera (guard against scene shutdown)
    this.scene?.cameras?.main?.setScroll(0, 0)

    super.destroy(fromScene)
  }
}
