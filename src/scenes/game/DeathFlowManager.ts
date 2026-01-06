import Phaser from 'phaser'
import Player from '../../entities/Player'
import type Enemy from '../../entities/Enemy'
import type { ParticleManager } from '../../systems/ParticleManager'
import type { ScreenShake } from '../../systems/ScreenShake'
import type { DropManager } from './DropManager'
import { hapticManager } from '../../systems/HapticManager'
import { getXpMultiplierForChapter } from '../../config/chapterData'
import { chapterManager } from '../../systems/ChapterManager'

/**
 * Kill information for unified death handling
 */
export interface KillInfo {
  source: 'bullet' | 'dot' | 'chainsaw' | 'aura' | 'spirit_cat' | 'lightning_chain'
  isBoss: boolean
  isCrit?: boolean
  wasOnFire: boolean
  position: { x: number; y: number }
}

/**
 * Event handlers for death flow coordination
 */
export interface DeathFlowEventHandlers {
  onRoomClearCheck: () => void
  onBossKilled: () => void
  onXPGained: (xp: number) => void
  onLevelUp: () => void
  onPlayerHealed: (amount: number) => void
  onEnemyCacheInvalidate: () => void
}

/**
 * Configuration for DeathFlowManager
 */
export interface DeathFlowConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  particles: ParticleManager
  screenShake: ScreenShake
  dropManager: DropManager
  eventHandlers: DeathFlowEventHandlers
  getBonusXPMultiplier: () => number
  spreadFireOnDeath?: (enemy: Enemy) => void
}

/**
 * Manages unified enemy death flow
 * Consolidates all death handling from multiple sources into single code path
 */
export class DeathFlowManager {
  private player: Player
  private particles: ParticleManager
  private screenShake: ScreenShake
  private dropManager: DropManager
  private eventHandlers: DeathFlowEventHandlers
  private getBonusXPMultiplier: () => number
  private spreadFireOnDeath?: (enemy: Enemy) => void

  constructor(config: DeathFlowConfig) {
    this.player = config.player
    this.particles = config.particles
    this.screenShake = config.screenShake
    this.dropManager = config.dropManager
    this.eventHandlers = config.eventHandlers
    this.getBonusXPMultiplier = config.getBonusXPMultiplier
    this.spreadFireOnDeath = config.spreadFireOnDeath
  }

  /**
   * Main entry point for ALL enemy deaths
   * Unified flow ensures consistent behavior regardless of kill source
   */
  handleEnemyDeath(enemy: Enemy, killInfo: KillInfo): void {
    // 1. Fire spread if enemy was burning (UNIFIED - all sources spread)
    if (killInfo.wasOnFire && this.spreadFireOnDeath) {
      this.applyFireSpread(enemy)
    }

    // 2. Track kill stats and spawn drops
    this.dropManager.incrementKills()
    this.dropManager.recordKill(enemy, killInfo.isBoss)
    this.dropManager.spawnDrops(enemy)

    // 3. Death effects (particles, shake, haptics)
    this.applyDeathEffects(enemy, killInfo)

    // 4. On-kill bonuses (bloodthirst heal, XP gain)
    this.applyOnKillBonuses(enemy, killInfo)

    // 5. Cleanup (destroy enemy, invalidate cache, boss ref)
    this.cleanupEnemy(enemy, killInfo.isBoss)

    // 6. Trigger room clear check
    this.eventHandlers.onRoomClearCheck()
  }

  /**
   * Spread fire to nearby enemies if the dying enemy was burning
   * UNIFIED: Now works for ALL kill sources (bullets, DOT, chainsaw, aura, spirit cat, lightning)
   */
  private applyFireSpread(_enemy: Enemy): void {
    if (this.spreadFireOnDeath) {
      this.spreadFireOnDeath(_enemy)
    }
  }

  /**
   * Apply death effects: particles, screen shake, haptics
   */
  private applyDeathEffects(_enemy: Enemy, killInfo: KillInfo): void {
    const { position, isBoss, source } = killInfo

    // Boss death gets bigger particles
    if (isBoss) {
      this.particles.emitBossDeath(position.x, position.y)
    } else {
      this.particles.emitDeath(position.x, position.y)
    }

    // Fire DOT deaths get additional fire particles
    if (source === 'dot' && killInfo.wasOnFire) {
      this.particles.emitFire(position.x, position.y)
    }

    // Screen shake
    this.screenShake.onExplosion()

    // Haptic feedback
    hapticManager.light()
  }

  /**
   * Apply on-kill bonuses: bloodthirst healing and XP gain
   */
  private applyOnKillBonuses(_enemy: Enemy, killInfo: KillInfo): void {
    // Bloodthirst: Heal on kill
    const bloodthirstHeal = this.player.getBloodthirstHeal()
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal)
      this.eventHandlers.onPlayerHealed(bloodthirstHeal)
    }

    // XP gain with equipment bonus and chapter scaling
    // UNIFIED: base=1 for normal enemies, 10 for bosses (fixed inconsistency)
    const baseXpGain = killInfo.isBoss ? 10 : 1
    const bonusXPMultiplier = this.getBonusXPMultiplier()
    const chapterXpMultiplier = getXpMultiplierForChapter(chapterManager.getSelectedChapter())
    const xpGain = Math.round(baseXpGain * bonusXPMultiplier * chapterXpMultiplier)

    const leveledUp = this.player.addXP(xpGain)
    this.eventHandlers.onXPGained(xpGain)

    // Hero XP tracking
    this.dropManager.addHeroXPEarned(killInfo.isBoss ? 25 : 1)

    // Handle level up
    if (leveledUp) {
      this.eventHandlers.onLevelUp()
    }
  }

  /**
   * Cleanup enemy: destroy, invalidate cache, clear boss reference
   */
  private cleanupEnemy(_enemy: Enemy, isBoss: boolean): void {
    // Clear boss reference if this was a boss
    if (isBoss) {
      this.eventHandlers.onBossKilled()
    }

    // Destroy enemy
    _enemy.destroy()

    // Invalidate nearest enemy cache (enemies changed)
    this.eventHandlers.onEnemyCacheInvalidate()
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed
  }
}

export default DeathFlowManager
