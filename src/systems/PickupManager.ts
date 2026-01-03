import type Enemy from '../entities/Enemy'
import type GoldPool from './GoldPool'
import type HealthPool from './HealthPool'
import type { ParticleManager } from './ParticleManager'
import { hapticManager } from './HapticManager'
import type { EnemyType } from './CurrencyManager'

export interface PickupCallbacks {
  onGoldCollected: (amount: number) => void
  onHealthCollected: (amount: number) => void
}

/**
 * PickupManager handles gold and health pickup spawning and collection.
 * Extracted from GameScene to centralize pickup logic.
 */
export class PickupManager {
  private goldPool: GoldPool
  private healthPool: HealthPool
  private particles: ParticleManager
  private callbacks!: PickupCallbacks

  constructor(
    goldPool: GoldPool,
    healthPool: HealthPool,
    particles: ParticleManager
  ) {
    this.goldPool = goldPool
    this.healthPool = healthPool
    this.particles = particles
  }

  /**
   * Set callbacks for pickup events
   */
  setCallbacks(callbacks: PickupCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Determine enemy type for gold drops based on class hierarchy
   */
  private getEnemyType(enemy: Enemy): EnemyType {
    // Check constructor name since we can't import all types
    const constructorName = enemy.constructor.name

    if (constructorName === 'Boss' || constructorName.endsWith('Boss')) {
      return 'boss'
    }
    if (constructorName === 'SpreaderEnemy') {
      return 'spreader'
    }
    if (constructorName === 'RangedShooterEnemy') {
      return 'ranged'
    }
    return 'melee'
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

    // 5% chance to drop health potion (heals 20 HP)
    if (Math.random() < 0.05) {
      this.healthPool.spawn(enemy.x, enemy.y, 20)
      console.log('Health potion spawned!')
    }
  }

  /**
   * Update pickup collection
   */
  update(playerX: number, playerY: number): number {
    // Update gold pickups - check for collection
    const goldCollected = this.goldPool.updateAll(playerX, playerY)
    if (goldCollected > 0) {
      this.callbacks.onGoldCollected(goldCollected)
      // Gold collect particles at player position
      this.particles.emitGoldCollect(playerX, playerY)
      hapticManager.light()
    }

    // Update health pickups - check for collection
    this.healthPool.updateAll(playerX, playerY, (healAmount) => {
      this.callbacks.onHealthCollected(healAmount)
      // Heal particles at player position
      this.particles.emitHeal(playerX, playerY)
      hapticManager.light()
    })

    return goldCollected
  }

  /**
   * Collect all remaining pickups (called when room clears)
   */
  collectAll(playerX: number, playerY: number, onHeal: (amount: number) => void): number {
    const goldCollected = this.goldPool.collectAll(playerX, playerY)
    this.healthPool.collectAll(playerX, playerY, onHeal)
    return goldCollected
  }

  /**
   * Clean up pickups (called on room transition)
   */
  cleanup(): void {
    this.goldPool.cleanup()
  }
}
