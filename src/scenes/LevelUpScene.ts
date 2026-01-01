import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import {
  showModal,
  glow,
  applyButtonEffects,
  DURATION,
  EASING,
} from '../systems/UIAnimations'

interface AbilityData {
  id: string
  name: string
  description: string
  color: number
  iconKey: string
}

const ABILITIES: AbilityData[] = [
  // Original 8 abilities
  {
    id: 'front_arrow',
    name: 'Front Arrow +1',
    description: '-25% damage',
    color: 0x44aaff,
    iconKey: 'abilityFrontArrow',
  },
  {
    id: 'multishot',
    name: 'Multishot',
    description: '-15% attack speed',
    color: 0xff6644,
    iconKey: 'abilityMultishot',
  },
  {
    id: 'attack_speed',
    name: 'Attack Speed',
    description: '+25% speed',
    color: 0xffdd00,
    iconKey: 'abilityAttackSpeed',
  },
  {
    id: 'attack_boost',
    name: 'Attack Boost',
    description: '+30% damage',
    color: 0xff4488,
    iconKey: 'abilityAttackBoost',
  },
  {
    id: 'piercing',
    name: 'Piercing',
    description: 'Pass through enemies',
    color: 0x00ffaa,
    iconKey: 'abilityPiercing',
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    description: 'Bounce 3x',
    color: 0x88ff88,
    iconKey: 'abilityRicochet',
  },
  {
    id: 'fire_damage',
    name: 'Fire',
    description: '18% DOT',
    color: 0xff6600,
    iconKey: 'abilityFireDamage',
  },
  {
    id: 'crit_boost',
    name: 'Critical',
    description: '+10% crit, +40% dmg',
    color: 0xffff00,
    iconKey: 'abilityCrit',
  },
  // New 8 abilities for V1
  {
    id: 'ice_shot',
    name: 'Ice Shot',
    description: '15% freeze chance',
    color: 0x66ccff,
    iconKey: 'abilityIceShot',
  },
  {
    id: 'poison_shot',
    name: 'Poison',
    description: '5% DOT, stacks 5x',
    color: 0x66ff66,
    iconKey: 'abilityPoisonShot',
  },
  {
    id: 'lightning_chain',
    name: 'Lightning',
    description: 'Chain to 2 enemies',
    color: 0x9966ff,
    iconKey: 'abilityLightningChain',
  },
  {
    id: 'diagonal_arrows',
    name: 'Diagonal Arrows',
    description: '+2 arrows at 30°',
    color: 0xff9966,
    iconKey: 'abilityDiagonalArrows',
  },
  {
    id: 'rear_arrow',
    name: 'Rear Arrow',
    description: '+1 backwards',
    color: 0x6699ff,
    iconKey: 'abilityRearArrow',
  },
  {
    id: 'bouncy_wall',
    name: 'Bouncy Wall',
    description: '2 wall bounces',
    color: 0x99ff99,
    iconKey: 'abilityBouncyWall',
  },
  {
    id: 'bloodthirst',
    name: 'Bloodthirst',
    description: '+2 HP per kill',
    color: 0xff3333,
    iconKey: 'abilityBloodthirst',
  },
  {
    id: 'rage',
    name: 'Rage',
    description: '+5% dmg per 10% HP lost',
    color: 0xcc0000,
    iconKey: 'abilityRage',
  },
]

export interface LevelUpData {
  playerLevel: number
}

export default class LevelUpScene extends Phaser.Scene {
  private playerLevel: number = 1
  private buttons: Phaser.GameObjects.Rectangle[] = []
  private abilityCards: Phaser.GameObjects.Container[] = []
  private titleContainer?: Phaser.GameObjects.Container

  constructor() {
    super({ key: 'LevelUpScene' })
  }

  init(data: LevelUpData) {
    this.playerLevel = data?.playerLevel || 1
    this.buttons = []
    this.abilityCards = []
  }

