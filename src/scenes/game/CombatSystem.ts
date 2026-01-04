import Phaser from 'phaser'
import Player from '../../entities/Player'
import Enemy from '../../entities/Enemy'
import Boss from '../../entities/Boss'
import Bullet from '../../entities/Bullet'
import SpiritCat from '../../entities/SpiritCat'
import { audioManager } from '../../systems/AudioManager'
import { hapticManager } from '../../systems/HapticManager'
import type { ScreenShake } from '../../systems/ScreenShake'
import type { ParticleManager } from '../../systems/ParticleManager'
import type DamageNumberPool from '../../systems/DamageNumberPool'
import type { TalentBonuses } from '../../config/talentData'
import type { DifficultyConfig } from '../../config/difficulty'
import { chapterManager } from '../../systems/ChapterManager'
import { getChapterDefinition, type ChapterId } from '../../config/chapterData'

/**
 * Damage result from player taking damage
 */
export interface DamageResult {
  damaged: boolean
  dodged: boolean
}

/**
 * Combat event handlers interface
 */
export interface CombatEventHandlers {
  onEnemyKilled: (enemy: Enemy, isBoss: boolean) => void
  onPlayerDamaged: (damage: number) => void
  onPlayerDeath: () => void
  onBossHealthUpdate: (health: number, maxHealth: number) => void
  onBossKilled: () => void
  onLevelUp: () => void
  onXPGained: (xp: number) => void
}

/**
 * Combat system configuration
 */
export interface CombatSystemConfig {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  boss: Boss | null
  screenShake: ScreenShake
  particles: ParticleManager
  damageNumberPool: DamageNumberPool
  talentBonuses: TalentBonuses
  difficultyConfig: DifficultyConfig
  bonusXPMultiplier: number
  eventHandlers: CombatEventHandlers
}

/**
 * CombatSystem - Handles collision detection and damage calculations
 *
 * Extracted from GameScene to provide a focused combat handling system.
 * Manages bullet-enemy, bullet-wall, enemy-player, and bomb collisions.
 */
export class CombatSystem {
  private scene: Phaser.Scene
  private player: Player
  private enemies: Phaser.Physics.Arcade.Group
  private boss: Boss | null
  private screenShake: ScreenShake
  private particles: ParticleManager
  private damageNumberPool: DamageNumberPool
  private talentBonuses: TalentBonuses
  private difficultyConfig: DifficultyConfig
  private bonusXPMultiplier: number
  private eventHandlers: CombatEventHandlers

  private isGameOver: boolean = false
  private isLevelingUp: boolean = false
  private isTransitioning: boolean = false

  // Damage aura tracking
  private lastAuraDamageTime: number = 0
  private readonly AURA_DAMAGE_INTERVAL = 500 // Apply damage every 500ms

  constructor(config: CombatSystemConfig) {
    this.scene = config.scene
    this.player = config.player
    this.enemies = config.enemies
    this.boss = config.boss
    this.screenShake = config.screenShake
    this.particles = config.particles
    this.damageNumberPool = config.damageNumberPool
    this.talentBonuses = config.talentBonuses
    this.difficultyConfig = config.difficultyConfig
    this.bonusXPMultiplier = config.bonusXPMultiplier
    this.eventHandlers = config.eventHandlers
  }

  /**
   * Update game state flags
   */
  setGameState(isGameOver: boolean, isLevelingUp: boolean, isTransitioning: boolean): void {
    this.isGameOver = isGameOver
    this.isLevelingUp = isLevelingUp
    this.isTransitioning = isTransitioning
  }

  /**
   * Update boss reference
   */
  setBoss(boss: Boss | null): void {
    this.boss = boss
  }

