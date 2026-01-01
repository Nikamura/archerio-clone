import Phaser from 'phaser'
import Enemy from './Enemy'
import EnemyBulletPool from '../systems/EnemyBulletPool'

type BossPhase = 'idle' | 'spread' | 'barrage_aim' | 'barrage_fire' | 'charge_windup' | 'charging'

export default class Boss extends Enemy {
  private bulletPool: EnemyBulletPool
  private phase: BossPhase = 'idle'
  private phaseStartTime: number = 0
  private lastAttackTime: number = 0
  private attackCooldown: number = 2000 // 2 seconds between attacks
  private attackPattern: number = 0 // Cycles through 0, 1, 2 for different attacks

  // Telegraph line for barrage attack
  private telegraphLines: Phaser.GameObjects.Line[] = []

  // Charge attack properties
  private chargeTargetX: number = 0
  private chargeTargetY: number = 0
  private chargeSpeed: number = 400

  // Boss-specific properties
  private bossHealth: number
  private bossMaxHealth: number

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

    // Apply difficulty modifiers to boss health
    const baseHealth = 200
    this.bossMaxHealth = Math.round(baseHealth * (options?.healthMultiplier ?? 1.0))
    this.bossHealth = this.bossMaxHealth

    // Use boss sprite
    this.setTexture('bossSprite')
    this.setDisplaySize(64, 64)

