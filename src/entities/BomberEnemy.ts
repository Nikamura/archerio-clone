import Phaser from 'phaser'
import Enemy from './Enemy'
import BombPool from '../systems/BombPool'

export default class BomberEnemy extends Enemy {
  private lastThrowTime: number = 0
  private throwCooldown: number = 2500 // 2.5 seconds between throws
  private bombPool: BombPool
  private isWindingUp: boolean = false
  private windUpStartTime: number = 0
  private windUpDuration: number = 600 // 0.6 seconds warning before throw
  private targetX: number = 0
  private targetY: number = 0

  // Callback for explosion damage check
  private onBombExplode?: (x: number, y: number, radius: number, damage: number) => void

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    bombPool: BombPool,
    options?: {
      healthMultiplier?: number
      damageMultiplier?: number
    },
    onBombExplode?: (x: number, y: number, radius: number, damage: number) => void
  ) {
    super(scene, x, y, options)

    this.bombPool = bombPool
    this.onBombExplode = onBombExplode

    // Apply damage multiplier to bomb pool
    if (options?.damageMultiplier) {
      this.bombPool.setDamageMultiplier(options.damageMultiplier)
    }

    // Use bomber enemy sprite (fallback to melee if not loaded)
    if (scene.textures.exists('enemyBomber')) {
      this.setTexture('enemyBomber')
    } else {
      // Fallback: tint melee sprite orange
      this.setTint(0xff8800)
    }
    this.setDisplaySize(32, 32)

    console.log('BomberEnemy created at', x, y)
  }

  setOnBombExplode(callback: (x: number, y: number, radius: number, damage: number) => void) {
    this.onBombExplode = callback
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update fire DOT from parent class
    const diedFromFire = super.update(time, _delta, playerX, playerY)
    if (diedFromFire) {
      return true
    }

    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      playerX,
      playerY
    )

    // Preferred throw distance - not too close, not too far
    const minDistance = 120
    const maxDistance = 220

    if (!this.isWindingUp) {
      if (distanceToPlayer < minDistance) {
        // Too close - retreat
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        const speed = 70
        this.setVelocity(-Math.cos(angle) * speed, -Math.sin(angle) * speed)
      } else if (distanceToPlayer > maxDistance) {
        // Too far - approach
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        const speed = 60
        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed)
      } else {
        // Good distance - stop and throw
        this.setVelocity(0, 0)

        if (time - this.lastThrowTime > this.throwCooldown) {
          this.startWindUp(time, playerX, playerY)
        }
      }
    } else {
      // Winding up - stand still and show warning
      this.setVelocity(0, 0)

      // Visual warning - scale pulse
      const elapsed = time - this.windUpStartTime
      const progress = elapsed / this.windUpDuration
      const scale = 1 + Math.sin(progress * Math.PI * 4) * 0.15
      this.setScale(scale)

      // Throw bomb after wind-up
      if (elapsed > this.windUpDuration) {
        this.throwBomb()
        this.isWindingUp = false
        this.lastThrowTime = time
        this.setScale(1) // Reset scale
      }
    }

    // Ensure enemy stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 16 // Half of bomber size (32x32)
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    return false
  }

  private startWindUp(time: number, playerX: number, playerY: number) {
    this.isWindingUp = true
    this.windUpStartTime = time
    // Store target position at start of wind-up (leads the throw slightly)
    this.targetX = playerX
    this.targetY = playerY
  }

  private throwBomb() {
    this.bombPool.spawn(
      this.x,
      this.y,
      this.targetX,
      this.targetY,
      150,
      this.onBombExplode
    )
  }
}
