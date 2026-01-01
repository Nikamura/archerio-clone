import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'

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

  constructor() {
    super({ key: 'LevelUpScene' })
  }

  init(data: LevelUpData) {
    this.playerLevel = data?.playerLevel || 1
    this.buttons = []
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Ensure this scene receives input
    this.input.enabled = true
    this.scene.bringToTop()

    // Dark overlay background
    const bg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
    bg.setInteractive() // Capture all clicks on background too

    // Title
    this.add
      .text(width / 2, 100, 'LEVEL UP!', {
        fontSize: '32px',
        color: '#ffdd00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Global input log for debugging
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      console.log('LevelUpScene: Global pointerdown at', pointer.x, pointer.y)
    })

    // Select 3 random abilities
    const selectedAbilities = this.selectRandomAbilities(3)

    // Create simple buttons - vertically stacked
    const buttonWidth = width - 60
    const buttonHeight = 80
    const startY = 180
    const spacing = 100

    selectedAbilities.forEach((ability, index) => {
      const y = startY + index * spacing
      this.createSimpleButton(width / 2, y, buttonWidth, buttonHeight, ability)
    })

    console.log('LevelUpScene: Created for level', this.playerLevel)
  }

  private selectRandomAbilities(count: number): AbilityData[] {
    const shuffled = [...ABILITIES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  private createSimpleButton(
    x: number,
    y: number,
    width: number,
    height: number,
    ability: AbilityData
  ) {
    // Simple rectangle button
    const button = this.add.rectangle(x, y, width, height, 0x333333)
    button.setStrokeStyle(3, ability.color)
    button.setInteractive({ useHandCursor: true })

    // Icon on the left side
    const iconX = x - width / 2 + 45
    const textX = x + 15 // Shift text right to make room for icon

    // Add ability icon
    if (this.textures.exists(ability.iconKey)) {
      const icon = this.add.image(iconX, y, ability.iconKey)
      icon.setDisplaySize(48, 48)
    } else {
      // Fallback: colored circle if icon not loaded
      const fallbackIcon = this.add.circle(iconX, y, 20, ability.color)
      fallbackIcon.setStrokeStyle(2, 0xffffff)
    }

    // Ability name (larger, on top line)
    this.add
      .text(textX, y - 15, ability.name, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Description (smaller, below name)
    this.add
      .text(textX, y + 15, ability.description, {
        fontSize: '14px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)

    // Hover effects
    button.on('pointerover', () => {
      button.setFillStyle(0x555555)
    })

    button.on('pointerout', () => {
      button.setFillStyle(0x333333)
    })

    // Click to select
    button.on('pointerdown', () => {
      console.log('LevelUpScene: button pointerdown', ability.id)
      button.setFillStyle(0x666666)
      this.selectAbility(ability.id)
    })

    this.buttons.push(button)
  }

  private selectAbility(abilityId: string) {
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

      // Close this scene first to ensure it disappears
      console.log('LevelUpScene: stopping scene')
      this.scene.stop('LevelUpScene')

      // Emit event to GameScene using global game events
      console.log('LevelUpScene: emitting abilitySelected')
      this.game.events.emit('abilitySelected', abilityId)
    } catch (error) {
      console.error('LevelUpScene: Error in selectAbility:', error)
      // Attempt to stop the scene anyway if it hasn't stopped
      this.scene.stop('LevelUpScene')
    }
  }
}