    // Create telegraph lines for barrage (3 lines)
    for (let i = 0; i < 3; i++) {
      const line = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.7)
      line.setOrigin(0, 0)
      line.setVisible(false)
      line.setDepth(0)
      line.setLineWidth(2)
      this.telegraphLines.push(line)
    }

    console.log('Boss created at', x, y, 'with', this.bossHealth, 'HP')
  }

  getHealth(): number {
    return this.bossHealth
  }

  getMaxHealth(): number {
    return this.bossMaxHealth
  }

  takeDamage(amount: number): boolean {
    this.bossHealth -= amount

    // Flash effect (red tint for boss)
    this.setTint(0xff0000)
    this.scene.time.delayedCall(100, () => {
      this.clearTint()
    })

    if (this.bossHealth <= 0) {
      return true // Boss died
    }
    return false
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Note: Boss doesn't call super.update() because it uses its own health system
    // and fire DOT would need to be integrated with bossHealth

    switch (this.phase) {
      case 'idle':
        this.handleIdlePhase(time, playerX, playerY)
        break
      case 'spread':
        this.handleSpreadPhase(time)
        break
      case 'barrage_aim':
        this.handleBarrageAimPhase(time, playerX, playerY)
        break
      case 'barrage_fire':
        this.handleBarrageFirePhase(time, playerX, playerY)
        break
      case 'charge_windup':
        this.handleChargeWindupPhase(time, playerX, playerY)
        break
      case 'charging':
        this.handleChargingPhase(time)
        break
    }

    return false
  }

  private handleIdlePhase(time: number, playerX: number, playerY: number) {
    // Slow movement toward center of screen when idle
    const centerX = 375 / 2
    const centerY = 667 / 2 - 50 // Slightly above center

    const distToCenter = Phaser.Math.Distance.Between(this.x, this.y, centerX, centerY)

    if (distToCenter > 50) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, centerX, centerY)
      this.setVelocity(Math.cos(angle) * 40, Math.sin(angle) * 40)
    } else {
      this.setVelocity(0, 0)
    }

    // Start next attack after cooldown
    if (time - this.lastAttackTime > this.attackCooldown) {
      this.startNextAttack(time, playerX, playerY)
    }
  }

  private startNextAttack(time: number, playerX: number, playerY: number) {
    this.phaseStartTime = time

    // Cycle through attack patterns
    switch (this.attackPattern) {
      case 0:
        this.phase = 'spread'
        break
      case 1:
        this.phase = 'barrage_aim'
        break
      case 2:
        this.phase = 'charge_windup'
        this.chargeTargetX = playerX
        this.chargeTargetY = playerY
        break
    }

    this.attackPattern = (this.attackPattern + 1) % 3
  }

  // Attack Pattern 1: Spread Shot - 8 projectiles in circular pattern
  private handleSpreadPhase(time: number) {
    this.setVelocity(0, 0)

    // Slight delay before firing
    if (time - this.phaseStartTime > 300) {
      this.fireSpreadAttack()
      this.phase = 'idle'
      this.lastAttackTime = time
    }
  }

  private fireSpreadAttack() {
    const numProjectiles = 8
    const speed = 180

    for (let i = 0; i < numProjectiles; i++) {
      const angle = (Math.PI * 2 * i) / numProjectiles
      this.bulletPool.spawn(this.x, this.y, angle, speed)
    }

    // Second wave slightly offset
    this.scene.time.delayedCall(200, () => {
      if (!this.active) return
      for (let i = 0; i < numProjectiles; i++) {
        const angle = (Math.PI * 2 * i) / numProjectiles + Math.PI / 8 // Offset by 22.5 degrees
        this.bulletPool.spawn(this.x, this.y, angle, speed)
      }
    })
  }

  // Attack Pattern 2: Barrage - Telegraph then fire 3 fast projectiles at player
  private handleBarrageAimPhase(time: number, playerX: number, playerY: number) {
    this.setVelocity(0, 0)

    const aimDuration = 800 // 0.8 seconds to aim
    const elapsed = time - this.phaseStartTime

    // Show telegraph lines (3 lines spread around player)
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    const spreadAngle = 0.15 // Small spread

    for (let i = 0; i < 3; i++) {
      const angleOffset = (i - 1) * spreadAngle
      const angle = baseAngle + angleOffset
      const lineLength = 400
      const endX = this.x + Math.cos(angle) * lineLength
      const endY = this.y + Math.sin(angle) * lineLength

      this.telegraphLines[i].setTo(this.x, this.y, endX, endY)
      this.telegraphLines[i].setVisible(true)

      // Flash effect as attack approaches
      const alpha = 0.3 + (elapsed / aimDuration) * 0.5
      this.telegraphLines[i].setAlpha(alpha)
    }

    if (elapsed > aimDuration) {
      this.phase = 'barrage_fire'
      this.phaseStartTime = time
    }
  }

  private handleBarrageFirePhase(time: number, playerX: number, playerY: number) {
    // Hide telegraph lines
    this.telegraphLines.forEach(line => line.setVisible(false))

    // Fire 3 fast projectiles
    const baseAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
    const spreadAngle = 0.15
    const speed = 350 // Fast projectiles

    for (let i = 0; i < 3; i++) {
      const angleOffset = (i - 1) * spreadAngle
      this.bulletPool.spawn(this.x, this.y, baseAngle + angleOffset, speed)
    }

    this.phase = 'idle'
    this.lastAttackTime = time
  }

  // Attack Pattern 3: Charge - Wind up then dash toward player
  private handleChargeWindupPhase(time: number, playerX: number, playerY: number) {
    this.setVelocity(0, 0)

    const windupDuration = 600 // 0.6 seconds warning
    const elapsed = time - this.phaseStartTime

    // Visual warning - pulse red
    if (Math.floor(elapsed / 100) % 2 === 0) {
      this.setTint(0xff0000)
    } else {
      this.clearTint()
    }

    // Update charge target to current player position
    this.chargeTargetX = playerX
    this.chargeTargetY = playerY

    if (elapsed > windupDuration) {
      this.clearTint()
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

  private handleChargingPhase(time: number) {
    const chargeDuration = 500 // Charge for 0.5 seconds max
    const elapsed = time - this.phaseStartTime

    // Check if reached target or time expired
    const distToTarget = Phaser.Math.Distance.Between(
      this.x, this.y,
      this.chargeTargetX, this.chargeTargetY
    )

    if (elapsed > chargeDuration || distToTarget < 30) {
      this.setVelocity(0, 0)
      this.phase = 'idle'
      this.lastAttackTime = time
    }
  }

  destroy(fromScene?: boolean) {
    // Clean up telegraph lines
    this.telegraphLines.forEach(line => {
      if (line) line.destroy()
    })
    this.telegraphLines = []

    super.destroy(fromScene)
  }
}
