import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'

type MagmaWyrmPhase = 'idle' | 'burrow' | 'emerge' | 'fire_breath' | 'body_slam'

interface WyrmSegment {
  x: number
  y: number
  graphics: Phaser.GameObjects.Graphics
}

/**
 * Chapter 4 Boss 2: Magma Wyrm
 * A massive serpent boss that burrows through lava.
 *
 * Attack Patterns:
 * 1. Burrow Attack - Dives underground, emerges at player location with spread attack
 * 2. Fire Breath Sweep - Sweeping fire breath attack across the arena
 * 3. Body Slam - Segments deal contact damage as wyrm charges across screen
 */
export default class MagmaWyrmBoss extends BaseBoss {
  protected phase: MagmaWyrmPhase = 'idle'

  // Wyrm segments (body parts that follow head)
  private segments: WyrmSegment[] = []
  private segmentCount: number = 5
  private segmentSpacing: number = 25

  // Burrow attack tracking
  private burrowTargetX: number = 0
  private burrowTargetY: number = 0
  private isUnderground: boolean = false

  // Fire breath tracking
  private breathAngle: number = 0
  private breathStartAngle: number = 0
  private breathSweepRange: number = Math.PI // 180 degree sweep
  private breathProjectileCount: number = 0

  // Body slam tracking
  private slamStartX: number = 0
  private slamStartY: number = 0
  private slamEndX: number = 0
  private slamEndY: number = 0
  private slamProgress: number = 0

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, 'boss_magma_wyrm', options)

    this.baseHealth = 300
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0))
    this.bossHealth = this.bossMaxHealth
    this.attackCooldown = 2200
    this.attackPatternCount = 3
    this.displaySize = 56

    this.setDisplaySize(this.displaySize, this.displaySize)

    // Create body segments
    this.createSegments()
  }

  protected getPlaceholderColor(): number {
    return 0xff6600 // Bright orange for magma wyrm
  }

  private createSegments(): void {
    for (let i = 0; i < this.segmentCount; i++) {
      const segment: WyrmSegment = {
        x: this.x - (i + 1) * this.segmentSpacing,
        y: this.y,
        graphics: this.scene.add.graphics(),
      }
      segment.graphics.setDepth(0)
      this.drawSegment(segment, i)
      this.segments.push(segment)
    }
  }

  private drawSegment(segment: WyrmSegment, index: number): void {
    segment.graphics.clear()
    const size = 20 - index * 2 // Segments get smaller toward tail
    const alpha = this.isUnderground ? 0.3 : 1

    segment.graphics.fillStyle(0xff4400, alpha)
    segment.graphics.fillCircle(segment.x, segment.y, size)
    segment.graphics.lineStyle(2, 0xffaa00, alpha)
    segment.graphics.strokeCircle(segment.x, segment.y, size)
  }

  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'burrow'
        this.burrowTargetX = playerX
        this.burrowTargetY = playerY
        break
      case 1:
        this.phase = 'fire_breath'
        // Start breath aimed at player
        this.breathStartAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY) - this.breathSweepRange / 2
        this.breathAngle = this.breathStartAngle
        this.breathProjectileCount = 0
        break
      case 2:
        this.phase = 'body_slam'
        this.prepareSlamAttack(playerX, playerY)
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime

    switch (this.phase) {
      case 'burrow':
        this.handleBurrowPhase(time, elapsed)
        break
      case 'emerge':
        this.handleEmergePhase(time, elapsed)
        break
      case 'fire_breath':
        this.handleFireBreathPhase(time, elapsed, playerX, playerY)
        break
      case 'body_slam':
        this.handleBodySlamPhase(time, elapsed)
        break
    }
  }

  private handleBurrowPhase(time: number, elapsed: number): void {
    // Sinking animation
    if (elapsed < 400) {
      const sinkProgress = elapsed / 400
      this.setAlpha(1 - sinkProgress * 0.7)
      this.setScale(1 - sinkProgress * 0.5)

      // Fade segments too
      for (let i = 0; i < this.segments.length; i++) {
        const segmentDelay = (i + 1) * 50
        const segmentProgress = Math.max(0, (elapsed - segmentDelay) / 400)
        this.segments[i].graphics.setAlpha(1 - segmentProgress * 0.7)
      }
      return
    }

    // Underground movement
    if (elapsed < 1000) {
      if (!this.isUnderground) {
        this.isUnderground = true
        this.setVisible(false)
        for (const seg of this.segments) {
          seg.graphics.setVisible(false)
        }
      }

      // Show warning at target location
      this.clearTelegraphs()
      const warningAlpha = 0.3 + ((elapsed - 400) / 600) * 0.5
      this.drawTelegraphCircle(this.burrowTargetX, this.burrowTargetY, 50, warningAlpha)
      return
    }

    // Transition to emerge phase
    this.x = this.burrowTargetX
    this.y = this.burrowTargetY
    this.phase = 'emerge'
    this.phaseStartTime = time
    this.clearTelegraphs()
  }

  private handleEmergePhase(time: number, elapsed: number): void {
    // Rising animation
    if (elapsed < 300) {
      if (this.isUnderground) {
        this.isUnderground = false
        this.setVisible(true)
        for (const seg of this.segments) {
          seg.graphics.setVisible(true)
        }
      }

      const riseProgress = elapsed / 300
      this.setAlpha(0.3 + riseProgress * 0.7)
      this.setScale(0.5 + riseProgress * 0.5)

      // Update segment positions to head
      for (let i = 0; i < this.segments.length; i++) {
        this.segments[i].x = this.x
        this.segments[i].y = this.y
        this.drawSegment(this.segments[i], i)
      }
      return
    }

    // Fire spread attack on emergence
    if (elapsed >= 300 && elapsed < 400) {
      this.setAlpha(1)
      this.setScale(1)
      this.fireSpread(12, 180)
    }

    if (elapsed > 500) {
      this.finishAttack(time)
    }
  }

  private handleFireBreathPhase(time: number, elapsed: number, _playerX: number, _playerY: number): void {
    this.setVelocity(0, 0)

    // Charge up
    if (elapsed < 400) {
      this.pulseWarning(elapsed, 80)
      return
    }

    this.clearTint()

    // Sweep fire breath
    const sweepDuration = 1500
    const sweepElapsed = elapsed - 400

    if (sweepElapsed < sweepDuration) {
      const sweepProgress = sweepElapsed / sweepDuration
      this.breathAngle = this.breathStartAngle + sweepProgress * this.breathSweepRange

      // Fire projectiles continuously during sweep
      const expectedProjectiles = Math.floor(sweepElapsed / 50) // One every 50ms
      while (this.breathProjectileCount < expectedProjectiles) {
        const currentAngle = this.breathStartAngle + (this.breathProjectileCount / 30) * this.breathSweepRange
        this.bulletPool.spawn(this.x, this.y, currentAngle, 200)
        // Add some spread
        this.bulletPool.spawn(this.x, this.y, currentAngle + 0.1, 180)
        this.bulletPool.spawn(this.x, this.y, currentAngle - 0.1, 180)
        this.breathProjectileCount++
      }

      // Show breath cone
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        this.telegraphGraphics.lineStyle(4, 0xff6600, 0.6)
        this.telegraphGraphics.beginPath()
        this.telegraphGraphics.moveTo(this.x, this.y)
        const length = 200
        this.telegraphGraphics.lineTo(
          this.x + Math.cos(this.breathAngle) * length,
          this.y + Math.sin(this.breathAngle) * length
        )
        this.telegraphGraphics.strokePath()
      }
    }

    if (sweepElapsed >= sweepDuration) {
      this.clearTelegraphs()
      this.finishAttack(time)
    }
  }

  private prepareSlamAttack(playerX: number, playerY: number): void {
    this.slamStartX = this.x
    this.slamStartY = this.y

    // Slam toward player but extend past them
    const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    const distance = 400

    this.slamEndX = Phaser.Math.Clamp(this.x + Math.cos(angle) * distance, 50, 325)
    this.slamEndY = Phaser.Math.Clamp(this.y + Math.sin(angle) * distance, 100, 550)
    this.slamProgress = 0
  }

  private handleBodySlamPhase(time: number, elapsed: number): void {
    // Wind up
    if (elapsed < 600) {
      this.pulseWarning(elapsed, 100)

      // Show slam path
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        const alpha = elapsed / 600
        this.telegraphGraphics.lineStyle(20, 0xff4400, alpha * 0.4)
        this.telegraphGraphics.beginPath()
        this.telegraphGraphics.moveTo(this.slamStartX, this.slamStartY)
        this.telegraphGraphics.lineTo(this.slamEndX, this.slamEndY)
        this.telegraphGraphics.strokePath()
      }
      return
    }

    this.clearTint()
    this.clearTelegraphs()

    // Execute slam
    const slamDuration = 400
    const slamElapsed = elapsed - 600

    if (slamElapsed < slamDuration) {
      this.slamProgress = slamElapsed / slamDuration

      // Ease out movement
      const eased = 1 - Math.pow(1 - this.slamProgress, 2)

      this.x = Phaser.Math.Linear(this.slamStartX, this.slamEndX, eased)
      this.y = Phaser.Math.Linear(this.slamStartY, this.slamEndY, eased)

      // Leave fire trail
      if (slamElapsed % 50 < 20) {
        // Fire bullets behind as trail
        const trailAngle = Phaser.Math.Angle.Between(this.slamEndX, this.slamEndY, this.slamStartX, this.slamStartY)
        this.bulletPool.spawn(this.x, this.y, trailAngle + Math.PI / 2, 100)
        this.bulletPool.spawn(this.x, this.y, trailAngle - Math.PI / 2, 100)
      }

      // Update segments to follow
      this.updateSegments()
      return
    }

    // Recovery
    if (elapsed > 600 + slamDuration + 200) {
      this.finishAttack(time)
    }
  }

  private updateSegments(): void {
    // Each segment follows the one ahead of it
    let prevX = this.x
    let prevY = this.y

    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i]
      const dist = Phaser.Math.Distance.Between(seg.x, seg.y, prevX, prevY)

      if (dist > this.segmentSpacing) {
        const angle = Phaser.Math.Angle.Between(seg.x, seg.y, prevX, prevY)
        seg.x = prevX - Math.cos(angle) * this.segmentSpacing
        seg.y = prevY - Math.sin(angle) * this.segmentSpacing
      }

      this.drawSegment(seg, i)
      prevX = seg.x
      prevY = seg.y
    }
  }

  update(time: number, delta: number, playerX: number, playerY: number): boolean {
    const died = super.update(time, delta, playerX, playerY)

    // Update segment positions to follow head smoothly
    if (this.phase === 'idle') {
      this.updateSegments()
    }

    return died
  }

  destroy(fromScene?: boolean): void {
    // Clean up segments
    for (const seg of this.segments) {
      seg.graphics?.destroy()
    }
    this.segments = []

    super.destroy(fromScene)
  }
}
