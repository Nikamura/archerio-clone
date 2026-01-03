import Phaser from 'phaser'
import type Player from '../entities/Player'
import type Enemy from '../entities/Enemy'
import type Boss from '../entities/Boss'
import type Bullet from '../entities/Bullet'
import type SpiritCat from '../entities/SpiritCat'
import type BulletPool from './BulletPool'
import type EnemyBulletPool from './EnemyBulletPool'
import type DamageNumberPool from './DamageNumberPool'
import type { ScreenShake } from './ScreenShake'
import type { ParticleManager } from './ParticleManager'
import { audioManager } from './AudioManager'
import { hapticManager } from './HapticManager'
import { chapterManager } from './ChapterManager'
import { getChapterDefinition, type ChapterId } from '../config/chapterData'
import type { TalentBonuses } from '../config/talentData'
import type { DifficultyConfig } from '../config/difficulty'

export interface CombatSystemConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  bulletPool: BulletPool
  enemyBulletPool: EnemyBulletPool
  damageNumberPool: DamageNumberPool
  screenShake: ScreenShake
  particles: ParticleManager
  difficultyConfig: DifficultyConfig
  talentBonuses: TalentBonuses
}

export interface CombatCallbacks {
  onEnemyKilled: (enemy: Enemy, isBoss: boolean, xpGain: number) => void
  onPlayerDamaged: () => void
  onPlayerDeath: () => void
  onBossHealthUpdate: (current: number, max: number) => void
  onBossKilled: () => void
  getBoss: () => Boss | null
  spawnDrops: (enemy: Enemy) => void
  applyLightningChain: (source: Enemy, damage: number, chainCount: number) => void
  findNearestEnemyExcluding: (x: number, y: number, exclude: Enemy) => Enemy | null
  invalidateNearestEnemyCache: () => void
  checkRoomCleared: () => void
}

/**
 * CombatSystem handles all combat-related collision detection and damage processing.
 * Extracted from GameScene to reduce complexity.
 */
export class CombatSystem {
  private scene: Phaser.Scene
  private player: Player
  private damageNumberPool: DamageNumberPool
  private screenShake: ScreenShake
  private particles: ParticleManager
  private difficultyConfig: DifficultyConfig
  private talentBonuses: TalentBonuses
  private callbacks!: CombatCallbacks

  constructor(config: CombatSystemConfig) {
    this.scene = config.scene
    this.player = config.player
    this.damageNumberPool = config.damageNumberPool
    this.screenShake = config.screenShake
    this.particles = config.particles
    this.difficultyConfig = config.difficultyConfig
    this.talentBonuses = config.talentBonuses
  }

