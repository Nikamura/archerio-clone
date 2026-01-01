import Phaser from 'phaser'
import { saveManager } from '../systems/SaveManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'

/**
 * Hero configuration with stats, costs, and descriptions
 * This supplements the basic HeroData from SaveManager
 */
interface HeroConfig {
  id: string
  name: string
  description: string
  passive: string
  unlockCost: number
  iconKey: string // Texture key for the hero icon
  baseStats: {
    attack: number
    health: number
    speed: number
    critChance: number
    critDamage: number
  }
}

/**
 * Complete hero configurations
 */
const HERO_CONFIGS: Record<string, HeroConfig> = {
  atreus: {
    id: 'atreus',
    name: 'Atreus',
    description: 'Balanced warrior with no weaknesses',
    passive: 'None - Well-rounded stats',
    unlockCost: 0, // Free starting hero
    iconKey: 'heroAtreus',
    baseStats: {
      attack: 10,
      health: 100,
      speed: 150,
      critChance: 5,
      critDamage: 150,
    },
  },
  helix: {
    id: 'helix',
    name: 'Helix',
    description: 'Rage-powered berserker',
    passive: '+5% damage per 10% missing HP',
    unlockCost: 5000,
    iconKey: 'heroHelix',
    baseStats: {
      attack: 12,
      health: 80,
      speed: 140,
      critChance: 8,
      critDamage: 160,
    },
  },
  meowgik: {
    id: 'meowgik',
    name: 'Meowgik',
    description: 'Mystical cat wizard',
    passive: 'Summons spirit cats to attack',
    unlockCost: 10000,
    iconKey: 'heroMeowgik',
    baseStats: {
      attack: 8,
      health: 90,
      speed: 160,
      critChance: 10,
      critDamage: 140,
    },
  },
}

/**
 * HeroesScene - Displays hero selection and unlock interface
 */
export default class HeroesScene extends Phaser.Scene {
  private heroCards: Phaser.GameObjects.Container[] = []
  private goldText?: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'HeroesScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Dark semi-transparent background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.98)

    // Header section
    this.createHeader(width)

    // Hero cards
    this.createHeroCards(width, height)