  create() {
    try {
      const width = this.cameras.main.width
      const height = this.cameras.main.height

      // Register shutdown event
      this.events.once('shutdown', this.shutdown, this)

      // CRITICAL: Ensure this scene receives input and is on top
      this.input.enabled = true
      this.input.setTopOnly(false) // Allow all objects to receive input
      this.scene.bringToTop()

      // Set canvas pointer events to ensure touch works
      if (this.game.canvas) {
        this.game.canvas.style.pointerEvents = 'auto'
        // Also re-enable the parent container; Safari can inherit a 'none' from the joystick
        if (this.game.canvas.parentElement) {
          this.game.canvas.parentElement.style.pointerEvents = 'auto'
        }
      }

    // Dark overlay background with fade in
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
    bg.setInteractive() // Capture all clicks on background too
    bg.setDepth(-1) // Ensure background is behind everything

    // Fade in overlay
    this.tweens.add({
      targets: bg,
      alpha: 0.9,
      duration: DURATION.FAST,
      ease: EASING.EASE_OUT,
    })

    // Title container for animation
    this.titleContainer = this.add.container(width / 2, 100)
    this.titleContainer.setDepth(1)

    // Title background glow
    const titleGlow = this.add.rectangle(0, 0, 250, 60, 0xffdd00, 0.15)
    titleGlow.setStrokeStyle(2, 0xffdd00)
    this.titleContainer.add(titleGlow)

    // Title text
    const title = this.add
      .text(0, 0, 'LEVEL UP!', {
        fontSize: '32px',
        color: '#ffdd00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.titleContainer.add(title)

    // Animate title in with bounce
    showModal(this, this.titleContainer, DURATION.NORMAL)

    // Pulsing glow on title
    glow(this, titleGlow, 0.1, 0.25, 800)

    // Create particles around title
    this.createTitleParticles(width)

    // Global input log for debugging
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      console.log('LevelUpScene: Global pointerdown at', pointer.x, pointer.y)
    })

    // Select 3 random abilities
    const selectedAbilities = this.selectRandomAbilities(3)

    // Create ability cards - vertically stacked with staggered animation
    const buttonWidth = width - 60
    const buttonHeight = 80
    const startY = 180
    const spacing = 100

      selectedAbilities.forEach((ability, index) => {
        const y = startY + index * spacing
        // Delay each card's creation for stagger effect
        this.time.delayedCall(DURATION.FAST + index * 100, () => {
          try {
            this.createAbilityCard(width / 2, y, buttonWidth, buttonHeight, ability, index)
          } catch (error) {
            console.error('LevelUpScene: Error creating ability card:', error)
          }
        })
      })

      console.log('LevelUpScene: Created for level', this.playerLevel)
    } catch (error) {
      console.error('LevelUpScene: Error in create:', error)
      // Try to close the scene gracefully
      this.scene.stop('LevelUpScene')
    }
  }