  /**
   * Handle player bullet hitting an enemy
   */
  bulletHitEnemy(
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ): void {
    if (this.isGameOver || this.isTransitioning) return

    const bulletSprite = bullet as Bullet
    const enemySprite = enemy as Enemy

    // Skip if bullet is already inactive
    if (!bulletSprite.active) {
      return
    }

    // Skip if bullet has already hit this enemy (prevents duplicate collisions during piercing)
    if (bulletSprite.hasHitEnemy(enemy)) {
      return
    }

    // IMPORTANT: Immediately mark this enemy as hit to prevent duplicate damage
    // when physics system detects multiple overlaps in the same frame
    bulletSprite.markEnemyAsHit(enemy)

    // For non-piercing bullets, deactivate immediately to prevent hitting multiple enemies
    if (bulletSprite.getMaxPierces() === 0 && bulletSprite.getMaxBounces() === 0) {
      bulletSprite.setActive(false)
      bulletSprite.setVisible(false)
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

    // Apply status effects from bullet
    this.applyBulletStatusEffects(bulletSprite, enemySprite, killed, damage)

    // Check if bullet should be deactivated or continue (piercing/ricochet)
    const shouldDeactivate = bulletSprite.onHit(enemy)

    // Handle ricochet
    this.handleBulletRicochet(bulletSprite, enemySprite, shouldDeactivate)

    // Update boss health bar if this is the boss
    const isBoss = this.boss && enemySprite === (this.boss as unknown as Enemy)
    if (isBoss && !killed) {
      this.eventHandlers.onBossHealthUpdate(this.boss!.getHealth(), this.boss!.getMaxHealth())
      hapticManager.bossHit()
    }

    if (killed) {
      this.handleEnemyKilled(enemySprite, !!isBoss)
    }
  }

  /**
   * Apply status effects from bullet to enemy
   */
  private applyBulletStatusEffects(
    bullet: Bullet,
    enemy: Enemy,
    killed: boolean,
    damage: number
  ): void {
    if (killed) return

    // Apply fire DOT
    const fireDamage = bullet.getFireDamage()
    if (fireDamage > 0) {
      enemy.applyFireDamage(fireDamage, 2000) // 2 second burn
      this.particles.emitFire(enemy.x, enemy.y)
    }

    // Apply freeze
    if (bullet.rollFreeze()) {
      enemy.applyFreeze()
    }

    // Apply poison DOT
    const poisonDamage = bullet.getPoisonDamage()
    if (poisonDamage > 0) {
      enemy.applyPoisonDamage(poisonDamage)
    }

    // Handle lightning chain
    const lightningChainCount = bullet.getLightningChainCount()
    if (lightningChainCount > 0) {
      this.applyLightningChain(enemy, damage * 0.5, lightningChainCount)
    }
  }

  /**
   * Handle bullet ricochet to nearest enemy
   */
  private handleBulletRicochet(
    bullet: Bullet,
    hitEnemy: Enemy,
    shouldDeactivate: boolean
  ): void {
    if (!shouldDeactivate && bullet.getBounceCount() < bullet.getMaxBounces()) {
      const nearestEnemy = this.findNearestEnemyExcluding(bullet.x, bullet.y, hitEnemy)
      if (nearestEnemy) {
        bullet.redirectTo(nearestEnemy.x, nearestEnemy.y)
      } else {
        // No target for ricochet, deactivate
        bullet.setActive(false)
        bullet.setVisible(false)
      }
    } else if (shouldDeactivate) {
      bullet.setActive(false)
      bullet.setVisible(false)
    }
    // else: bullet continues (piercing)
  }

  /**
   * Handle player bullets hitting walls
   */
  bulletHitWall(
    bullet: Phaser.GameObjects.GameObject,
    _wall: Phaser.GameObjects.GameObject
  ): void {
    const bulletSprite = bullet as Bullet
    if (!bulletSprite.active) return

    // Through wall ability - bullets pass through walls
    if (bulletSprite.isThroughWallEnabled()) {
      return
    }

    // Bouncy wall ability - bullets bounce off walls
    if (bulletSprite.getMaxWallBounces() > 0 && bulletSprite.getWallBounceCount() < bulletSprite.getMaxWallBounces()) {
      const body = bulletSprite.body as Phaser.Physics.Arcade.Body

      // Reflect velocity based on current direction
      const vx = body.velocity.x
      const vy = body.velocity.y

      if (Math.abs(vx) > Math.abs(vy)) {
        body.velocity.x = -vx
      } else {
        body.velocity.y = -vy
      }

      // Update bullet rotation to match new direction
      bulletSprite.setRotation(Math.atan2(body.velocity.y, body.velocity.x))
      return
    }

    // Normal bullets are destroyed on wall contact
    bulletSprite.deactivate()
  }

  /**
   * Handle enemy bullets hitting walls
   */
  enemyBulletHitWall(
    bullet: Phaser.GameObjects.GameObject,
    _wall: Phaser.GameObjects.GameObject
  ): void {
    const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite
    if (!bulletSprite.active) return

    bulletSprite.setActive(false)
    bulletSprite.setVisible(false)
  }

  /**
   * Handle enemy bullets hitting player
   */
  enemyBulletHitPlayer(
    player: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject
  ): void {
    if (this.isGameOver || this.isLevelingUp) return

    const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite
    const playerSprite = player as Player

    // Skip if bullet is already inactive
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

    // Try to damage player
    const damageResult = playerSprite.takeDamage(bulletDamage)

    if (damageResult.dodged) {
      this.damageNumberPool.showDodge(playerSprite.x, playerSprite.y)
      return
    }

    if (!damageResult.damaged) return

    this.handlePlayerDamaged(playerSprite, bulletDamage, true)
  }

  /**
   * Handle enemy melee hitting player
   */
  enemyHitPlayer(
    player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ): void {
    if (this.isGameOver || this.isLevelingUp) return

    const playerSprite = player as Player
    const enemySprite = enemy as Enemy

    // Check melee attack cooldown
    const currentTime = this.scene.time.now
    if (!enemySprite.canMeleeAttack(currentTime)) {
      return
    }

    // Record this attack to start cooldown
    enemySprite.recordMeleeAttack(currentTime)

    // Get enemy damage with talent damage reduction
    const baseDamage = enemySprite.getDamage()
    const damageReduction = 1 - (this.talentBonuses.percentDamageReduction / 100)
    const damage = Math.round(baseDamage * damageReduction)

    // Try to damage player
    const damageResult = playerSprite.takeDamage(damage)

    if (damageResult.dodged) {
      this.damageNumberPool.showDodge(playerSprite.x, playerSprite.y)
      return
    }

    if (!damageResult.damaged) return

    this.handlePlayerDamaged(playerSprite, damage, false)

    // Apply knockback
    this.applyKnockback(enemySprite, playerSprite, 150)
  }

  /**
   * Handle bomb explosion damage to player
   */
  handleBombExplosion(x: number, y: number, radius: number, damage: number): void {
    if (this.isGameOver || this.isLevelingUp) return

    // Check if player is within explosion radius
    const distanceToPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y)
    if (distanceToPlayer > radius) return

    // Try to damage player
    const damageResult = this.player.takeDamage(damage)

    if (damageResult.dodged) {
      this.damageNumberPool.showDodge(this.player.x, this.player.y)
      return
    }

    if (!damageResult.damaged) return

    audioManager.playPlayerHit()
    this.eventHandlers.onPlayerDamaged(damage)

    // Flash screen red to indicate damage
    this.showScreenDamageFlash()

    // Check for death
    if (this.player.getHealth() <= 0) {
      this.eventHandlers.onPlayerDeath()
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
  }

  /**
   * Handle spirit cat hitting an enemy
   */
  spiritCatHitEnemy(
    cat: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ): void {
    if (this.isGameOver || this.isTransitioning) return

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
    const isBoss = this.boss && enemySprite === (this.boss as unknown as Enemy)
    if (isBoss && !killed) {
      this.eventHandlers.onBossHealthUpdate(this.boss!.getHealth(), this.boss!.getMaxHealth())
      hapticManager.bossHit()
    }

    if (killed) {
      this.handleEnemyKilled(enemySprite, !!isBoss)
    }
  }

  /**
   * Apply damage aura to nearby enemies
   */
  applyDamageAura(time: number, playerX: number, playerY: number): void {
    const auraDPS = this.player.getDamageAuraDPS()
    if (auraDPS <= 0) return

    // Only apply damage at intervals
    if (time - this.lastAuraDamageTime < this.AURA_DAMAGE_INTERVAL) return
    this.lastAuraDamageTime = time

    const auraRadius = this.player.getDamageAuraRadius()
    const damagePerTick = Math.floor(auraDPS / 2)

    const enemiesToDestroy: Enemy[] = []

    // Find and damage all enemies within aura radius
    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (!e.active) return

      const distance = Phaser.Math.Distance.Between(playerX, playerY, e.x, e.y)
      if (distance <= auraRadius) {
        const killed = e.takeDamage(damagePerTick)

        // Show damage number
        this.damageNumberPool.showEnemyDamage(e.x, e.y, damagePerTick, false)

        // Visual feedback
        this.particles.emitHit(e.x, e.y)

        if (killed) {
          enemiesToDestroy.push(e)
        }
      }
    })

