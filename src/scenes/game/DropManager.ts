import Phaser from 'phaser'
import Player from '../../entities/Player'
import type Enemy from '../../entities/Enemy'
import type GoldPool from '../../systems/GoldPool'
import type HealthPool from '../../systems/HealthPool'
import type { BossType } from '../../config/chapterData'
import type { EnemyType } from '../../systems/CurrencyManager'
import type { BossId } from '../../config/bossData'
import { saveManager } from '../../systems/SaveManager'
import { errorReporting } from '../../systems/ErrorReportingManager'
import { chapterManager } from '../../systems/ChapterManager'

/**
 * Configuration for DropManager
 */
export interface DropManagerConfig {
  scene: Phaser.Scene
  player: Player
  goldPool: GoldPool
  healthPool: HealthPool
  difficultyConfig: {
    enemyDamageMultiplier: number
  }
}

/**
 * Manages drop spawning, kill tracking, and statistics
 * Extracted from GameScene to reduce complexity
 */
export class DropManager {
  private player: Player
  private goldPool: GoldPool
  private healthPool: HealthPool
  private difficultyConfig: { enemyDamageMultiplier: number }

  // Kill tracking state
  private goldEarned: number = 0
  private enemiesKilled: number = 0
  private heroXPEarned: number = 0

  // Boss tracking (passed in via methods)
  private currentBossType: BossType | null = null
  private bossSpawnTime: number = 0

  constructor(config: DropManagerConfig) {
    this.player = config.player
    this.goldPool = config.goldPool
    this.healthPool = config.healthPool
    this.difficultyConfig = config.difficultyConfig
  }

  /**
   * Reset stats for new run
   */
  reset(): void {
    this.goldEarned = 0
    this.enemiesKilled = 0
    this.heroXPEarned = 0
    this.currentBossType = null
    this.bossSpawnTime = 0
  }

  /**
   * Set current boss type for kill tracking
   */
  setBossInfo(bossType: BossType, spawnTime: number): void {
    this.currentBossType = bossType
    this.bossSpawnTime = spawnTime
  }

  /**
   * Get accumulated gold this run
   */
  getGoldEarned(): number {
    return this.goldEarned
  }

  /**
   * Get total enemies killed this run
   */
  getEnemiesKilled(): number {
    return this.enemiesKilled
  }

  /**
   * Get total hero XP earned this run
   */
  getHeroXPEarned(): number {
    return this.heroXPEarned
  }

  /**
   * Add gold earned (called when gold is collected)
   */
  addGoldEarned(amount: number): void {
    this.goldEarned += amount
  }

  /**
   * Add hero XP earned (called by death flow manager)
   */
  addHeroXPEarned(amount: number): void {
    this.heroXPEarned += amount
  }

  /**
   * Increment enemies killed counter
   */
  incrementKills(): void {
    this.enemiesKilled++
  }

  /**
   * Determine enemy type from class
   */
  private getEnemyType(enemy: Enemy): EnemyType {
    // Check if it's a boss
    if ((enemy as any).isBoss || enemy.constructor.name.includes('Boss')) {
      return 'boss'
    }
    // Check class name for enemy type
    const className = enemy.constructor.name
    if (className.includes('Spreader')) {
      return 'spreader'
    }
    if (className.includes('Ranged') || className.includes('Shooter')) {
      return 'ranged'
    }
    return 'melee'
  }

  /**
   * Calculate health potion heal value based on player stats and difficulty
   * - Scales with player's max health (10% of max HP)
   * - Reduced slightly on higher difficulties (more enemy damage = less healing)
   * - Clamped between 15 and 100 HP
   */
  private calculateHealthPotionValue(): number {
    // Base: 10% of player's max health
    const maxHealth = this.player.getMaxHealth()
    const baseHeal = Math.round(maxHealth * 0.1)

    // Scale down slightly on harder difficulties (enemyDamage is higher)
    // Normal difficulty has enemyDamage around 1.0, hard has 1.5+
    const difficultyMod = Math.max(0.6, 1.0 / this.difficultyConfig.enemyDamageMultiplier)
    const scaledHeal = Math.round(baseHeal * difficultyMod)

    // Clamp between min 15 and max 100 HP
    return Math.min(100, Math.max(15, scaledHeal))
  }

  /**
   * Convert BossType to BossId for kill tracking
   * Handles aliases like 'treant' -> 'tree_guardian' and 'frost_giant' -> 'ice_golem'
   */
  private normalizeBossType(bossType: BossType): BossId {
    switch (bossType) {
      case 'treant':
        return 'tree_guardian'
      case 'frost_giant':
        return 'ice_golem'
      default:
        return bossType as BossId
    }
  }

  /**
   * Record a kill for statistics tracking
   */
  recordKill(enemy: Enemy, isBoss: boolean): void {
    if (isBoss && this.currentBossType) {
      const bossId = this.normalizeBossType(this.currentBossType)
      saveManager.recordBossKill(bossId)

      // Track boss kill in Sentry metrics
      const timeToKillMs = Date.now() - this.bossSpawnTime
      errorReporting.trackBossKill(bossId, timeToKillMs, chapterManager.getSelectedChapter())
    } else {
      const enemyType = enemy.getEnemyType()
      saveManager.recordEnemyKill(enemyType)
      errorReporting.trackEnemyKill(enemyType)
    }
  }

  /**
   * Spawn drops at enemy death position (50% gold, 5% health potion)
   */
  spawnDrops(enemy: Enemy): void {
    const enemyType = this.getEnemyType(enemy)

    // 50% chance to drop gold
    if (Math.random() < 0.5) {
      const goldValue = this.goldPool.spawnForEnemy(enemy.x, enemy.y, enemyType)
      console.log(`Gold spawned: ${goldValue} from ${enemyType}`)
    }

    // 5% chance to drop health potion (scales with difficulty)
    if (Math.random() < 0.05) {
      const healValue = this.calculateHealthPotionValue()
      this.healthPool.spawn(enemy.x, enemy.y, healValue)
      console.log(`Health potion spawned: ${healValue} HP`)
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed
  }
}

export default DropManager
