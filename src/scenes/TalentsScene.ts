import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { talentManager, SpinResult } from '../systems/TalentManager'
import { currencyManager } from '../systems/CurrencyManager'
import {
  TalentId,
  TalentTier,
  Talent,
  TALENTS,
  TIER_NAMES,
} from '../config/talentData'
import { ScrollContainer } from '../ui/components/ScrollContainer'
import { createBackButton } from '../ui/components/BackButton'

/**
 * TalentsScene - UI for the talent lottery system
 *
 * Features:
 * - Spin button to perform lottery spins
 * - Display of all talents with their current levels
 * - Total bonus display at bottom
 * - Spin animation with visual feedback
 *
 * Refactored to use reusable UI components from src/ui/components
 */
export default class TalentsScene extends Phaser.Scene {
  // UI Elements
  private spinButton?: Phaser.GameObjects.Container
  private spinCostText?: Phaser.GameObjects.Text
  private spinsRemainingText?: Phaser.GameObjects.Text
  private goldText?: Phaser.GameObjects.Text
  private talentCards: Map<TalentId, Phaser.GameObjects.Container> = new Map()
  private bonusTexts: Phaser.GameObjects.Text[] = []

  // Scroll container (using reusable component)
  private scrollContainer?: ScrollContainer
  private scrollBounds = { top: 140, bottom: 557 }

  // Animation state
  private isSpinning: boolean = false

  // Tier colors from requirements
  private readonly TIER_DISPLAY_COLORS: Record<TalentTier, string> = {
    [TalentTier.COMMON]: '#888888',
    [TalentTier.RARE]: '#0066FF',
    [TalentTier.EPIC]: '#AA00FF',
  }

