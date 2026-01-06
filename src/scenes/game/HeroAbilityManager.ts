import Phaser from 'phaser'
import Player from '../../entities/Player'
import type Enemy from '../../entities/Enemy'
import type Boss from '../../entities/bosses/BaseBoss'
import type SpiritCatPool from '../../systems/SpiritCatPool'
import type { SpiritCatConfig } from '../../config/heroData'
import type { ParticleManager } from '../../systems/ParticleManager'
import type DamageNumberPool from '../../systems/DamageNumberPool'
import { hapticManager } from '../../systems/HapticManager'
import type { KillInfo } from './DeathFlowManager'

/**
 * Event handlers for hero ability coordination
 */
export interface HeroAbilityEventHandlers {
  onEnemyKilled: (enemy: Enemy, killInfo: KillInfo) => void
  getBoss: () => Boss | null
}

/**
 * Configuration for HeroAbilityManager
 */
export interface HeroAbilityConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  particles: ParticleManager
  damageNumberPool: DamageNumberPool
  spiritCatPool: SpiritCatPool | null
  spiritCatConfig: SpiritCatConfig | null
  eventHandlers: HeroAbilityEventHandlers
}

/**
 * Manages hero-specific passive abilities
 * - Chainsaw orbit (Helix passive)
 * - Damage aura visual and damage
 * - Spirit cats (Meowgik passive)
 */
export class HeroAbilityManager {
  private scene: Phaser.Scene
  private player: Player
  private enemies: Phaser.Physics.Arcade.Group
  private particles: ParticleManager
  private damageNumberPool: DamageNumberPool
  private spiritCatPool: SpiritCatPool | null
  private spiritCatConfig: SpiritCatConfig | null
  private eventHandlers: HeroAbilityEventHandlers

  // Damage aura state
  private damageAuraGraphics: Phaser.GameObjects.Graphics | null = null
  private lastAuraDamageTime: number = 0
  private readonly AURA_DAMAGE_INTERVAL = 500 // Apply damage every 500ms (2x per second)

  // Chainsaw orbit state
  private chainsawSprites: Phaser.GameObjects.Sprite[] = []
  private chainsawOrbitAngle: number = 0
  private lastChainsawDamageTime: number = 0
  private readonly CHAINSAW_DAMAGE_INTERVAL = 200  // 5 damage ticks per second
  private readonly CHAINSAW_ORBIT_RADIUS = 100
  private readonly CHAINSAW_ORBIT_PERIOD = 2000  // 2 seconds per full rotation
  private readonly CHAINSAW_HITBOX_RADIUS = 24

  // Spirit cat state
  private lastSpiritCatSpawnTime: number = 0

  constructor(config: HeroAbilityConfig) {
    this.scene = config.scene
    this.player = config.player
    this.enemies = config.enemies
    this.particles = config.particles
    this.damageNumberPool = config.damageNumberPool
    this.spiritCatPool = config.spiritCatPool
    this.spiritCatConfig = config.spiritCatConfig
    this.eventHandlers = config.eventHandlers

    // Create damage aura graphics (rendered below player)
    this.damageAuraGraphics = this.scene.add.graphics()
    this.damageAuraGraphics.setDepth(this.player.depth - 1)
  }

  /**
   * Update all hero abilities
   */
  update(time: number, delta: number, playerX: number, playerY: number): void {
    // Update damage aura visual and apply damage if player has the ability
    this.updateDamageAuraVisual(time, playerX, playerY)
    this.applyDamageAura(time, playerX, playerY)

    // Update chainsaw orbit for Helix (if player has Rage ability)
    this.updateChainsawOrbit(time, delta, playerX, playerY)

    // Spawn spirit cats if playing as Meowgik
    if (this.spiritCatPool && this.spiritCatConfig) {
      this.updateSpiritCats(time, playerX, playerY)
    }
  }

