import type BulletPool from '../systems/BulletPool'
import type EnemyBulletPool from '../systems/EnemyBulletPool'
import type BombPool from '../systems/BombPool'
import type GoldPool from '../systems/GoldPool'
import type HealthPool from '../systems/HealthPool'
import type DamageNumberPool from '../systems/DamageNumberPool'
import type SpiritCatPool from '../systems/SpiritCatPool'
import type { ScreenShake } from '../systems/ScreenShake'
import type { ParticleManager } from '../systems/ParticleManager'
import type { TalentBonuses } from '../config/talentData'
import type { DifficultyConfig } from '../config/difficulty'
import type Player from '../entities/Player'
import type Enemy from '../entities/Enemy'
import type Boss from '../entities/Boss'

/**
 * References to all object pools used in the game
 */
export interface PoolReferences {
  bulletPool: BulletPool
  enemyBulletPool: EnemyBulletPool
  bombPool: BombPool
  goldPool: GoldPool
  healthPool: HealthPool
  damageNumberPool: DamageNumberPool
  spiritCatPool?: SpiritCatPool
}

/**
 * References to visual effect systems
 */
export interface EffectsReferences {
  screenShake: ScreenShake
  particles: ParticleManager
}

/**
 * Core game state tracked during gameplay
 */
export interface GameState {
  isGameOver: boolean
  isTransitioning: boolean
  currentRoom: number
  totalRooms: number
  isRoomCleared: boolean
  enemiesKilled: number
  goldEarned: number
  heroXPEarned: number
  abilitiesGained: number
  runStartTime: number
}

/**
 * Combat-related callbacks for handling kills and damage
 */
export interface CombatCallbacks {
  onEnemyKilled: (enemy: Enemy, isBoss: boolean) => void
  onPlayerDamaged: (damage: number) => void
  onPlayerDeath: () => void
  onBossHealthUpdate: (current: number, max: number) => void
}

/**
 * Room management callbacks
 */
export interface RoomCallbacks {
  onRoomCleared: () => void
  onVictory: () => void
  onRoomTransition: (newRoom: number) => void
}

/**
 * Player final calculated stats after all bonuses
 */
export interface FinalPlayerStats {
  maxHealth: number
  baseDamage: number
  baseAttackSpeed: number
  critChance: number
  critDamage: number
  dodgeChance: number
}

/**
 * Hero stats from hero manager
 */
export interface HeroStats {
  maxHealth: number
  attack: number
  attackSpeed: number
  critChance: number
  critDamage: number
}

/**
 * Equipment stats from equipment manager
 */
export interface EquipStats {
  maxHealth?: number
  maxHealthPercent?: number
  attackDamage?: number
  attackDamagePercent?: number
  attackSpeed?: number
  attackSpeedPercent?: number
  critChance?: number
  critDamage?: number
  dodgeChance?: number
  weaponType?: string
}

/**
 * Context passed to subsystems for accessing shared game state
 */
export interface GameContext {
  scene: Phaser.Scene
  player: Player
  enemies: Phaser.Physics.Arcade.Group
  boss: Boss | null
  pools: PoolReferences
  effects: EffectsReferences
  state: GameState
  difficultyConfig: DifficultyConfig
  talentBonuses: TalentBonuses
}

/**
 * Acquired ability with its current level
 */
export interface AcquiredAbility {
  id: string
  level: number
}

/**
 * Weapon projectile configuration
 */
export interface WeaponProjectileConfig {
  sprite: string
  sizeMultiplier: number
}