    // Back button
    this.createBackButton(width, height)
  }

  private createHeader(width: number): void {
    // Title
    this.add
      .text(width / 2, 40, 'HEROES', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Gold display
    const gold = currencyManager.get('gold')
    this.goldText = this.add
      .text(width / 2, 70, `Gold: ${gold}`, {
        fontSize: '16px',
        color: '#FFD700',
      })
      .setOrigin(0.5)
  }

  private createHeroCards(width: number, _height: number): void {
    const selectedHeroId = saveManager.getSelectedHeroId()
    const heroIds = ['atreus', 'helix', 'meowgik']
    const cardHeight = 140
    const cardSpacing = 15
    const startY = 120

    heroIds.forEach((heroId, index) => {
      const config = HERO_CONFIGS[heroId]
      const heroData = saveManager.getHero(heroId)
      const isUnlocked = heroData?.unlocked ?? false
      const isSelected = heroId === selectedHeroId
      const yPos = startY + index * (cardHeight + cardSpacing)

      const card = this.createHeroCard(
        width / 2,
        yPos,
        config,
        isUnlocked,
        isSelected
      )
      this.heroCards.push(card)
    })
  }

  private createHeroCard(
    x: number,
    y: number,
    config: HeroConfig,
    isUnlocked: boolean,
    isSelected: boolean
  ): Phaser.GameObjects.Container {
    const cardWidth = 340
    const cardHeight = 130

    // Card background color based on state
    let bgColor = 0x2d2d3d // Default locked color
    if (isUnlocked && isSelected) {
      bgColor = 0x4a6fa5 // Selected - blue highlight
    } else if (isUnlocked) {
      bgColor = 0x3d3d4d // Unlocked but not selected
    }

    // Card container
    const container = this.add.container(x, y)

    // Background
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, bgColor)
    bg.setStrokeStyle(2, isSelected ? 0x6b9fff : 0x555566)
    container.add(bg)

    // Hero icon (48x48)
    const iconSize = 48
    const iconX = -cardWidth / 2 + 15 + iconSize / 2
    const iconY = -cardHeight / 2 + 15 + iconSize / 2
    const heroIcon = this.add.image(iconX, iconY, config.iconKey)
    heroIcon.setDisplaySize(iconSize, iconSize)
    // Apply grayscale tint if locked
    if (!isUnlocked) {
      heroIcon.setTint(0x666666)
    }
    container.add(heroIcon)

    // Icon border
    const iconBorder = this.add.rectangle(iconX, iconY, iconSize + 4, iconSize + 4)
    iconBorder.setStrokeStyle(2, isSelected ? 0x6b9fff : 0x555566)
    iconBorder.setFillStyle(0x000000, 0)
    container.add(iconBorder)

    // Offset for text (shifted right to accommodate icon)
    const textOffsetX = iconSize + 25

    // Hero name
    const nameText = this.add
      .text(-cardWidth / 2 + textOffsetX, -cardHeight / 2 + 12, config.name, {
        fontSize: '20px',
        color: isUnlocked ? '#ffffff' : '#888888',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
    container.add(nameText)

    // Level indicator (if unlocked)
    const heroData = saveManager.getHero(config.id)
    if (isUnlocked && heroData) {
      const levelText = this.add
        .text(-cardWidth / 2 + textOffsetX, -cardHeight / 2 + 36, `Lv.${heroData.level}`, {
          fontSize: '12px',
          color: '#aaaaaa',
        })
        .setOrigin(0, 0)
      container.add(levelText)
    }

    // Passive ability description
    const passiveText = this.add
      .text(-cardWidth / 2 + textOffsetX, -cardHeight / 2 + 52, config.passive, {
        fontSize: '11px',
        color: '#88cc88',
        wordWrap: { width: cardWidth - textOffsetX - 20 },
      })
      .setOrigin(0, 0)
    container.add(passiveText)

    // Stats display
    const stats = config.baseStats
    const statsY = -cardHeight / 2 + 75
    const statsText = this.add
      .text(
        -cardWidth / 2 + 15,
        statsY,
        `ATK: ${stats.attack}  HP: ${stats.health}  SPD: ${stats.speed}`,
        {
          fontSize: '11px',
          color: isUnlocked ? '#cccccc' : '#666666',
        }
      )
      .setOrigin(0, 0)
    container.add(statsText)

    const critText = this.add
      .text(
        -cardWidth / 2 + 15,
        statsY + 15,
        `CRIT: ${stats.critChance}%  CRIT DMG: ${stats.critDamage}%`,
        {
          fontSize: '11px',
          color: isUnlocked ? '#cccccc' : '#666666',
        }
      )
      .setOrigin(0, 0)
    container.add(critText)

    // Action button (Select or Unlock)
    if (isUnlocked) {
      if (isSelected) {
        // Selected indicator
        const selectedBadge = this.add
          .text(cardWidth / 2 - 15, -cardHeight / 2 + 15, 'SELECTED', {
            fontSize: '12px',
            color: '#6bff6b',
            fontStyle: 'bold',
          })
          .setOrigin(1, 0)
        container.add(selectedBadge)
      } else {
        // Select button
        const selectBtn = this.createButton(
          cardWidth / 2 - 55,
          cardHeight / 2 - 25,
          'SELECT',
          '#4a9eff',
          () => this.selectHero(config.id)
        )
        container.add(selectBtn)
      }
    } else {
      // Unlock button with cost
      const canAfford = currencyManager.canAfford('gold', config.unlockCost)
      const btnColor = canAfford ? '#6b8e23' : '#555555'
      const unlockBtn = this.createButton(
        cardWidth / 2 - 70,
        cardHeight / 2 - 25,
        `${config.unlockCost} G`,
        btnColor,
        () => this.unlockHero(config.id, config.unlockCost)
      )
      container.add(unlockBtn)

      // Lock icon
      const lockText = this.add
        .text(cardWidth / 2 - 15, -cardHeight / 2 + 15, 'LOCKED', {
          fontSize: '11px',
          color: '#ff6b6b',
        })
        .setOrigin(1, 0)
      container.add(lockText)
    }

    return container
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    const bg = this.add.rectangle(0, 0, 90, 30, Phaser.Display.Color.HexStringToColor(color).color)
    bg.setInteractive({ useHandCursor: true })

    const text = this.add
      .text(0, 0, label, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    container.add([bg, text])

    // Hover effects
    bg.on('pointerover', () => {
      bg.setFillStyle(
        Phaser.Display.Color.HexStringToColor(color).lighten(20).color
      )
    })

    bg.on('pointerout', () => {
      bg.setFillStyle(Phaser.Display.Color.HexStringToColor(color).color)
    })

    bg.on('pointerdown', () => {
      audioManager.playMenuSelect()
      onClick()
    })

    return container
  }

  private selectHero(heroId: string): void {
    const success = saveManager.selectHero(heroId)
    if (success) {
      audioManager.playAbilitySelect()
      // Refresh the scene to show updated selection
      this.scene.restart()
    }
  }

  private unlockHero(heroId: string, cost: number): void {
    const canAfford = currencyManager.canAfford('gold', cost)
    if (!canAfford) {
      // Flash gold text red to indicate insufficient funds
      if (this.goldText) {
        this.goldText.setColor('#ff4444')
        this.time.delayedCall(300, () => {
          this.goldText?.setColor('#FFD700')
        })
      }
      return
    }

    // Spend gold and unlock
    const spent = currencyManager.spend('gold', cost)
    if (spent) {
      saveManager.unlockHero(heroId)
      audioManager.playLevelUp() // Use level up sound for unlock
      // Refresh the scene
      this.scene.restart()
    }
  }

  private createBackButton(width: number, height: number): void {
    const backBtn = this.add
      .text(width / 2, height - 50, 'BACK', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#555555',
        padding: { x: 40, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    backBtn.on('pointerover', () => {
      backBtn.setStyle({ backgroundColor: '#666666' })
    })

    backBtn.on('pointerout', () => {
      backBtn.setStyle({ backgroundColor: '#555555' })
    })

    backBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.scene.start('MainMenuScene')
    })
  }
}
