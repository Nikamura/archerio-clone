import Phaser from 'phaser'
import BaseBoss, { BossOptions } from './BaseBoss'
import EnemyBulletPool from '../../systems/EnemyBulletPool'

type FinalBossPhase =
  | 'idle'
  | 'phase_transition'
  | 'fire_barrage'
  | 'void_summon'
  | 'meteor_storm'
  | 'clone_assault'
  | 'ultimate_attack'
  | 'minion_summon'

interface MinionSpawn {
  x: number
  y: number
  graphics: Phaser.GameObjects.Graphics
  health: number
  type: 'melee' | 'ranged' | 'spreader'
  active: boolean
}

/**
 * Chapter 5 Final Boss: The Void Emperor
 * The ultimate challenge that combines attacks from all previous bosses.
 *
 * Phases:
 * - Phase 1 (100-70% HP): Fire attacks (from Volcanic Depths bosses)
 * - Phase 2 (70-40% HP): Shadow attacks (from Shadow Realm bosses)
 * - Phase 3 (40-0% HP): Combined attacks with minion summons
 *
 * Attack Patterns per phase:
 * Phase 1: Fire Barrage, Meteor Storm
 * Phase 2: Void Summon, Clone Assault
 * Phase 3: All attacks + Minion Summons + Ultimate Attack
 */
export default class FinalBoss extends BaseBoss {
  protected phase: FinalBossPhase = 'idle'

  // Phase tracking
  private currentBossPhase: 1 | 2 | 3 = 1
  private phaseTransitioning: boolean = false
  private phase2Threshold: number = 0.7 // 70% HP
  private phase3Threshold: number = 0.4 // 40% HP

  // Fire barrage tracking
  private barrageWaves: number = 0
  private barrageMaxWaves: number = 3

  // Meteor storm tracking
  private meteorTargets: { x: number; y: number; delay: number }[] = []
  private meteorsLaunched: number = 0

  // Void summon tracking
  private voidZones: { x: number; y: number; graphics: Phaser.GameObjects.Graphics; age: number }[] = []

  // Clone tracking
  private clonePositions: { x: number; y: number; graphics: Phaser.GameObjects.Graphics }[] = []
  private clonesFired: boolean = false

  // Ultimate attack tracking
  private ultimateWaves: number = 0

