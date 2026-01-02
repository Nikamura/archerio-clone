import Phaser from 'phaser'
import { heroManager } from '../systems/HeroManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import { HERO_DEFINITIONS, HERO_MAX_LEVEL, getHeroXPThreshold, type HeroId } from '../config/heroData'
import type { HeroState } from '../systems/Hero'

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
    const selectedHeroId = heroManager.getSelectedHeroId()
    const heroIds = heroManager.getAllHeroStates().map(h => h.id)
    const cardHeight = 140
    const cardSpacing = 15
    const startY = 120

    heroIds.forEach((heroId, index) => {
      const heroState = heroManager.getHeroState(heroId as HeroId)
      const isSelected = heroId === selectedHeroId
      const yPos = startY + index * (cardHeight + cardSpacing)

      const card = this.createHeroCard(
        width / 2,
        yPos,
        heroState,
        isSelected
      )
      this.heroCards.push(card)
    })
  }

  private createHeroCard(
    x: number,
    y: number,
    heroState: HeroState,
    isSelected: boolean
  ): Phaser.GameObjects.Container {
    const cardWidth = 340
    const cardHeight = 130
    const isUnlocked = heroState.isUnlocked

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
    
    // Use the icon from HERO_DEFINITIONS
    const heroDef = HERO_DEFINITIONS[heroState.id as HeroId]
    
    // In PreloaderScene icons are named differently (heroAtreus vs hero_atreus)
    // Let's normalize to what's in PreloaderScene
    const preloaderIconKey = 'hero' + heroDef.id.charAt(0).toUpperCase() + heroDef.id.slice(1)
    
    const heroIcon = this.add.image(iconX, iconY, preloaderIconKey)
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
      .text(-cardWidth / 2 + textOffsetX, -cardHeight / 2 + 12, heroState.name, {
        fontSize: '20px',
        color: isUnlocked ? '#ffffff' : '#888888',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0)
    container.add(nameText)

    // Level indicator with XP progress (if unlocked)
    if (isUnlocked) {
      const levelText = this.add
        .text(-cardWidth / 2 + textOffsetX, -cardHeight / 2 + 36, `Lv.${heroState.level}`, {
          fontSize: '12px',
          color: '#aaaaaa',
        })
        .setOrigin(0, 0)
      container.add(levelText)

      // XP progress bar (only if not max level)
      const isMaxLevel = heroState.level >= HERO_MAX_LEVEL
      if (!isMaxLevel) {
        const xpBarWidth = 80
        const xpBarHeight = 6
        const xpBarX = -cardWidth / 2 + textOffsetX + 45
        const xpBarY = -cardHeight / 2 + 42

        // XP bar background
        const xpBarBg = this.add.rectangle(xpBarX, xpBarY, xpBarWidth, xpBarHeight, 0x333333)
        xpBarBg.setOrigin(0, 0.5)
        container.add(xpBarBg)

        // XP bar fill
        const currentXP = heroState.xp
        const xpThreshold = getHeroXPThreshold(heroState.level)
        const xpPercent = Math.min(currentXP / xpThreshold, 1)
        const xpBarFill = this.add.rectangle(
          xpBarX,
          xpBarY,
          xpBarWidth * xpPercent,
          xpBarHeight,
          0x88ccff
        )
        xpBarFill.setOrigin(0, 0.5)
        container.add(xpBarFill)

        // XP text
        const xpText = this.add
          .text(xpBarX + xpBarWidth + 5, xpBarY, `${currentXP}/${xpThreshold}`, {
            fontSize: '9px',
            color: '#888888',
          })
          .setOrigin(0, 0.5)
        container.add(xpText)
      } else {
        // Max level indicator
        const maxText = this.add
          .text(-cardWidth / 2 + textOffsetX + 45, -cardHeight / 2 + 42, 'MAX', {
            fontSize: '10px',
            color: '#ffdd00',
            fontStyle: 'bold',
          })
          .setOrigin(0, 0.5)
        container.add(maxText)
      }
    }

    // Passive ability description
    const passiveText = this.add
      .text(-cardWidth / 2 + textOffsetX, -cardHeight / 2 + 52, heroDef.ability.description, {
        fontSize: '11px',
        color: '#88cc88',
        wordWrap: { width: cardWidth - textOffsetX - 20 },
      })
      .setOrigin(0, 0)
    container.add(passiveText)

    // Stats display
    const stats = heroState.computedStats
    const statsY = -cardHeight / 2 + 75
    const statsText = this.add
      .text(
        -cardWidth / 2 + 15,
        statsY,
        `ATK: ${stats.attack}  HP: ${stats.maxHealth}  SPD: ${stats.attackSpeed}`,
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
        `CRIT: ${Math.round(stats.critChance * 100)}%  CRIT DMG: ${Math.round(stats.critDamage * 100)}%`,
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
          () => this.selectHero(heroState.id)
        )
        container.add(selectBtn)
      }
    } else {
      // Unlock button with cost
      const unlockInfo = heroManager.getUnlockCost(heroState.id)
      const canAfford = heroManager.canUnlock(heroState.id)
      const btnColor = canAfford ? '#6b8e23' : '#555555'
      const unlockBtn = this.createButton(
        cardWidth / 2 - 70,
        cardHeight / 2 - 25,
        `${unlockInfo.cost} ${unlockInfo.currency.toUpperCase()}`,
        btnColor,
        () => this.unlockHero(heroState.id)
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
    const success = heroManager.select(heroId as HeroId)
    if (success) {
      audioManager.playAbilitySelect()
      // Refresh the scene to show updated selection
      this.scene.restart()
    }
  }

  private unlockHero(heroId: string): void {
    const canAfford = heroManager.canUnlock(heroId as HeroId)
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
    const success = heroManager.unlock(heroId as HeroId)
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
