import Phaser from 'phaser'

/**
 * HealthPickup - A collectible health potion that spawns when enemies die (5% chance).
 * Features:
 * - Spawns at enemy death position with upward arc animation
 * - Auto-collected when player gets within 50px
 * - Shows floating "+X HP" text when collected
 * - Despawns after 10 seconds if not collected
 * - Red/pink glow for visibility
 */
export default class HealthPickup extends Phaser.Physics.Arcade.Sprite {
  private healValue: number = 0
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
    super(scene, x, y, 'healthPotion')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set display size for the health potion
    this.setDisplaySize(20, 20)

    // Set up physics body
    if (this.body) {
      const displaySize = 20
      const radius = 10
      const offset = (displaySize - radius * 2) / 2
      this.body.setSize(displaySize, displaySize)
      this.body.setCircle(radius, offset, offset)
    }

    this.setActive(false)
    this.setVisible(false)
  }

  /**
   * Spawn health pickup at a position with a heal value
   */
  spawn(x: number, y: number, value: number): void {
    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)

    this.healValue = value
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
      y: startY - 25,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => {
        // Fall back down slightly
        this.scene.tweens.add({
          targets: this,
          y: startY - 8,
          duration: 200,
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
      y: this.y - 4,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Pulsing glow effect
    this.pulseTween = this.scene.tweens.add({
      targets: this,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      alpha: { from: 1, to: 0.8 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  /**
   * Collect the health pickup - called when player is close enough
   * @returns The heal value of this pickup
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

    // Collection animation: scale up and fade out with green flash
    this.setTint(0x00ff00)
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.8,
      scaleY: 1.8,
      alpha: 0,
      y: this.y - 25,
      duration: 250,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.deactivate()
      },
    })

    return this.healValue
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
    this.healValue = 0
    this.isCollected = false
    this.clearTint()
  }

  /**
   * Update method - check for player proximity and lifetime
   * @param playerX Player X position
   * @param playerY Player Y position
   * @returns The heal value if collected, 0 otherwise
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
   * Get the heal value of this pickup
   */
  getValue(): number {
    return this.healValue
  }

  /**
   * Check if this pickup has been collected
   */
  isPickedUp(): boolean {
    return this.isCollected
  }
}
