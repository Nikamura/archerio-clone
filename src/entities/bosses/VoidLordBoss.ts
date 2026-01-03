import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'

type VoidLordPhase = 'idle' | 'darkness_zones' | 'tentacle_attack' | 'phase_shift'

interface DarknessZone {
  x: number
  y: number
  radius: number
  graphics: Phaser.GameObjects.Graphics
  createdAt: number
  pulseTimer: number
}

interface Tentacle {
  x: number
  y: number
  targetX: number
  targetY: number
  graphics: Phaser.GameObjects.Graphics
  createdAt: number
  struck: boolean
}

/**
 * Chapter 5 Boss 1: Void Lord
 * A shadow master that controls darkness.
 *
 * Attack Patterns:
 * 1. Darkness Zones - Creates zones that damage player while inside
 * 2. Shadow Tentacle Attacks - Tentacles emerge from ground to strike
 * 3. Phase Shift - Becomes invulnerable, moves to new position
 */
export default class VoidLordBoss extends BaseBoss {
  protected phase: VoidLordPhase = 'idle'

  // Darkness zone tracking
  private darknessZones: DarknessZone[] = []
  private zoneSpawnCount: number = 0
  private maxZones: number = 4
  private zoneDuration: number = 6000
  private zoneRadius: number = 50

  // Tentacle tracking
  private tentacles: Tentacle[] = []
  private maxTentacles: number = 6
  private tentacleWarningTime: number = 600
  private tentacleStrikeTime: number = 200

