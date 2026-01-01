/**
 * Boss entity exports
 * All boss variants for chapters 1-5
 */

export { default as BaseBoss } from './BaseBoss'
export type { BossOptions, BossPhase } from './BaseBoss'

// Chapter 1 boss (existing)
// Boss.ts in parent directory

// Chapter 2 - Forest Ruins bosses
export { default as TreeGuardianBoss } from './TreeGuardianBoss'
export { default as WildBoarBoss } from './WildBoarBoss'
export { default as ForestSpiritBoss } from './ForestSpiritBoss'

// Chapter 3 - Frozen Caves bosses
export { default as IceGolemBoss } from './IceGolemBoss'
export { default as FrostWyrmBoss } from './FrostWyrmBoss'
export { default as CrystalGuardianBoss } from './CrystalGuardianBoss'

// Chapter 4 - Volcanic Depths bosses
export { default as LavaGolemBoss } from './LavaGolemBoss'
export { default as MagmaWyrmBoss } from './MagmaWyrmBoss'
export { default as InfernoDemonBoss } from './InfernoDemonBoss'

// Chapter 5 - Shadow Realm bosses
export { default as VoidLordBoss } from './VoidLordBoss'
export { default as NightmareBoss } from './NightmareBoss'
export { default as FinalBoss } from './FinalBoss'

// Re-export the factory
export { createBoss, getBossDisplaySize, getBossHitboxRadius } from './BossFactory'