  /**
   * Update damage aura visual effect
   */
  private updateDamageAuraVisual(time: number, playerX: number, playerY: number): void {
    if (!this.damageAuraGraphics) return

    const auraRadius = this.player.getDamageAuraRadius()
    if (auraRadius <= 0) {
      this.damageAuraGraphics.clear()
      return
    }

    // Pulsing effect (0.5s period)
    const pulsePeriod = 500
    const pulsePhase = ((time % pulsePeriod) / pulsePeriod) * Math.PI * 2
    const pulseAlpha = 0.2 + Math.sin(pulsePhase) * 0.1

    this.damageAuraGraphics.clear()

    // Outer ring (orange glow)
    this.damageAuraGraphics.lineStyle(3, 0xff4400, 0.5 + Math.sin(pulsePhase) * 0.3)
    this.damageAuraGraphics.strokeCircle(playerX, playerY, auraRadius)

    // Fill (faint orange)
    this.damageAuraGraphics.fillStyle(0xff4400, pulseAlpha * 0.4)
    this.damageAuraGraphics.fillCircle(playerX, playerY, auraRadius)

    // Inner ring (brighter)
    this.damageAuraGraphics.lineStyle(2, 0xff6600, 0.3 + Math.sin(pulsePhase) * 0.2)
    this.damageAuraGraphics.strokeCircle(playerX, playerY, auraRadius * 0.7)
  }

