import Phaser from 'phaser'
import type Player from '../entities/Player'
import type Enemy from '../entities/Enemy'
import type SpiritCat from '../entities/SpiritCat'
import SpiritCatPool from './SpiritCatPool'
import type DamageNumberPool from './DamageNumberPool'
import type { ScreenShake } from './ScreenShake'
import type { ParticleManager } from './ParticleManager'
import { audioManager } from './AudioManager'
import { hapticManager } from './HapticManager'
import { heroManager } from './HeroManager'
import { getSpiritCatConfig, type SpiritCatConfig } from '../config/heroData'

export interface SpiritCatCallbacks {
  getCachedNearestEnemy: () => Enemy | null
  onEnemyKilled: (enemy: Enemy, isBoss: boolean, xpGain: number) => void
  getBoss: () => Enemy | null
  onBossKilled: () => void
  onBossHealthUpdate: (current: number, max: number) => void
  spawnDrops: (enemy: Enemy) => void
  invalidateNearestEnemyCache: () => void
  checkRoomCleared: () => void
  updatePlayerHealthUI: () => void
}

/**
 * SpiritCatSystem handles the Meowgik hero's spirit cat ability.
 * Extracted from GameScene to centralize hero-specific logic.
 */
export class SpiritCatSystem {
  private player: Player
  private damageNumberPool: DamageNumberPool
  private screenShake: ScreenShake
  private particles: ParticleManager
  private callbacks!: SpiritCatCallbacks

  private spiritCatPool: SpiritCatPool | null = null
  private spiritCatConfig: SpiritCatConfig | null = null
  private lastSpiritCatSpawnTime: number = 0

  constructor(
    scene: Phaser.Scene,
    player: Player,
    damageNumberPool: DamageNumberPool,
    screenShake: ScreenShake,
    particles: ParticleManager,
    heroStats: { attack: number }
  ) {
    this.player = player
    this.damageNumberPool = damageNumberPool
    this.screenShake = screenShake
    this.particles = particles

    // Initialize spirit cat pool
    this.spiritCatPool = new SpiritCatPool(scene)

    // Get spirit cat config based on hero level and perks
    const heroLevel = heroManager.getLevel('meowgik')
    const unlockedPerks = new Set(heroManager.getUnlockedPerkLevels('meowgik'))
    const baseAttack = heroStats.attack

    this.spiritCatConfig = getSpiritCatConfig(heroLevel, unlockedPerks, baseAttack)
    console.log('SpiritCatSystem: Initialized with config:', this.spiritCatConfig)
  }

  /**
   * Set callbacks for spirit cat events
   */
  setCallbacks(callbacks: SpiritCatCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Get the spirit cat pool for collision setup
   */
  getPool(): SpiritCatPool | null {
    return this.spiritCatPool
  }

  /**
   * Update spirit cat spawning
   */
  update(time: number, playerX: number, playerY: number): void {
    if (!this.spiritCatPool || !this.spiritCatConfig) return

    // Calculate spawn interval from attack speed
    const spawnInterval = 1000 / this.spiritCatConfig.attackSpeed

    // Check spawn interval
    if (time - this.lastSpiritCatSpawnTime < spawnInterval) return

    // Find nearest enemy to target
    const target = this.callbacks.getCachedNearestEnemy()
    if (!target) return

    // Spawn cats around the player
    const catCount = this.spiritCatConfig.count
    for (let i = 0; i < catCount; i++) {
      // Spawn in circular pattern around player
      const spawnAngle = (Math.PI * 2 * i) / catCount + (time * 0.001)
      const spawnDistance = 40
      const spawnX = playerX + Math.cos(spawnAngle) * spawnDistance
      const spawnY = playerY + Math.sin(spawnAngle) * spawnDistance

      this.spiritCatPool.spawn(
        spawnX,
        spawnY,
        target,
        this.spiritCatConfig.damage,
        this.spiritCatConfig.canCrit
      )
    }

    this.lastSpiritCatSpawnTime = time
  }

  /**
   * Handle spirit cat hitting an enemy
   */
  handleHit(
    cat: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
    isGameOver: boolean,
    isTransitioning: boolean
  ): void {
    if (isGameOver || isTransitioning) return

    const spiritCat = cat as SpiritCat
    const enemySprite = enemy as Enemy

    if (!spiritCat.active || !enemySprite.active) return

    // Get damage and check crit
    const damage = spiritCat.getDamage()
    const isCrit = spiritCat.isCriticalHit()

    // Damage enemy
    const killed = enemySprite.takeDamage(damage)
    audioManager.playHit()

    // Show damage number
    this.damageNumberPool.showEnemyDamage(enemySprite.x, enemySprite.y, damage, isCrit)

    // Visual effects
    if (isCrit) {
      this.particles.emitCrit(enemySprite.x, enemySprite.y)
      this.screenShake.onCriticalHit()
    } else {
      this.particles.emitHit(enemySprite.x, enemySprite.y)
    }

    // Deactivate cat on hit
    spiritCat.deactivate()

    // Update boss health bar if this is the boss
    const boss = this.callbacks.getBoss()
    const isBoss = boss && enemySprite === boss
    if (isBoss && !killed) {
      this.callbacks.onBossHealthUpdate(boss.getHealth(), boss.getMaxHealth())
      hapticManager.bossHit()
    }

    if (killed) {
      this.handleEnemyKilled(enemySprite, isBoss ?? false)
    }
  }

  /**
   * Handle enemy death from spirit cat
   */
  private handleEnemyKilled(enemy: Enemy, isBoss: boolean): void {
    // Bloodthirst: Heal on kill
    const bloodthirstHeal = this.player.getBloodthirstHeal()
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal)
      this.callbacks.updatePlayerHealthUI()
    }

    // Death particles
    if (isBoss) {
      this.particles.emitBossDeath(enemy.x, enemy.y)
      this.screenShake.onBossDeath()
    } else {
      this.particles.emitDeath(enemy.x, enemy.y)
      this.screenShake.onExplosion()
      hapticManager.light()
    }

    // Spawn drops
    this.callbacks.spawnDrops(enemy)

    // XP gain
    const xpGain = isBoss ? 10 : 1
    this.callbacks.onEnemyKilled(enemy, isBoss, xpGain)

    // Clear boss reference
    if (isBoss) {
      this.callbacks.onBossKilled()
    }

    enemy.destroy()
    this.callbacks.invalidateNearestEnemyCache()
    this.callbacks.checkRoomCleared()
  }

  /**
   * Clean up spirit cats (called on room transition)
   */
  cleanup(): void {
    if (this.spiritCatPool) {
      this.spiritCatPool.clear(true, true)
    }
  }

  /**
   * Destroy the spirit cat system
   */
  destroy(): void {
    if (this.spiritCatPool) {
      this.spiritCatPool.destroy(true)
      this.spiritCatPool = null
    }
    this.spiritCatConfig = null
  }
}
