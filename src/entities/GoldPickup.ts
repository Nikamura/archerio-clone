import Phaser from 'phaser'

/**
 * GoldPickup - A collectible gold coin that spawns when enemies die.
 * Features:
 * - Spawns at enemy death position with upward arc animation
 * - Auto-collected when player gets within 50px
 * - Shows floating "+X" text when collected
 * - Despawns after 10 seconds if not collected
 * - Subtle pulse animation for visibility
 */
export default class GoldPickup extends Phaser.Physics.Arcade.Sprite {
  private goldValue: number = 0
  private spawnTime: number = 0
  private lifetime: number = 10000 // 10 seconds before despawn
  private collectRadius: number = 50 // Auto-collect when player is within this distance
  private magnetRadius: number = 80 // Start pulling toward player at this distance
  private magnetSpeed: number = 300 // Speed when being pulled toward player

  // Animation state
  private isCollected: boolean = false
  private floatTween: Phaser.Tweens.Tween | null = null
  private pulseTween: Phaser.Tweens.Tween | null = null

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Use placeholder texture, will be created dynamically if not exists
    super(scene, x, y, 'goldCoin')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set display size for the gold coin
    this.setDisplaySize(16, 16)

    // Set up physics body
    if (this.body) {
      const displaySize = 16
      const radius = 8
      const offset = (displaySize - radius * 2) / 2
      this.body.setSize(displaySize, displaySize)
      this.body.setCircle(radius, offset, offset)
    }

    this.setActive(false)
    this.setVisible(false)
  }

  /**
   * Spawn gold pickup at a position with a value
   */
  spawn(x: number, y: number, value: number): void {
    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)

    this.goldValue = value
    this.spawnTime = this.scene.time.now
    this.isCollected = false

    // Reset visual state
    this.setAlpha(1)
    this.setScale(1)
    this.clearTint()

    // Stop any existing tweens
    if (this.floatTween) {
      this.floatTween.stop()
      this.floatTween = null
    }
    if (this.pulseTween) {
      this.pulseTween.stop()
      this.pulseTween = null
    }

    // Spawn animation: small upward arc
    const startY = y
    this.scene.tweens.add({
      targets: this,
      y: startY - 20,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Fall back down slightly
        this.scene.tweens.add({
          targets: this,
          y: startY - 5,
          duration: 150,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            this.startIdleAnimation()
          },
        })
      },
    })
  }

  /**
   * Start subtle idle animations (float and pulse)
   */
  private startIdleAnimation(): void {
    if (!this.active) return

    // Gentle floating animation
    this.floatTween = this.scene.tweens.add({
      targets: this,
      y: this.y - 3,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Subtle pulse/shine effect
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: { from: 1, to: 1.15 },
      scaleY: { from: 1, to: 1.15 },
      alpha: { from: 1, to: 0.85 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * Collect the gold pickup - called when player is close enough
   * @returns The gold value of this pickup
   */
  collect(): number {
    if (this.isCollected) return 0

    this.isCollected = true

    // Stop idle animations
    if (this.floatTween) {
      this.floatTween.stop()
      this.floatTween = null
    }
    if (this.pulseTween) {
      this.pulseTween.stop()
      this.pulseTween = null
    }

    // Collection animation: scale up and fade out
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      y: this.y - 20,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.deactivate()
      },
    })

    return this.goldValue
  }

  /**
   * Deactivate and return to pool
   */
  deactivate(): void {
    // Stop tweens
    if (this.floatTween) {
      this.floatTween.stop()
      this.floatTween = null
    }
    if (this.pulseTween) {
      this.pulseTween.stop()
      this.pulseTween = null
    }

    this.setActive(false)
    this.setVisible(false)
    this.setVelocity(0, 0)
    this.goldValue = 0
    this.isCollected = false
  }

  /**
   * Update method - check for player proximity and lifetime
   * @param playerX Player X position
   * @param playerY Player Y position
   * @returns The gold value if collected, 0 otherwise
   */
  updatePickup(playerX: number, playerY: number): number {
    if (!this.active || this.isCollected) return 0

    const time = this.scene.time.now

    // Check for despawn (10 seconds)
    if (time - this.spawnTime > this.lifetime) {
      // Fade out before despawn
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.deactivate()
        },
      })
      return 0
    }

    // Flash when about to expire (last 2 seconds)
    if (time - this.spawnTime > this.lifetime - 2000) {
      const flashRate = Math.sin((time - this.spawnTime) * 0.02) > 0
      this.setAlpha(flashRate ? 1 : 0.4)
    }

    // Calculate distance to player
    const distance = Phaser.Math.Distance.Between(this.x, this.y, playerX, playerY)

    // Auto-collect when within collect radius
    if (distance <= this.collectRadius) {
      return this.collect()
    }

    // Magnetic pull when within magnet radius
    if (distance <= this.magnetRadius && distance > this.collectRadius) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
      const pullStrength = 1 - (distance / this.magnetRadius) // Stronger pull when closer
      const speed = this.magnetSpeed * pullStrength
      this.setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      )
    } else {
      this.setVelocity(0, 0)
    }

    return 0
  }

  /**
   * Get the gold value of this pickup
   */
  getValue(): number {
    return this.goldValue
  }

  /**
   * Check if this pickup has been collected
   */
  isPickedUp(): boolean {
    return this.isCollected
  }
}
