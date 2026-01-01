import Phaser from 'phaser'

/**
 * Particle effect types
 */
export type ParticleType =
  | 'death'         // Enemy death explosion
  | 'hit'           // Bullet impact sparks
  | 'crit'          // Critical hit impact
  | 'fire'          // Fire trail/damage effect
  | 'ice'           // Ice/freeze effect
  | 'levelUp'       // Level up celebration
  | 'goldCollect'   // Gold pickup sparkle
  | 'heal'          // Health restore effect
  | 'bossDeath'     // Boss death explosion (bigger)

/**
 * Particle configuration presets
 */
interface ParticleConfig {
  key: string
  quantity: number
  speed: { min: number; max: number }
  scale: { start: number; end: number }
  lifespan: number
  alpha: { start: number; end: number }
  tint?: number | number[]
  gravityY?: number
  angle?: { min: number; max: number }
  rotate?: { min: number; max: number }
  blendMode?: Phaser.BlendModes
}

/**
 * ParticleManager - Centralized system for managing all particle effects
 *
 * Uses Phaser's particle emitter system with reusable configurations
 * for different game events (enemy death, bullet impacts, abilities, etc.)
 */
export class ParticleManager {
  private scene: Phaser.Scene
  private enabled: boolean = true
  private particleTexture: string = 'particle'
  private emitters: Map<string, Phaser.GameObjects.Particles.ParticleEmitter> = new Map()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.createParticleTexture()
  }

  /**
   * Create a simple circular particle texture if not already loaded
   */
  private createParticleTexture(): void {
    if (this.scene.textures.exists(this.particleTexture)) {
      return
    }

    // Create a simple circular particle texture
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false)
    graphics.fillStyle(0xffffff, 1)
    graphics.fillCircle(8, 8, 8)
    graphics.generateTexture(this.particleTexture, 16, 16)
    graphics.destroy()
  }

  /**
   * Enable or disable particle effects
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  /**
   * Check if particles are enabled
   */
  isEnabled(): boolean {
    return this.enabled
  }

  /**
   * Get particle configuration for a specific effect type
   */
  private getConfig(type: ParticleType): ParticleConfig {
    switch (type) {
      case 'death':
        return {
          key: this.particleTexture,
          quantity: 12,
          speed: { min: 60, max: 150 },
          scale: { start: 0.5, end: 0 },
          lifespan: 400,
          alpha: { start: 1, end: 0 },
          tint: [0xff4444, 0xff6666, 0xffaaaa],
          gravityY: 100,
          angle: { min: 0, max: 360 },
        }

      case 'hit':
        return {
          key: this.particleTexture,
          quantity: 6,
          speed: { min: 40, max: 100 },
          scale: { start: 0.3, end: 0 },
          lifespan: 200,
          alpha: { start: 1, end: 0 },
          tint: [0xffff00, 0xffaa00],
          angle: { min: 0, max: 360 },
        }

      case 'crit':
        return {
          key: this.particleTexture,
          quantity: 10,
          speed: { min: 80, max: 160 },
          scale: { start: 0.6, end: 0 },
          lifespan: 350,
          alpha: { start: 1, end: 0 },
          tint: [0xffff00, 0xffdd00, 0xffffff],
          angle: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
        }

      case 'fire':
        return {
          key: this.particleTexture,
          quantity: 4,
          speed: { min: 20, max: 50 },
          scale: { start: 0.4, end: 0 },
          lifespan: 500,
          alpha: { start: 0.8, end: 0 },
          tint: [0xff4400, 0xff6600, 0xffaa00],
          gravityY: -50, // Fire rises
          angle: { min: 250, max: 290 }, // Mostly upward
          blendMode: Phaser.BlendModes.ADD,
        }

      case 'ice':
        return {
          key: this.particleTexture,
          quantity: 8,
          speed: { min: 30, max: 80 },
          scale: { start: 0.35, end: 0 },
          lifespan: 600,
          alpha: { start: 0.9, end: 0 },
          tint: [0x66ccff, 0x88ddff, 0xffffff],
          gravityY: 40,
          angle: { min: 0, max: 360 },
        }

      case 'levelUp':
        return {
          key: this.particleTexture,
          quantity: 30,
          speed: { min: 100, max: 250 },
          scale: { start: 0.6, end: 0.1 },
          lifespan: 800,
          alpha: { start: 1, end: 0 },
          tint: [0x00ff88, 0x44ffaa, 0xffff00, 0xffffff],
          gravityY: -100, // Rise upward
          angle: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
        }

      case 'goldCollect':
        return {
          key: this.particleTexture,
          quantity: 5,
          speed: { min: 30, max: 80 },
          scale: { start: 0.3, end: 0 },
          lifespan: 300,
          alpha: { start: 1, end: 0 },
          tint: [0xffd700, 0xffec8b],
          gravityY: -60,
          angle: { min: 240, max: 300 },
        }

      case 'heal':
        return {
          key: this.particleTexture,
          quantity: 10,
          speed: { min: 40, max: 100 },
          scale: { start: 0.4, end: 0 },
          lifespan: 600,
          alpha: { start: 0.9, end: 0 },
          tint: [0x00ff00, 0x44ff44, 0x88ff88],
          gravityY: -80,
          angle: { min: 250, max: 290 },
          blendMode: Phaser.BlendModes.ADD,
        }

      case 'bossDeath':
        return {
          key: this.particleTexture,
          quantity: 40,
          speed: { min: 100, max: 300 },
          scale: { start: 0.8, end: 0 },
          lifespan: 800,
          alpha: { start: 1, end: 0 },
          tint: [0xff0000, 0xff4400, 0xffaa00, 0xffffff],
          gravityY: 50,
          angle: { min: 0, max: 360 },
          blendMode: Phaser.BlendModes.ADD,
        }

      default:
        // Default particles
        return {
          key: this.particleTexture,
          quantity: 8,
          speed: { min: 50, max: 100 },
          scale: { start: 0.4, end: 0 },
          lifespan: 400,
          alpha: { start: 1, end: 0 },
          angle: { min: 0, max: 360 },
        }
    }
  }

  /**
   * Emit particles at a specific location
   */
  emit(type: ParticleType, x: number, y: number): void {
    if (!this.enabled) return

    const config = this.getConfig(type)

    // Create a particle emitter with the configuration
    const emitter = this.scene.add.particles(x, y, config.key, {
      speed: config.speed,
      scale: config.scale,
      lifespan: config.lifespan,
      alpha: config.alpha,
      tint: config.tint,
      gravityY: config.gravityY ?? 0,
      angle: config.angle,
      rotate: config.rotate ?? { min: 0, max: 0 },
      blendMode: config.blendMode ?? Phaser.BlendModes.NORMAL,
      emitting: false,
    })

    // Set depth to be above game objects
    emitter.setDepth(100)

    // Emit particles
    emitter.explode(config.quantity, 0, 0)

    // Clean up emitter after particles fade
    this.scene.time.delayedCall(config.lifespan + 100, () => {
      emitter.destroy()
    })
  }

  /**
   * Emit death particles at enemy location
   */
  emitDeath(x: number, y: number): void {
    this.emit('death', x, y)
  }

  /**
   * Emit boss death particles (larger explosion)
   */
  emitBossDeath(x: number, y: number): void {
    this.emit('bossDeath', x, y)

    // Add a secondary wave for extra impact
    this.scene.time.delayedCall(100, () => {
      this.emit('bossDeath', x, y)
    })
  }

  /**
   * Emit hit particles at impact location
   */
  emitHit(x: number, y: number): void {
    this.emit('hit', x, y)
  }

  /**
   * Emit critical hit particles
   */
  emitCrit(x: number, y: number): void {
    this.emit('crit', x, y)
  }

  /**
   * Emit fire effect particles
   */
  emitFire(x: number, y: number): void {
    this.emit('fire', x, y)
  }

  /**
   * Emit ice effect particles
   */
  emitIce(x: number, y: number): void {
    this.emit('ice', x, y)
  }

  /**
   * Emit level up celebration particles
   */
  emitLevelUp(x: number, y: number): void {
    this.emit('levelUp', x, y)
  }

  /**
   * Emit gold collect sparkle
   */
  emitGoldCollect(x: number, y: number): void {
    this.emit('goldCollect', x, y)
  }

  /**
   * Emit heal particles
   */
  emitHeal(x: number, y: number): void {
    this.emit('heal', x, y)
  }

  /**
   * Create a continuous fire trail effect that follows an object
   * Returns a cleanup function to stop the effect
   */
  createFireTrail(target: Phaser.GameObjects.Sprite): () => void {
    if (!this.enabled) return () => {}

    const config = this.getConfig('fire')

    // Create emitter at target position
    const emitter = this.scene.add.particles(0, 0, config.key, {
      speed: { min: 10, max: 30 },
      scale: { start: 0.3, end: 0 },
      lifespan: 300,
      alpha: { start: 0.6, end: 0 },
      tint: config.tint,
      gravityY: -30,
      frequency: 50,
      blendMode: Phaser.BlendModes.ADD,
      follow: target,
    })

    emitter.setDepth(5)

    // Return cleanup function
    return () => {
      emitter.stop()
      this.scene.time.delayedCall(500, () => {
        emitter.destroy()
      })
    }
  }

  /**
   * Cleanup all emitters
   */
  destroy(): void {
    this.emitters.forEach((emitter) => {
      emitter.destroy()
    })
    this.emitters.clear()
  }
}

// Export a factory function for easy creation
export function createParticleManager(scene: Phaser.Scene): ParticleManager {
  return new ParticleManager(scene)
}