  constructor() {
    super({ key: 'TalentsScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header
    this.createHeader(width)

    // Spin section
    this.createSpinSection(width)

    // Talent grid
    this.createTalentGrid(width, height)

    // Bonus display at bottom
    this.createBonusDisplay(width, height)

    // Back button using reusable component
    createBackButton({
      scene: this,
      x: width / 2,
      y: height - 25,
      targetScene: 'MainMenuScene',
    })

    // Initial update
    this.updateUI()
  }

  private createHeader(width: number) {
    // Title
    this.add
      .text(width / 2, 30, 'TALENTS', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Gold display (top right)
    this.goldText = this.add
      .text(width - 15, 30, `Gold: ${currencyManager.get('gold')}`, {
        fontSize: '14px',
        color: '#FFD700',
      })
      .setOrigin(1, 0.5)
  }

  private createSpinSection(width: number) {
    const spinY = 85

    // Spin button container
    this.spinButton = this.add.container(width / 2, spinY)

    // Button background
    const buttonBg = this.add.rectangle(0, 0, 160, 50, 0x4a9eff)
    buttonBg.setStrokeStyle(2, 0x6bb6ff)
    buttonBg.setInteractive({ useHandCursor: true })

    // Button text
    const buttonText = this.add
      .text(0, -5, 'SPIN', {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Cost text (below SPIN)
    this.spinCostText = this.add
      .text(0, 15, '', {
        fontSize: '12px',
        color: '#FFD700',
      })
      .setOrigin(0.5)

    this.spinButton.add([buttonBg, buttonText, this.spinCostText])

    // Hover effects
    buttonBg.on('pointerover', () => {
      if (!this.isSpinning) {
        buttonBg.setFillStyle(0x6bb6ff)
      }
    })

    buttonBg.on('pointerout', () => {
      if (!this.isSpinning) {
        buttonBg.setFillStyle(0x4a9eff)
      }
    })

    // Click handler
    buttonBg.on('pointerdown', () => {
      if (!this.isSpinning) {
        this.performSpin()
      }
    })

    // Spins remaining text
    this.spinsRemainingText = this.add
      .text(width / 2, spinY + 40, '', {
        fontSize: '12px',
        color: '#888888',
      })
      .setOrigin(0.5)
  }

  private createTalentGrid(width: number, _height: number) {
    const cardHeight = 45
    const cardSpacing = 52
    const cardWidth = width - 30
    const cardX = width / 2

    // Create scroll container using reusable component
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width,
      bounds: this.scrollBounds,
    })

    // Group talents by tier for display
    const talentsByTier: Record<TalentTier, Talent[]> = {
      [TalentTier.COMMON]: [],
      [TalentTier.RARE]: [],
      [TalentTier.EPIC]: [],
    }

    Object.values(TALENTS).forEach((talent) => {
      talentsByTier[talent.tier].push(talent)
    })

    // Content starts at the top of scroll area (relative to scroll bounds)
    let currentY = this.scrollBounds.top + 10
    const tiers = [TalentTier.COMMON, TalentTier.RARE, TalentTier.EPIC]

    tiers.forEach((tier) => {
      // Tier header - add to scroll container
      const tierColor = this.TIER_DISPLAY_COLORS[tier]
      const tierHeader = this.add
        .text(15, currentY, TIER_NAMES[tier].toUpperCase(), {
          fontSize: '11px',
          color: tierColor,
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
      this.scrollContainer!.add(tierHeader)

      currentY += 18

      // Talent cards for this tier - add to scroll container
      talentsByTier[tier].forEach((talent) => {
        const card = this.createTalentCard(
          cardX,
          currentY,
          cardWidth,
          cardHeight,
          talent
        )
        this.scrollContainer!.add(card)
        this.talentCards.set(talent.id, card)
        currentY += cardSpacing
      })

      currentY += 5 // Extra spacing between tiers
    })

    // Set content height for scroll calculations
    const contentHeight = currentY - this.scrollBounds.top + 10
    this.scrollContainer.setContentHeight(contentHeight)
  }

  private createTalentCard(
    x: number,
    y: number,
    width: number,
    height: number,
    talent: Talent
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]
    const tierColorNum = parseInt(tierColor.replace('#', ''), 16)

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0x2a2a3e)
    bg.setStrokeStyle(1, tierColorNum)

    // Talent name
    const nameText = this.add
      .text(-width / 2 + 10, -8, talent.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)

    // Level display (right side)
    const level = talentManager.getTalentLevel(talent.id)
    const levelText = this.add
      .text(width / 2 - 10, -8, `Lv.${level}/${talent.maxLevel}`, {
        fontSize: '12px',
        color: level > 0 ? tierColor : '#555555',
      })
      .setOrigin(1, 0.5)
    levelText.setData('levelText', true)

    // Description
    const descText = this.add
      .text(-width / 2 + 10, 10, talent.description, {
        fontSize: '10px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)

    // Current bonus value (right side, below level)
    const bonusValue = talentManager.getTalentBonus(talent.id)
    const bonusText = this.add
      .text(width / 2 - 10, 10, bonusValue > 0 ? `+${bonusValue}` : '-', {
        fontSize: '10px',
        color: bonusValue > 0 ? '#44ff44' : '#555555',
      })
      .setOrigin(1, 0.5)
    bonusText.setData('bonusText', true)

    container.add([bg, nameText, levelText, descText, bonusText])
    return container
  }

  private createBonusDisplay(width: number, height: number) {
    const bonusY = height - 90
    const bonuses = talentManager.calculateTotalBonuses()

    // Background panel
    this.add.rectangle(width / 2, bonusY + 20, width - 20, 70, 0x2a2a3e, 0.8)

    // Title
    this.add
      .text(width / 2, bonusY - 10, 'TOTAL BONUSES', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0.5)

    // Bonus values in two columns
    const leftX = 25
    const rightX = width / 2 + 15
    const col1Y = bonusY + 10
    const lineHeight = 14

    const bonusItems = [
      { label: 'HP', value: bonuses.flatHp, suffix: '' },
      { label: 'Attack', value: bonuses.flatAttack, suffix: '' },
      { label: 'Dmg Reduction', value: bonuses.percentDamageReduction, suffix: '%' },
      { label: 'Atk Speed', value: bonuses.percentAttackSpeed, suffix: '%' },
      { label: 'Crit Chance', value: bonuses.percentCritChance, suffix: '%' },
      { label: 'Equip Bonus', value: bonuses.percentEquipmentStats, suffix: '%' },
    ]

    this.bonusTexts = []

    bonusItems.forEach((item, index) => {
      const col = index < 3 ? leftX : rightX
      const row = index < 3 ? index : index - 3
      const y = col1Y + row * lineHeight

      const text = this.add
        .text(col, y, `${item.label}: +${item.value}${item.suffix}`, {
          fontSize: '11px',
          color: item.value > 0 ? '#44ff44' : '#555555',
        })
        .setOrigin(0, 0.5)

      this.bonusTexts.push(text)
    })
  }

  private performSpin() {
    const cost = talentManager.getSpinCost()
    const canAfford = currencyManager.canAfford('gold', cost)
    const canSpin = talentManager.canSpin()

    if (!canAfford) {
      // Play error sound or show message
      this.showMessage('Not enough gold!', '#ff4444')
      return
    }

    if (!canSpin) {
      // Check which condition failed
      if (talentManager.areAllTalentsMaxed()) {
        this.showMessage('All talents maxed!', '#ff4444')
      } else {
        this.showMessage('Daily limit reached!', '#ff4444')
      }
      return
    }

    // Start spin animation
    this.isSpinning = true
    this.updateSpinButtonState()

    // Play sound
    audioManager.playMenuSelect()

    // Animate the spin effect
    this.playSpinAnimation(() => {
      // Perform the actual spin
      const result = talentManager.spin(currencyManager.get('gold'), (amount) =>
        currencyManager.spend('gold', amount)
      )

      this.handleSpinResult(result)
    })
  }

  private playSpinAnimation(onComplete: () => void) {
    // Create spinning indicator
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Overlay
    const overlay = this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.7
    )
    overlay.setDepth(100)

    // Spinning symbols
    const symbols = ['?', '!', '*', '+', '#', '@']
    const spinText = this.add
      .text(width / 2, height / 2, '?', {
        fontSize: '64px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(101)

    // Animate symbol changes
    let symbolIndex = 0
    const spinInterval = this.time.addEvent({
      delay: 80,
      repeat: 15,
      callback: () => {
        symbolIndex = (symbolIndex + 1) % symbols.length
        spinText.setText(symbols[symbolIndex])

        // Cycle through colors
        const colors = ['#ffffff', '#FFD700', '#0066FF', '#AA00FF', '#44ff44']
        spinText.setColor(colors[symbolIndex % colors.length])
      },
    })

    // Complete animation
    this.time.delayedCall(1300, () => {
      spinInterval.destroy()
      overlay.destroy()
      spinText.destroy()
      onComplete()
    })
  }

  private handleSpinResult(result: SpinResult) {
    this.isSpinning = false
    this.updateSpinButtonState()

    if (result.success && result.talent) {
      // Show result animation
      this.showTalentResult(result.talent, result.newLevel || 1)

      // Play success sound
      audioManager.playLevelUp()

      // Highlight the talent card
      this.highlightTalentCard(result.talent.id)

      // Update all UI
      this.updateUI()
    } else if (result.error) {
      this.showMessage(result.error, '#ff4444')
    }
  }

  private showTalentResult(talent: Talent, newLevel: number) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]

    // Result popup
    const popup = this.add.container(width / 2, height / 2 - 50)
    popup.setDepth(100)

    // Background
    const bg = this.add.rectangle(0, 0, 280, 120, 0x1a1a2e)
    bg.setStrokeStyle(3, parseInt(tierColor.replace('#', ''), 16))

    // Tier label
    const tierLabel = this.add
      .text(0, -40, TIER_NAMES[talent.tier].toUpperCase(), {
        fontSize: '12px',
        color: tierColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Talent name
    const nameText = this.add
      .text(0, -15, talent.name, {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Level
    const levelText = this.add
      .text(0, 15, `Level ${newLevel}/${talent.maxLevel}`, {
        fontSize: '16px',
        color: tierColor,
      })
      .setOrigin(0.5)

    // Bonus gained
    const bonusText = this.add
      .text(0, 40, `+${talent.effectPerLevel} ${this.getEffectLabel(talent)}`, {
        fontSize: '14px',
        color: '#44ff44',
      })
      .setOrigin(0.5)

    popup.add([bg, tierLabel, nameText, levelText, bonusText])

    // Animate in
    popup.setScale(0.5)
    popup.setAlpha(0)

    this.tweens.add({
      targets: popup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    // Fade out after delay
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: popup,
        alpha: 0,
        y: popup.y - 30,
        duration: 300,
        onComplete: () => popup.destroy(),
      })
    })
  }

  private getEffectLabel(talent: Talent): string {
    switch (talent.effectType) {
      case 'flat_hp':
        return 'HP'
      case 'flat_attack':
        return 'Attack'
      case 'percent_damage_reduction':
        return '% Damage Reduction'
      case 'percent_attack_speed':
        return '% Attack Speed'
      case 'flat_heal_on_level':
        return ' HP on Level-Up'
      case 'percent_crit_chance':
        return '% Crit Chance'
      case 'percent_equipment_stats':
        return '% Equipment Stats'
      case 'starting_abilities':
        return ' Starting Ability'
      case 'percent_hp_when_low':
        return '% HP when Low'
      default:
        return ''
    }
  }

  private highlightTalentCard(talentId: TalentId) {
    const card = this.talentCards.get(talentId)
    if (!card) return

    // Flash animation
    this.tweens.add({
      targets: card,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 150,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })
  }

  private showMessage(text: string, color: string) {
    const width = this.cameras.main.width

    const message = this.add
      .text(width / 2, 130, text, {
        fontSize: '14px',
        color: color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(50)

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 20,
      duration: 1000,
      delay: 500,
      onComplete: () => message.destroy(),
    })
  }

  private updateUI() {
    // Update gold display
    if (this.goldText) {
      this.goldText.setText(`Gold: ${currencyManager.get('gold')}`)
    }

    // Update spin cost
    if (this.spinCostText) {
      const cost = talentManager.getSpinCost()
      this.spinCostText.setText(`Cost: ${cost}`)
    }

    // Update spins remaining
    if (this.spinsRemainingText) {
      const remaining = talentManager.getSpinsRemaining()
      const max = talentManager.getMaxDailySpins()
      this.spinsRemainingText.setText(`Spins today: ${max - remaining}/${max}`)
    }

    // Update talent cards
    this.talentCards.forEach((card, talentId) => {
      const talent = TALENTS[talentId]
      const level = talentManager.getTalentLevel(talentId)
      const bonus = talentManager.getTalentBonus(talentId)
      const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]

      // Update level text
      card.list.forEach((child) => {
        if (child instanceof Phaser.GameObjects.Text) {
          if (child.getData('levelText')) {
            child.setText(`Lv.${level}/${talent.maxLevel}`)
            child.setColor(level > 0 ? tierColor : '#555555')
          }
          if (child.getData('bonusText')) {
            child.setText(bonus > 0 ? `+${bonus}` : '-')
            child.setColor(bonus > 0 ? '#44ff44' : '#555555')
          }
        }
      })
    })

    // Update bonus display
    const bonuses = talentManager.calculateTotalBonuses()
    const bonusValues = [
      bonuses.flatHp,
      bonuses.flatAttack,
      bonuses.percentDamageReduction,
      bonuses.percentAttackSpeed,
      bonuses.percentCritChance,
      bonuses.percentEquipmentStats,
    ]
    const suffixes = ['', '', '%', '%', '%', '%']
    const labels = [
      'HP',
      'Attack',
      'Dmg Reduction',
      'Atk Speed',
      'Crit Chance',
      'Equip Bonus',
    ]

    this.bonusTexts.forEach((text, index) => {
      const value = bonusValues[index]
      // Round to 1 decimal place, show as integer if whole number
      const rounded = Math.round(value * 10) / 10
      const displayValue = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
      text.setText(`${labels[index]}: +${displayValue}${suffixes[index]}`)
      text.setColor(value > 0 ? '#44ff44' : '#555555')
    })

    this.updateSpinButtonState()
  }

  private updateSpinButtonState() {
    if (!this.spinButton) return

    const cost = talentManager.getSpinCost()
    const canAfford = currencyManager.canAfford('gold', cost)
    const canSpin = talentManager.canSpin()
    const isEnabled = canAfford && canSpin && !this.isSpinning

    // Update button appearance
    const bg = this.spinButton.list[0] as Phaser.GameObjects.Rectangle
    if (bg) {
      if (this.isSpinning) {
        bg.setFillStyle(0x666666)
      } else if (!isEnabled) {
        bg.setFillStyle(0x444444)
      } else {
        bg.setFillStyle(0x4a9eff)
      }
    }

    // Update cost text color
    if (this.spinCostText) {
      this.spinCostText.setColor(canAfford ? '#FFD700' : '#ff4444')
    }
  }
}
