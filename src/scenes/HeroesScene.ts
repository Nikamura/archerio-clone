import Phaser from 'phaser'
import { heroManager } from '../systems/HeroManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import { equipmentManager } from '../systems/EquipmentManager'
import { talentManager } from '../systems/TalentManager'
import { HERO_DEFINITIONS, HERO_MAX_LEVEL, getHeroXPThreshold, type HeroId } from '../config/heroData'
import type { HeroState } from '../systems/Hero'
import { createBackButton } from '../ui/components/BackButton'
import * as UIAnimations from '../systems/UIAnimations'

/**
 * HeroesScene - Displays hero selection and unlock interface
 */
export default class HeroesScene extends Phaser.Scene {
  private heroCards: Phaser.GameObjects.Container[] = []
  private goldText?: Phaser.GameObjects.Text
  private statsPanel?: Phaser.GameObjects.Container

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

    // Stats button (top-right)
    const statsBtn = this.add.container(width - 50, 35)
    const statsBg = this.add.rectangle(0, 0, 70, 30, 0x4a6fa5)
    statsBg.setStrokeStyle(1, 0x6b9fff)
    statsBg.setInteractive({ useHandCursor: true })
    const statsText = this.add.text(0, 0, 'STATS', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    statsBtn.add([statsBg, statsText])

    statsBg.on('pointerover', () => statsBg.setFillStyle(0x5a7fb5))
    statsBg.on('pointerout', () => statsBg.setFillStyle(0x4a6fa5))
    statsBg.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.showStatsPanel()
    })
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

  // ============================================
  // Stats Summary Panel
  // ============================================

  private showStatsPanel(): void {
    if (this.statsPanel) return

    const { width, height } = this.cameras.main
    this.statsPanel = this.add.container(width / 2, height / 2)
    this.statsPanel.setDepth(100)

    // Backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.8)
    backdrop.setInteractive()
    backdrop.on('pointerdown', () => this.hideStatsPanel())
    this.statsPanel.add(backdrop)

    // Panel
    const panelWidth = width - 30
    const panelHeight = 480
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x2a2a40, 1)
    panel.setStrokeStyle(2, 0x4a4a6a)
    this.statsPanel.add(panel)

    // Title
    const title = this.add.text(0, -panelHeight / 2 + 20, 'STATS SUMMARY', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.statsPanel.add(title)

    // Subtitle explaining base stats
    const subtitle = this.add.text(0, -panelHeight / 2 + 40, 'Base stats before chapter/weapon modifiers', {
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5)
    this.statsPanel.add(subtitle)

    // Get stats from all sources
    const heroStats = heroManager.getSelectedHeroStats()
    const equipStats = equipmentManager.getEquippedStats()
    const talentBonuses = talentManager.calculateTotalBonuses()

    // Equipment stat multiplier from talents
    const equipMultiplier = 1 + (talentBonuses.percentEquipmentStats / 100)

    let y = -panelHeight / 2 + 60

    // Section: Attack
    y = this.addStatSection(y, panelWidth, 'ATTACK', [
      {
        label: 'Attack Damage',
        hero: heroStats.attack,
        equip: (equipStats.attackDamage ?? 0) * equipMultiplier,
        talent: talentBonuses.flatAttack,
        percent: equipStats.attackDamagePercent,
      },
      {
        label: 'Attack Speed',
        hero: heroStats.attackSpeed,
        equip: (equipStats.attackSpeed ?? 0) * equipMultiplier,
        talent: 0,
        percent: (equipStats.attackSpeedPercent ?? 0) + (talentBonuses.percentAttackSpeed / 100),
        decimals: 2,
      },
      {
        label: 'Crit Chance',
        hero: heroStats.critChance * 100,
        equip: ((equipStats.critChance ?? 0) * equipMultiplier) * 100,
        talent: talentBonuses.percentCritChance,
        suffix: '%',
      },
      {
        label: 'Crit Damage',
        hero: heroStats.critDamage * 100,
        equip: ((equipStats.critDamage ?? 0) * equipMultiplier) * 100,
        suffix: '%',
      },
    ])

    // Section: Defense
    y = this.addStatSection(y + 10, panelWidth, 'DEFENSE', [
      {
        label: 'Max Health',
        hero: heroStats.maxHealth,
        equip: (equipStats.maxHealth ?? 0) * equipMultiplier,
        talent: talentBonuses.flatHp,
        percent: equipStats.maxHealthPercent,
      },
      {
        label: 'Damage Reduction',
        hero: 0,
        equip: (equipStats.damageReduction ?? 0) * equipMultiplier,
        talent: 0,
        percent: (equipStats.damageReductionPercent ?? 0) + (talentBonuses.percentDamageReduction / 100),
      },
      {
        label: 'Dodge Chance',
        hero: 0,
        equip: Math.min(3, ((equipStats.dodgeChance ?? 0) * equipMultiplier) * 100),
        suffix: '%',
        note: '(max 3%)',
      },
    ])

    // Section: Utility
    y = this.addStatSection(y + 10, panelWidth, 'UTILITY', [
      {
        label: 'Bonus XP',
        hero: 0,
        equip: ((equipStats.bonusXPPercent ?? 0) * equipMultiplier) * 100,
        suffix: '%',
      },
      {
        label: 'Gold Bonus',
        hero: 0,
        equip: ((equipStats.goldBonusPercent ?? 0) * equipMultiplier) * 100,
        suffix: '%',
      },
    ])

    // Talent Equipment Bonus note
    if (talentBonuses.percentEquipmentStats > 0) {
      const noteText = this.add.text(0, y + 25, `* Equipment stats boosted by ${talentBonuses.percentEquipmentStats}% from talents`, {
        fontSize: '10px',
        color: '#88cc88',
      }).setOrigin(0.5)
      this.statsPanel.add(noteText)
    }

    // Close hint
    const closeHint = this.add.text(0, panelHeight / 2 - 25, 'TAP TO CLOSE', {
      fontSize: '11px',
      color: '#888888',
    }).setOrigin(0.5)
    this.statsPanel.add(closeHint)

    // Animate in
    UIAnimations.showModal(this, this.statsPanel)
  }

  private addStatSection(
    startY: number,
    panelWidth: number,
    sectionTitle: string,
    stats: Array<{
      label: string
      hero: number
      equip?: number
      talent?: number
      percent?: number
      suffix?: string
      note?: string
      decimals?: number
    }>
  ): number {
    if (!this.statsPanel) return startY

    const leftX = -panelWidth / 2 + 15
    let y = startY

    // Section header
    const header = this.add.text(leftX, y, sectionTitle, {
      fontSize: '12px',
      color: '#ffdd00',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5)
    this.statsPanel.add(header)
    y += 18

    // Stats rows
    for (const stat of stats) {
      const decimals = stat.decimals ?? 0
      const suffix = stat.suffix ?? ''
      const hero = stat.hero
      const equip = stat.equip ?? 0
      const talent = stat.talent ?? 0
      const percent = stat.percent ?? 0

      // Calculate total
      const baseTotal = hero + equip + talent
      const total = baseTotal * (1 + percent)

      // Format total
      const totalStr = decimals > 0 ? total.toFixed(decimals) : Math.round(total).toString()

      // Row: Label
      const labelText = this.add.text(leftX, y, stat.label, {
        fontSize: '11px',
        color: '#aaaaaa',
      }).setOrigin(0, 0.5)
      this.statsPanel.add(labelText)

      // Row: Total value
      const totalText = this.add.text(leftX + 100, y, `${totalStr}${suffix}`, {
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0, 0.5)
      this.statsPanel.add(totalText)

      // Row: Breakdown
      const parts: string[] = []
      if (hero > 0) parts.push(`H:${decimals > 0 ? hero.toFixed(decimals) : Math.round(hero)}`)
      if (equip > 0) parts.push(`E:${decimals > 0 ? equip.toFixed(decimals) : Math.round(equip)}`)
      if (talent > 0) parts.push(`T:${Math.round(talent)}`)
      if (percent > 0) parts.push(`+${Math.round(percent * 100)}%`)

      const breakdownStr = parts.length > 0 ? `(${parts.join(' + ')})` : ''
      const breakdownText = this.add.text(leftX + 150, y, breakdownStr + (stat.note ?? ''), {
        fontSize: '9px',
        color: '#666666',
      }).setOrigin(0, 0.5)
      this.statsPanel.add(breakdownText)

      y += 16
    }

    return y
  }

  private hideStatsPanel(): void {
    if (!this.statsPanel) return

    audioManager.playMenuSelect()
    UIAnimations.hideModal(this, this.statsPanel, UIAnimations.DURATION.FAST, () => {
      if (this.statsPanel) {
        this.statsPanel.destroy()
        this.statsPanel = undefined
      }
    })
  }
}