  // Minion tracking
  private minions: MinionSpawn[] = []
  private minionSpawnedThisPhase: boolean = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bulletPool: EnemyBulletPool,
    options?: BossOptions
  ) {
    super(scene, x, y, bulletPool, 'finalBoss', options)

    this.baseHealth = 600 // Much higher HP for final boss
    this.bossMaxHealth = Math.round(this.baseHealth * (options?.healthMultiplier ?? 1.0))
    this.bossHealth = this.bossMaxHealth
    this.attackCooldown = 1800 // Faster attacks
    this.attackPatternCount = 2 // Per phase
    this.displaySize = 96 // Larger boss

    this.setDisplaySize(this.displaySize, this.displaySize)
  }

  protected getPlaceholderColor(): number {
    return 0x1a0a2e // Very dark purple for final boss
  }

  protected selectAttackPhase(pattern: number, playerX: number, playerY: number): void {
    // Check for phase transitions
    this.checkPhaseTransition()

    if (this.phaseTransitioning) {
      this.phase = 'phase_transition'
      return
    }

    // Select attack based on current boss phase
    switch (this.currentBossPhase) {
      case 1:
        this.selectPhase1Attack(pattern, playerX, playerY)
        break
      case 2:
        this.selectPhase2Attack(pattern, playerX, playerY)
        break
      case 3:
        this.selectPhase3Attack(pattern, playerX, playerY)
        break
    }
  }

  private selectPhase1Attack(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'fire_barrage'
        this.barrageWaves = 0
        break
      case 1:
        this.phase = 'meteor_storm'
        this.prepareMeteorStorm(playerX, playerY)
        break
    }
  }

  private selectPhase2Attack(pattern: number, playerX: number, playerY: number): void {
    switch (pattern) {
      case 0:
        this.phase = 'void_summon'
        break
      case 1:
        this.phase = 'clone_assault'
        this.prepareCloneAssault(playerX, playerY)
        break
    }
  }

  private selectPhase3Attack(pattern: number, playerX: number, playerY: number): void {
    // Phase 3 has more attack variety
    const attackRoll = Math.random()

    // Occasionally summon minions
    if (!this.minionSpawnedThisPhase && attackRoll < 0.2) {
      this.phase = 'minion_summon'
      this.minionSpawnedThisPhase = true
      return
    }

    // Ultimate attack at low HP
    if (this.bossHealth / this.bossMaxHealth < 0.2 && attackRoll < 0.3) {
      this.phase = 'ultimate_attack'
      this.ultimateWaves = 0
      return
    }

    // Mix of previous phases
    switch (pattern) {
      case 0:
        if (Math.random() < 0.5) {
          this.phase = 'fire_barrage'
          this.barrageWaves = 0
        } else {
          this.phase = 'void_summon'
        }
        break
      case 1:
        if (Math.random() < 0.5) {
          this.phase = 'meteor_storm'
          this.prepareMeteorStorm(playerX, playerY)
        } else {
          this.phase = 'clone_assault'
          this.prepareCloneAssault(playerX, playerY)
        }
        break
    }
  }

  private checkPhaseTransition(): void {
    const hpPercent = this.bossHealth / this.bossMaxHealth

    if (this.currentBossPhase === 1 && hpPercent <= this.phase2Threshold) {
      this.currentBossPhase = 2
      this.phaseTransitioning = true
      this.attackPatternCount = 2
      console.log('Final Boss entering Phase 2!')
    } else if (this.currentBossPhase === 2 && hpPercent <= this.phase3Threshold) {
      this.currentBossPhase = 3
      this.phaseTransitioning = true
      this.attackCooldown = 1500 // Even faster in phase 3
      this.minionSpawnedThisPhase = false
      console.log('Final Boss entering Phase 3!')
    }
  }

  protected handleAttackPhase(time: number, playerX: number, playerY: number): void {
    const elapsed = time - this.phaseStartTime

    switch (this.phase) {
      case 'phase_transition':
        this.handlePhaseTransition(time, elapsed)
        break
      case 'fire_barrage':
        this.handleFireBarrage(time, elapsed, playerX, playerY)
        break
      case 'meteor_storm':
        this.handleMeteorStorm(time, elapsed)
        break
      case 'void_summon':
        this.handleVoidSummon(time, elapsed, playerX, playerY)
        break
      case 'clone_assault':
        this.handleCloneAssault(time, elapsed, playerX, playerY)
        break
      case 'ultimate_attack':
        this.handleUltimateAttack(time, elapsed, playerX, playerY)
        break
      case 'minion_summon':
        this.handleMinionSummon(time, elapsed)
        break
    }
  }

  private handlePhaseTransition(time: number, elapsed: number): void {
    this.setVelocity(0, 0)

    // Dramatic phase transition
    if (elapsed < 1500) {
      // Pulsing glow
      const pulse = Math.sin(elapsed / 100) * 0.3 + 0.7

      // Phase-specific color
      const color = this.currentBossPhase === 2 ? 0x4b0082 : 0xff0066
      this.setTint(color)
      this.setAlpha(pulse)

      // Expanding shockwave
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        const radius = (elapsed / 1500) * 200
        this.telegraphGraphics.lineStyle(5, color, 0.6)
        this.telegraphGraphics.strokeCircle(this.x, this.y, radius)
      }

      // Screen shake
      const shake = Math.sin(elapsed / 20) * 3
      this.scene.cameras.main.setScroll(shake, shake * 0.5)

      // Burst of projectiles during transition
      if (elapsed % 200 < 30) {
        this.fireSpread(12, 180)
      }
    } else {
      this.phaseTransitioning = false
      this.clearTint()
      this.setAlpha(1)
      this.clearTelegraphs()
      this.scene.cameras.main.setScroll(0, 0)
      this.finishAttack(time)
    }
  }

  private handleFireBarrage(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    const waveInterval = 400
    const expectedWaves = Math.floor(elapsed / waveInterval)

    if (this.barrageWaves < expectedWaves && this.barrageWaves < this.barrageMaxWaves) {
      // Fire a wave of projectiles
      const numProjectiles = 10 + this.currentBossPhase * 2
      this.fireSpread(numProjectiles, 200, this.barrageWaves * 0.1)

      // Also aim at player
      this.fireAtPlayer(playerX, playerY, 3, 250, 0.2)

      this.barrageWaves++
    }

    if (elapsed > this.barrageMaxWaves * waveInterval + 300) {
      this.finishAttack(time)
    }
  }

  private prepareMeteorStorm(playerX: number, playerY: number): void {
    this.meteorTargets = []
    this.meteorsLaunched = 0

    const meteorCount = 8 + this.currentBossPhase * 2

    for (let i = 0; i < meteorCount; i++) {
      // Some meteors target player area, some are random
      let targetX, targetY

      if (i < meteorCount / 2) {
        // Near player
        const angle = Math.random() * Math.PI * 2
        const dist = Math.random() * 80
        targetX = Phaser.Math.Clamp(playerX + Math.cos(angle) * dist, 50, 325)
        targetY = Phaser.Math.Clamp(playerY + Math.sin(angle) * dist, 100, 550)
      } else {
        // Random
        targetX = Phaser.Math.Between(50, 325)
        targetY = Phaser.Math.Between(100, 550)
      }

      this.meteorTargets.push({
        x: targetX,
        y: targetY,
        delay: i * 100,
      })
    }
  }

  private handleMeteorStorm(time: number, elapsed: number): void {
    this.setVelocity(0, 0)

    // Telegraph phase
    if (elapsed < 800) {
      this.clearTelegraphs()
      const alpha = 0.3 + (elapsed / 800) * 0.4
      for (const target of this.meteorTargets) {
        this.drawTelegraphCircle(target.x, target.y, 25, alpha)
      }
      return
    }

    this.clearTelegraphs()

    // Launch meteors
    for (let i = 0; i < this.meteorTargets.length; i++) {
      if (i >= this.meteorsLaunched) {
        const target = this.meteorTargets[i]
        if (elapsed >= 800 + target.delay) {
          // Fire meteor from above
          this.bulletPool.spawn(target.x, target.y - 100, Math.PI / 2, 350)
          this.meteorsLaunched++
        }
      }
    }

    if (elapsed > 800 + this.meteorTargets.length * 100 + 300) {
      this.finishAttack(time)
    }
  }

  private handleVoidSummon(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Spawn void zones around player
    if (elapsed < 400 && this.voidZones.length === 0) {
      const zoneCount = 3 + this.currentBossPhase

      for (let i = 0; i < zoneCount; i++) {
        const angle = (Math.PI * 2 * i) / zoneCount
        const distance = 60 + Math.random() * 40

        const zoneX = Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 60, 315)
        const zoneY = Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 110, 540)

        const zone = {
          x: zoneX,
          y: zoneY,
          graphics: this.scene.add.graphics(),
          age: 0,
        }
        zone.graphics.setDepth(0)
        this.voidZones.push(zone)
      }
    }

    // Update zones
    for (const zone of this.voidZones) {
      zone.age = elapsed
      zone.graphics.clear()

      // Warning phase
      if (elapsed < 600) {
        const alpha = elapsed / 600 * 0.6
        zone.graphics.fillStyle(0x1a0033, alpha)
        zone.graphics.fillCircle(zone.x, zone.y, 40)
        zone.graphics.lineStyle(2, 0x9932cc, alpha)
        zone.graphics.strokeCircle(zone.x, zone.y, 40)
      }
      // Active phase - fire projectiles
      else if (elapsed < 2000) {
        zone.graphics.fillStyle(0x1a0033, 0.6)
        zone.graphics.fillCircle(zone.x, zone.y, 45)

        if (elapsed % 300 < 30) {
          const angleToPlayer = Phaser.Math.Angle.Between(zone.x, zone.y, playerX, playerY)
          this.bulletPool.spawn(zone.x, zone.y, angleToPlayer, 160)
        }
      }
      // Fade out
      else {
        const fadeAlpha = 1 - (elapsed - 2000) / 500
        zone.graphics.fillStyle(0x1a0033, fadeAlpha * 0.6)
        zone.graphics.fillCircle(zone.x, zone.y, 40 * fadeAlpha)
      }
    }

    if (elapsed > 2500) {
      this.cleanupVoidZones()
      this.finishAttack(time)
    }
  }

  private prepareCloneAssault(playerX: number, playerY: number): void {
    this.clonePositions = []
    this.clonesFired = false

    const cloneCount = 3 + this.currentBossPhase

    for (let i = 0; i < cloneCount; i++) {
      const angle = (Math.PI * 2 * i) / cloneCount
      const distance = 100

      const cloneX = Phaser.Math.Clamp(playerX + Math.cos(angle) * distance, 50, 325)
      const cloneY = Phaser.Math.Clamp(playerY + Math.sin(angle) * distance, 100, 550)

      const clone = {
        x: cloneX,
        y: cloneY,
        graphics: this.scene.add.graphics(),
      }
      clone.graphics.setDepth(1)
      this.clonePositions.push(clone)
    }
  }

  private handleCloneAssault(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Fade in clones
    if (elapsed < 500) {
      const alpha = elapsed / 500 * 0.7

      for (const clone of this.clonePositions) {
        clone.graphics.clear()
        clone.graphics.fillStyle(0x1a0a2e, alpha)
        clone.graphics.fillCircle(clone.x, clone.y, 40)
        clone.graphics.lineStyle(2, 0xff0066, alpha)
        clone.graphics.strokeCircle(clone.x, clone.y, 40)
      }
      return
    }

    // Fire from all clones
    if (!this.clonesFired && elapsed >= 500 && elapsed < 600) {
      this.clonesFired = true

      for (const clone of this.clonePositions) {
        const angle = Phaser.Math.Angle.Between(clone.x, clone.y, playerX, playerY)

        // Each clone fires a spread
        for (let i = -2; i <= 2; i++) {
          this.bulletPool.spawn(clone.x, clone.y, angle + i * 0.15, 220)
        }
      }
    }

    // Fade out clones
    if (elapsed >= 600 && elapsed < 1000) {
      const alpha = (1 - (elapsed - 600) / 400) * 0.7

      for (const clone of this.clonePositions) {
        clone.graphics.clear()
        clone.graphics.fillStyle(0x1a0a2e, alpha)
        clone.graphics.fillCircle(clone.x, clone.y, 40)
      }
    }

    if (elapsed > 1000) {
      this.cleanupClones()
      this.finishAttack(time)
    }
  }

  private handleUltimateAttack(time: number, elapsed: number, playerX: number, playerY: number): void {
    this.setVelocity(0, 0)

    // Long charge up
    if (elapsed < 1500) {
      this.pulseWarning(elapsed, 60)

      // Dramatic buildup
      this.clearTelegraphs()
      if (this.telegraphGraphics) {
        const chargeProgress = elapsed / 1500
        const radius = 30 + chargeProgress * 50

        this.telegraphGraphics.lineStyle(4, 0xff0066, chargeProgress)
        this.telegraphGraphics.strokeCircle(this.x, this.y, radius)

        // Inner energy
        this.telegraphGraphics.fillStyle(0x1a0a2e, chargeProgress * 0.5)
        this.telegraphGraphics.fillCircle(this.x, this.y, radius * 0.6)
      }

      // Screen shake buildup
      const shake = (elapsed / 1500) * 5
      this.scene.cameras.main.setScroll(
        Math.sin(elapsed / 20) * shake,
        Math.cos(elapsed / 20) * shake
      )
      return
    }

    this.clearTint()
    this.scene.cameras.main.setScroll(0, 0)

    // Unleash waves of destruction
    const waveInterval = 200
    const expectedWaves = Math.floor((elapsed - 1500) / waveInterval)

    if (this.ultimateWaves < expectedWaves && this.ultimateWaves < 10) {
      // Each wave is more intense
      const projectiles = 12 + this.ultimateWaves * 2
      this.fireSpread(projectiles, 180 + this.ultimateWaves * 10, this.ultimateWaves * 0.2)

      // Also fire at player
      if (this.ultimateWaves % 2 === 0) {
        this.fireAtPlayer(playerX, playerY, 5, 250, 0.15)
      }

      this.ultimateWaves++
    }

    // Clear telegraphs during attack
    this.clearTelegraphs()

    if (elapsed > 1500 + 10 * waveInterval + 500) {
      this.finishAttack(time)
    }
  }

  private handleMinionSummon(time: number, elapsed: number): void {
    this.setVelocity(0, 0)

    // Summon animation
    if (elapsed < 800) {
      this.pulseWarning(elapsed, 100)

      // Show summon circles
      this.clearTelegraphs()
      if (this.telegraphGraphics && this.minions.length === 0) {
        // Prepare minion positions
        const positions = [
          { x: 100, y: 200 },
          { x: 275, y: 200 },
          { x: 187, y: 150 },
        ]

        for (const pos of positions) {
          const alpha = elapsed / 800 * 0.5
          this.telegraphGraphics.lineStyle(2, 0xff0066, alpha)
          this.telegraphGraphics.strokeCircle(pos.x, pos.y, 25)
        }
      }
      return
    }

    // Spawn minions
    if (this.minions.length === 0 && elapsed >= 800) {
      this.clearTelegraphs()

      const minionData = [
        { x: 100, y: 200, type: 'melee' as const },
        { x: 275, y: 200, type: 'ranged' as const },
        { x: 187, y: 150, type: 'spreader' as const },
      ]

      for (const data of minionData) {
        const minion: MinionSpawn = {
          x: data.x,
          y: data.y,
          graphics: this.scene.add.graphics(),
          health: 30,
          type: data.type,
          active: true,
        }
        minion.graphics.setDepth(1)
        this.minions.push(minion)
      }
    }

    // Draw minions
    for (const minion of this.minions) {
      if (!minion.active) continue

      minion.graphics.clear()

      // Different colors by type
      const color = minion.type === 'melee' ? 0xff4444 :
                    minion.type === 'ranged' ? 0x4444ff : 0x44ff44

      minion.graphics.fillStyle(color, 0.8)
      minion.graphics.fillCircle(minion.x, minion.y, 15)
      minion.graphics.lineStyle(2, 0xffffff, 0.5)
      minion.graphics.strokeCircle(minion.x, minion.y, 15)
    }

    if (elapsed > 1200) {
      this.finishAttack(time)
    }
  }

  private cleanupVoidZones(): void {
    for (const zone of this.voidZones) {
      zone.graphics?.destroy()
    }
    this.voidZones = []
  }

  private cleanupClones(): void {
    for (const clone of this.clonePositions) {
      clone.graphics?.destroy()
    }
    this.clonePositions = []
  }

  private cleanupMinions(): void {
    for (const minion of this.minions) {
      minion.graphics?.destroy()
    }
    this.minions = []
  }

  update(time: number, delta: number, playerX: number, playerY: number): boolean {
    const died = super.update(time, delta, playerX, playerY)

    // Update minions - make them fire at player
    for (const minion of this.minions) {
      if (!minion.active) continue

      // Random chance to fire
      if (Math.random() < 0.01) {
        const angle = Phaser.Math.Angle.Between(minion.x, minion.y, playerX, playerY)

        switch (minion.type) {
          case 'ranged':
            this.bulletPool.spawn(minion.x, minion.y, angle, 180)
            break
          case 'spreader':
            for (let i = 0; i < 4; i++) {
              const spreadAngle = (Math.PI * 2 * i) / 4
              this.bulletPool.spawn(minion.x, minion.y, spreadAngle, 120)
            }
            break
          // Melee minions don't fire
        }
      }
    }

    // Update void zones
    for (const zone of this.voidZones) {
      const distToPlayer = Phaser.Math.Distance.Between(zone.x, zone.y, playerX, playerY)
      if (distToPlayer < 45 && Math.random() < 0.02) {
        this.bulletPool.spawn(zone.x, zone.y,
          Phaser.Math.Angle.Between(zone.x, zone.y, playerX, playerY), 60)
      }
    }

    return died
  }

  destroy(fromScene?: boolean): void {
    this.cleanupVoidZones()
    this.cleanupClones()
    this.cleanupMinions()
    this.scene.cameras.main.setScroll(0, 0)
    super.destroy(fromScene)
  }
}
