import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { DURATION, EASING } from '../systems/UIAnimations'
import { errorReporting } from '../systems/ErrorReportingManager'

export interface AbilityData {
  id: string
  name: string
  description: string
  color: number
  iconKey: string
}

export const ABILITIES: AbilityData[] = [
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
    id: 'damage_aura',
    name: 'Damage Aura',
    description: '10 DPS in 80px radius',
    color: 0xff6666,
    iconKey: 'abilityDamageAura',
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
  {
    id: 'speed_boost',
    name: 'Speed Boost',
    description: '+15% movement speed',
    color: 0x00ffff,
    iconKey: 'abilitySpeedBoost',
  },
  {
    id: 'max_health',
    name: 'Vitality',
    description: '+10% max HP',
    color: 0x22cc66,
    iconKey: 'abilityMaxHealth',
  },
  {
    id: 'bouncy_wall',
    name: 'Bouncy Wall',
    description: '+2 wall bounces',
    color: 0x88ccff,
    iconKey: 'abilityBouncyWall',
  },
  {
    id: 'dodge_master',
    name: 'Dodge Master',
    description: '+1.5% dodge chance',
    color: 0xaaaaff,
    iconKey: 'abilityDodgeMaster',
  },
  // Devil abilities (powerful but with HP cost or risk)
  {
    id: 'extra_life',
    name: 'Extra Life',
    description: 'Revive once at 30% HP',
    color: 0xff3366,
    iconKey: 'abilityExtraLife',
  },
  {
    id: 'through_wall',
    name: 'Through Wall',
    description: 'Arrows pass through walls',
    color: 0x9933ff,
    iconKey: 'abilityThroughWall',
  },
  {
    id: 'giant',
    name: 'Giant',
    description: '+40% damage, larger hitbox',
    color: 0xcc3300,
    iconKey: 'abilityGiant',
  },
]

export interface LevelUpData {
  playerLevel: number
}

const SELECTION_TIME_MS = 5000 // 5 seconds to choose

export default class LevelUpScene extends Phaser.Scene {
  private abilityCards: Phaser.GameObjects.Container[] = []
  private modalContainer!: Phaser.GameObjects.Container
  private selectedAbilities: AbilityData[] = []
  private selectionTimer?: Phaser.Time.TimerEvent
  private progressBar?: Phaser.GameObjects.Graphics
  private timerText?: Phaser.GameObjects.Text
  private isSelecting: boolean = false

  constructor() {
    super({ key: 'LevelUpScene' })
  }

  init(_data: LevelUpData) {
    this.abilityCards = []
    this.selectedAbilities = []
    this.selectionTimer = undefined
    this.progressBar = undefined
    this.timerText = undefined
    this.isSelecting = false
  }

  create() {
    try {
      const width = this.cameras.main.width
      const height = this.cameras.main.height

      this.events.once('shutdown', this.shutdown, this)

      // Ensure input works
      this.input.enabled = true
      this.input.setTopOnly(false)
      this.scene.bringToTop()

      if (this.game.canvas) {
        this.game.canvas.style.pointerEvents = 'auto'
        if (this.game.canvas.parentElement) {
          this.game.canvas.parentElement.style.pointerEvents = 'auto'
        }
      }

      // Dark overlay
      const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      bg.setInteractive()
      bg.setDepth(-1)

      this.tweens.add({
        targets: bg,
        alpha: 0.85,
        duration: DURATION.FAST,
        ease: EASING.EASE_OUT,
      })

      // Main modal container
      this.modalContainer = this.add.container(width / 2, height / 2)
      this.modalContainer.setDepth(10)
      this.modalContainer.setScale(0.8)
      this.modalContainer.setAlpha(0)

      // Modal background
      const modalWidth = width - 40
      const modalHeight = 320
      const modalBg = this.add.graphics()
      modalBg.fillStyle(0x1a1a2e, 0.98)
      modalBg.fillRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16)
      modalBg.lineStyle(2, 0x4a4a6a, 1)
      modalBg.strokeRoundedRect(-modalWidth / 2, -modalHeight / 2, modalWidth, modalHeight, 16)
      this.modalContainer.add(modalBg)

      // Title
      const title = this.add.text(0, -modalHeight / 2 + 30, 'LEVEL UP', {
        fontSize: '24px',
        color: '#ffdd00',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      title.setStroke('#000000', 3)
      this.modalContainer.add(title)

      // Subtitle
      const subtitle = this.add.text(0, -modalHeight / 2 + 55, 'Choose an ability', {
        fontSize: '12px',
        color: '#888888',
      }).setOrigin(0.5)
      this.modalContainer.add(subtitle)

      // Select 3 random abilities
      this.selectedAbilities = this.selectRandomAbilities(3)

      // Create ability cards
      const cardWidth = modalWidth - 30
      const cardHeight = 60
      const cardSpacing = 70
      const startY = -40

      this.selectedAbilities.forEach((ability, index) => {
        const y = startY + index * cardSpacing
        this.createAbilityCard(0, y, cardWidth, cardHeight, ability, index)
      })

      // Progress bar at bottom of modal
      this.createProgressBar(modalWidth, modalHeight)

      // Animate modal in
      this.tweens.add({
        targets: this.modalContainer,
        scale: 1,
        alpha: 1,
        duration: 200,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.startSelectionTimer()
        },
      })

      console.log('LevelUpScene: Created (modern modal)')
    } catch (error) {
      console.error('LevelUpScene: Error in create:', error)
      this.scene.stop('LevelUpScene')
    }
  }

