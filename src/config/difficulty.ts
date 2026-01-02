/**
 * Difficulty configuration for the game.
 * Adjusts player and enemy stats to create easier or harder experiences.
 */

export enum DifficultyLevel {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
  INSANITY = 'insanity',
}

export interface DifficultyConfig {
  // Player modifiers
  playerMaxHealth: number
  playerDamage: number
  playerAttackSpeed: number

  // Enemy modifiers
  enemyHealthMultiplier: number
  enemyDamageMultiplier: number
  enemySpawnMultiplier: number
  extraEnemyCount: number // Flat bonus enemies added per room

  // Boss modifiers
  bossHealthMultiplier: number
  bossDamageMultiplier: number

  // Reward modifiers (effort:reward principle - harder = more gold)
  goldMultiplier: number

  // Display
  label: string
  description: string
  color: string
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  [DifficultyLevel.EASY]: {
    // Player buffs
    playerMaxHealth: 150, // +50% health
    playerDamage: 12, // +20% damage
    playerAttackSpeed: 1.2, // +20% attack speed

    // Enemy nerfs
    enemyHealthMultiplier: 0.7, // -30% health
    enemyDamageMultiplier: 0.75, // -25% damage
    enemySpawnMultiplier: 0.8, // -20% enemy count
    extraEnemyCount: 0,

    // Boss nerfs
    bossHealthMultiplier: 0.6, // -40% health
    bossDamageMultiplier: 0.75, // -25% damage

    // Reward - less gold for easier mode (effort:reward)
    goldMultiplier: 0.7, // -30% gold

    // Display
    label: 'EASY',
    description: 'For beginners - more health, weaker enemies',
    color: '#00ff00',
  },
  [DifficultyLevel.NORMAL]: {
    // Balanced stats (default)
    playerMaxHealth: 100,
    playerDamage: 10,
    playerAttackSpeed: 1.0,

    // Standard enemies
    enemyHealthMultiplier: 1.0,
    enemyDamageMultiplier: 1.0,
    enemySpawnMultiplier: 1.0,
    extraEnemyCount: 0,

    // Standard boss
    bossHealthMultiplier: 1.0,
    bossDamageMultiplier: 1.0,

    // Standard rewards
    goldMultiplier: 1.0,

    // Display
    label: 'NORMAL',
    description: 'Balanced challenge',
    color: '#ffff00',
  },
  [DifficultyLevel.HARD]: {
    // Player nerfs
    playerMaxHealth: 80, // -20% health
    playerDamage: 9, // -10% damage
    playerAttackSpeed: 0.9, // -10% attack speed

    // Enemy buffs
    enemyHealthMultiplier: 1.4, // +40% health
    enemyDamageMultiplier: 1.3, // +30% damage
    enemySpawnMultiplier: 1.3, // +30% enemy count
    extraEnemyCount: 0,

    // Boss buffs
    bossHealthMultiplier: 1.5, // +50% health
    bossDamageMultiplier: 1.3, // +30% damage

    // Reward - more gold for harder mode (effort:reward)
    goldMultiplier: 1.5, // +50% gold

    // Display
    label: 'HARD',
    description: 'For veterans - tough enemies, less health',
    color: '#ff0000',
  },
  [DifficultyLevel.INSANITY]: {
    // Player nerfs (same as hard)
    playerMaxHealth: 80,
    playerDamage: 9,
    playerAttackSpeed: 0.9,

    // Enemy buffs (harder than hard mode, plus +10 extra enemies)
    enemyHealthMultiplier: 1.4,
    enemyDamageMultiplier: 1.5, // +50% damage (vs hard's +30%)
    enemySpawnMultiplier: 1.3,
    extraEnemyCount: 10, // +10 monsters compared to hard

    // Boss buffs (harder than hard mode)
    bossHealthMultiplier: 1.5,
    bossDamageMultiplier: 1.5, // +50% damage (vs hard's +30%)

    // Reward - highest gold for insanity mode
    goldMultiplier: 2.0, // +100% gold

    // Display
    label: 'INSANITY',
    description: 'Pure chaos - 10 extra monsters per room',
    color: '#ff00ff',
  },
}

/**
 * Get the current difficulty level from the game registry.
 * Defaults to NORMAL if not set.
 */
export function getCurrentDifficulty(game: Phaser.Game): DifficultyLevel {
  return (game.registry.get('difficulty') as DifficultyLevel) || DifficultyLevel.NORMAL
}

/**
 * Set the difficulty level in the game registry.
 */
export function setDifficulty(game: Phaser.Game, difficulty: DifficultyLevel): void {
  game.registry.set('difficulty', difficulty)
}

/**
 * Get the configuration for the current difficulty level.
 */
export function getDifficultyConfig(game: Phaser.Game): DifficultyConfig {
  const difficulty = getCurrentDifficulty(game)
  return DIFFICULTY_CONFIGS[difficulty]
}
