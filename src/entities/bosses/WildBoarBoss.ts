import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import { getBossDefinition } from '../../config/bossData'

/**
 * Wild Boar Boss - Chapter 2 Forest Ruins
 *
 * Attack Patterns:
 * 1. Fast Charge - Faster version of demon's charge attack
 * 2. Ground Stomp - Radial shockwave that damages nearby player
 * 3. Summon Minions - Spawns small boar minions to chase player
 */
export default class WildBoarBoss extends BaseBoss {
  // Fast charge attack
  private chargeTargetX: number = 0
  private chargeTargetY: number = 0
  private readonly chargeSpeed = 500 // Faster than demon (400)
  private chargeTelegraph: Phaser.GameObjects.Line | null = null

  // Ground stomp attack
  private stompWave: Phaser.GameObjects.Arc | null = null
  private stompRadius: number = 0
  private readonly maxStompRadius = 150
  private readonly stompSpeed = 400 // pixels per second

  // Summon minions - stored externally via callback
  private onSpawnMinion?: (x: number, y: number) => void

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, getBossDefinition('wild_boar'), options)

    // Create charge telegraph
    this.chargeTelegraph = this.createTelegraphLine(0.6)
    this.chargeTelegraph.setStrokeStyle(3, 0xff6600, 1) // Orange for charging
  }

  /**
   * Set callback for spawning minions (called by GameScene)
   */
  setMinionSpawnCallback(callback: (x: number, y: number) => void): void {
    this.onSpawnMinion = callback
  }

  protected selectAttackPhase(pattern: number, _playerX: number, _playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'fast_charge'
        break
      case 1:
        this.phase = 'ground_stomp'
        break
      case 2:
        this.phase = 'summon_minions'
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    this.handleCustomPhase(time, playerX, playerY)
  }

  private handleCustomPhase(time: number, playerX: number, playerY: number): void {
    switch (this.phase) {
      // Fast Charge Attack
      case 'fast_charge':
        this.handleChargeWindup(time, playerX, playerY)
        break
      case 'charging':
        this.handleCharging(time)
        break

      // Ground Stomp Attack
      case 'ground_stomp':
        this.handleStompWindup(time)
        break
      case 'stomping':
        this.handleStomping(time)
        break

      // Summon Minions
      case 'summon_minions':
        this.handleSummonMinions(time)
        break

      default:
        this.finishAttack(time)
    }
  }

  // ==========================================
  // Fast Charge Attack
  // ==========================================

  private handleChargeWindup(time: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)
    const windupDuration = 400 // Faster windup than demon (600)

    // Track player position during windup
    this.chargeTargetX = playerX
    this.chargeTargetY = playerY

    // Show charge telegraph
    if (this.chargeTelegraph) {
      const lineLength = 400
      const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      const endX = this.x + Math.cos(angle) * lineLength
      const endY = this.y + Math.sin(angle) * lineLength

      this.chargeTelegraph.setTo(this.x, this.y, endX, endY)
      this.chargeTelegraph.setVisible(true)

      const elapsed = time - this.phaseStartTime
      const alpha = 0.3 + (elapsed / windupDuration) * 0.6
      this.chargeTelegraph.setAlpha(alpha)
    }

    // Warning pulse
    const elapsed = time - this.phaseStartTime
    this.showWarningPulse(elapsed)

    if (elapsed > windupDuration) {
      this.clearWarningPulse()
      if (this.chargeTelegraph) {
        this.chargeTelegraph.setVisible(false)
      }

      // Start charging
      this.phase = 'charging'
      this.phaseStartTime = time

      // Calculate charge direction
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.chargeTargetX, this.chargeTargetY)
      this.setVelocity(
        Math.cos(angle) * this.chargeSpeed,
        Math.sin(angle) * this.chargeSpeed
      )
    }
  }

  private handleCharging(time: number): void {
    const chargeDuration = 400 // Charge for 0.4 seconds max
    const elapsed = time - this.phaseStartTime

    // Check if reached target or time expired
    const distToTarget = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.chargeTargetX, this.chargeTargetY
    )

    // Dust trail effect
    if (elapsed % 50 < 16) { // Every 50ms
      this.createDustParticle()
    }

    if (elapsed > chargeDuration || distToTarget < 30) {
      // Stop and create impact effect
      this.setVelocity(0, 0)
      this.createImpactEffect()
      this.finishAttack(time)
    }
  }

  private createDustParticle(): void {
    const dust = this.scene.add.circle(
      this.x + Phaser.Math.Between(-20, 20),
      this.y + Phaser.Math.Between(-10, 10),
      Phaser.Math.Between(5, 10),
      0x8b4513,
      0.6
    )
    dust.setDepth(0)

    this.scene.tweens.add({
      targets: dust,
      alpha: 0,
      scale: 2,
      y: dust.y + 20,
      duration: 300,
      onComplete: () => dust.destroy()
    })
  }

  private createImpactEffect(): void {
    // Small shockwave on impact
    const impact = this.scene.add.circle(this.x, this.y, 10, 0x8b4513, 0.5)
    this.scene.tweens.add({
      targets: impact,
      radius: 50,
      alpha: 0,
      duration: 200,
      onComplete: () => impact.destroy()
    })
  }

  // ==========================================
  // Ground Stomp Attack
  // ==========================================

  private handleStompWindup(time: number): void {
    this.setVelocity(0, 0)
    const windupDuration = 500

    const elapsed = time - this.phaseStartTime

    // Jump up animation (shrink then grow)
    const progress = elapsed / windupDuration
    if (progress < 0.5) {
      const scale = 1 + progress * 0.3 // Grow during charge
      this.setScale(scale)
    } else {
      this.setScale(1.15) // Hold at max
    }

    this.showWarningPulse(elapsed)

    if (elapsed > windupDuration) {
      this.clearWarningPulse()
      this.setScale(1)
      this.phase = 'stomping'
      this.phaseStartTime = time
      this.stompRadius = 0

      // Create stomp wave
      this.stompWave = this.scene.add.arc(this.x, this.y, 10, 0, 360, false, 0x8b4513, 0)
      this.stompWave.setStrokeStyle(6, 0x8b4513, 1)
      this.stompWave.setDepth(0)

      // Screen shake effect
      this.scene.cameras.main.shake(200, 0.01)
    }
  }

  private handleStomping(time: number): void {
    const elapsed = time - this.phaseStartTime
    const deltaTime = elapsed / 1000 // Convert to seconds

    // Expand stomp wave
    this.stompRadius = Math.min(deltaTime * this.stompSpeed + 10, this.maxStompRadius)

    if (this.stompWave) {
      this.stompWave.setRadius(this.stompRadius)
      const alpha = 1 - (this.stompRadius / this.maxStompRadius)
      this.stompWave.setStrokeStyle(6 - 4 * (this.stompRadius / this.maxStompRadius), 0x8b4513, alpha)
    }

    if (this.stompRadius >= this.maxStompRadius) {
      // Clean up
      if (this.stompWave) {
        this.stompWave.destroy()
        this.stompWave = null
      }
      this.finishAttack(time)
    }
  }

  /**
   * Get stomp damage radius for external collision check
   */
  getStompRadius(): number {
    return this.phase === 'stomping' ? this.stompRadius : 0
  }

  // ==========================================
  // Summon Minions Attack
  // ==========================================

  private handleSummonMinions(time: number): void {
    this.setVelocity(0, 0)
    const summonDuration = 1000

    const elapsed = time - this.phaseStartTime

    // Roar animation
    if (elapsed < 200) {
      const scale = 1 + (elapsed / 200) * 0.2
      this.setScale(scale, scale)
      this.setTint(0xff6600) // Orange glow during roar
    } else if (elapsed < 400) {
      this.setScale(1.2, 1.2)
    } else if (elapsed < 500) {
      this.setScale(1)
      this.clearWarningPulse()

      // Spawn minions once
      if (!this.getData('minionsSummoned')) {
        this.setData('minionsSummoned', true)
        this.spawnMinions()
      }
    }

    if (elapsed > summonDuration) {
      this.setData('minionsSummoned', false)
      this.finishAttack(time)
    }
  }

  private spawnMinions(): void {
    if (!this.onSpawnMinion) {
      console.warn('WildBoarBoss: No minion spawn callback set')
      return
    }

    // Spawn 2-3 small boar minions around the boss
    const numMinions = Phaser.Math.Between(2, 3)
    for (let i = 0; i < numMinions; i++) {
      const angle = (Math.PI * 2 * i) / numMinions
      const distance = 60
      const minionX = this.x + Math.cos(angle) * distance
      const minionY = this.y + Math.sin(angle) * distance

      // Spawn effect
      const spawnEffect = this.scene.add.circle(minionX, minionY, 20, 0x8b4513, 0.7)
      this.scene.tweens.add({
        targets: spawnEffect,
        scale: 2,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          spawnEffect.destroy()
          // Actually spawn the minion
          this.onSpawnMinion!(minionX, minionY)
        }
      })
    }
  }

  destroy(fromScene?: boolean): void {
    if (this.chargeTelegraph) {
      this.chargeTelegraph.destroy()
      this.chargeTelegraph = null
    }
    if (this.stompWave) {
      this.stompWave.destroy()
      this.stompWave = null
    }
    super.destroy(fromScene)
  }
}