  private selectRandomAbilities(count: number): AbilityData[] {
    const shuffled = [...ABILITIES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  private createProgressBar(modalWidth: number, modalHeight: number) {
    const barWidth = modalWidth - 60
    const barHeight = 6
    const barY = modalHeight / 2 - 25

    // Background
    const bgBar = this.add.graphics()
    bgBar.fillStyle(0x333355, 1)
    bgBar.fillRoundedRect(-barWidth / 2, barY, barWidth, barHeight, 3)
    this.modalContainer.add(bgBar)

    // Progress bar
    this.progressBar = this.add.graphics()
    this.modalContainer.add(this.progressBar)
    this.progressBar.setData('width', barWidth)
    this.progressBar.setData('y', barY)
    this.progressBar.setData('height', barHeight)

    // Timer text
    this.timerText = this.add.text(0, barY - 12, '5.0', {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5)
    this.modalContainer.add(this.timerText)

    // Initial fill
    this.progressBar.fillStyle(0xffdd00, 1)
    this.progressBar.fillRoundedRect(-barWidth / 2, barY, barWidth, barHeight, 3)
  }

  private startSelectionTimer() {
    if (this.isSelecting) return

    const barWidth = this.progressBar?.getData('width') || 200
    const barY = this.progressBar?.getData('y') || 0
    const barHeight = this.progressBar?.getData('height') || 6
    const startTime = this.time.now

    const updateEvent = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (this.isSelecting) {
          updateEvent.destroy()
          return
        }

        const elapsed = this.time.now - startTime
        const remaining = Math.max(0, SELECTION_TIME_MS - elapsed)
        const progress = remaining / SELECTION_TIME_MS

        // Update progress bar
        if (this.progressBar) {
          this.progressBar.clear()

          let color = 0xffdd00
          if (progress < 0.3) color = 0xff3333
          else if (progress < 0.6) color = 0xff9933

          this.progressBar.fillStyle(color, 1)
          this.progressBar.fillRoundedRect(-barWidth / 2, barY, barWidth * progress, barHeight, 3)
        }

        // Update timer text
        if (this.timerText) {
          this.timerText.setText((remaining / 1000).toFixed(1))
          if (progress < 0.3) this.timerText.setColor('#ff3333')
          else if (progress < 0.6) this.timerText.setColor('#ff9933')
        }

        if (remaining <= 0) {
          updateEvent.destroy()
          this.selectRandomAbilityOnTimeout()
        }
      },
    })

    this.selectionTimer = updateEvent
  }

  private selectRandomAbilityOnTimeout() {
    if (this.isSelecting || this.selectedAbilities.length === 0) return

    const randomIndex = Math.floor(Math.random() * this.selectedAbilities.length)
    const randomAbility = this.selectedAbilities[randomIndex]
    const randomContainer = this.abilityCards[randomIndex]

    console.log('LevelUpScene: Auto-selecting:', randomAbility.id)

    if (randomContainer) {
      this.tweens.add({
        targets: randomContainer,
        scale: 1.05,
        duration: 100,
        yoyo: true,
        onComplete: () => {
          this.selectAbility(randomAbility.id, randomContainer)
        },
      })
    } else {
      this.selectAbility(randomAbility.id)
    }
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
      const container = this.add.container(x, y)
      container.setDepth(10 + index)

      // Card background
      const cardBg = this.add.graphics()
      cardBg.fillStyle(0x252540, 1)
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10)

