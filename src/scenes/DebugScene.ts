import Phaser from 'phaser'
import { debugManager, DebugSettings } from '../systems/DebugManager'
import { ABILITIES } from '../config/abilityData'
import { ChapterId, ROOMS_PER_CHAPTER } from '../config/chapterData'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import { createBackButton } from '../ui/components/BackButton'
import { ScrollContainer } from '../ui/components/ScrollContainer'

/**
 * DebugScene - Comprehensive debug settings page
 *
 * Provides extensive debugging options for testing:
 * - Energy bypass
 * - Chapter/room selection
 * - Starting abilities
 * - Player/enemy modifiers
 * - Wall layout forcing
 * - XP/Gold multipliers
 */
export default class DebugScene extends Phaser.Scene {
  private scrollContainer?: ScrollContainer
  private settings!: DebugSettings

  constructor() {
    super({ key: 'DebugScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Load current settings
    this.settings = debugManager.getSettings()

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a14)

    // Header
    this.createHeader(width)

    // Settings (scrollable)
    this.createSettingsList(width, height)

    // Back button (fixed at bottom)
    this.createBackButton(width, height)
  }

  private createHeader(width: number) {
    // Warning header
    const headerBg = this.add.rectangle(width / 2, 35, width, 70, 0x220808)
    headerBg.setStrokeStyle(2, 0xff6600)

    this.add
      .text(width / 2, 25, 'DEBUG SETTINGS', {
        fontSize: '22px',
        color: '#ff6600',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, 50, 'Changes apply to next game start', {
        fontSize: '11px',
        color: '#ffaa00',
      })
      .setOrigin(0.5)
  }

  private createSettingsList(width: number, height: number) {
    const headerHeight = 75
    const footerHeight = 80
    const contentStartY = headerHeight
    const scrollAreaBottom = height - footerHeight

    // Create scroll container
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width: width,
      bounds: { top: contentStartY, bottom: scrollAreaBottom },
    })

    let currentY = contentStartY + 15

    // === QUICK ACTIONS SECTION ===
    currentY = this.createSectionHeader(width, currentY, 'QUICK ACTIONS')
    currentY += 10

    currentY = this.createToggleSetting(width, currentY, 'Bypass Energy', 'Start games without spending energy', 'bypassEnergy')
    currentY = this.createToggleSetting(width, currentY, 'Invincible', 'Take no damage', 'invincible')
    currentY = this.createToggleSetting(width, currentY, 'One-Shot Enemies', 'Kill enemies in one hit', 'oneShotEnemies')
    currentY = this.createToggleSetting(width, currentY, 'Skip to Boss', 'Start at boss room (20)', 'skipToBoss')
    currentY = this.createToggleSetting(width, currentY, 'Show Hitboxes', 'Display collision hitboxes', 'showHitboxes')
    currentY = this.createToggleSetting(width, currentY, 'Disable Spawns', 'No enemies spawn', 'disableEnemySpawns')
    currentY += 20

    // === QUICK CURRENCY BUTTONS ===
    currentY = this.createSectionHeader(width, currentY, 'QUICK CURRENCY')
    currentY += 10
    currentY = this.createCurrencyButtons(width, currentY)
    currentY += 20

    // === CHAPTER/ROOM SELECTION ===
    currentY = this.createSectionHeader(width, currentY, 'CHAPTER & ROOM')
    currentY += 10
    currentY = this.createChapterSelector(width, currentY)
    currentY += 10
    currentY = this.createRoomSelector(width, currentY)
    currentY += 20

    // === PLAYER MODIFIERS ===
    currentY = this.createSectionHeader(width, currentY, 'PLAYER MODIFIERS')
    currentY += 10
    currentY = this.createSliderSetting(width, currentY, 'Damage Multiplier', 'playerDamageMultiplier', 0.1, 10, 0.1)
    currentY = this.createSliderSetting(width, currentY, 'Speed Multiplier', 'playerSpeedMultiplier', 0.5, 3, 0.1)
    currentY = this.createSliderSetting(width, currentY, 'Starting Health', 'startingHealthMultiplier', 0.5, 10, 0.5)
    currentY += 20

    // === ENEMY MODIFIERS ===
    currentY = this.createSectionHeader(width, currentY, 'ENEMY MODIFIERS')
    currentY += 10
    currentY = this.createSliderSetting(width, currentY, 'Enemy Health', 'enemyHealthMultiplier', 0.1, 5, 0.1)
    currentY = this.createSliderSetting(width, currentY, 'Enemy Damage', 'enemyDamageMultiplier', 0.1, 5, 0.1)
    currentY += 20

    // === XP & GOLD ===
    currentY = this.createSectionHeader(width, currentY, 'XP & GOLD')
    currentY += 10
    currentY = this.createSliderSetting(width, currentY, 'XP Multiplier', 'xpMultiplier', 1, 20, 1)
    currentY = this.createSliderSetting(width, currentY, 'Gold Multiplier', 'goldMultiplier', 1, 20, 1)
    currentY = this.createSliderSetting(width, currentY, 'Auto Level Up (sec)', 'autoLevelUpInterval', 0, 30, 1)
    currentY += 20

    // === WALL LAYOUT ===
    currentY = this.createSectionHeader(width, currentY, 'WALL LAYOUT')
    currentY += 10
    currentY = this.createLayoutCategorySelector(width, currentY)
    currentY += 10
    currentY = this.createLayoutSelector(width, currentY)
    currentY += 20

    // === STARTING ABILITIES ===
    currentY = this.createSectionHeader(width, currentY, 'STARTING ABILITIES')
    currentY += 10
    currentY = this.createAbilitySelector(width, currentY)
    currentY += 30

    // === RESET SECTION ===
    currentY = this.createResetSection(width, currentY)
    currentY += 40

    // Set content height for scroll
    const contentHeight = currentY - contentStartY + 20
    this.scrollContainer.setContentHeight(contentHeight)
  }

