import Phaser from 'phaser'
import { EnemyType } from '../config/chapterData'
import type WallGroup from '../systems/WallGroup'

/**
 * Options for enemy spawning with difficulty and chapter modifiers
 */
export interface EnemyOptions {
  /** HP multiplier from difficulty/chapter (default 1.0) */
  healthMultiplier?: number
  /** Damage multiplier from difficulty/chapter (default 1.0) */
  damageMultiplier?: number
  /** Movement speed multiplier from chapter (default 1.0) */
  speedMultiplier?: number
  /** Attack cooldown multiplier from chapter (lower = faster attacks, default 1.0) */
  attackCooldownMultiplier?: number
  /** Projectile speed multiplier from chapter (default 1.0) */
  projectileSpeedMultiplier?: number
  /** Special ability intensity from chapter (heal amount, spawn rate, etc, default 1.0) */
  abilityIntensityMultiplier?: number
  /** Enemy type for tracking kills */
  enemyType?: EnemyType
}

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
  private health: number
  private maxHealth: number
  protected damageMultiplier: number = 1.0 // For difficulty scaling
  protected speedMultiplier: number = 1.0 // For chapter-specific speed
  protected readonly enemyType: EnemyType // For kill tracking

  // Fire DOT tracking
  private fireDamage: number = 0 // Damage per tick
  private fireTicks: number = 0 // Remaining ticks
  private fireTickInterval: number = 500 // ms between ticks
  private lastFireTick: number = 0

  // Freeze effect tracking
  private isFrozen: boolean = false
  private freezeEndTime: number = 0
  private readonly freezeDuration: number = 1500 // 1.5 seconds

  // Poison DOT tracking
  private poisonDamage: number = 0 // Damage per tick (base damage per stack)
  private poisonStacks: number = 0 // Current stacks (max 5)
  private readonly poisonMaxStacks: number = 5
  private poisonTicks: number = 0 // Remaining ticks
  private readonly poisonTickInterval: number = 1000 // 1 second between ticks
  private lastPoisonTick: number = 0
  private readonly poisonDuration: number = 4000 // 4 seconds

  // Melee attack cooldown - per-enemy instance tracking
  private lastMeleeAttackTime: number = 0
  private meleeAttackCooldown: number = 1000 // 1 second between melee hits (can be modified by chapter)

  // Health bar
  private healthBar?: Phaser.GameObjects.Graphics
  private healthBarWidth: number = 30
  private healthBarHeight: number = 4
  private healthBarOffsetY: number = -22 // Position above enemy
  private lastHealthBarValue: number = -1 // Track last health to avoid redraws
  private lastHealthBarX: number = 0 // Track last position for cheap updates
  private lastHealthBarY: number = 0

  // Wall avoidance system
  protected wallGroup: WallGroup | null = null
  private lastPositionForStuck: { x: number; y: number } = { x: 0, y: 0 }
  private stuckFrames: number = 0
  private readonly STUCK_THRESHOLD = 5 // Frames without movement before triggering avoidance
  private readonly STUCK_DISTANCE_THRESHOLD = 0.5 // Minimum movement per frame
  private alternateAngle: number | null = null // Current avoidance direction
  private alternateTimer: number = 0 // Time since avoidance started
  private readonly ALTERNATE_DURATION = 500 // ms to follow alternate path

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: EnemyOptions
  ) {
    super(scene, x, y, 'enemyMelee')

    // Store enemy type for kill tracking
    this.enemyType = options?.enemyType ?? 'melee'

    // Apply difficulty modifiers
    const baseHealth = 30
    this.maxHealth = Math.round(baseHealth * (options?.healthMultiplier ?? 1.0))
    this.health = this.maxHealth
    this.damageMultiplier = options?.damageMultiplier ?? 1.0
    this.speedMultiplier = options?.speedMultiplier ?? 1.0

    // Apply melee attack cooldown multiplier (lower = faster attacks)
    this.meleeAttackCooldown = Math.round(1000 * (options?.attackCooldownMultiplier ?? 1.0))

    // Set display size
    this.setDisplaySize(30, 30)

    // Ensure enemy is visible and active
    this.setActive(true)
    this.setVisible(true)
    this.setDepth(1) // Make sure enemy renders above background

    // Create health bar (initially hidden)
    this.healthBar = scene.add.graphics()
    this.healthBar.setDepth(10) // Above everything
    this.healthBar.setVisible(false)

    console.log('Enemy constructor called at', x, y, 'with health:', this.maxHealth)
  }

  takeDamage(amount: number): boolean {
    this.health -= amount

    // Flash effect
    this.setTint(0xffffff)
    // Guard against destroyed enemy or missing scene (can happen with lightning chain on pooled enemies)
    if (this.scene?.time) {
      this.scene.time.delayedCall(100, () => {
        this.updateEffectTint()
      })
    }

    // Update health bar
    this.updateHealthBar()

    if (this.health <= 0) {
      return true // Enemy died
    }
    return false
  }

  /**
   * Update the visual tint based on active effects
   * Priority: Frozen > Burning > Poisoned > None
   */
  private updateEffectTint(): void {
    if (this.isFrozen) {
      this.setTint(0x66ccff) // Blue tint for frozen
    } else if (this.fireTicks > 0) {
      this.setTint(0xff4400) // Orange tint for burning
    } else if (this.poisonStacks > 0) {
      this.setTint(0x66ff66) // Green tint for poisoned
    } else {
      this.clearTint()
    }
  }

  /**
   * Redraw the health bar (only call when health actually changes)
   * For position-only updates, use updateHealthBarPosition()
   */
  private updateHealthBar(): void {
    if (!this.healthBar) return

    // Only show if damaged but not dead
    if (this.health >= this.maxHealth || this.health <= 0) {
      this.healthBar.setVisible(false)
      this.lastHealthBarValue = -1
      return
    }

    // Skip redraw if health hasn't changed (optimization)
    if (this.health === this.lastHealthBarValue) {
      // Just update position if needed
      this.updateHealthBarPosition()
      return
    }

    this.lastHealthBarValue = this.health
    this.lastHealthBarX = this.x
    this.lastHealthBarY = this.y

    this.healthBar.setVisible(true)
    this.healthBar.clear()

    const barX = this.x - this.healthBarWidth / 2
    const barY = this.y + this.healthBarOffsetY

    // Background (dark gray)
    this.healthBar.fillStyle(0x333333, 0.8)
    this.healthBar.fillRect(barX, barY, this.healthBarWidth, this.healthBarHeight)

    // Health fill (green to red based on health percentage)
    const healthPercent = this.health / this.maxHealth
    const fillWidth = this.healthBarWidth * healthPercent
    const color = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
    this.healthBar.fillStyle(color, 1)
    this.healthBar.fillRect(barX, barY, fillWidth, this.healthBarHeight)

    // Border
    this.healthBar.lineStyle(1, 0x000000, 0.8)
    this.healthBar.strokeRect(barX, barY, this.healthBarWidth, this.healthBarHeight)
  }

  /**
   * Update health bar position only (cheap operation)
   * Called every frame while health bar is visible
   */
  private updateHealthBarPosition(): void {
    if (!this.healthBar?.visible) return

    // Only redraw if position actually changed (optimization)
    if (this.x === this.lastHealthBarX && this.y === this.lastHealthBarY) {
      return
    }

    this.lastHealthBarX = this.x
    this.lastHealthBarY = this.y

    // Must redraw graphics since Phaser graphics can't just move
    this.healthBar.clear()

    const barX = this.x - this.healthBarWidth / 2
    const barY = this.y + this.healthBarOffsetY

    // Background (dark gray)
    this.healthBar.fillStyle(0x333333, 0.8)
    this.healthBar.fillRect(barX, barY, this.healthBarWidth, this.healthBarHeight)

    // Health fill
    const healthPercent = this.health / this.maxHealth
    const fillWidth = this.healthBarWidth * healthPercent
    const color = healthPercent > 0.5 ? 0x00ff00 : healthPercent > 0.25 ? 0xffff00 : 0xff0000
    this.healthBar.fillStyle(color, 1)
    this.healthBar.fillRect(barX, barY, fillWidth, this.healthBarHeight)

    // Border
    this.healthBar.lineStyle(1, 0x000000, 0.8)
    this.healthBar.strokeRect(barX, barY, this.healthBarWidth, this.healthBarHeight)
  }

  /**
   * Apply fire DOT effect
   * @param damage Damage per tick
   * @param duration Duration in ms (default 2000ms = 2 seconds)
   */
  applyFireDamage(damage: number, duration: number = 2000): void {
    if (damage <= 0) return

    this.fireDamage = damage
    this.fireTicks = Math.ceil(duration / this.fireTickInterval)
    this.lastFireTick = this.scene.time.now

    // Update visual
    this.updateEffectTint()
  }

  /**
   * Apply freeze effect - enemy can't move or attack for duration
   */
  applyFreeze(): void {
    this.isFrozen = true
    this.freezeEndTime = this.scene.time.now + this.freezeDuration

    // Stop all movement
    this.setVelocity(0, 0)

    // Update visual
    this.updateEffectTint()
  }

  /**
   * Check if enemy is currently frozen
   */
  isEnemyFrozen(): boolean {
    return this.isFrozen
  }

  /**
   * Apply poison DOT effect - stacks up to 5 times
   * @param damage Base damage per tick per stack
   */
  applyPoisonDamage(damage: number): void {
    if (damage <= 0) return

    // Stack poison up to max
    if (this.poisonStacks < this.poisonMaxStacks) {
      this.poisonStacks++
    }

    // Update damage (accumulate per stack)
    this.poisonDamage = damage

    // Reset/extend duration
    this.poisonTicks = Math.ceil(this.poisonDuration / this.poisonTickInterval)
    this.lastPoisonTick = this.scene.time.now

    // Update visual
    this.updateEffectTint()
  }

  /**
   * Get current poison stack count
   */
  getPoisonStacks(): number {
    return this.poisonStacks
  }

  resetHealth() {
    this.health = this.maxHealth
    this.fireDamage = 0
    this.fireTicks = 0
    // Reset freeze
    this.isFrozen = false
    this.freezeEndTime = 0
    // Reset poison
    this.poisonDamage = 0
    this.poisonStacks = 0
    this.poisonTicks = 0
    // Reset melee attack cooldown
    this.lastMeleeAttackTime = 0
    this.clearTint()
    // Hide health bar when reset
    if (this.healthBar) {
      this.healthBar.setVisible(false)
      this.healthBar.clear()
    }
  }

  /**
   * Heal the enemy by the specified amount (capped at max health)
   * @param amount Amount of HP to restore
   * @returns The actual amount healed
   */
  heal(amount: number): number {
    const previousHealth = this.health
    this.health = Math.min(this.health + amount, this.maxHealth)
    const healedAmount = this.health - previousHealth

    // Update health bar if healed
    if (healedAmount > 0) {
      this.updateHealthBar()
    }

    return healedAmount
  }

  /**
   * Get current health
   */
  getHealth(): number {
    return this.health
  }

  /**
   * Get max health
   */
  getMaxHealth(): number {
    return this.maxHealth
  }

  /**
   * Get the enemy type for kill tracking
   */
  getEnemyType(): EnemyType {
    return this.enemyType
  }

  /**
   * Update fire DOT effect
   * @returns true if enemy died from fire damage
   */
  private updateFireDamage(time: number): boolean {
    if (this.fireTicks > 0 && time - this.lastFireTick >= this.fireTickInterval) {
      this.fireTicks--
      this.lastFireTick = time

      // Apply fire damage
      const died = this.takeDamage(this.fireDamage)

      // Clear fire effect if no ticks remaining
      if (this.fireTicks === 0) {
        this.fireDamage = 0
        if (!died) {
          this.updateEffectTint()
        }
      }

      return died
    }
    return false
  }

  /**
   * Update freeze effect
   */
  private updateFreeze(time: number): void {
    if (this.isFrozen && time >= this.freezeEndTime) {
      this.isFrozen = false
      this.updateEffectTint()
    }
  }

  /**
   * Update poison DOT effect
   * @returns true if enemy died from poison damage
   */
  private updatePoisonDamage(time: number): boolean {
    if (this.poisonTicks > 0 && time - this.lastPoisonTick >= this.poisonTickInterval) {
      this.poisonTicks--
      this.lastPoisonTick = time

      // Apply poison damage (damage per stack per tick)
      const totalPoisonDamage = this.poisonDamage * this.poisonStacks
      const died = this.takeDamage(totalPoisonDamage)

      // Clear poison effect if no ticks remaining
      if (this.poisonTicks === 0) {
        this.poisonDamage = 0
        this.poisonStacks = 0
        if (!died) {
          this.updateEffectTint()
        }
      }

      return died
    }
    return false
  }

  /**
   * Get the damage this enemy deals (with difficulty modifier applied)
   */
  getDamage(): number {
    const baseDamage = 15 // Base melee damage (increased by 200%)
    return Math.round(baseDamage * this.damageMultiplier)
  }

  /**
   * Check if the enemy can perform a melee attack (cooldown has passed)
   * @param time Current game time in ms
   */
  canMeleeAttack(time: number): boolean {
    return time - this.lastMeleeAttackTime >= this.meleeAttackCooldown
  }

  /**
   * Record that a melee attack was performed (starts cooldown)
   * @param time Current game time in ms
   */
  recordMeleeAttack(time: number): void {
    this.lastMeleeAttackTime = time
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update freeze effect
    this.updateFreeze(time)

    // Update fire DOT
    const diedFromFire = this.updateFireDamage(time)
    if (diedFromFire) {
      return true // Signal to caller that enemy died
    }

    // Update poison DOT
    const diedFromPoison = this.updatePoisonDamage(time)
    if (diedFromPoison) {
      return true // Signal to caller that enemy died
    }

    // If frozen, don't move or act
    if (this.isFrozen) {
      this.setVelocity(0, 0)
      return false
    }

    // Simple AI: move toward player with wall avoidance
    const baseSpeed = 80
    const speed = baseSpeed * this.speedMultiplier

    if (this.wallGroup) {
      // Use wall-aware movement
      const movement = this.calculateMovementWithWallAvoidance(playerX, playerY, speed, time)
      this.setVelocity(movement.vx, movement.vy)
    } else {
      // Fallback to direct movement
      const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
    }

    // Ensure enemy stays within world bounds (extra safety check)
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      // Clamp position to world bounds with a small margin
      const margin = 15 // Half of enemy size
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    // Update health bar position (if visible) - optimized position-only update
    if (this.healthBar?.visible) {
      this.updateHealthBarPosition()
    }

    return false
  }

  /**
   * Set wall group reference for wall avoidance pathfinding
   */
  setWallGroup(wallGroup: WallGroup): void {
    this.wallGroup = wallGroup
  }

  /**
   * Check if a position is blocked by any wall
   */
  protected isPositionBlockedByWall(x: number, y: number): boolean {
    if (!this.wallGroup) return false

    const padding = 20 // Account for enemy size
    for (const wall of this.wallGroup.getWalls()) {
      const halfWidth = wall.width / 2 + padding
      const halfHeight = wall.height / 2 + padding

      if (
        x >= wall.x - halfWidth &&
        x <= wall.x + halfWidth &&
        y >= wall.y - halfHeight &&
        y <= wall.y + halfHeight
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Find an alternate direction when blocked by a wall
   */
  private findAlternateDirection(
    blockedAngle: number,
    playerX: number,
    playerY: number
  ): number {
    // Sample 7 directions offset from the blocked direction
    const offsets = [
      Math.PI / 4, // 45 degrees clockwise
      -Math.PI / 4, // 45 degrees counter-clockwise
      Math.PI / 2, // 90 degrees clockwise
      -Math.PI / 2, // 90 degrees counter-clockwise
      (3 * Math.PI) / 4,
      (-3 * Math.PI) / 4,
      Math.PI, // Opposite direction (last resort)
    ]

    const testDistance = 40 // Pixels ahead to check
    let bestAngle = blockedAngle
    let bestScore = -Infinity

    for (const offset of offsets) {
      const testAngle = blockedAngle + offset
      const testX = this.x + Math.cos(testAngle) * testDistance
      const testY = this.y + Math.sin(testAngle) * testDistance

      // Check if test position is blocked by wall
      if (this.isPositionBlockedByWall(testX, testY)) {
        continue
      }

      // Score by how much this direction moves toward player
      const distBefore = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)
      const distAfter = Phaser.Math.Distance.Between(testX, testY, playerX, playerY)
      const progressScore = distBefore - distAfter // Positive = getting closer

      // Prefer smaller offsets (more direct paths)
      const offsetPenalty = Math.abs(offset) * 5
      const score = progressScore - offsetPenalty

      if (score > bestScore) {
        bestScore = score
        bestAngle = testAngle
      }
    }

    return bestAngle
  }

  /**
   * Calculate movement with wall avoidance
   * Returns velocity components for wall-aware movement
   */
  protected calculateMovementWithWallAvoidance(
    playerX: number,
    playerY: number,
    baseSpeed: number,
    time: number
  ): { vx: number; vy: number } {
    // Direct angle to player
    const directAngle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)

    // Check if currently stuck (position hasn't changed despite velocity)
    const dx = this.x - this.lastPositionForStuck.x
    const dy = this.y - this.lastPositionForStuck.y
    const distMoved = Math.sqrt(dx * dx + dy * dy)

    if (distMoved < this.STUCK_DISTANCE_THRESHOLD && this.body) {
      this.stuckFrames++
    } else {
      this.stuckFrames = 0
      this.alternateAngle = null // Clear alternate path when moving freely
    }

    // Update last position
    this.lastPositionForStuck.x = this.x
    this.lastPositionForStuck.y = this.y

    // If stuck, find alternate direction
    if (this.stuckFrames > this.STUCK_THRESHOLD) {
      if (
        this.alternateAngle === null ||
        time - this.alternateTimer > this.ALTERNATE_DURATION
      ) {
        this.alternateAngle = this.findAlternateDirection(directAngle, playerX, playerY)
        this.alternateTimer = time
      }
    }

    // Use alternate angle if set, otherwise direct
    const moveAngle = this.alternateAngle ?? directAngle

    return {
      vx: Math.cos(moveAngle) * baseSpeed,
      vy: Math.sin(moveAngle) * baseSpeed,
    }
  }

  destroy(fromScene?: boolean) {
    if (this.healthBar) {
      this.healthBar.destroy()
      this.healthBar = undefined
    }
    super.destroy(fromScene)
  }
}