  // Phase shift tracking
  private isPhaseShifting: boolean = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, 'boss_void_lord', options)

    this.baseHealth = 400
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0))
    this.bossHealth = this.bossMaxHealth
    this.attackCooldown = 2300
    this.attackPatternCount = 3
    this.displaySize = 72

    this.setDisplaySize(this.displaySize, this.displaySize)
  }

  protected getPlaceholderColor(): number {
    return 0x4b0082 // Indigo/purple for void lord
  }

  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'darkness_zones'
        this.zoneSpawnCount = 0
        break
      case 1:
        this.phase = 'tentacle_attack'
        this.prepareTentacleAttack(playerX, playerY)
        break
      case 2:
        this.phase = 'phase_shift'
        this.isPhaseShifting = false
        break
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime

    switch (this.phase) {
      case 'darkness_zones':
        this.handleDarknessZonesPhase(time, elapsed, playerX, playerY)
        break
      case 'tentacle_attack':
        this.handleTentacleAttackPhase(time, elapsed)
        break
      case 'phase_shift':
        this.handlePhaseShiftPhase(time, elapsed, playerX, playerY)
        break
    }
  }

  private handleDarknessZonesPhase(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Spawn zones sequentially
    const spawnInterval = 400
    const expectedSpawns = Math.min(Math.floor(elapsed / spawnInterval), this.maxZones)

    while (this.zoneSpawnCount < expectedSpawns) {
      this.spawnDarknessZone(playerX, playerY, time)
      this.zoneSpawnCount++
    }

    // Fire projectiles while creating zones
    if (elapsed % 300 < 50 && elapsed > 200) {
      this.fireAtPlayer(playerX, playerY, 3, 180, 0.25)
    }

    // Finish after zones spawned
    if (elapsed > this.maxZones * spawnInterval + 500) {
      this.finishAttack(time)
    }
  }

  private spawnDarknessZone(playerX: number, playerY: number, time: number): void {
    // Spawn zones in positions that cut off escape routes
    const angle = Math.random() * Math.PI * 2
    const distance = 40 + Math.random() * 80

    const zoneX = Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 60, 315)
    const zoneY = Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 110, 540)

    const zone: DarknessZone = {
      x: zoneX,
      y: zoneY,
      radius: this.zoneRadius,
      graphics: this.scene.add.graphics(),
      createdAt: time,
      pulseTimer: 0,
    }
    zone.graphics.setDepth(0)

    this.darknessZones.push(zone)
  }

  private updateDarknessZones(time: number, playerX: number, playerY: number): void {
    for (let i = this.darknessZones.length - 1; i >= 0; i--) {
      const zone = this.darknessZones[i]
      const age = time - zone.createdAt

      // Remove expired zones
      if (age > this.zoneDuration) {
        zone.graphics?.destroy()
        this.darknessZones.splice(i, 1)
        continue
      }

      // Update visuals
      zone.graphics.clear()

      // Pulsing effect
      zone.pulseTimer = (zone.pulseTimer + 1) % 60
      const pulse = Math.sin(zone.pulseTimer / 60 * Math.PI * 2) * 0.2

      // Fade in and out
      let alpha = 0.6
      if (age < 300) {
        alpha = (age / 300) * 0.6
      } else if (age > this.zoneDuration - 500) {
        alpha = ((this.zoneDuration - age) / 500) * 0.6
      }

      // Draw dark zone
      zone.graphics.fillStyle(0x1a0033, alpha + pulse)
      zone.graphics.fillCircle(zone.x, zone.y, zone.radius)

      // Eerie border
      zone.graphics.lineStyle(2, 0x9932cc, alpha)
      zone.graphics.strokeCircle(zone.x, zone.y, zone.radius)

      // Inner swirl effect
      zone.graphics.lineStyle(1, 0x4b0082, alpha * 0.5)
      const swirl = (time / 1000 + i) % (Math.PI * 2)
      for (let j = 0; j < 3; j++) {
        const swirlAngle = swirl + j * (Math.PI * 2 / 3)
        const swirlRadius = zone.radius * 0.7
        zone.graphics.beginPath()
        zone.graphics.arc(
          zone.x,
          zone.y,
          swirlRadius,
          swirlAngle,
          swirlAngle + 0.5
        )
        zone.graphics.strokePath()
      }

      // Check if player is in zone and deal damage
      const distToPlayer = Phaser.Math.Distance.Between(zone.x, zone.y, playerX, playerY)
      if (distToPlayer < zone.radius && Math.random() < 0.03) {
        // Spawn slow bullet at player inside zone
        this.bulletPool.spawn(zone.x, zone.y,
          Phaser.Math.Angle.Between(zone.x, zone.y, playerX, playerY), 80)
      }
    }
  }

  private prepareTentacleAttack(playerX: number, playerY: number): void {
    this.tentacles = []

    // Create tentacle warning positions around and toward player
    for (let i = 0; i < this.maxTentacles; i++) {
      const angle = (Math.PI * 2 * i) / this.maxTentacles + Math.random() * 0.3
      const distance = 40 + Math.random() * 100

      const tentacleX = Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 50, 325)
      const tentacleY = Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 100, 550)

      const tentacle: Tentacle = {
        x: tentacleX,
        y: tentacleY,
        targetX: playerX,
        targetY: playerY,
        graphics: this.scene.add.graphics(),
        createdAt: this.phaseStartTime + i * 150, // Stagger spawn times
        struck: false,
      }
      tentacle.graphics.setDepth(1)

      this.tentacles.push(tentacle)
    }
  }

  private handleTentacleAttackPhase(time: number, elapsed: number): void {
    this.setVelocity(0, 0)

    let allDone = true

    for (const tentacle of this.tentacles) {
      const tentacleElapsed = time - tentacle.createdAt
      if (tentacleElapsed < 0) {
        allDone = false
        continue
      }

      tentacle.graphics.clear()

      // Warning phase - ground indicator
      if (tentacleElapsed < this.tentacleWarningTime) {
        allDone = false
        const warningProgress = tentacleElapsed / this.tentacleWarningTime
        const warningAlpha = 0.3 + warningProgress * 0.4

        // Warning circle on ground
        tentacle.graphics.lineStyle(2, 0x9932cc, warningAlpha)
        tentacle.graphics.strokeCircle(tentacle.x, tentacle.y, 15 + warningProgress * 10)
        tentacle.graphics.fillStyle(0x4b0082, warningAlpha * 0.3)
        tentacle.graphics.fillCircle(tentacle.x, tentacle.y, 15)
      }
      // Strike phase
      else if (tentacleElapsed < this.tentacleWarningTime + this.tentacleStrikeTime) {
        allDone = false
        const strikeProgress = (tentacleElapsed - this.tentacleWarningTime) / this.tentacleStrikeTime

        // Tentacle emerges
        const height = 60 * strikeProgress
        tentacle.graphics.fillStyle(0x1a0033, 0.9)

        // Draw tentacle as a curved shape
        tentacle.graphics.beginPath()
        tentacle.graphics.moveTo(tentacle.x - 8, tentacle.y)
        tentacle.graphics.lineTo(tentacle.x - 6, tentacle.y - height * 0.5)
        tentacle.graphics.lineTo(tentacle.x - 3, tentacle.y - height)
        tentacle.graphics.lineTo(tentacle.x + 3, tentacle.y - height)
        tentacle.graphics.lineTo(tentacle.x + 6, tentacle.y - height * 0.5)
        tentacle.graphics.lineTo(tentacle.x + 8, tentacle.y)
        tentacle.graphics.closePath()
        tentacle.graphics.fillPath()

        // Tentacle tip
        tentacle.graphics.fillStyle(0x9932cc, 1)
        tentacle.graphics.fillCircle(tentacle.x, tentacle.y - height, 5)

        // Fire projectile on strike
        if (!tentacle.struck && strikeProgress > 0.8) {
          tentacle.struck = true
          const angleToTarget = Phaser.Math.Angle.Between(
            tentacle.x, tentacle.y - height,
            tentacle.targetX, tentacle.targetY
          )
          this.bulletPool.spawn(tentacle.x, tentacle.y - height, angleToTarget, 200)
        }
      }
      // Retract phase
      else if (tentacleElapsed < this.tentacleWarningTime + this.tentacleStrikeTime + 300) {
        allDone = false
        const retractProgress = (tentacleElapsed - this.tentacleWarningTime - this.tentacleStrikeTime) / 300
        const height = 60 * (1 - retractProgress)

        tentacle.graphics.fillStyle(0x1a0033, 0.9 * (1 - retractProgress))
        tentacle.graphics.fillRect(tentacle.x - 6, tentacle.y - height, 12, height)
      }
    }

    if (allDone && elapsed > 2000) {
      this.cleanupTentacles()
      this.finishAttack(time)
    }
  }

  private handlePhaseShiftPhase(time: number, elapsed: number, _playerX: number, _playerY: number): void {
    // Fade out
    if (elapsed < 400) {
      const fadeProgress = elapsed / 400
      this.setAlpha(1 - fadeProgress * 0.8)
      this.setTint(0x4b0082)

      // Swirling effect
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        for (let i = 0; i < 3; i++) {
          const angle = (elapsed / 200 + i * Math.PI * 2 / 3) % (Math.PI * 2)
          const radius = 50 * (1 - fadeProgress)
          this.telegraphGraphics.lineStyle(2, 0x9932cc, 0.7)
          this.telegraphGraphics.strokeCircle(
            this.x + Math.cos(angle) * radius,
            this.y + Math.sin(angle) * radius,
            10
          )
        }
      }
      return
    }

    // Invulnerable and move to new position
    if (!this.isPhaseShifting && elapsed >= 400) {
      this.isPhaseShifting = true
      this.setVisible(false)

      // Move to random position
      this.x = Phaser.Math.Between(100, 275)
      this.y = Phaser.Math.Between(150, 400)
    }

    // Appear phase
    if (elapsed >= 800 && elapsed < 1200) {
      if (!this.visible) {
        this.setVisible(true)
      }

      const appearProgress = (elapsed - 800) / 400
      this.setAlpha(0.2 + appearProgress * 0.8)

      // Portal effect
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        const portalRadius = 40 * (1 - appearProgress)
        this.telegraphGraphics.lineStyle(3, 0x9932cc, appearProgress)
        this.telegraphGraphics.strokeCircle(this.x, this.y, portalRadius)
      }
    }

    // Attack after appearing
    if (elapsed >= 1200 && elapsed < 1300) {
      this.setAlpha(1)
      this.clearTint()
      this.clearTelegraphs()

      // Burst attack after phase shift
      if (elapsed >= 1200 && elapsed < 1250) {
        this.fireSpread(10, 180)
      }
    }

    if (elapsed > 1500) {
      this.finishAttack(time)
    }
  }

  private cleanupTentacles(): void {
    for (const tentacle of this.tentacles) {
      tentacle.graphics?.destroy()
    }
    this.tentacles = []
  }

  takeDamage(amount: number): boolean {
    // Immune during phase shift
    if (this.isPhaseShifting) {
      return false
    }
    return super.takeDamage(amount)
  }

  update(time: number, delta: number, playerX: number, playerY: number): boolean {
    const died = super.update(time, delta, playerX, playerY)

    // Update darkness zones
    this.updateDarknessZones(time, playerX, playerY)

    return died
  }

  destroy(fromScene?: boolean): void {
    // Cleanup zones
    for (const zone of this.darknessZones) {
      zone.graphics?.destroy()
    }
    this.darknessZones = []

    // Cleanup tentacles
    this.cleanupTentacles()

    super.destroy(fromScene)
  }
}