      // Left accent bar (ability color)
      cardBg.fillStyle(ability.color, 1)
      cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, { tl: 10, bl: 10, tr: 0, br: 0 })

      container.add(cardBg)

      // Interactive area
      const hitArea = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x000000, 0)
      hitArea.setInteractive({ useHandCursor: true })
      container.add(hitArea)

      // Icon
      const iconX = -cardWidth / 2 + 40
      if (this.textures.exists(ability.iconKey)) {
        const icon = this.add.image(iconX, 0, ability.iconKey)
        icon.setDisplaySize(36, 36)
        container.add(icon)
      } else {
        const iconCircle = this.add.circle(iconX, 0, 16, ability.color)
        container.add(iconCircle)
      }

      // Name
      const nameText = this.add.text(iconX + 35, -10, ability.name, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5)
      container.add(nameText)

      // Description
      const descText = this.add.text(iconX + 35, 10, ability.description, {
        fontSize: '12px',
        color: '#888888',
      }).setOrigin(0, 0.5)
      container.add(descText)

      // Hover effects
      hitArea.on('pointerover', () => {
        this.tweens.add({
          targets: container,
          scale: 1.02,
          duration: 100,
          ease: 'Power2.easeOut',
        })
        cardBg.clear()
        cardBg.fillStyle(0x303050, 1)
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10)
        cardBg.fillStyle(ability.color, 1)
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, { tl: 10, bl: 10, tr: 0, br: 0 })
      })

      hitArea.on('pointerout', () => {
        this.tweens.add({
          targets: container,
          scale: 1,
          duration: 100,
          ease: 'Power2.easeOut',
        })
        cardBg.clear()
        cardBg.fillStyle(0x252540, 1)
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 10)
        cardBg.fillStyle(ability.color, 1)
        cardBg.fillRoundedRect(-cardWidth / 2, -cardHeight / 2, 6, cardHeight, { tl: 10, bl: 10, tr: 0, br: 0 })
      })

      // Click handler
      hitArea.on('pointerdown', () => {
        console.log('LevelUpScene: Selected', ability.id)
        this.tweens.add({
          targets: container,
          scale: 1.05,
          duration: 80,
          yoyo: true,
          ease: 'Power2.easeOut',
          onComplete: () => {
            this.selectAbility(ability.id, container)
          },
        })
      })

      // Add to modal
      this.modalContainer.add(container)
      this.abilityCards.push(container)
    } catch (error) {
      console.error('LevelUpScene: Error creating card:', error)
    }
  }

  private selectAbility(abilityId: string, selectedContainer?: Phaser.GameObjects.Container) {
    if (this.isSelecting) return
    this.isSelecting = true

    errorReporting.addBreadcrumb('game', `Selected ability: ${abilityId}`)

    if (this.selectionTimer) {
      this.selectionTimer.destroy()
      this.selectionTimer = undefined
    }

    try {
      // Disable all interactions
      this.abilityCards.forEach(card => {
        const hitArea = card.getAt(1) as Phaser.GameObjects.Rectangle
        if (hitArea?.disableInteractive) {
          hitArea.disableInteractive()
        }
      })

      audioManager.playAbilitySelect()

      // Fade out unselected cards
      this.abilityCards.forEach(card => {
        if (card !== selectedContainer) {
          this.tweens.add({
            targets: card,
            alpha: 0,
            x: -50,
            duration: 150,
            ease: 'Power2.easeIn',
          })
        }
      })

      // Animate selected card
      if (selectedContainer) {
        this.tweens.add({
          targets: selectedContainer,
          scale: 1.1,
          duration: 150,
          ease: 'Power2.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: this.modalContainer,
              alpha: 0,
              scale: 0.9,
              duration: 150,
              ease: 'Power2.easeIn',
              onComplete: () => {
                this.finishSelection(abilityId)
              },
            })
          },
        })
      } else {
        this.tweens.add({
          targets: this.modalContainer,
          alpha: 0,
          scale: 0.9,
          duration: 150,
          ease: 'Power2.easeIn',
          onComplete: () => {
            this.finishSelection(abilityId)
          },
        })
      }
    } catch (error) {
      console.error('LevelUpScene: Error in selectAbility:', error)
      this.scene.stop('LevelUpScene')
    }
  }

  private finishSelection(abilityId: string) {
    try {
      console.log('LevelUpScene: Finishing selection')
      this.scene.stop('LevelUpScene')
      this.game.events.emit('abilitySelected', abilityId)
    } catch (error) {
      console.error('LevelUpScene: Error in finishSelection:', error)
      try {
        this.scene.stop('LevelUpScene')
      } catch (stopError) {
        console.error('LevelUpScene: Error stopping scene:', stopError)
      }
    }
  }

  shutdown() {
    if (this.selectionTimer) {
      this.selectionTimer.destroy()
      this.selectionTimer = undefined
    }

    this.input.removeAllListeners()

    this.abilityCards.forEach(card => {
      const hitArea = card.getAt(1) as Phaser.GameObjects.Rectangle
      if (hitArea?.input) {
        hitArea.removeAllListeners()
        hitArea.disableInteractive()
      }
    })
    this.abilityCards = []

    this.tweens.killAll()
  }
}