  private createTitleParticles(width: number) {
    try {
      // Create particle texture if not exists
      if (!this.textures.exists('levelup_particle')) {
        const graphics = this.add.graphics()
        graphics.fillStyle(0xffdd00, 1)
        graphics.fillCircle(4, 4, 4)
        graphics.generateTexture('levelup_particle', 8, 8)
        graphics.destroy()
      }

    // Create particle emitters on each side of title
    const leftEmitter = this.add.particles(width / 2 - 100, 100, 'levelup_particle', {
      speed: { min: 20, max: 50 },
      angle: { min: 240, max: 300 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 600, max: 1000 },
      frequency: 200,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xffdd00, 0xffaa00, 0xff8800],
    })
    leftEmitter.setDepth(1)

      const rightEmitter = this.add.particles(width / 2 + 100, 100, 'levelup_particle', {
        speed: { min: 20, max: 50 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.8, end: 0 },
        lifespan: { min: 600, max: 1000 },
        frequency: 200,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
        tint: [0xffdd00, 0xffaa00, 0xff8800],
      })
      rightEmitter.setDepth(1)
    } catch (error) {
      console.error('LevelUpScene: Error creating title particles:', error)
      // Non-critical, continue without particles
    }
  }

  private selectRandomAbilities(count: number): AbilityData[] {
    const shuffled = [...ABILITIES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  private createAbilityCard(
    x: number,
    y: number,
    cardWidth: number,
    cardHeight: number,
    ability: AbilityData,
    index: number
  ) {
    try {
      // Create container for the whole card
      const container = this.add.container(x, y)
      container.setDepth(10 + index) // Ensure cards are above background

    // Outer glow/border effect
    const glowRect = this.add.rectangle(0, 0, cardWidth + 6, cardHeight + 6, ability.color, 0.2)
    container.add(glowRect)

    // Main button background
    const button = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x333333)
    button.setStrokeStyle(3, ability.color)
    button.setInteractive({ useHandCursor: true })
    container.add(button)

    // Icon on the left side
    const iconX = -cardWidth / 2 + 45
    const textX = 15 // Relative to container center

    // Add ability icon
    let iconElement: Phaser.GameObjects.Image | Phaser.GameObjects.Arc
    if (this.textures.exists(ability.iconKey)) {
      iconElement = this.add.image(iconX, 0, ability.iconKey)
      iconElement.setDisplaySize(48, 48)
    } else {
      // Fallback: colored circle if icon not loaded
      iconElement = this.add.circle(iconX, 0, 20, ability.color)
      ;(iconElement as Phaser.GameObjects.Arc).setStrokeStyle(2, 0xffffff)
    }
    container.add(iconElement)

    // Ability name (larger, on top line)
    const nameText = this.add
      .text(textX, -15, ability.name, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(nameText)

    // Description (smaller, below name)
    const descText = this.add
      .text(textX, 15, ability.description, {
        fontSize: '14px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)
    container.add(descText)

    // Start card off-screen to the right and animate in
    container.setX(x + 400)
    container.setAlpha(0)

    this.tweens.add({
      targets: container,
      x: x,
      alpha: 1,
      duration: DURATION.NORMAL,
      ease: EASING.BOUNCE_OUT,
      delay: index * 80,
    })

    // Subtle idle glow animation
    this.tweens.add({
      targets: glowRect,
      alpha: { from: 0.15, to: 0.3 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: EASING.SINE_IN_OUT,
      delay: index * 200,
    })

    // Apply enhanced button effects
    applyButtonEffects(this, container, {
      scaleOnHover: 1.03,
      scaleOnPress: 0.97,
    })

    // Hover effects for background color
    button.on('pointerover', () => {
      button.setFillStyle(0x444444)
      glowRect.setAlpha(0.4)
      // Scale up icon slightly
      this.tweens.add({
        targets: iconElement,
        scale: 1.1,
        duration: 100,
        ease: EASING.EASE_OUT,
      })
    })

    button.on('pointerout', () => {
      button.setFillStyle(0x333333)
      // Reset icon scale
      this.tweens.add({
        targets: iconElement,
        scale: 1,
        duration: 100,
        ease: EASING.EASE_OUT,
      })
    })

    // Click to select with flash animation
    button.on('pointerdown', () => {
      console.log('LevelUpScene: button pointerdown', ability.id)
      button.setFillStyle(0x555555)

      // Flash effect on selection
      this.tweens.add({
        targets: container,
        scale: 1.1,
        duration: 80,
        yoyo: true,
        ease: EASING.EASE_OUT,
        onComplete: () => {
          this.selectAbility(ability.id, container)
        },
      })
      })

      this.buttons.push(button)
      this.abilityCards.push(container)
    } catch (error) {
      console.error('LevelUpScene: Error in createAbilityCard:', error)
      // Card creation failed, but other cards might still work
    }
  }

  private selectAbility(abilityId: string, selectedContainer?: Phaser.GameObjects.Container) {
    console.log('LevelUpScene: selectAbility called', abilityId)

    try {
      // Disable all buttons to prevent double selection
      this.buttons.forEach(btn => {
        if (btn && btn.disableInteractive) {
          btn.disableInteractive()
        }
      })

      // Play ability selection sound
      audioManager.playAbilitySelect()

      // Animate out unselected cards
      this.abilityCards.forEach(card => {
        if (card !== selectedContainer) {
          this.tweens.add({
            targets: card,
            x: card.x - 400,
            alpha: 0,
            duration: DURATION.FAST,
            ease: EASING.EASE_IN,
          })
        }
      })

      // Animate selected card to center and scale up
      if (selectedContainer) {
        this.tweens.add({
          targets: selectedContainer,
          y: this.cameras.main.height / 2,
          scale: 1.2,
          duration: DURATION.NORMAL,
          ease: EASING.EASE_OUT,
          onComplete: () => {
            // Flash and fade out
            this.tweens.add({
              targets: selectedContainer,
              alpha: 0,
              scale: 1.5,
              duration: DURATION.FAST,
              ease: EASING.EASE_IN,
              onComplete: () => {
                this.finishSelection(abilityId)
              },
            })
          },
        })
      } else {
        // If no container, just finish immediately
        this.time.delayedCall(DURATION.FAST, () => {
          this.finishSelection(abilityId)
        })
      }
    } catch (error) {
      console.error('LevelUpScene: Error in selectAbility:', error)
      // Attempt to stop the scene anyway if it hasn't stopped
      this.scene.stop('LevelUpScene')
    }
  }

  private finishSelection(abilityId: string) {
    try {
      // Close this scene
      console.log('LevelUpScene: stopping scene')
      this.scene.stop('LevelUpScene')

      // Emit event to GameScene using global game events
      console.log('LevelUpScene: emitting abilitySelected')
      this.game.events.emit('abilitySelected', abilityId)
    } catch (error) {
      console.error('LevelUpScene: Error in finishSelection:', error)
      // Force scene stop if it hasn't stopped
      try {
        this.scene.stop('LevelUpScene')
      } catch (stopError) {
        console.error('LevelUpScene: Error stopping scene:', stopError)
      }
    }
  }

  /**
   * Clean up scene resources
   */
  shutdown() {
    this.tweens.killAll()
  }
}
