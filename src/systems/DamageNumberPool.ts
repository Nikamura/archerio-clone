import Phaser from 'phaser'

export type DamageNumberType = 'normal' | 'crit' | 'player' | 'heal' | 'dot' | 'dodge'

interface DamageNumberConfig {
  color: string
  fontSize: string
  scale: number
  duration: number
  floatDistance: number
}

const DAMAGE_CONFIGS: Record<DamageNumberType, DamageNumberConfig> = {
  normal: {
    color: '#ffffff',
    fontSize: '14px',
    scale: 1,
    duration: 800,
    floatDistance: 30,
  },
  crit: {
    color: '#ffaa00',
    fontSize: '18px',
    scale: 1.3,
    duration: 1000,
    floatDistance: 40,
  },
  player: {
    color: '#ff4444',
    fontSize: '16px',
    scale: 1.2,
    duration: 900,
    floatDistance: 35,
  },
  heal: {
    color: '#44ff44',
    fontSize: '14px',
    scale: 1,
    duration: 800,
    floatDistance: 30,
  },
  dot: {
    color: '#ff8800',
    fontSize: '12px',
    scale: 0.9,
    duration: 600,
    floatDistance: 20,
  },
  dodge: {
    color: '#00ffff',
    fontSize: '16px',
    scale: 1.2,
    duration: 800,
    floatDistance: 35,
  },
}

/**
 * DamageNumberPool - Manages floating damage number text objects.
 * Uses object pooling for performance.
 * Supports different damage types with unique visual styles.
 */
export default class DamageNumberPool {
  private scene: Phaser.Scene
  private textPool: Phaser.GameObjects.Text[] = []
  private maxTexts: number = 30

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.createTextPool()
  }

  /**
   * Create the pool of text objects
   */
  private createTextPool(): void {
    for (let i = 0; i < this.maxTexts; i++) {
      const text = this.scene.add.text(0, 0, '', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      })
      text.setOrigin(0.5, 0.5)
      text.setDepth(150) // Above most game objects
      text.setVisible(false)
      this.textPool.push(text)
    }
  }

  /**
   * Get an available text object from the pool
   */
  private getAvailableText(): Phaser.GameObjects.Text | null {
    for (const text of this.textPool) {
      if (!text.visible) {
        return text
      }
    }
    return null
  }

  /**
   * Show a damage number at a position
   * @param x X position
   * @param y Y position
   * @param damage The damage amount to display
   * @param type The type of damage (affects color/size)
   */
  show(x: number, y: number, damage: number, type: DamageNumberType = 'normal'): void {
    const text = this.getAvailableText()
    if (!text) return

    const config = DAMAGE_CONFIGS[type]

    // Add slight random offset to prevent stacking
    const offsetX = Phaser.Math.Between(-10, 10)
    const offsetY = Phaser.Math.Between(-5, 5)

    text.setPosition(x + offsetX, y + offsetY)
    text.setText(type === 'dodge' ? 'DODGE' : type === 'heal' ? `+${damage}` : `${damage}`)
    text.setStyle({
      fontSize: config.fontSize,
      fontStyle: 'bold',
      color: config.color,
      stroke: '#000000',
      strokeThickness: 3,
    })
    text.setScale(config.scale)
    text.setVisible(true)
    text.setAlpha(1)

    // Stop any existing tweens on this text
    this.scene.tweens.killTweensOf(text)

    // Animate: float up, scale pulse, and fade out
    this.scene.tweens.add({
      targets: text,
      y: y + offsetY - config.floatDistance,
      alpha: 0,
      duration: config.duration,
      ease: 'Quad.easeOut',
      onComplete: () => {
        text.setVisible(false)
      },
    })

    // Add scale punch effect for crits
    if (type === 'crit') {
      this.scene.tweens.add({
        targets: text,
        scale: config.scale * 1.2,
        duration: 100,
        yoyo: true,
        ease: 'Quad.easeOut',
      })
    }
  }

  /**
   * Show damage dealt to an enemy
   */
  showEnemyDamage(x: number, y: number, damage: number, isCrit: boolean = false): void {
    this.show(x, y, damage, isCrit ? 'crit' : 'normal')
  }

  /**
   * Show damage dealt to the player
   */
  showPlayerDamage(x: number, y: number, damage: number): void {
    this.show(x, y, damage, 'player')
  }

  /**
   * Show healing amount
   */
  showHeal(x: number, y: number, amount: number): void {
    this.show(x, y, amount, 'heal')
  }

  /**
   * Show damage over time (fire, poison)
   */
  showDotDamage(x: number, y: number, damage: number): void {
    this.show(x, y, damage, 'dot')
  }

  /**
   * Show dodge text when player dodges an attack
   */
  showDodge(x: number, y: number): void {
    this.show(x, y, 0, 'dodge')
  }

  /**
   * Get count of active damage numbers
   */
  getActiveCount(): number {
    return this.textPool.filter((text) => text.visible).length
  }

  /**
   * Clean up all damage numbers
   */
  cleanup(): void {
    this.textPool.forEach((text) => {
      this.scene.tweens.killTweensOf(text)
      text.setVisible(false)
    })
  }

  /**
   * Destroy the pool
   */
  destroy(): void {
    this.textPool.forEach((text) => {
      this.scene.tweens.killTweensOf(text)
      text.destroy()
    })
    this.textPool = []
  }
}
