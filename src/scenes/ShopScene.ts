import Phaser from 'phaser'
import { themeManager } from '../systems/ThemeManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import { type ThemeId, THEME_DEFINITIONS } from '../config/themeData'
import { createBackButton } from '../ui/components/BackButton'

/**
 * ShopScene - Displays theme selection and unlock interface
 */
export default class ShopScene extends Phaser.Scene {
  private themeCards: Phaser.GameObjects.Container[] = []
  private goldText?: Phaser.GameObjects.Text
  private scrollContainer?: Phaser.GameObjects.Container
  private scrollY = 0
  private maxScroll = 0
  private isDragging = false
  private dragStartY = 0
  private dragStartScrollY = 0

  constructor() {
    super({ key: 'ShopScene' })
  }

  create(data?: { scrollY?: number }) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Restore scroll state if provided, otherwise reset
    this.scrollY = data?.scrollY ?? 0
    this.themeCards = []

    // Dark semi-transparent background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e, 0.98)

    // Header section (fixed)
    this.createHeader(width)

    // Theme cards (scrollable)
    this.createScrollableThemeCards(width, height)

    // Back button (fixed)
    this.createBackButton(width, height)

    // Setup scroll input
    this.setupScrollInput(width, height)

    // Apply restored scroll position
    this.updateScrollPosition()
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
    const scrollAreaHeight = scrollAreaBottom - scrollAreaTop

    // Create scroll container
    this.scrollContainer = this.add.container(0, 0)

    // Create mask for scroll area
    const maskGraphics = this.make.graphics({ x: 0, y: 0 })
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(0, scrollAreaTop, width, scrollAreaHeight)
    const mask = maskGraphics.createGeometryMask()
    this.scrollContainer.setMask(mask)

    // Calculate total content height
    const totalContentHeight = themeStates.length * (cardHeight + cardSpacing)
    this.maxScroll = Math.max(0, totalContentHeight - scrollAreaHeight + 20)

    // Create theme cards inside scroll container
    themeStates.forEach((state, index) => {
      const yPos = scrollAreaTop + 10 + index * (cardHeight + cardSpacing) + cardHeight / 2
      const card = this.createThemeCard(width / 2, yPos, state)
      this.scrollContainer!.add(card)
      this.themeCards.push(card)
    })
  }

  private setupScrollInput(_width: number, height: number): void {
    const scrollAreaTop = 120
    const scrollAreaBottom = height - 80

    // Mouse wheel scrolling (works without blocking buttons)
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScroll)
      this.updateScrollPosition()
    })

    // Touch/drag scrolling using scene-level input (doesn't block buttons)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only start drag if in scroll area
      if (pointer.y >= scrollAreaTop && pointer.y <= scrollAreaBottom) {
        this.isDragging = true
        this.dragStartY = pointer.y
        this.dragStartScrollY = this.scrollY
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const deltaY = this.dragStartY - pointer.y
        this.scrollY = Phaser.Math.Clamp(this.dragStartScrollY + deltaY, 0, this.maxScroll)
        this.updateScrollPosition()
      }
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
    })

    this.input.on('pointerupoutside', () => {
      this.isDragging = false
    })
  }

  private updateScrollPosition(): void {
    if (this.scrollContainer) {
      this.scrollContainer.y = -this.scrollY
    }
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
      this.scene.restart({ scrollY: this.scrollY })
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
      this.scene.restart({ scrollY: this.scrollY })
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