  /**
   * Apply damage aura to nearby enemies
   * Deals DPS damage every AURA_DAMAGE_INTERVAL ms to enemies within radius
   */
  private applyDamageAura(time: number, playerX: number, playerY: number): void {
    const auraDPS = this.player.getDamageAuraDPS()
    if (auraDPS <= 0) return

    // Only apply damage at intervals
    if (time - this.lastAuraDamageTime < this.AURA_DAMAGE_INTERVAL) return
    this.lastAuraDamageTime = time

    const auraRadius = this.player.getDamageAuraRadius()
    // Calculate damage per tick (DPS / 2 since we apply 2x per second)
    const damagePerTick = Math.floor(auraDPS / 2)

    const enemiesToDestroy: Enemy[] = []

    // Find and damage all enemies within aura radius
    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (!e.active) return

      const distance = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y)
      if (distance <= auraRadius) {
        const killed = e.takeDamage(damagePerTick)

        // Visual feedback
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
      const isBoss = this.eventHandlers.getBoss() && e === (this.eventHandlers.getBoss() as unknown as Enemy)
      const killInfo: KillInfo = {
        source: 'aura',
        isBoss: !!isBoss,
        isCrit: false,
        wasOnFire: e.isOnFire(),
        position: { x: e.x, y: e.y },
      }

      this.eventHandlers.onEnemyKilled(e, killInfo)
    }
  }

  /**
   * Update chainsaw orbit visual and damage
   */
  private updateChainsawOrbit(time: number, delta: number, playerX: number, playerY: number): void {
    const chainsawCount = this.player.getChainsawOrbitCount()
    if (chainsawCount <= 0) {
      // No chainsaws, hide any existing sprites
      this.chainsawSprites.forEach(sprite => sprite.setVisible(false))
      return
    }

    // Ensure we have enough sprites for current chainsaw count
    while (this.chainsawSprites.length < chainsawCount) {
      const sprite = this.scene.add.sprite(0, 0, 'chainsawOrbit')
      sprite.setDisplaySize(48, 48)
      sprite.setDepth(this.player.depth + 1)
      this.chainsawSprites.push(sprite)
    }

    // Update orbital angle (2s per full rotation)
    this.chainsawOrbitAngle += (Math.PI * 2 / this.CHAINSAW_ORBIT_PERIOD) * delta

    // Position and rotate each chainsaw
    for (let i = 0; i < chainsawCount; i++) {
      const sprite = this.chainsawSprites[i]
      if (!sprite) continue

      sprite.setVisible(true)

      // Calculate orbital position (evenly spaced)
      const angle = this.chainsawOrbitAngle + (Math.PI * 2 * i / chainsawCount)
      const x = playerX + Math.cos(angle) * this.CHAINSAW_ORBIT_RADIUS
      const y = playerY + Math.sin(angle) * this.CHAINSAW_ORBIT_RADIUS

      sprite.setPosition(x, y)

      // Spin on own axis (fast rotation for blur effect)
      sprite.rotation += 0.3
    }

    // Hide any extra sprites (from previous higher levels if ability was lost)
    for (let i = chainsawCount; i < this.chainsawSprites.length; i++) {
      this.chainsawSprites[i].setVisible(false)
    }

    // Apply damage to enemies within chainsaw hitbox
    this.applyChainsawDamage(time, playerX, playerY, chainsawCount)
  }

  /**
   * Apply chainsaw damage to enemies within hitbox radius of any chainsaw
   */
  private applyChainsawDamage(time: number, playerX: number, playerY: number, chainsawCount: number): void {
    // Only apply damage at intervals
    if (time - this.lastChainsawDamageTime < this.CHAINSAW_DAMAGE_INTERVAL) return
    this.lastChainsawDamageTime = time

    const damage = this.player.getChainsawOrbitDamage()
    if (damage <= 0) return

    const enemiesToDestroy: Enemy[] = []
    const hitEnemies = new Set<Enemy>()  // Track hit enemies to prevent double damage from multiple chainsaws

    // Check each chainsaw position for enemy collisions
    for (let i = 0; i < chainsawCount; i++) {
      const angle = this.chainsawOrbitAngle + (Math.PI * 2 * i / chainsawCount)
      const chainsawX = playerX + Math.cos(angle) * this.CHAINSAW_ORBIT_RADIUS
      const chainsawY = playerY + Math.sin(angle) * this.CHAINSAW_ORBIT_RADIUS

      // Find enemies within chainsaw hitbox
      this.enemies.getChildren().forEach((enemy) => {
        const e = enemy as Enemy
        if (!e.active || hitEnemies.has(e)) return

        const distance = Phaser.Math.Distance.Between(chainsawX, chainsawY, e.x, e.y)
        if (distance <= this.CHAINSAW_HITBOX_RADIUS + 16) {  // +16 for enemy hitbox
          hitEnemies.add(e)

          const killed = e.takeDamage(damage)

          // Visual feedback
          this.damageNumberPool.showEnemyDamage(e.x, e.y, damage, false)
          this.particles.emitHit(e.x, e.y)
          hapticManager.light()

          if (killed) {
            enemiesToDestroy.push(e)
          }
        }
      })
    }

    // Handle deaths from chainsaw damage
    for (const e of enemiesToDestroy) {
      const isBoss = this.eventHandlers.getBoss() && e === (this.eventHandlers.getBoss() as unknown as Enemy)
      const killInfo: KillInfo = {
        source: 'chainsaw',
        isBoss: !!isBoss,
        isCrit: false,
        wasOnFire: e.isOnFire(),
        position: { x: e.x, y: e.y },
      }

      this.eventHandlers.onEnemyKilled(e, killInfo)
    }
  }

  /**
   * Update spirit cat spawning for Meowgik hero
   */
  private updateSpiritCats(time: number, playerX: number, playerY: number): void {
    if (!this.spiritCatPool || !this.spiritCatConfig) return

    // Spawn interval based on attack speed (attacks per second)
    const spawnInterval = 1000 / this.spiritCatConfig.attackSpeed

    // Check if enough time has passed since last spawn
    if (time - this.lastSpiritCatSpawnTime < spawnInterval) return

    // Get nearest enemy
    const boss = this.eventHandlers.getBoss()
    const target = boss && boss.active ? boss : this.getNearestEnemy(playerX, playerY)
    if (!target) return

    const catCount = this.spiritCatConfig.count

    // Calculate damage (30% of player damage + Meowgik bonuses)
    const catDamage = Math.floor(this.player.getDamage() * 0.3 * this.spiritCatConfig.damageMultiplier)

    // Spawn cats in a spread pattern
    for (let i = 0; i < catCount; i++) {
      this.spiritCatPool.spawn(
        playerX,
        playerY,
        target,
        catDamage,
        this.spiritCatConfig.canCrit
      )
    }

    this.lastSpiritCatSpawnTime = time
  }

  /**
   * Find nearest enemy to player
   */
  private getNearestEnemy(playerX: number, playerY: number): Enemy | null {
    let nearest: Enemy | null = null
    let minDistance = Infinity

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (!e.active) return

      const distance = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y)
      if (distance < minDistance) {
        minDistance = distance
        nearest = e
      }
    })

    return nearest
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.damageAuraGraphics) {
      this.damageAuraGraphics.destroy()
      this.damageAuraGraphics = null
    }

    for (const sprite of this.chainsawSprites) {
      sprite.destroy()
    }
    this.chainsawSprites = []
  }
}

export default HeroAbilityManager
