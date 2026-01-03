import Phaser from 'phaser'
import type Player from '../entities/Player'
import type Enemy from '../entities/Enemy'
import type BulletPool from './BulletPool'
import { audioManager } from './AudioManager'
import { hapticManager } from './HapticManager'
import type { WeaponProjectileConfig } from '../types/GameTypes'

/**
 * ShootingSystem handles all player projectile spawning logic.
 * Extracted from GameScene to centralize shooting mechanics.
 */
export class ShootingSystem {
  private player: Player
  private bulletPool: BulletPool
  private weaponProjectileConfig: WeaponProjectileConfig | null = null

  private lastShotTime: number = 0
  private readonly baseFireRate: number = 500 // ms between shots

  constructor(
    _scene: Phaser.Scene,
    player: Player,
    bulletPool: BulletPool
  ) {
    this.player = player
    this.bulletPool = bulletPool
  }

  /**
   * Set the weapon projectile configuration
   */
  setWeaponProjectileConfig(config: WeaponProjectileConfig | null): void {
    this.weaponProjectileConfig = config
  }

  /**
   * Get the effective fire rate based on player attack speed
   */
  getEffectiveFireRate(): number {
    if (!this.player) return this.baseFireRate
    return this.baseFireRate / this.player.getAttackSpeed()
  }

  /**
   * Check if the player can shoot (based on fire rate)
   */
  canShoot(time: number): boolean {
    return time - this.lastShotTime > this.getEffectiveFireRate()
  }

  /**
   * Shoot at the target enemy
   */
  shootAt(enemy: Enemy, time: number): void {
    // Validate enemy position before shooting
    if (!isFinite(enemy.x) || !isFinite(enemy.y)) {
      console.warn('shootAt: Invalid enemy position', enemy.x, enemy.y, enemy.constructor.name)
      return
    }

    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      enemy.x,
      enemy.y
    )

    // Validate calculated angle
    if (!isFinite(angle)) {
      console.warn('shootAt: Invalid angle calculated', angle, 'player:', this.player.x, this.player.y, 'enemy:', enemy.x, enemy.y)
      return
    }

    const bulletSpeed = 400

    // Offset spawn position to hit enemies directly under player
    const SPAWN_OFFSET = 20 // Pixels ahead in firing direction (past player radius of 16)
    const getSpawnPos = (bulletAngle: number) => ({
      x: this.player.x + Math.cos(bulletAngle) * SPAWN_OFFSET,
      y: this.player.y + Math.sin(bulletAngle) * SPAWN_OFFSET,
    })

    // Gather ability options for bullets (including new V1 abilities)
    const bulletOptions = {
      maxPierces: this.player.getPiercingLevel(),
      maxBounces: this.player.getRicochetBounces(),
      fireDamage: this.player.getFireDamage(),
      isCrit: this.player.rollCrit(), // Roll crit for main projectile
      // New V1 ability options
      freezeChance: this.player.getFreezeChance(),
      poisonDamage: this.player.getPoisonDamage(),
      lightningChainCount: this.player.getLightningChainCount(),
      // Weapon projectile options
      projectileSprite: this.weaponProjectileConfig?.sprite,
      projectileSizeMultiplier: this.weaponProjectileConfig?.sizeMultiplier,
    }

    // Main projectile
    const mainSpawn = getSpawnPos(angle)
    this.bulletPool.spawn(mainSpawn.x, mainSpawn.y, angle, bulletSpeed, bulletOptions)

    // Front Arrow: Extra forward projectiles with slight spread
    const extraProjectiles = this.player.getExtraProjectiles()
    if (extraProjectiles > 0) {
      const spreadAngle = 0.1 // ~6 degrees spread between extra arrows
      for (let i = 0; i < extraProjectiles; i++) {
        // Alternate left and right
        const offset = ((i % 2 === 0 ? 1 : -1) * Math.ceil((i + 1) / 2)) * spreadAngle
        const extraAngle = angle + offset
        const extraSpawn = getSpawnPos(extraAngle)
        // Each extra projectile rolls its own crit
        const extraOptions = { ...bulletOptions, isCrit: this.player.rollCrit() }
        this.bulletPool.spawn(extraSpawn.x, extraSpawn.y, extraAngle, bulletSpeed, extraOptions)
      }
    }

    // Multishot: Side projectiles at 45 degrees
    const multishotCount = this.player.getMultishotCount()
    if (multishotCount > 0) {
      const sideAngle = Math.PI / 4 // 45 degrees
      for (let i = 0; i < multishotCount; i++) {
        // Add projectiles at increasing angles
        const angleOffset = sideAngle * (i + 1)
        const multiAngle1 = angle + angleOffset
        const multiAngle2 = angle - angleOffset
        const multiSpawn1 = getSpawnPos(multiAngle1)
        const multiSpawn2 = getSpawnPos(multiAngle2)
        // Each multishot projectile rolls its own crit
        const multishotOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() }
        const multishotOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() }
        this.bulletPool.spawn(multiSpawn1.x, multiSpawn1.y, multiAngle1, bulletSpeed, multishotOptions1)
        this.bulletPool.spawn(multiSpawn2.x, multiSpawn2.y, multiAngle2, bulletSpeed, multishotOptions2)
      }
    }

    // Diagonal Arrows: Arrows at 30 degree angles (80% damage)
    const diagonalArrows = this.player.getDiagonalArrows()
    if (diagonalArrows > 0) {
      const diagonalAngle = Math.PI / 6 // 30 degrees
      // diagonalArrows is in pairs (2 per level)
      const pairs = Math.floor(diagonalArrows / 2)
      for (let i = 0; i < pairs; i++) {
        const diagAngle1 = angle + diagonalAngle * (i + 1)
        const diagAngle2 = angle - diagonalAngle * (i + 1)
        const diagSpawn1 = getSpawnPos(diagAngle1)
        const diagSpawn2 = getSpawnPos(diagAngle2)
        // Each diagonal projectile rolls its own crit
        const diagOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() }
        const diagOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() }
        this.bulletPool.spawn(diagSpawn1.x, diagSpawn1.y, diagAngle1, bulletSpeed, diagOptions1)
        this.bulletPool.spawn(diagSpawn2.x, diagSpawn2.y, diagAngle2, bulletSpeed, diagOptions2)
      }
    }

    // Rear Arrow: Arrows shooting backwards (70% damage)
    const rearArrows = this.player.getRearArrows()
    if (rearArrows > 0) {
      const rearAngle = angle + Math.PI // 180 degrees from forward
      for (let i = 0; i < rearArrows; i++) {
        // Slight spread for multiple rear arrows
        const spreadOffset = i > 0 ? ((i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2)) * 0.1 : 0
        const rearBulletAngle = rearAngle + spreadOffset
        const rearSpawn = getSpawnPos(rearBulletAngle)
        const rearOptions = { ...bulletOptions, isCrit: this.player.rollCrit() }
        this.bulletPool.spawn(rearSpawn.x, rearSpawn.y, rearBulletAngle, bulletSpeed, rearOptions)
      }
    }

    // Play shoot sound (once per attack, not per projectile)
    audioManager.playShoot()
    hapticManager.medium() // Haptic feedback for shooting
    this.lastShotTime = time
  }
}