  private createSectionHeader(width: number, y: number, title: string): number {
    const line = this.add.rectangle(width / 2, y, width - 30, 2, 0x444466)
    this.scrollContainer!.add(line)

    const text = this.add.text(20, y + 15, title, {
      fontSize: '14px',
      color: '#8888ff',
      fontStyle: 'bold',
    })
    this.scrollContainer!.add(text)

    return y + 35
  }

  private createToggleSetting(
    width: number,
    y: number,
    label: string,
    description: string,
    settingKey: keyof DebugSettings
  ): number {
    const leftX = 20
    const rightX = width - 20

    // Label
    const labelText = this.add.text(leftX, y, label, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(labelText)

    // Description
    const descText = this.add.text(leftX, y + 16, description, {
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(descText)

    // Toggle
    const toggleWidth = 46
    const toggleHeight = 24
    const toggleX = rightX - toggleWidth / 2

    const toggle = this.add.container(toggleX, y + 4)
    this.scrollContainer!.add(toggle)

    const initialValue = this.settings[settingKey] as boolean
    const trackColor = initialValue ? 0x00cc66 : 0x444444
    const track = this.add.rectangle(0, 0, toggleWidth, toggleHeight, trackColor, 1)
    track.setStrokeStyle(1, 0x666666)

    const knobX = initialValue ? toggleWidth / 2 - 12 : -toggleWidth / 2 + 12
    const knob = this.add.circle(knobX, 0, 9, 0xffffff)

    toggle.add([track, knob])
    track.setInteractive({ useHandCursor: true })

    let currentValue = initialValue

    track.on('pointerdown', () => {
      audioManager.playMenuSelect()
      currentValue = !currentValue
      debugManager.setSetting(settingKey, currentValue)

      this.tweens.add({
        targets: knob,
        x: currentValue ? toggleWidth / 2 - 12 : -toggleWidth / 2 + 12,
        duration: 150,
        ease: 'Power2',
      })

      track.setFillStyle(currentValue ? 0x00cc66 : 0x444444)
    })

    return y + 45
  }

  private createSliderSetting(
    width: number,
    y: number,
    label: string,
    settingKey: keyof DebugSettings,
    min: number,
    max: number,
    step: number
  ): number {
    const leftX = 20
    const rightX = width - 20

    // Label
    const labelText = this.add.text(leftX, y, label, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(labelText)

    // Value display
    const currentValue = this.settings[settingKey] as number
    const valueText = this.add.text(rightX - 50, y, currentValue.toFixed(1), {
      fontSize: '14px',
      color: '#ffaa00',
    }).setOrigin(1, 0.5)
    this.scrollContainer!.add(valueText)

    // Decrease button
    const minusBtn = this.add.text(rightX - 40, y, '-', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333366',
      padding: { x: 8, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(minusBtn)

    // Increase button
    const plusBtn = this.add.text(rightX - 10, y, '+', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333366',
      padding: { x: 8, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(plusBtn)

    let value = currentValue

    minusBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      value = Math.max(min, value - step)
      value = Math.round(value * 100) / 100
      debugManager.setSetting(settingKey, value)
      valueText.setText(value.toFixed(1))
    })

    plusBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      value = Math.min(max, value + step)
      value = Math.round(value * 100) / 100
      debugManager.setSetting(settingKey, value)
      valueText.setText(value.toFixed(1))
    })

    return y + 35
  }

  private createChapterSelector(_width: number, y: number): number {
    const leftX = 20

    this.add.text(leftX, y, 'Start Chapter:', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(this.children.getChildren()[this.children.length - 1])

    const chapters: ChapterId[] = [1, 2, 3, 4, 5]
    const buttonWidth = 55
    const startX = leftX + 110
    const buttons: Phaser.GameObjects.Text[] = []

    chapters.forEach((chapterId, index) => {
      const x = startX + index * (buttonWidth + 5)
      const isSelected = this.settings.startChapter === chapterId

      const btn = this.add.text(x, y, `${chapterId}`, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: isSelected ? '#4a9eff' : '#333355',
        padding: { x: 12, y: 6 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      this.scrollContainer!.add(btn)

      btn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        debugManager.setSetting('startChapter', chapterId)
        buttons.forEach((b, i) => {
          b.setStyle({ backgroundColor: chapters[i] === chapterId ? '#4a9eff' : '#333355' })
        })
      })

      buttons.push(btn)
    })

    return y + 40
  }

  private createRoomSelector(width: number, y: number): number {
    const leftX = 20
    const rightX = width - 20

    this.add.text(leftX, y, 'Start Room:', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(this.children.getChildren()[this.children.length - 1])

    // Room value display
    const valueText = this.add.text(rightX - 50, y, this.settings.startRoom.toString(), {
      fontSize: '14px',
      color: '#ffaa00',
    }).setOrigin(1, 0.5)
    this.scrollContainer!.add(valueText)

    // Decrease button
    const minusBtn = this.add.text(rightX - 40, y, '-', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333366',
      padding: { x: 8, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(minusBtn)

    // Increase button
    const plusBtn = this.add.text(rightX - 10, y, '+', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#333366',
      padding: { x: 8, y: 2 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(plusBtn)

    let room = this.settings.startRoom

    minusBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      room = Math.max(1, room - 1)
      debugManager.setSetting('startRoom', room)
      valueText.setText(room.toString())
    })

    plusBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      room = Math.min(ROOMS_PER_CHAPTER, room + 1)
      debugManager.setSetting('startRoom', room)
      valueText.setText(room.toString())
    })

    return y + 35
  }

  private createCurrencyButtons(_width: number, y: number): number {
    const leftX = 20
    const buttonWidth = 80

    const currencies = [
      { label: '+1000 Gold', action: () => currencyManager.add('gold', 1000) },
      { label: '+100 Gems', action: () => currencyManager.add('gems', 100) },
      { label: '+10 Scrolls', action: () => currencyManager.add('scrolls', 10) },
      { label: 'Max Energy', action: () => currencyManager.add('energy', 20) },
    ]

    currencies.forEach((curr, index) => {
      const x = leftX + (index % 2) * (buttonWidth + 10)
      const rowY = y + Math.floor(index / 2) * 35

      const btn = this.add.text(x, rowY, curr.label, {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#335533',
        padding: { x: 8, y: 6 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      this.scrollContainer!.add(btn)

      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#447744' }))
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#335533' }))
      btn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        curr.action()
      })
    })

    return y + 75
  }

  private createLayoutCategorySelector(_width: number, y: number): number {
    const leftX = 20

    this.add.text(leftX, y, 'Layout Type:', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(this.children.getChildren()[this.children.length - 1])

    const categories: DebugSettings['layoutCategory'][] = ['standard', 'chokepoint', 'boss', 'miniboss']
    const labels = ['Standard', 'Choke', 'Boss', 'Mini']
    const buttonWidth = 55
    const startX = leftX + 100
    const buttons: Phaser.GameObjects.Text[] = []

    categories.forEach((cat, index) => {
      const x = startX + index * (buttonWidth + 5)
      const isSelected = this.settings.layoutCategory === cat

      const btn = this.add.text(x, y, labels[index], {
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: isSelected ? '#4a9eff' : '#333355',
        padding: { x: 6, y: 6 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      this.scrollContainer!.add(btn)

      btn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        debugManager.setSetting('layoutCategory', cat)
        debugManager.setSetting('forcedLayoutIndex', null) // Reset layout selection
        buttons.forEach((b, i) => {
          b.setStyle({ backgroundColor: categories[i] === cat ? '#4a9eff' : '#333355' })
        })
        // Refresh scene to update layout list
        this.scene.restart()
      })

      buttons.push(btn)
    })

    return y + 40
  }

  private createLayoutSelector(width: number, y: number): number {
    const leftX = 20

    const layouts = debugManager.getLayoutNames(this.settings.layoutCategory)
    const selectedIndex = this.settings.forcedLayoutIndex

    // Header with clear button
    this.add.text(leftX, y, 'Force Layout:', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(this.children.getChildren()[this.children.length - 1])

    const clearBtn = this.add.text(width - 30, y, 'RANDOM', {
      fontSize: '10px',
      color: selectedIndex === null ? '#00ff00' : '#888888',
      backgroundColor: '#333333',
      padding: { x: 6, y: 4 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(clearBtn)

    clearBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      debugManager.setSetting('forcedLayoutIndex', null)
      this.scene.restart()
    })

    y += 30

    // Layout grid (2 columns)
    const buttonWidth = (width - 50) / 2
    const buttons: Phaser.GameObjects.Text[] = []

    layouts.forEach((layoutName, index) => {
      const x = leftX + (index % 2) * (buttonWidth + 10)
      const rowY = y + Math.floor(index / 2) * 32
      const isSelected = selectedIndex === index

      const btn = this.add.text(x, rowY, layoutName, {
        fontSize: '11px',
        color: '#ffffff',
        backgroundColor: isSelected ? '#4a9eff' : '#333355',
        padding: { x: 6, y: 4 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      this.scrollContainer!.add(btn)

      btn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        debugManager.setSetting('forcedLayoutIndex', index)
        buttons.forEach((b, i) => {
          b.setStyle({ backgroundColor: i === index ? '#4a9eff' : '#333355' })
        })
        clearBtn.setStyle({ color: '#888888' })
      })

      buttons.push(btn)
    })

    return y + Math.ceil(layouts.length / 2) * 32 + 10
  }

  private createAbilitySelector(width: number, y: number): number {
    const leftX = 20

    // Selected abilities display
    const selectedAbilities = this.settings.startingAbilities
    const selectedText = selectedAbilities.length > 0
      ? `Selected: ${selectedAbilities.length}`
      : 'None selected'

    this.add.text(leftX, y, selectedText, {
      fontSize: '12px',
      color: '#ffaa00',
    }).setOrigin(0, 0.5)
    this.scrollContainer!.add(this.children.getChildren()[this.children.length - 1])

    // Clear all button
    const clearBtn = this.add.text(width - 30, y, 'CLEAR', {
      fontSize: '10px',
      color: '#ff6666',
      backgroundColor: '#333333',
      padding: { x: 6, y: 4 },
    }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(clearBtn)

    clearBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      debugManager.clearStartingAbilities()
      this.scene.restart()
    })

    y += 30

    // Ability grid (3 columns)
    const buttonWidth = (width - 60) / 3
    const buttons: Phaser.GameObjects.Text[] = []

    ABILITIES.forEach((ability, index) => {
      const x = leftX + (index % 3) * (buttonWidth + 10)
      const rowY = y + Math.floor(index / 3) * 32
      const isSelected = selectedAbilities.includes(ability.id)

      const btn = this.add.text(x, rowY, ability.name.substring(0, 12), {
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: isSelected ? '#4a9eff' : '#333355',
        padding: { x: 4, y: 4 },
      }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true })
      this.scrollContainer!.add(btn)

      btn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        if (isSelected) {
          debugManager.removeStartingAbility(ability.id)
        } else {
          debugManager.addStartingAbility(ability.id)
        }
        // Toggle style
        const newSelected = debugManager.getSettings().startingAbilities.includes(ability.id)
        btn.setStyle({ backgroundColor: newSelected ? '#4a9eff' : '#333355' })
      })

      buttons.push(btn)
    })

    return y + Math.ceil(ABILITIES.length / 3) * 32 + 10
  }

  private createResetSection(width: number, y: number): number {
    const centerX = width / 2

    const resetBtn = this.add.text(centerX, y, 'RESET ALL DEBUG SETTINGS', {
      fontSize: '14px',
      color: '#ff4444',
      backgroundColor: '#331111',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    this.scrollContainer!.add(resetBtn)

    resetBtn.on('pointerover', () => resetBtn.setStyle({ backgroundColor: '#552222' }))
    resetBtn.on('pointerout', () => resetBtn.setStyle({ backgroundColor: '#331111' }))
    resetBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      debugManager.resetSettings()
      this.scene.restart()
    })

    return y + 50
  }

  private createBackButton(_width: number, height: number) {
    createBackButton({
      scene: this,
      y: height - 50,
      targetScene: 'MainMenuScene',
    })
  }
}
