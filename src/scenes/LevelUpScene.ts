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
  {
    id: 'piercing',
    name: 'Piercing Shot',
    description: 'Arrows pierce enemies\n-33% damage per hit',
    color: 0x00ffaa,
  },
  {
    id: 'ricochet',
    name: 'Ricochet',
    description: 'Arrows bounce 3x\nbetween enemies',
    color: 0x88ff88,
  },
  {
    id: 'fire_damage',
    name: 'Fire Damage',
    description: '18% weapon damage\nover 2 seconds',
    color: 0xff6600,
  },
  {
    id: 'crit_boost',
    name: 'Crit Boost',
    description: '+10% crit chance\n+40% crit damage',
    color: 0xffff00,
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

    // Ensure this scene receives input (important when launched over another scene)
    this.input.enabled = true
    this.scene.bringToTop()

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
    // Use a container to group all card elements
    const container = this.add.container(x, y)

    // Card background (positioned relative to container at 0,0)
    const card = this.add.rectangle(0, 0, width, height, 0x222222, 1).setStrokeStyle(3, ability.color)
    container.add(card)

    // Colored top strip
    const topStrip = this.add.rectangle(0, -height / 2 + 15, width - 6, 26, ability.color)
    container.add(topStrip)

    // Ability name
    const nameText = this.add
      .text(0, -height / 2 + 15, ability.name, {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: width - 10 },
      })
      .setOrigin(0.5)
    container.add(nameText)

    // Ability icon (simple shape based on type)
    const iconGraphics = this.createAbilityIcon(0, -10, ability.id)
    container.add(iconGraphics)

    // Description
    const descText = this.add
      .text(0, 40, ability.description, {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#cccccc',
        align: 'center',
        lineSpacing: 4,
      })
      .setOrigin(0.5)
    container.add(descText)

    // Make the container interactive with explicit hit area
    // Container origin is at center, so hit area must be offset by -width/2, -height/2
    container.setSize(width, height)
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true
    })

    // Hover effects
    container.on('pointerover', () => {
      card.setFillStyle(0x333333)
      container.setScale(1.05)
    })

    container.on('pointerout', () => {
      card.setFillStyle(0x222222)
      container.setScale(1)
    })

    // Use pointerdown for selection (more reliable than pointerup)
    container.on('pointerdown', () => {
      card.setFillStyle(0x444444)
      this.selectAbility(ability.id)
    })
  }

  private createAbilityIcon(x: number, y: number, abilityId: string): Phaser.GameObjects.Graphics {
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

      case 'piercing':
        // Arrow going through target
        graphics.fillStyle(0x00ffaa, 1)
        graphics.fillTriangle(x, y - 15, x - 6, y + 5, x + 6, y + 5)
        graphics.fillCircle(x, y + 10, 8)
        graphics.fillStyle(0x222222, 1)
        graphics.fillCircle(x, y + 10, 4)
        break

      case 'ricochet':
        // Bouncing arrow pattern
        graphics.fillStyle(0x88ff88, 1)
        graphics.fillTriangle(x - 15, y - 10, x - 10, y, x - 5, y - 10)
        graphics.fillTriangle(x, y, x + 5, y + 10, x + 10, y)
        graphics.fillTriangle(x + 15, y + 10, x + 20, y + 20, x + 25, y + 10)
        break

      case 'fire_damage':
        // Fire icon
        graphics.fillStyle(0xff6600, 1)
        graphics.fillCircle(x, y, 12)
        graphics.fillTriangle(x, y - 20, x - 8, y - 5, x + 8, y - 5)
        graphics.fillStyle(0xffaa00, 1)
        graphics.fillCircle(x, y, 6)
        break

      case 'crit_boost':
        // Critical hit star
        graphics.fillStyle(0xffff00, 1)
        graphics.beginPath()
        graphics.moveTo(x, y - 18)
        graphics.lineTo(x + 5, y - 5)
        graphics.lineTo(x + 18, y - 5)
        graphics.lineTo(x + 8, y + 5)
        graphics.lineTo(x + 12, y + 18)
        graphics.lineTo(x, y + 10)
        graphics.lineTo(x - 12, y + 18)
        graphics.lineTo(x - 8, y + 5)
        graphics.lineTo(x - 18, y - 5)
        graphics.lineTo(x - 5, y - 5)
        graphics.closePath()
        graphics.fill()
        break
    }

    return graphics
  }

  private selectAbility(abilityId: string) {
    console.log('Selected ability:', abilityId)

    // Emit event to GameScene using global game events
    this.game.events.emit('abilitySelected', abilityId)

    // Close this scene
    this.scene.stop('LevelUpScene')
  }
}
