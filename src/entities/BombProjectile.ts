import Phaser from 'phaser'

export default class BombProjectile extends Phaser.Physics.Arcade.Sprite {
  private fuseTime: number = 1500 // 1.5 seconds before explosion
  private spawnTime: number = 0
  private explosionRadius: number = 60
  private damage: number = 15
  private damageMultiplier: number = 1.0
  private hasExploded: boolean = false
  private warningCircle?: Phaser.GameObjects.Graphics

  // Callback when bomb explodes (to check player damage)
  private onExplodeCallback?: (x: number, y: number, radius: number, damage: number) => void

  constructor(scene: Phaser.Scene, x: number, y: number) {
    // Create bomb texture if it doesn't exist
    if (!scene.textures.exists('bombProjectile')) {
      const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
      // Dark circle with fuse (orange top)
      graphics.fillStyle(0x333333, 1)
      graphics.fillCircle(10, 10, 8)
      graphics.fillStyle(0xff6600, 1)
      graphics.fillRect(8, 0, 4, 4) // Fuse
      graphics.generateTexture('bombProjectile', 20, 20)
      graphics.destroy()
    }

    super(scene, x, y, 'bombProjectile')
    scene.add.existing(this)
    scene.physics.add.existing(this)

    // Set display size for the bomb
    this.setDisplaySize(20, 20)

    // Set circular hitbox centered on the sprite
    if (this.body) {
      const displaySize = 20
      const radius = 8
      const offset = (displaySize - radius * 2) / 2
      this.body.setSize(displaySize, displaySize)
      this.body.setCircle(radius, offset, offset)
    }

    this.setActive(false)
    this.setVisible(false)
  }

  setOnExplode(callback: (x: number, y: number, radius: number, damage: number) => void) {
    this.onExplodeCallback = callback
  }

  setDamageMultiplier(multiplier: number) {
    this.damageMultiplier = multiplier
  }

  fire(x: number, y: number, targetX: number, targetY: number, speed: number = 150) {
    this.setPosition(x, y)
    this.setActive(true)
    this.setVisible(true)
    this.hasExploded = false

    this.spawnTime = this.scene.time.now

    // Calculate angle to target
    const angle = Phaser.Math.Angle.Between(x, y, targetX, targetY)
    const distance = Phaser.Math.Distance.Between(x, y, targetX, targetY)

    // Calculate velocity to reach target in approximately fuseTime/2
    // This makes the bomb land before exploding
    const flightTime = Math.min(distance / speed, this.fuseTime / 2000)
    const vx = Math.cos(angle) * speed
    const vy = Math.sin(angle) * speed

    this.setVelocity(vx, vy)

    // Stop moving after reaching approximate target
    this.scene.time.delayedCall(flightTime * 1000, () => {
      if (this.active && !this.hasExploded) {
        this.setVelocity(0, 0)
        this.showWarning()
      }
    })
  }

  private showWarning() {
    if (this.hasExploded) return

    // Create warning circle showing explosion radius
    this.warningCircle = this.scene.add.graphics()
    this.warningCircle.setDepth(0)

    // Pulsing red warning circle
    const drawWarning = (alpha: number) => {
      if (!this.warningCircle || this.hasExploded) return
      this.warningCircle.clear()
      this.warningCircle.lineStyle(2, 0xff0000, alpha)
      this.warningCircle.strokeCircle(this.x, this.y, this.explosionRadius)
      this.warningCircle.fillStyle(0xff0000, alpha * 0.2)
      this.warningCircle.fillCircle(this.x, this.y, this.explosionRadius)
    }

    // Pulse the warning
    let pulseCount = 0
    const pulseInterval = this.scene.time.addEvent({
      delay: 100,
      callback: () => {
        pulseCount++
        drawWarning(0.3 + (pulseCount % 3) * 0.2)
      },
      repeat: -1,
    })

    // Store reference to clear it on explosion
    this.setData('pulseInterval', pulseInterval)
  }

  private explode() {
    if (this.hasExploded) return
    this.hasExploded = true

    // Stop pulse animation
    const pulseInterval = this.getData('pulseInterval') as Phaser.Time.TimerEvent
    if (pulseInterval) {
      pulseInterval.destroy()
    }

    // Clear warning circle
    if (this.warningCircle) {
      this.warningCircle.destroy()
      this.warningCircle = undefined
    }

    // Create explosion visual effect
    const explosion = this.scene.add.graphics()
    explosion.setDepth(5)

    // Explosion animation - expanding circle
    let frame = 0
    const maxFrames = 8
    const explosionAnim = this.scene.time.addEvent({
      delay: 30,
      callback: () => {
        frame++
        const progress = frame / maxFrames
        const currentRadius = this.explosionRadius * progress
        const alpha = 1 - progress

        explosion.clear()
        explosion.fillStyle(0xff6600, alpha * 0.8)
        explosion.fillCircle(this.x, this.y, currentRadius)
        explosion.fillStyle(0xffff00, alpha * 0.5)
        explosion.fillCircle(this.x, this.y, currentRadius * 0.6)

        if (frame >= maxFrames) {
          explosion.destroy()
          explosionAnim.destroy()
        }
      },
      repeat: maxFrames - 1,
    })

    // Trigger explosion callback for damage check
    const finalDamage = Math.round(this.damage * this.damageMultiplier)
    if (this.onExplodeCallback) {
      this.onExplodeCallback(this.x, this.y, this.explosionRadius, finalDamage)
    }

    // Deactivate bomb
    this.setActive(false)
    this.setVisible(false)
    this.setVelocity(0, 0)
  }

  update(time: number) {
    if (!this.active || this.hasExploded) return

    // Check if fuse time has elapsed
    if (time - this.spawnTime > this.fuseTime) {
      this.explode()
    }
  }

  // Also explode on direct hit with player
  onHitPlayer() {
    this.explode()
  }

  destroy(fromScene?: boolean) {
    // Clean up warning circle
    if (this.warningCircle) {
      this.warningCircle.destroy()
      this.warningCircle = undefined
    }

    // Clean up pulse interval
    const pulseInterval = this.getData('pulseInterval') as Phaser.Time.TimerEvent
    if (pulseInterval) {
      pulseInterval.destroy()
    }

    super.destroy(fromScene)
  }
}
