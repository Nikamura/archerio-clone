import Phaser from 'phaser'
import { themeManager } from '../systems/ThemeManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import { type ThemeId, THEME_DEFINITIONS } from '../config/themeData'

/**
 * ShopScene - Displays theme selection and unlock interface
 */
export default class ShopScene extends Phaser.Scene {
  private themeCards: Phaser.GameObjects.Container[] = []
  private goldText?: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'ShopScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Dark semi-transparent background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.98)

    // Header section
    this.createHeader(width)

    // Theme cards
    this.createThemeCards(width)

    // Back button
    this.createBackButton(width, height)
  }

  private createHeader(width: number): void {
    // Title
    this.add
      .text(width / 2, 40, 'SHOP', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Subtitle
    this.add
      .text(width / 2, 70, 'Themes', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)

    // Gold display
    const gold = currencyManager.get('gold')
    this.goldText = this.add
      .text(width / 2, 95, `Gold: ${gold.toLocaleString()}`, {
        fontSize: '14px',
        color: '#FFD700',
      })
      .setOrigin(0.5)
  }

  private createThemeCards(width: number): void {
    const themeStates = themeManager.getAllThemeStates()
    const cardHeight = 200
    const cardSpacing = 20
    const startY = 150

    themeStates.forEach((state, index) => {
      const yPos = startY + index * (cardHeight + cardSpacing)
      const card = this.createThemeCard(width / 2, yPos, state)
      this.themeCards.push(card)
    })
  }

  private createThemeCard(
    x: number,
    y: number,
    state: {
      id: ThemeId
      name: string
      description: string
      isUnlocked: boolean
      isSelected: boolean
      cost: number
      currency: 'gold' | 'free'
    }
  ): Phaser.GameObjects.Container {
    const cardWidth = 340
    const cardHeight = 190
    const theme = THEME_DEFINITIONS[state.id]

    // Card background color based on state
    let bgColor = 0x2d2d3d // Default locked color
    if (state.isUnlocked && state.isSelected) {
      bgColor = 0x4a6fa5 // Selected - blue highlight
    } else if (state.isUnlocked) {
      bgColor = 0x3d3d4d // Unlocked but not selected
    }

    // Card container
    const container = this.add.container(x, y)

    // Background
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, bgColor)
    bg.setStrokeStyle(2, state.isSelected ? 0x6b9fff : 0x555566)
    container.add(bg)

    // Theme name
    const nameText = this.add
      .text(-cardWidth / 2 + 20, -cardHeight / 2 + 15, state.name, {
        fontSize: '24px',
        color: state.isUnlocked ? '#ffffff' : '#888888',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
    container.add(nameText)

    // Theme description
    const descText = this.add
      .text(-cardWidth / 2 + 20, -cardHeight / 2 + 45, state.description, {
        fontSize: '14px',
        color: '#aaaaaa',
        wordWrap: { width: cardWidth - 40 },
      })
      .setOrigin(0, 0)
    container.add(descText)

    // Color preview swatches
    const swatchY = 20
    const swatchSize = 30
    const swatches = [
      theme.colors.primaryButton,
      theme.colors.secondaryButton,
      theme.colors.healthFull,
      theme.colors.xpBar,
    ]
    const swatchLabels = ['Button', 'Menu', 'Health', 'XP']

    swatches.forEach((color, i) => {
      const swatchX = -cardWidth / 2 + 35 + i * 80
      const swatch = this.add.rectangle(swatchX, swatchY, swatchSize, swatchSize, color)
      swatch.setStrokeStyle(1, 0x666666)
      container.add(swatch)

      // Swatch label
      const label = this.add
        .text(swatchX, swatchY + 22, swatchLabels[i], {
          fontSize: '10px',
          color: '#888888',
        })
        .setOrigin(0.5, 0)
      container.add(label)
    })

    // Status/Action section
    if (state.isUnlocked) {
      if (state.isSelected) {
        // EQUIPPED badge
        const badge = this.add
          .text(cardWidth / 2 - 15, -cardHeight / 2 + 15, 'EQUIPPED', {
            fontSize: '12px',
            color: '#6bff6b',
            fontStyle: 'bold',
          })
          .setOrigin(1, 0)
        container.add(badge)
      } else {
        // SELECT button
        const selectBtn = this.createButton(
          cardWidth / 2 - 60,
          cardHeight / 2 - 30,
          'SELECT',
          '#4a9eff',
          () => this.selectTheme(state.id)
        )
        container.add(selectBtn)
      }
    } else {
      // UNLOCK button with cost
      const canAfford = themeManager.canUnlock(state.id)
      const btnColor = canAfford ? '#6b8e23' : '#555555'
      const unlockBtn = this.createButton(
        cardWidth / 2 - 80,
        cardHeight / 2 - 30,
        `${state.cost.toLocaleString()} GOLD`,
        btnColor,
        () => this.unlockTheme(state.id)
      )
      container.add(unlockBtn)

      // LOCKED label
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

    const btnWidth = label.length > 10 ? 120 : 90
    const bg = this.add.rectangle(
      0,
      0,
      btnWidth,
      30,
      Phaser.Display.Color.HexStringToColor(color).color
    )
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

  private selectTheme(themeId: ThemeId): void {
    const success = themeManager.select(themeId)
    if (success) {
      audioManager.playAbilitySelect()
      // Refresh the scene to show updated selection
      this.scene.restart()
    }
  }

  private unlockTheme(themeId: ThemeId): void {
    const canAfford = themeManager.canUnlock(themeId)
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

    // Attempt to unlock
    const success = themeManager.unlock(themeId)
    if (success) {
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