    // Handle deaths from aura damage
    for (const e of enemiesToDestroy) {
      const isBoss = this.boss && e === (this.boss as unknown as Enemy)
      this.handleEnemyKilled(e, !!isBoss)
    }
  }

  /**
   * Apply lightning chain effect to nearby enemies
   */
  applyLightningChain(source: Enemy, damage: number, chainCount: number): void {
    const maxChainDistance = 250 // Increased from 150 to better catch minions

    // Find nearby enemies excluding the source
    const nearbyEnemies: Enemy[] = []
    this.enemies.getChildren().forEach((enemy) => {
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

    // Apply damage to each target with visual feedback
    targets.forEach((target) => {
      if (!target.active || !target.scene) return

      // Draw lightning line from source to target
      this.drawLightningLine(source.x, source.y, target.x, target.y)

      // Show particle effect at target
      this.particles.emitHit(target.x, target.y)

      // Apply damage
      const killed = target.takeDamage(Math.floor(damage))

      if (killed) {
        const isBoss = this.boss && target === (this.boss as unknown as Enemy)
        this.handleEnemyKilled(target, !!isBoss)
      }
    })
  }

  /**
   * Handle common enemy killed logic
   */
  private handleEnemyKilled(enemy: Enemy, isBoss: boolean): void {
    // Death particles and screen shake
    if (isBoss) {
      this.particles.emitBossDeath(enemy.x, enemy.y)
      this.screenShake.onBossDeath()
    } else {
      this.particles.emitDeath(enemy.x, enemy.y)
      this.screenShake.onExplosion()
      hapticManager.light()
    }

    // Bloodthirst: Heal on kill
    const bloodthirstHeal = this.player.getBloodthirstHeal()
    if (bloodthirstHeal > 0) {
      this.player.heal(bloodthirstHeal)
    }

    // Add XP with equipment XP bonus
    const baseXpGain = isBoss ? 10 : 1
    const xpGain = Math.round(baseXpGain * this.bonusXPMultiplier)

    // Notify event handlers
    this.eventHandlers.onEnemyKilled(enemy, isBoss)
    this.eventHandlers.onXPGained(xpGain)

    if (isBoss) {
      this.eventHandlers.onBossKilled()
    }
  }

  /**
   * Handle player taking damage
   */
  private handlePlayerDamaged(
    player: Player,
    damage: number,
    isRangedAttack: boolean
  ): void {
    // Show damage number
    this.damageNumberPool.showPlayerDamage(player.x, player.y, damage)

    audioManager.playPlayerHit()
    hapticManager.heavy()

    // Screen shake based on damage amount
    if (isRangedAttack && damage >= 15) {
      this.screenShake.onPlayerHeavyDamage()
    } else {
      this.screenShake.onPlayerDamage()
    }

    // Flash screen red to indicate damage
    this.showScreenDamageFlash()

    // Notify handler
    this.eventHandlers.onPlayerDamaged(damage)

    // Check for death
    if (player.getHealth() <= 0) {
      this.screenShake.onPlayerDeath()
      this.eventHandlers.onPlayerDeath()
      return
    }

    // Flash player when hit
    this.showHitFlash(player)
  }

  /**
   * Apply knockback from source to target
   */
  applyKnockback(
    source: Phaser.GameObjects.Sprite,
    target: Phaser.Physics.Arcade.Sprite,
    force: number
  ): void {
    const angle = Phaser.Math.Angle.Between(source.x, source.y, target.x, target.y)
    target.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force)
  }

  /**
   * Show hit flash effect on sprite
   */
  showHitFlash(sprite: Phaser.Physics.Arcade.Sprite): void {
    sprite.setTint(0xff0000)
    sprite.setAlpha(0.7)

    this.scene.time.delayedCall(100, () => {
      if (sprite.active) {
        sprite.clearTint()
        sprite.setAlpha(1)
      }
    })
  }

  /**
   * Flash the screen red when player takes damage
   */
  showScreenDamageFlash(): void {
    const camera = this.scene.cameras.main
    const flashOverlay = this.scene.add.rectangle(
      camera.width / 2,
      camera.height / 2,
      camera.width,
      camera.height,
      0xff0000,
      0.3
    )
    flashOverlay.setScrollFactor(0)
    flashOverlay.setDepth(1000)

    this.scene.tweens.add({
      targets: flashOverlay,
      alpha: 0,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => flashOverlay.destroy(),
    })
  }

  /**
   * Find nearest enemy excluding a specific enemy
   */
  findNearestEnemyExcluding(x: number, y: number, exclude: Enemy): Enemy | null {
    let nearest: Enemy | null = null
    let nearestDistance = Infinity

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (e === exclude || !e.active) return

      const distance = Phaser.Math.Distance.Between(x, y, e.x, e.y)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = e
      }
    })

    return nearest
  }

  /**
   * Find nearest enemy to a position
   */
  findNearestEnemy(x: number, y: number): Enemy | null {
    let nearest: Enemy | null = null
    let nearestDistance = Infinity

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      if (!e.active) return

      const distance = Phaser.Math.Distance.Between(x, y, e.x, e.y)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearest = e
      }
    })

    return nearest
  }

  /**
   * Draw a lightning effect line between two points
   */
  private drawLightningLine(x1: number, y1: number, x2: number, y2: number): void {
    const graphics = this.scene.add.graphics()
    graphics.lineStyle(3, 0x8888ff, 1) // Light blue/purple

    // Draw slightly jagged line for lightning effect
    const segments = 4
    const dx = (x2 - x1) / segments
    const dy = (y2 - y1) / segments

    graphics.beginPath()
    graphics.moveTo(x1, y1)

    for (let i = 1; i < segments; i++) {
      // Add some randomness to middle points
      const offsetX = (Math.random() - 0.5) * 10
      const offsetY = (Math.random() - 0.5) * 10
      graphics.lineTo(x1 + dx * i + offsetX, y1 + dy * i + offsetY)
    }

    graphics.lineTo(x2, y2)
    graphics.strokePath()

    // Fade out and destroy
    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 150,
      onComplete: () => graphics.destroy(),
    })
  }
}

export default CombatSystem
