import Phaser from 'phaser'
import { themeManager } from '../systems/ThemeManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import { type ThemeId, THEME_DEFINITIONS } from '../config/themeData'
import { createBackButton } from '../ui/components/BackButton'
import { ScrollContainer } from '../ui/components/ScrollContainer'

/**
 * ShopScene - Displays theme selection and unlock interface
 */
export default class ShopScene extends Phaser.Scene {
  private themeCards: Phaser.GameObjects.Container[] = []
  private goldText?: Phaser.GameObjects.Text
  private scrollContainer?: ScrollContainer

  constructor() {
    super({ key: 'ShopScene' })
  }

  create(data?: { scrollY?: number }) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    this.themeCards = []

    // Dark semi-transparent background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.98)

    // Header section (fixed)
    this.createHeader(width)

    // Theme cards (scrollable)
    this.createScrollableThemeCards(width, height)

    // Restore scroll position if provided
    if (data?.scrollY && this.scrollContainer) {
      this.scrollContainer.scrollTo(data.scrollY)
    }

    // Back button (fixed)
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

    // Currency display (Gold and Gems)
    const gold = currencyManager.get('gold')
    const gems = currencyManager.get('gems')
    this.goldText = this.add
      .text(width / 2 - 60, 95, `Gold: ${gold.toLocaleString()}`, {
        fontSize: '14px',
        color: '#FFD700',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2 + 60, 95, `Gems: ${gems}`, {
        fontSize: '14px',
        color: '#00CCFF',
      })
      .setOrigin(0.5)
  }

  private createScrollableThemeCards(width: number, height: number): void {
    const themeStates = themeManager.getAllThemeStates()
    const cardHeight = 190
    const cardSpacing = 20
    const startY = 120 // Header ends around 110

    // Scroll area bounds
    const scrollAreaTop = startY
    const scrollAreaBottom = height - 80 // Leave room for back button

    // Create scroll container using reusable component
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width: width,
      bounds: { top: scrollAreaTop, bottom: scrollAreaBottom },
    })

    // Calculate total content height
    const totalContentHeight = themeStates.length * (cardHeight + cardSpacing) + 20
    this.scrollContainer.setContentHeight(totalContentHeight)

    // Create theme cards inside scroll container
    themeStates.forEach((state, index) => {
      const yPos = scrollAreaTop + 10 + index * (cardHeight + cardSpacing) + cardHeight / 2
      const card = this.createThemeCard(width / 2, yPos, state)
      this.scrollContainer!.add(card)
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
      currency: 'gold' | 'gems' | 'free'
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

    // Theme preview image
    const previewY = 20
    const previewKey = `themePreview_${state.id}`

    if (this.textures.exists(previewKey)) {
      const preview = this.add.image(0, previewY, previewKey)
      // Scale to fit card width with some padding
      const maxWidth = cardWidth - 40
      const maxHeight = 80
      const scale = Math.min(maxWidth / preview.width, maxHeight / preview.height)
      preview.setScale(scale)
      preview.setAlpha(state.isUnlocked ? 1 : 0.5)
      container.add(preview)

      // Add a subtle border around the preview
      const borderWidth = preview.displayWidth
      const borderHeight = preview.displayHeight
      const border = this.add.rectangle(0, previewY, borderWidth + 4, borderHeight + 4)
      border.setStrokeStyle(2, state.isSelected ? 0x6bff6b : 0x444455)
      border.setFillStyle(0x000000, 0)
      container.add(border)
    } else {
      // Fallback to color swatches if preview not available
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
        const swatch = this.add.rectangle(swatchX, previewY, swatchSize, swatchSize, color)
        swatch.setStrokeStyle(1, 0x666666)
        container.add(swatch)

        // Swatch label
        const label = this.add
          .text(swatchX, previewY + 22, swatchLabels[i], {
            fontSize: '10px',
            color: '#888888',
          })
          .setOrigin(0.5, 0)
        container.add(label)
      })
    }

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
      const currencyLabel = state.currency === 'gems' ? 'GEMS' : 'GOLD'
      const unlockBtn = this.createButton(
        cardWidth / 2 - 80,
        cardHeight / 2 - 30,
        `${state.cost.toLocaleString()} ${currencyLabel}`,
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
      // Don't process click if user was scrolling
      if (this.scrollContainer?.isDragScrolling()) return
      audioManager.playMenuSelect()
      onClick()
    })

    return container
  }

  private selectTheme(themeId: ThemeId): void {
    const success = themeManager.select(themeId)
    if (success) {
      audioManager.playAbilitySelect()
      // Refresh the scene to show updated selection, preserving scroll position
      const scrollY = this.scrollContainer?.getScrollY() ?? 0
      this.scene.restart({ scrollY })
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
      // Refresh the scene, preserving scroll position
      const scrollY = this.scrollContainer?.getScrollY() ?? 0
      this.scene.restart({ scrollY })
    }
  }

  private createBackButton(_width: number, height: number): void {
    createBackButton({
      scene: this,
      y: height - 50,
      targetScene: 'MainMenuScene',
      text: 'BACK',
      backgroundColor: 0x555555,
      hoverColor: 0x666666,
      fontSize: '18px',
    })
  }
}
