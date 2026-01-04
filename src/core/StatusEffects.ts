/**
 * StatusEffects - Reusable status effect system for enemies
 *
 * Manages fire DOT, freeze, and poison effects with stacking behavior.
 * Extracted from Enemy.ts to allow reuse across all enemy types.
 */

export type StatusEffectType = 'fire' | 'freeze' | 'poison'

export interface FireEffect {
  damage: number
  ticks: number
  tickInterval: number
  lastTick: number
}

export interface FreezeEffect {
  endTime: number
  duration: number
}

export interface PoisonEffect {
  damage: number
  stacks: number
  maxStacks: number
  ticks: number
  tickInterval: number
  lastTick: number
  duration: number
}

export interface StatusEffectTint {
  frozen: number
  burning: number
  poisoned: number
}

const DEFAULT_TINTS: StatusEffectTint = {
  frozen: 0x66ccff, // Blue tint for frozen
  burning: 0xff4400, // Orange tint for burning
  poisoned: 0x66ff66, // Green tint for poisoned
}

/**
 * Result of a status effect update tick
 */
export interface StatusEffectUpdateResult {
  /** Total damage dealt this tick from all effects */
  damage: number
  /** Whether the entity is currently frozen */
  isFrozen: boolean
  /** Whether any effects changed state (for tint updates) */
  effectsChanged: boolean
}

export class StatusEffectSystem {
  // Fire DOT
  private fire: FireEffect = {
    damage: 0,
    ticks: 0,
    tickInterval: 500,
    lastTick: 0,
  }

  // Freeze effect
  private freeze: FreezeEffect = {
    endTime: 0,
    duration: 1500,
  }
  private _isFrozen: boolean = false

  // Poison DOT
  private poison: PoisonEffect = {
    damage: 0,
    stacks: 0,
    maxStacks: 5,
    ticks: 0,
    tickInterval: 1000,
    lastTick: 0,
    duration: 4000,
  }

  private tints: StatusEffectTint = { ...DEFAULT_TINTS }

  constructor(options?: {
    freezeDuration?: number
    poisonMaxStacks?: number
    poisonDuration?: number
    fireTickInterval?: number
    poisonTickInterval?: number
    tints?: Partial<StatusEffectTint>
  }) {
    if (options?.freezeDuration) this.freeze.duration = options.freezeDuration
    if (options?.poisonMaxStacks) this.poison.maxStacks = options.poisonMaxStacks
    if (options?.poisonDuration) this.poison.duration = options.poisonDuration
    if (options?.fireTickInterval) this.fire.tickInterval = options.fireTickInterval
    if (options?.poisonTickInterval) this.poison.tickInterval = options.poisonTickInterval
    if (options?.tints) this.tints = { ...DEFAULT_TINTS, ...options.tints }
  }

  /**
   * Apply fire DOT effect
   * @param damage Damage per tick
   * @param duration Duration in ms (default 2000ms)
   * @param currentTime Current game time
   */
  applyFire(damage: number, duration: number = 2000, currentTime: number): void {
    if (damage <= 0) return

    this.fire.damage = damage
    this.fire.ticks = Math.ceil(duration / this.fire.tickInterval)
    this.fire.lastTick = currentTime
  }

  /**
   * Apply freeze effect
   * @param currentTime Current game time
   * @param duration Optional custom duration
   */
  applyFreeze(currentTime: number, duration?: number): void {
    this._isFrozen = true
    this.freeze.endTime = currentTime + (duration ?? this.freeze.duration)
  }

  /**
   * Apply poison DOT effect - stacks up to max
   * @param damage Base damage per tick per stack
   * @param currentTime Current game time
   */
  applyPoison(damage: number, currentTime: number): void {
    if (damage <= 0) return

    // Stack poison up to max
    if (this.poison.stacks < this.poison.maxStacks) {
      this.poison.stacks++
    }

    this.poison.damage = damage
    this.poison.ticks = Math.ceil(this.poison.duration / this.poison.tickInterval)
    this.poison.lastTick = currentTime
  }

  /**
   * Check if entity is frozen
   */
  isFrozen(): boolean {
    return this._isFrozen
  }

  /**
   * Check if fire is active
   */
  isOnFire(): boolean {
    return this.fire.ticks > 0
  }

  /**
   * Check if poison is active
   */
  isPoisoned(): boolean {
    return this.poison.stacks > 0
  }

  /**
   * Get current poison stacks
   */
  getPoisonStacks(): number {
    return this.poison.stacks
  }

  /**
   * Update all status effects
   * @param currentTime Current game time
   * @returns Update result with damage and state info
   */
  update(currentTime: number): StatusEffectUpdateResult {
    let damage = 0
    let effectsChanged = false

    // Update freeze
    if (this._isFrozen && currentTime >= this.freeze.endTime) {
      this._isFrozen = false
      effectsChanged = true
    }

    // Update fire DOT
    if (this.fire.ticks > 0 && currentTime - this.fire.lastTick >= this.fire.tickInterval) {
      this.fire.ticks--
      this.fire.lastTick = currentTime
      damage += this.fire.damage

      if (this.fire.ticks === 0) {
        this.fire.damage = 0
        effectsChanged = true
      }
    }

    // Update poison DOT
    if (
      this.poison.ticks > 0 &&
      currentTime - this.poison.lastTick >= this.poison.tickInterval
    ) {
      this.poison.ticks--
      this.poison.lastTick = currentTime
      damage += this.poison.damage * this.poison.stacks

      if (this.poison.ticks === 0) {
        this.poison.damage = 0
        this.poison.stacks = 0
        effectsChanged = true
      }
    }

    return {
      damage,
      isFrozen: this._isFrozen,
      effectsChanged,
    }
  }

  /**
   * Get the current tint color based on active effects
   * Priority: Frozen > Burning > Poisoned > null
   */
  getTint(): number | null {
    if (this._isFrozen) {
      return this.tints.frozen
    }
    if (this.fire.ticks > 0) {
      return this.tints.burning
    }
    if (this.poison.stacks > 0) {
      return this.tints.poisoned
    }
    return null
  }

  /**
   * Check if any effect is active
   */
  hasActiveEffect(): boolean {
    return this._isFrozen || this.fire.ticks > 0 || this.poison.stacks > 0
  }

  /**
   * Clear a specific effect or all effects
   */
  clear(type?: StatusEffectType): void {
    if (!type || type === 'fire') {
      this.fire.damage = 0
      this.fire.ticks = 0
    }
    if (!type || type === 'freeze') {
      this._isFrozen = false
      this.freeze.endTime = 0
    }
    if (!type || type === 'poison') {
      this.poison.damage = 0
      this.poison.stacks = 0
      this.poison.ticks = 0
    }
  }

  /**
   * Reset all effects (for enemy pooling/reuse)
   */
  reset(): void {
    this.clear()
  }
}

export default StatusEffectSystem
