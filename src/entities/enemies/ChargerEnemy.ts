import Phaser from 'phaser'
import Enemy, { EnemyOptions } from '../Enemy'
import { getEnemySpriteKey } from '../../config/themeData'
import { themeManager } from '../../systems/ThemeManager'

type ChargerPhase = 'idle' | 'windup' | 'charging' | 'stunned'

export default class ChargerEnemy extends Enemy {
  private phase: ChargerPhase = 'idle'
  private phaseStartTime: number = 0
  private lastChargeTime: number = 0
  private chargeCooldown: number = 3000 // Base 3 seconds between charges

  // Charge properties
  private chargeSpeed: number = 350 // Very fast during charge
  private normalSpeed: number = 80
  private chargeTargetX: number = 0
  private chargeTargetY: number = 0
  private chargeDuration: number = 600 // Max charge time (0.6 seconds)

  // Phase durations
  private windUpDuration: number = 700 // 0.7 seconds telegraph before charge
  private stunDuration: number = 800 // 0.8 seconds stunned after charge

  // Charge damage multiplier (higher during charge)
  private isCharging: boolean = false
  private static readonly CHARGE_DAMAGE_MULTIPLIER = 2.5

  // Visual elements
  private chargeIndicator?: Phaser.GameObjects.Graphics
  private directionLine?: Phaser.GameObjects.Line

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    options?: EnemyOptions
  ) {
    super(scene, x, y, options)

    // Apply chapter-specific modifiers
    this.chargeCooldown = 3000 * (options?.attackCooldownMultiplier ?? 1.0)
    this.normalSpeed = 80 * (options?.speedMultiplier ?? 1.0)
    // Charge speed also scales with speedMultiplier for thematic ice slides, etc.
    this.chargeSpeed = 350 * (options?.speedMultiplier ?? 1.0)

    // Use themed charger enemy sprite
    const spriteKey = getEnemySpriteKey('charger', themeManager.getAssets())
    if (scene.textures.exists(spriteKey)) {
      this.setTexture(spriteKey)
    } else {
      // Fallback: tint melee sprite cyan
      this.setTint(0x00ffff)
    }

    // Slightly larger sprite
    this.setDisplaySize(34, 34)

    // Create visual indicators
    this.chargeIndicator = scene.add.graphics()
    this.chargeIndicator.setDepth(0)

    this.directionLine = scene.add.line(0, 0, 0, 0, 0, 0, 0xff0000, 0.8)
    this.directionLine.setOrigin(0, 0)
    this.directionLine.setVisible(false)
    this.directionLine.setDepth(0)
    this.directionLine.setLineWidth(3)

    console.log('ChargerEnemy created at', x, y)
  }

  update(time: number, _delta: number, playerX: number, playerY: number): boolean {
    if (!this.active || !this.body) {
      return false
    }

    // Update fire DOT from parent class (only in non-charge phases)
    if (this.phase !== 'charging') {
      const diedFromFire = super.update(time, _delta, playerX, playerY)
      if (diedFromFire) {
        return true
      }
    }

    switch (this.phase) {
      case 'idle':
        this.handleIdlePhase(time, playerX, playerY)
        break
      case 'windup':
        this.handleWindUpPhase(time, playerX, playerY)
        break
      case 'charging':
        this.handleChargingPhase(time)
        break
      case 'stunned':
        this.handleStunnedPhase(time)
        break
    }

    // Ensure enemy stays within world bounds
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body) {
      const margin = 17 // Half of charger size (34x34)
      const worldBounds = this.scene.physics.world.bounds
      this.x = Phaser.Math.Clamp(this.x, worldBounds.left + margin, worldBounds.right - margin)
      this.y = Phaser.Math.Clamp(this.y, worldBounds.top + margin, worldBounds.bottom - margin)
    }

    // Update health bar position if visible
    this.updateChargeIndicatorPosition()

    return false
  }

  private handleIdlePhase(time: number, playerX: number, playerY: number) {
    const distanceToPlayer = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      playerX,
      playerY
    )

    // Keep some distance before charging
    if (distanceToPlayer > 80) {
      // Use wall-aware movement if wallGroup is set
      if (this.wallGroup) {
        const movement = this.calculateMovementWithWallAvoidance(
          playerX,
          playerY,
          this.normalSpeed,
          time
        )
        this.setVelocity(movement.vx, movement.vy)
      } else {
        // Fallback to direct movement
        const angle = Phaser.Math.Angle.Between(this.x, this.y, playerX, playerY)
        this.setVelocity(
          Math.cos(angle) * this.normalSpeed,
          Math.sin(angle) * this.normalSpeed
        )
      }
    } else {
      this.setVelocity(0, 0)
    }

    // Start charge if cooldown is ready and player is in range
    if (time - this.lastChargeTime > this.chargeCooldown && distanceToPlayer < 250) {
      this.startWindUp(time, playerX, playerY)
    }
  }

  private startWindUp(time: number, playerX: number, playerY: number) {
    this.phase = 'windup'
    this.phaseStartTime = time
    this.chargeTargetX = playerX
    this.chargeTargetY = playerY
    this.setVelocity(0, 0)

    // Show direction line
    if (this.directionLine) {
      this.directionLine.setVisible(true)
    }
  }

  private handleWindUpPhase(time: number, playerX: number, playerY: number) {
    const elapsed = time - this.phaseStartTime
    const progress = Math.min(elapsed / this.windUpDuration, 1)

    // Update target position during wind-up (track player)
    this.chargeTargetX = playerX
    this.chargeTargetY = playerY

    // Visual warning effects
    // 1. Shaking effect (increases with progress)
    const shakeIntensity = progress * 4
    const shakeX = (Math.random() - 0.5) * shakeIntensity
    const shakeY = (Math.random() - 0.5) * shakeIntensity
    this.setPosition(this.x + shakeX, this.y + shakeY)

    // 2. Color flash (cyan -> red)
    const flashFreq = 4 + progress * 10 // Faster flashing as charge approaches
    const flash = Math.sin(time * flashFreq * 0.01) > 0
    this.setTint(flash ? 0xff0000 : 0x00ffff)

    // 3. Update direction line
    if (this.directionLine) {
      const angle = Phaser.Math.Angle.Between(this.x, this.y, this.chargeTargetX, this.chargeTargetY)
      const lineLength = 150
      const endX = this.x + Math.cos(angle) * lineLength
      const endY = this.y + Math.sin(angle) * lineLength
      this.directionLine.setTo(this.x, this.y, endX, endY)

      // Line opacity increases with progress
      this.directionLine.setAlpha(0.3 + progress * 0.7)
    }

    // 4. Draw charge indicator circle
    if (this.chargeIndicator) {
      this.chargeIndicator.clear()
      this.chargeIndicator.lineStyle(3, 0xff0000, progress * 0.8)
      this.chargeIndicator.strokeCircle(this.x, this.y, 25 + progress * 10)
    }

    // Start charging when wind-up is complete
    if (elapsed > this.windUpDuration) {
      this.startCharge(time)
    }
  }

  private startCharge(time: number) {
    this.phase = 'charging'
    this.phaseStartTime = time
    this.isCharging = true

    // Hide indicators
    if (this.directionLine) {
      this.directionLine.setVisible(false)
    }
    if (this.chargeIndicator) {
      this.chargeIndicator.clear()
    }

    // Calculate charge direction and velocity
    const angle = Phaser.Math.Angle.Between(this.x, this.y, this.chargeTargetX, this.chargeTargetY)
    this.setVelocity(
      Math.cos(angle) * this.chargeSpeed,
      Math.sin(angle) * this.chargeSpeed
    )

    // Set charging visual (bright red)
    this.setTint(0xff0000)

    // Create trail effect during charge
    this.createChargeTrail()
  }

  private createChargeTrail() {
    // Add trail particles during charge
    const trailInterval = this.scene.time.addEvent({
      delay: 50,
      callback: () => {
        if (this.phase !== 'charging' || !this.active) {
          trailInterval.destroy()
          return
        }

        // Create simple afterimage
        const trail = this.scene.add.circle(this.x, this.y, 10, 0xff4444, 0.5)
        trail.setDepth(0)

        // Fade out and destroy
        this.scene.tweens.add({
          targets: trail,
          alpha: 0,
          scale: 0.5,
          duration: 200,
          onComplete: () => trail.destroy(),
        })
      },
      repeat: Math.floor(this.chargeDuration / 50),
    })

    this.setData('trailInterval', trailInterval)
  }

  private handleChargingPhase(time: number) {
    const elapsed = time - this.phaseStartTime

    // Check if charge should end
    const distToTarget = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.chargeTargetX,
      this.chargeTargetY
    )

    // End charge if time expired or reached target
    if (elapsed > this.chargeDuration || distToTarget < 30) {
      this.endCharge(time)
    }
  }

  private endCharge(time: number) {
    this.phase = 'stunned'
    this.phaseStartTime = time
    this.isCharging = false
    this.lastChargeTime = time
    this.setVelocity(0, 0)

    // Clear trail interval
    const trailInterval = this.getData('trailInterval') as Phaser.Time.TimerEvent
    if (trailInterval) {
      trailInterval.destroy()
    }

    // Stunned visual - dizzy effect
    this.setTint(0x888888)
  }

  private handleStunnedPhase(time: number) {
    const elapsed = time - this.phaseStartTime

    // Visual stun effect - wobble
    const wobble = Math.sin(time * 0.02) * 0.2
    this.setRotation(wobble)

    // Flicker between gray and normal color
    if (Math.floor(elapsed / 150) % 2 === 0) {
      this.setTint(0x888888)
    } else {
      // Reset to charger color (or custom texture)
      if (!this.scene.textures.exists('enemyCharger')) {
        this.setTint(0x00ffff)
      } else {
        this.clearTint()
      }
    }

    // End stun after duration
    if (elapsed > this.stunDuration) {
      this.phase = 'idle'
      this.setRotation(0)
      // Reset tint
      if (!this.scene.textures.exists('enemyCharger')) {
        this.setTint(0x00ffff)
      } else {
        this.clearTint()
      }
    }
  }

  private updateChargeIndicatorPosition() {
    // Update any position-dependent visuals
    if (this.chargeIndicator && this.phase === 'windup') {
      // Already updated in handleWindUpPhase
    }
  }

  /**
   * Override getDamage to return higher damage during charge
   */
  getDamage(): number {
    const baseDamage = 15 // Increased by 200%
    const multiplier = this.isCharging ? ChargerEnemy.CHARGE_DAMAGE_MULTIPLIER : 1.0
    return Math.round(baseDamage * this.damageMultiplier * multiplier)
  }

  /**
   * Check if currently charging (for external collision handling)
   */
  isCurrentlyCharging(): boolean {
    return this.isCharging
  }

  destroy(fromScene?: boolean) {
    // Clean up visual elements
    if (this.chargeIndicator) {
      this.chargeIndicator.destroy()
      this.chargeIndicator = undefined
    }
    if (this.directionLine) {
      this.directionLine.destroy()
      this.directionLine = undefined
    }

    // Clean up trail interval
    const trailInterval = this.getData('trailInterval') as Phaser.Time.TimerEvent
    if (trailInterval) {
      trailInterval.destroy()
    }

    super.destroy(fromScene)
  }
}
