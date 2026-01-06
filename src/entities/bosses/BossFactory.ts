import Phaser from 'phaser'
import { BossType } from '../../config/chapterData'
import EnemyBulletPool from '../../systems/EnemyBulletPool'
import BaseBoss, { BossOptions } from './BaseBoss'
import Boss from '../Boss' // Original chapter 1 boss
// Chapter 2 - Forest Ruins bosses
import TreeGuardianBoss from './TreeGuardianBoss'
import WildBoarBoss from './WildBoarBoss'
import ForestSpiritBoss from './ForestSpiritBoss'
// Chapter 3 - Frozen Caves bosses
import IceGolemBoss from './IceGolemBoss'
import FrostWyrmBoss from './FrostWyrmBoss'
import CrystalGuardianBoss from './CrystalGuardianBoss'
// Chapter 4 - Volcanic Depths bosses
import LavaGolemBoss from './LavaGolemBoss'
import MagmaWyrmBoss from './MagmaWyrmBoss'
import InfernoDemonBoss from './InfernoDemonBoss'
// Chapter 5 - Shadow Realm bosses
import VoidLordBoss from './VoidLordBoss'
import NightmareBoss from './NightmareBoss'
import FinalBoss from './FinalBoss'

/**
 * Factory for creating boss instances based on boss type.
 * Used by GameScene to spawn the correct boss for each chapter.
 */
export function createBoss(
  scene: Phaser.Scene,
  x: number,
  y: number,
  bossType: BossType,
  bulletPool: EnemyBulletPool,
  options?: BossOptions
): BaseBoss {
  switch (bossType) {
    // Chapter 1 - Dark Dungeon
    case 'demon':
      return new Boss(scene, x, y, bulletPool, options) as unknown as BaseBoss

    // Chapter 2 - Forest Ruins
    case 'treant':
      // Treant uses Tree Guardian boss
      return new TreeGuardianBoss(scene, x, y, bulletPool, options)

    case 'tree_guardian':
      return new TreeGuardianBoss(scene, x, y, bulletPool, options)

    case 'wild_boar':
      return new WildBoarBoss(scene, x, y, bulletPool, options)

    case 'forest_spirit':
      return new ForestSpiritBoss(scene, x, y, bulletPool, options)

    // Chapter 3 - Frozen Caves
    case 'frost_giant':
      // Frost Giant uses Ice Golem boss
      return new IceGolemBoss(scene, x, y, bulletPool, options)

    case 'ice_golem':
      return new IceGolemBoss(scene, x, y, bulletPool, options)

    case 'frost_wyrm':
      return new FrostWyrmBoss(scene, x, y, bulletPool, options)

    case 'crystal_guardian':
      return new CrystalGuardianBoss(scene, x, y, bulletPool, options)

    // Chapter 4 - Volcanic Depths
    case 'lava_golem':
      return new LavaGolemBoss(scene, x, y, bulletPool, options)

    case 'magma_wyrm':
      return new MagmaWyrmBoss(scene, x, y, bulletPool, options)

    case 'inferno_demon':
      return new InfernoDemonBoss(scene, x, y, bulletPool, options)

    // Chapter 5 - Shadow Realm
    case 'void_lord':
      return new VoidLordBoss(scene, x, y, bulletPool, options)

    case 'nightmare':
      return new NightmareBoss(scene, x, y, bulletPool, options)

    case 'final_boss':
      return new FinalBoss(scene, x, y, bulletPool, options)

    default:
      console.warn(`Unknown boss type: ${bossType}, falling back to default boss`)
      return new Boss(scene, x, y, bulletPool, options) as unknown as BaseBoss
  }
}

/**
 * Get the display size for a boss type
 * Used for setting up physics bodies correctly
 */
export function getBossDisplaySize(bossType: BossType): number {
  switch (bossType) {
    case 'final_boss':
      return 96
    case 'inferno_demon':
    case 'ice_golem':
      return 80
    case 'lava_golem':
    case 'void_lord':
    case 'tree_guardian':
    case 'frost_wyrm':
      return 72
    case 'nightmare':
    case 'crystal_guardian':
      return 68
    case 'wild_boar':
    case 'demon':
    case 'treant':
    case 'frost_giant':
    case 'magma_wyrm':
      return 64
    case 'forest_spirit':
      return 56
    default:
      return 64
  }
}

/**
 * Get the hitbox radius for a boss type
 * Larger bosses have larger hitboxes
 */
export function getBossHitboxRadius(bossType: BossType): number {
  const displaySize = getBossDisplaySize(bossType)
  // Hitbox is about 40% of display size for fairness
  return Math.floor(displaySize * 0.4)
}
