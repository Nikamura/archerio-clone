import Phaser from 'phaser'

interface AbilityData {
  id: string
  name: string
  description: string
  color: number
}

const ABILITIES: AbilityData[] = [
  {
    id: 'front_arrow',
    name: 'Front Arrow +1',
    description: 'Extra arrow forward\n-25% damage',
    color: 0x44aaff,
  },
  {
    id: 'multishot',
    name: 'Multishot',
    description: 'Side arrows at 45°\n-15% attack speed',
    color: 0xff6644,
  },
  {
    id: 'attack_speed',
    name: 'Attack Speed',
    description: '+25% attack speed',
    color: 0xffdd00,
  },
  {
    id: 'attack_boost',
    name: 'Attack Boost',
    description: '+30% damage',
    color: 0xff4488,
  },
]

export interface LevelUpData {
  playerLevel: number
}

export default class LevelUpScene extends Phaser.Scene {
  private playerLevel: number = 1

  constructor() {
    super({ key: 'LevelUpScene' })
  }

  init(data: LevelUpData) {
    this.playerLevel = data?.playerLevel || 1
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Dark overlay background
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.85).setOrigin(0)

    // Title
    this.add
      .text(width / 2, 60, 'LEVEL UP!', {
        fontSize: '36px',
        fontFamily: 'Arial',
        color: '#ffdd00',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Level text
    this.add
      .text(width / 2, 100, `Level ${this.playerLevel}`, {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // Select 3 random abilities
    const selectedAbilities = this.selectRandomAbilities(3)

    // Create ability cards
    const cardWidth = 100
    const cardHeight = 150
    const cardSpacing = 15
    const totalWidth = cardWidth * 3 + cardSpacing * 2
    const startX = (width - totalWidth) / 2 + cardWidth / 2
    const cardY = height / 2

    selectedAbilities.forEach((ability, index) => {
      const cardX = startX + index * (cardWidth + cardSpacing)
      this.createAbilityCard(cardX, cardY, cardWidth, cardHeight, ability)
    })

    // Instruction text
    this.add
      .text(width / 2, height - 80, 'Choose an ability', {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)

    console.log('LevelUpScene: Created for level', this.playerLevel)
  }

  private selectRandomAbilities(count: number): AbilityData[] {
    const shuffled = [...ABILITIES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, count)
  }

  private createAbilityCard(
    x: number,
    y: number,
    width: number,
    height: number,
    ability: AbilityData
  ) {
    // Card background
    const card = this.add
      .rectangle(x, y, width, height, 0x222222, 1)
      .setStrokeStyle(3, ability.color)
      .setInteractive({ useHandCursor: true })

    // Colored top strip
    this.add.rectangle(x, y - height / 2 + 15, width - 6, 26, ability.color)

    // Ability name
    this.add
      .text(x, y - height / 2 + 15, ability.name, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 10 },
      })
      .setOrigin(0.5)

    // Ability icon (simple shape based on type)
    this.createAbilityIcon(x, y - 10, ability.id)

    // Description
    this.add
      .text(x, y + 40, ability.description, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#cccccc',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)

    // Hover effects
    card.on('pointerover', () => {
      card.setFillStyle(0x333333)
      card.setScale(1.05)
    })

    card.on('pointerout', () => {
      card.setFillStyle(0x222222)
      card.setScale(1)
    })

    // Use pointerdown for selection (more reliable than pointerup)
    card.on('pointerdown', () => {
      card.setFillStyle(0x444444)
      this.selectAbility(ability.id)
    })
  }

  private createAbilityIcon(x: number, y: number, abilityId: string) {
    const graphics = this.add.graphics()

    switch (abilityId) {
      case 'front_arrow':
        // Multiple arrows pointing up
        graphics.fillStyle(0x44aaff, 1)
        graphics.fillTriangle(x, y - 15, x - 8, y + 5, x + 8, y + 5)
        graphics.fillTriangle(x - 12, y - 10, x - 20, y + 10, x - 4, y + 10)
        graphics.fillTriangle(x + 12, y - 10, x + 4, y + 10, x + 20, y + 10)
        break

      case 'multishot':
        // Arrows spreading outward
        graphics.fillStyle(0xff6644, 1)
        graphics.fillTriangle(x, y - 15, x - 6, y + 5, x + 6, y + 5)
        graphics.fillTriangle(x - 18, y - 5, x - 24, y + 15, x - 12, y + 15)
        graphics.fillTriangle(x + 18, y - 5, x + 12, y + 15, x + 24, y + 15)
        break

      case 'attack_speed':
        // Lightning bolt
        graphics.fillStyle(0xffdd00, 1)
        graphics.beginPath()
        graphics.moveTo(x + 5, y - 20)
        graphics.lineTo(x - 5, y)
        graphics.lineTo(x + 2, y)
        graphics.lineTo(x - 5, y + 20)
        graphics.lineTo(x + 10, y - 5)
        graphics.lineTo(x + 2, y - 5)
        graphics.closePath()
        graphics.fill()
        break

      case 'attack_boost':
        // Sword or damage icon
        graphics.fillStyle(0xff4488, 1)
        graphics.fillTriangle(x, y - 20, x - 8, y + 10, x + 8, y + 10)
        graphics.fillRect(x - 12, y + 10, 24, 6)
        break
    }
  }

  private selectAbility(abilityId: string) {
    console.log('Selected ability:', abilityId)

    // Emit event to GameScene using global game events
    this.game.events.emit('abilitySelected', abilityId)

    // Close this scene
    this.scene.stop('LevelUpScene')
  }
}