  /**
   * Set callbacks for handling combat events
   */
  setCallbacks(callbacks: CombatCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Handle player bullet hitting an enemy
   */
  bulletHitEnemy(
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
    isGameOver: boolean,
    isTransitioning: boolean
  ): void {
    if (isGameOver || isTransitioning) return

    const bulletSprite = bullet as Bullet
    const enemySprite = enemy as Enemy

    // Skip if bullet has already hit this enemy (prevents duplicate collisions during piercing)
    if (bulletSprite.hasHitEnemy(enemy)) {
      return
    }

    // Calculate damage based on bullet properties
    let damage = this.player.getDamage()

    // Check for critical hit
    if (bulletSprite.isCriticalHit()) {
      damage = this.player.getDamageWithCrit(true)
    }

    // Apply piercing damage reduction if bullet has hit enemies before
    const hitCount = bulletSprite.getHitCount()
    if (hitCount > 0 && bulletSprite.getMaxPierces() > 0) {
      damage = this.player.getPiercingDamage(hitCount)
    }

    // Damage enemy
    const killed = enemySprite.takeDamage(damage)
    audioManager.playHit()

    // Show damage number
    this.damageNumberPool.showEnemyDamage(enemySprite.x, enemySprite.y, damage, bulletSprite.isCriticalHit())

    // Visual effects for hit
    if (bulletSprite.isCriticalHit()) {
      this.particles.emitCrit(enemySprite.x, enemySprite.y)
      this.screenShake.onCriticalHit()
    } else {
      this.particles.emitHit(enemySprite.x, enemySprite.y)
      this.screenShake.onEnemyHit()
    }

    // Apply fire DOT if bullet has fire damage
    const fireDamage = bulletSprite.getFireDamage()
    if (fireDamage > 0 && !killed) {
      enemySprite.applyFireDamage(fireDamage, 2000) // 2 second burn
      this.particles.emitFire(enemySprite.x, enemySprite.y)
    }

    // Apply freeze if bullet has freeze chance and rolls successfully
    if (!killed && bulletSprite.rollFreeze()) {
      enemySprite.applyFreeze()
    }

    // Apply poison DOT if bullet has poison damage
    const poisonDamage = bulletSprite.getPoisonDamage()
    if (poisonDamage > 0 && !killed) {
      enemySprite.applyPoisonDamage(poisonDamage)
    }

    // Handle lightning chain if bullet has lightning ability
    const lightningChainCount = bulletSprite.getLightningChainCount()
    if (lightningChainCount > 0 && !killed) {
      this.callbacks.applyLightningChain(enemySprite, damage * 0.5, lightningChainCount)
    }

    // Check if bullet should be deactivated or continue (piercing/ricochet)
    const shouldDeactivate = bulletSprite.onHit(enemy)

    // Handle ricochet - find nearest enemy and redirect
    if (!shouldDeactivate && bulletSprite.getBounceCount() < bulletSprite.getMaxBounces()) {
      const nearestEnemy = this.callbacks.findNearestEnemyExcluding(bulletSprite.x, bulletSprite.y, enemySprite)
      if (nearestEnemy) {
        bulletSprite.redirectTo(nearestEnemy.x, nearestEnemy.y)
      } else {
        // No target for ricochet, deactivate
        bulletSprite.setActive(false)
        bulletSprite.setVisible(false)
      }
    } else if (shouldDeactivate) {
      // Deactivate bullet
      bulletSprite.setActive(false)
      bulletSprite.setVisible(false)
    }
    // else: bullet continues (piercing)

    // Update boss health bar if this is the boss
    const boss = this.callbacks.getBoss()
    const isBoss = boss && enemySprite === (boss as unknown as Enemy)
    if (isBoss && !killed) {
      this.callbacks.onBossHealthUpdate(boss!.getHealth(), boss!.getMaxHealth())
      hapticManager.bossHit()
    }

    if (killed) {
      this.handleEnemyKilled(enemySprite, isBoss ?? false)
    }
  }

  /**
   * Handle enemy bullet hitting player
   */
  enemyBulletHitPlayer(
    player: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject,
    isGameOver: boolean
  ): void {
    if (isGameOver) return

    const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite
    const playerSprite = player as Player

    // Skip if bullet is already inactive (prevents multiple damage from same bullet)
    if (!bulletSprite.active) return

    // Deactivate bullet regardless of invincibility
    bulletSprite.setActive(false)
    bulletSprite.setVisible(false)

    // Calculate bullet damage with difficulty + chapter modifier and talent damage reduction
    const baseBulletDamage = 30
    const selectedChapter = chapterManager.getSelectedChapter() as ChapterId
    const chapterDef = getChapterDefinition(selectedChapter)
    const damageReduction = 1 - (this.talentBonuses.percentDamageReduction / 100)
    const bulletDamage = Math.round(
      baseBulletDamage *
      this.difficultyConfig.enemyDamageMultiplier *
      chapterDef.scaling.enemyDamageMultiplier *
      damageReduction
    )

    // Try to damage player (respects invincibility and dodge)
    const damageResult = playerSprite.takeDamage(bulletDamage)

    // Check if attack was dodged
    if (damageResult.dodged) {
      this.damageNumberPool.showDodge(playerSprite.x, playerSprite.y)
      return
    }

    // Check if damage was taken (invincibility check)
    if (!damageResult.damaged) return

    // Show damage number
    this.damageNumberPool.showPlayerDamage(playerSprite.x, playerSprite.y, bulletDamage)

    audioManager.playPlayerHit()
    hapticManager.heavy()

    // Screen shake on player damage
    if (bulletDamage >= 15) {
      this.screenShake.onPlayerHeavyDamage()
    } else {
      this.screenShake.onPlayerDamage()
    }

    // Notify callback
    this.callbacks.onPlayerDamaged()

    // Check for death
    if (playerSprite.getHealth() <= 0) {
      this.screenShake.onPlayerDeath()
      this.callbacks.onPlayerDeath()
      return
    }

    // Flash player when hit
    this.showHitFlash(playerSprite)

    console.log(`Player hit by bullet! Health: ${playerSprite.getHealth()}`)
  }

  /**
   * Handle enemy melee attack hitting player
   */
  enemyHitPlayer(
    player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject,
    isGameOver: boolean,
    currentTime: number
  ): void {
    if (isGameOver) return

    const playerSprite = player as Player
    const enemySprite = enemy as Enemy

    // Check melee attack cooldown
    if (!enemySprite.canMeleeAttack(currentTime)) {
      return
    }

    // Record this attack to start cooldown
    enemySprite.recordMeleeAttack(currentTime)

    // Get enemy damage (scaled by difficulty) and apply talent damage reduction
    const baseDamage = enemySprite.getDamage()
    const damageReduction = 1 - (this.talentBonuses.percentDamageReduction / 100)
    const damage = Math.round(baseDamage * damageReduction)

    // Try to damage player (respects invincibility and dodge)
    const damageResult = playerSprite.takeDamage(damage)

    // Check if attack was dodged
    if (damageResult.dodged) {
      this.damageNumberPool.showDodge(playerSprite.x, playerSprite.y)
      return
    }

    // Check if damage was taken (invincibility check)
    if (!damageResult.damaged) return

    // Show damage number
    this.damageNumberPool.showPlayerDamage(playerSprite.x, playerSprite.y, damage)

    audioManager.playPlayerHit()
    hapticManager.heavy()

    // Screen shake on player damage
    this.screenShake.onPlayerDamage()

    // Notify callback
    this.callbacks.onPlayerDamaged()

    // Check for death
    if (playerSprite.getHealth() <= 0) {
      this.screenShake.onPlayerDeath()
      this.callbacks.onPlayerDeath()
      return
    }

    // Flash player when hit
    this.showHitFlash(playerSprite)

    // Push player back slightly
    const angle = Phaser.Math.Angle.Between(
      enemySprite.x,
      enemySprite.y,
      playerSprite.x,
      playerSprite.y
    )
    const knockbackForce = 150
    playerSprite.setVelocity(
      Math.cos(angle) * knockbackForce,
      Math.sin(angle) * knockbackForce
    )

    console.log(`Player hit by enemy! Health: ${playerSprite.getHealth()}`)
  }

  /**
   * Handle bomb explosion damage to player
   */
  handleBombExplosion(
    x: number,
    y: number,
    radius: number,
    damage: number,
    isGameOver: boolean
  ): void {
    if (isGameOver) return

    // Check if player is within explosion radius
    const distanceToPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y)
    if (distanceToPlayer <= radius) {
      // Try to damage player (respects invincibility and dodge)
      const damageResult = this.player.takeDamage(damage)

      // Check if attack was dodged
      if (damageResult.dodged) {
        this.damageNumberPool.showDodge(this.player.x, this.player.y)
        return
      }

      // Check if damage was taken (invincibility check)
      if (!damageResult.damaged) return

      audioManager.playPlayerHit()

      // Notify callback
      this.callbacks.onPlayerDamaged()

      // Check for death
      if (this.player.getHealth() <= 0) {
        this.callbacks.onPlayerDeath()
        return
      }

      // Flash player when hit
      this.showHitFlash(this.player)

      // Knockback from explosion center
      const angle = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y)
      const knockbackForce = 200
      this.player.setVelocity(
        Math.cos(angle) * knockbackForce,
        Math.sin(angle) * knockbackForce
      )

      console.log(`Player hit by bomb explosion! Health: ${this.player.getHealth()}`)
    }
  }

  /**
   * Handle spirit cat hitting an enemy
   */
  spiritCatHitEnemy(
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
    const isBoss = boss && enemySprite === (boss as unknown as Enemy)
    if (isBoss && !killed) {
      this.callbacks.onBossHealthUpdate(boss!.getHealth(), boss!.getMaxHealth())
      hapticManager.bossHit()
    }

    if (killed) {
      this.handleEnemyKilled(enemySprite, isBoss ?? false)
    }
  }

  /**
   * Handle enemy death (common logic for all damage sources)
   */
  private handleEnemyKilled(enemy: Enemy, isBoss: boolean): void {
    // Bloodthirst: Heal on kill
    const bloodthirstHeal = this.player.getBloodthirstHeal()
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal)
    }

    // Death particles and screen shake
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

    // Notify via callback
    this.callbacks.onEnemyKilled(enemy, isBoss, xpGain)

    // Clear boss reference
    if (isBoss) {
      this.callbacks.onBossKilled()
    }

    // Remove enemy from group and destroy
    enemy.destroy()

    // Invalidate nearest enemy cache since enemies changed
    this.callbacks.invalidateNearestEnemyCache()

    // Check if room is cleared (must be after enemy.destroy())
    this.callbacks.checkRoomCleared()
  }

  /**
   * Show hit flash effect on player
   */
  private showHitFlash(player: Player): void {
    player.setTint(0xff0000)
    player.setAlpha(0.7)

    this.scene.time.delayedCall(100, () => {
      if (player.active) {
        player.clearTint()
        player.setAlpha(1)
      }
    })
  }
}
