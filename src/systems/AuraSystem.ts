import Phaser from 'phaser'
import type Player from '../entities/Player'
import type Enemy from '../entities/Enemy'
import type DamageNumberPool from './DamageNumberPool'
import type { ScreenShake } from './ScreenShake'
import type { ParticleManager } from './ParticleManager'
import { hapticManager } from './HapticManager'

export interface AuraSystemCallbacks {
  getEnemies: () => Phaser.Physics.Arcade.Group
  onEnemyKilled: (enemy: Enemy, isBoss: boolean, xpGain: number) => void
  getBoss: () => Enemy | null
  onBossKilled: () => void
  spawnDrops: (enemy: Enemy) => void
  invalidateNearestEnemyCache: () => void
  checkRoomCleared: () => void
}

/**
 * AuraSystem handles damage aura visuals and damage, plus lightning chain.
 * Extracted from GameScene to centralize aura logic.
 */
export class AuraSystem {
  private player: Player
  private damageNumberPool: DamageNumberPool
  private screenShake: ScreenShake
  private particles: ParticleManager
  private callbacks!: AuraSystemCallbacks

  private damageAuraGraphics: Phaser.GameObjects.Graphics | null = null
  private lastAuraDamageTime: number = 0
  private readonly AURA_DAMAGE_INTERVAL = 500 // Apply damage every 500ms

  constructor(
    scene: Phaser.Scene,
    player: Player,
    damageNumberPool: DamageNumberPool,
    screenShake: ScreenShake,
    particles: ParticleManager
  ) {
    this.player = player
    this.damageNumberPool = damageNumberPool
    this.screenShake = screenShake
    this.particles = particles

    // Create damage aura graphics (rendered below player)
    this.damageAuraGraphics = scene.add.graphics()
    this.damageAuraGraphics.setDepth(player.depth - 1)
  }

  /**
   * Set callbacks for aura system events
   */
  setCallbacks(callbacks: AuraSystemCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Update the damage aura visual and apply damage
   */
  update(time: number, playerX: number, playerY: number): void {
    this.updateVisual(time, playerX, playerY)
    this.applyDamage(time, playerX, playerY)
  }

  /**
   * Update the damage aura visual effect around the player
   */
  private updateVisual(time: number, playerX: number, playerY: number): void {
    if (!this.damageAuraGraphics) return

    const auraRadius = this.player.getDamageAuraRadius()

    // Clear previous frame
    this.damageAuraGraphics.clear()

    // Only draw if player has damage aura ability
    if (auraRadius <= 0) return

    // Create pulsing effect
    const pulseSpeed = 0.003
    const pulsePhase = (Math.sin(time * pulseSpeed) + 1) / 2 // 0 to 1
    const pulseAlpha = 0.15 + pulsePhase * 0.2 // 0.15 to 0.35

    // Outer ring - main aura boundary
    this.damageAuraGraphics.lineStyle(3, 0xff4400, 0.5 + pulsePhase * 0.3)
    this.damageAuraGraphics.strokeCircle(playerX, playerY, auraRadius)

    // Inner glow - fills the aura area
    this.damageAuraGraphics.fillStyle(0xff4400, pulseAlpha * 0.4)
    this.damageAuraGraphics.fillCircle(playerX, playerY, auraRadius)

    // Inner ring for depth effect
    this.damageAuraGraphics.lineStyle(2, 0xff6600, 0.3 + pulsePhase * 0.2)
    this.damageAuraGraphics.strokeCircle(playerX, playerY, auraRadius * 0.7)
  }

  /**
   * Apply damage aura to nearby enemies
   */
  private applyDamage(time: number, playerX: number, playerY: number): void {
    const auraDPS = this.player.getDamageAuraDPS()
    if (auraDPS <= 0) return

    // Only apply damage at intervals
    if (time - this.lastAuraDamageTime < this.AURA_DAMAGE_INTERVAL) return
    this.lastAuraDamageTime = time

    const auraRadius = this.player.getDamageAuraRadius()
    // Calculate damage per tick (DPS / 2 since we apply 2x per second)
    const damagePerTick = Math.floor(auraDPS / 2)

    const enemiesToDestroy: Enemy[] = []
    const enemies = this.callbacks.getEnemies()

    // Find and damage all enemies within aura radius
    enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (!e.active) return

      const distance = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y)
      if (distance <= auraRadius) {
        const killed = e.takeDamage(damagePerTick)

        // Show damage number
        this.damageNumberPool.showEnemyDamage(e.x, e.y, damagePerTick, false)

        // Visual feedback - emit particles
        this.particles.emitHit(e.x, e.y)

        if (killed) {
          enemiesToDestroy.push(e)
        }
      }
    })

    // Handle deaths from aura damage
    for (const e of enemiesToDestroy) {
      // Bloodthirst heal on kill
      const bloodthirstHeal = this.player.getBloodthirstHeal()
      if (bloodthirstHeal > 0) {
        this.player.heal(bloodthirstHeal)
      }

      // Death particles
      this.particles.emitDeath(e.x, e.y)
      this.screenShake.onExplosion()
      hapticManager.light()

      // Spawn drops
      this.callbacks.spawnDrops(e)

      // Check if boss
      const boss = this.callbacks.getBoss()
      const isBoss = boss && e === boss

      // XP gain
      const xpGain = isBoss ? 10 : 1
      this.callbacks.onEnemyKilled(e, isBoss ?? false, xpGain)

      if (isBoss) {
        this.callbacks.onBossKilled()
      }

      e.destroy()
      this.callbacks.invalidateNearestEnemyCache()
    }

    // Check if room cleared after processing deaths
    if (enemiesToDestroy.length > 0) {
      this.callbacks.checkRoomCleared()
    }
  }

  /**
   * Apply lightning chain damage to nearby enemies
   */
  applyLightningChain(source: Enemy, damage: number, chainCount: number): void {
    const maxChainDistance = 150 // Max distance for lightning to jump
    const enemies = this.callbacks.getEnemies()

    // Find nearby enemies excluding the source
    const nearbyEnemies: Enemy[] = []
    enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (e === source || !e.active) return

      const distance = Phaser.Math.Distance.Between(source.x, source.y, e.x, e.y)
      if (distance <= maxChainDistance) {
        nearbyEnemies.push(e)
      }
    })

    // Sort by distance and take only chainCount enemies
    nearbyEnemies.sort((a, b) => {
      const distA = Phaser.Math.Distance.Between(source.x, source.y, a.x, a.y)
      const distB = Phaser.Math.Distance.Between(source.x, source.y, b.x, b.y)
      return distA - distB
    })

    const targets = nearbyEnemies.slice(0, chainCount)

    // Apply damage to each target
    targets.forEach((target) => {
      // Guard against destroyed enemies
      if (!target.active || !target.scene) return

      const killed = target.takeDamage(Math.floor(damage))

      if (killed) {
        // Bloodthirst heal on kill
        const bloodthirstHeal = this.player.getBloodthirstHeal()
        if (bloodthirstHeal > 0) {
          this.player.heal(bloodthirstHeal)
        }

        this.callbacks.spawnDrops(target)
        target.destroy()
        this.callbacks.checkRoomCleared()
      }
    })
  }

  /**
   * Destroy the aura system and clean up
   */
  destroy(): void {
    if (this.damageAuraGraphics) {
      this.damageAuraGraphics.destroy()
      this.damageAuraGraphics = null
    }
  }
}
