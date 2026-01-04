/**
 * ChestScene - Chest opening UI and animations
 *
 * Features:
 * - Display owned chests with counts
 * - Tap chest to open with animation
 * - Equipment reveal card with details
 * - Equip button on reveal
 */

import Phaser from 'phaser'
import { ChestType, CHEST_CONFIGS, CHEST_ORDER, rollChestRarity, rollChestCurrencyRewards, ChestCurrencyRewards } from '../data/chestData'
import { chestManager } from '../systems/ChestManager'
import { currencyManager } from '../systems/CurrencyManager'
import { equipmentManager } from '../systems/EquipmentManager'
import { Equipment, Rarity, RARITY_CONFIGS, EquipmentStats, PerkId } from '../systems/Equipment'
import { PERKS } from '../config/equipmentData'
import { audioManager } from '../systems/AudioManager'
import { PlayerStats } from '../systems/PlayerStats'
import * as UIAnimations from '../systems/UIAnimations'
import { createBackButton } from '../ui/components/BackButton'

interface ChestSlot {
  container: Phaser.GameObjects.Container
  type: ChestType
  countText: Phaser.GameObjects.Text
  openAllBtn: Phaser.GameObjects.Text
}

export default class ChestScene extends Phaser.Scene {
  private chestSlots: ChestSlot[] = []
  private revealContainer: Phaser.GameObjects.Container | null = null
  private bulkRevealContainer: Phaser.GameObjects.Container | null = null
  private isOpening = false
  private instructionText: Phaser.GameObjects.Text | null = null
  private inventoryChangedHandler: (() => void) | null = null

  constructor() {
    super({ key: 'ChestScene' })
  }

  create(): void {
    // Reset slots to prevent stale references from previous scene visits
    this.chestSlots = []

    const { width, height } = this.cameras.main

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header with back button
    this.createHeader()

    // Chest display slots
    this.createChestSlots()

    // Instruction text
    this.instructionText = this.add
      .text(width / 2, height - 100, 'Tap a chest to open!', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)

    // Back button
    this.createBackButton()

    // Listen for inventory changes
    this.setupEventListeners()

    // Ensure cleanup when scene shuts down (handles all transition types)
    this.events.once('shutdown', this.shutdown, this)

    // Initial update
    this.updateChestCounts()
  }

  private createHeader(): void {
    const { width } = this.cameras.main

    // Title
    this.add
      .text(width / 2, 40, 'CHESTS', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Back button (top-left)
    const backBtn = this.add
      .text(20, 40, '< Back', {
        fontSize: '16px',
        color: '#aaaaaa',
      })
      .setOrigin(0, 0.5)

    backBtn.setInteractive({ useHandCursor: true })
    backBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.scene.start('MainMenuScene')
    })
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'))
    backBtn.on('pointerout', () => backBtn.setColor('#aaaaaa'))

    // Divider
    this.add.rectangle(width / 2, 70, width - 40, 2, 0x444444)
  }

  private createChestSlots(): void {
    const { width } = this.cameras.main
    const startY = 150
    const slotHeight = 120
    const slotGap = 30

    CHEST_ORDER.forEach((chestType, index) => {
      const y = startY + index * (slotHeight + slotGap)
      const slot = this.createChestSlot(width / 2, y, chestType)
      this.chestSlots.push(slot)
    })
  }

  private createChestSlot(x: number, y: number, chestType: ChestType): ChestSlot {
    const config = CHEST_CONFIGS[chestType]
    const container = this.add.container(x, y)

    // Background card
    const bgWidth = 320
    const bgHeight = 100
    const bg = this.add.rectangle(0, 0, bgWidth, bgHeight, 0x2d2d44, 1)
    bg.setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(config.color).color)
    container.add(bg)

    // Chest icon - use setDisplaySize to avoid scaling issues with missing textures
    const chestSprite = this.add.image(-100, 0, `chest_${chestType}`)
    chestSprite.setDisplaySize(64, 64)
    container.add(chestSprite)

    // Chest name
    const nameText = this.add
      .text(-20, -25, config.name, {
        fontSize: '18px',
        color: config.color,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    container.add(nameText)

    // Description
    const descText = this.add
      .text(-20, 0, config.description, {
        fontSize: '11px',
        color: '#888888',
        wordWrap: { width: 180 },
      })
      .setOrigin(0, 0.5)
    container.add(descText)

    // Count text (right side) - initialize with actual count
    const count = chestManager.getChestCount(chestType)
    const countText = this.add
      .text(100, -15, `x${count}`, {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(countText)

    // Open All button (below count, visible when count > 1)
    const openAllBtn = this.add
      .text(100, 18, 'Open All', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#44aa44',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
    openAllBtn.setInteractive({ useHandCursor: true })
    openAllBtn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      this.openAllChests(chestType)
    })
    openAllBtn.on('pointerover', () => openAllBtn.setStyle({ backgroundColor: '#55bb55' }))
    openAllBtn.on('pointerout', () => openAllBtn.setStyle({ backgroundColor: '#44aa44' }))
    openAllBtn.setVisible(count > 1)
    container.add(openAllBtn)

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => this.onChestClick(chestType))
    bg.on('pointerover', () => {
      bg.setFillStyle(0x3d3d54)
      // Slight scale up animation
      this.tweens.add({
        targets: container,
        scale: 1.02,
        duration: 100,
        ease: 'Power2',
      })
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x2d2d44)
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 100,
        ease: 'Power2',
      })
    })

    return {
      container,
      type: chestType,
      countText,
      openAllBtn,
    }
  }

  private createBackButton(): void {
    const { height } = this.cameras.main

    createBackButton({
      scene: this,
      y: height - 40,
      targetScene: 'MainMenuScene',
      text: 'BACK TO MENU',
      backgroundColor: 0x444455,
      hoverColor: 0x555566,
    })
  }

  private setupEventListeners(): void {
    // Store reference so we can unsubscribe in shutdown
    this.inventoryChangedHandler = () => {
      this.updateChestCounts()
    }
    chestManager.on('inventoryChanged', this.inventoryChangedHandler)
  }

  private updateChestCounts(): void {
    // Guard against updates after scene shutdown
    if (!this.scene.isActive()) return

    this.chestSlots.forEach((slot) => {
      // Guard against destroyed game objects
      if (!slot.countText?.active || !slot.container?.active) return

      const count = chestManager.getChestCount(slot.type)
      slot.countText.setText(`x${count}`)

      // Update Open All button visibility (show when count > 1)
      if (slot.openAllBtn?.active) {
        slot.openAllBtn.setVisible(count > 1)
      }

      // Dim if no chests available
      if (count <= 0) {
        slot.countText.setColor('#666666')
        slot.container.setAlpha(0.6)
      } else {
        slot.countText.setColor('#ffffff')
        slot.container.setAlpha(1)
      }
    })

    // Update instruction text
    if (this.instructionText?.active) {
      const totalChests = chestManager.getTotalChests()
      if (totalChests <= 0) {
        this.instructionText.setText('No chests available. Play runs to earn more!')
      } else {
        this.instructionText.setText('Tap a chest to open!')
      }
    }
  }

  private onChestClick(chestType: ChestType): void {
    // Prevent multiple openings
    if (this.isOpening) return

    // Check if player has this chest
    if (!chestManager.hasChest(chestType)) {
      // Flash red to indicate no chests
      const slot = this.chestSlots.find((s) => s.type === chestType)
      if (slot) {
        this.tweens.add({
          targets: slot.container,
          alpha: 0.3,
          duration: 100,
          yoyo: true,
          repeat: 1,
        })
      }
      return
    }

    this.isOpening = true

    // Remove the chest
    chestManager.removeChest(chestType)

    // Roll for rarity and generate equipment
    const rarity = rollChestRarity(chestType)
    const equipment = equipmentManager.generateRandomEquipment(rarity)

    // Roll for currency rewards
    const currencyRewards = rollChestCurrencyRewards(chestType)

    // Award currency immediately
    if (currencyRewards.gold > 0) {
      currencyManager.add('gold', currencyRewards.gold)
    }
    if (currencyRewards.gems > 0) {
      currencyManager.add('gems', currencyRewards.gems)
    }

    // Play opening animation
    this.playChestOpenAnimation(chestType, equipment, currencyRewards)
  }

  private playChestOpenAnimation(chestType: ChestType, equipment: Equipment, currencyRewards: ChestCurrencyRewards): void {
    const { width, height } = this.cameras.main
    const config = CHEST_CONFIGS[chestType]

    // Create overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
    overlay.setDepth(100)

    // Fade in overlay
    this.tweens.add({
      targets: overlay,
      alpha: 0.8,
      duration: 300,
    })

    // Create chest sprite for animation
    const chestContainer = this.add.container(width / 2, height / 2 - 50)
    chestContainer.setDepth(101)

    // Use setDisplaySize to avoid scaling issues with missing textures
    const chestSprite = this.add.image(0, 0, `chest_${chestType}`)
    chestSprite.setDisplaySize(100, 100)
    chestContainer.add(chestSprite)

    // Create glow effect behind chest
    const glow = this.add.circle(0, 0, 80, Phaser.Display.Color.HexStringToColor(config.color).color, 0.3)
    chestContainer.add(glow)
    chestContainer.sendToBack(glow)

    // Shake animation
    this.tweens.add({
      targets: chestContainer,
      x: { from: width / 2 - 10, to: width / 2 + 10 },
      duration: 80,
      yoyo: true,
      repeat: 4,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        // Burst open effect
        this.cameras.main.shake(100, 0.01)
        audioManager.playLevelUp()

        // Flash effect
        const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1)
        flash.setDepth(102)
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 300,
          onComplete: () => flash.destroy(),
        })

        // Scale up and fade out chest
        this.tweens.add({
          targets: chestContainer,
          scale: 2,
          alpha: 0,
          duration: 300,
          ease: 'Power2',
          onComplete: () => {
            chestContainer.destroy()
          },
        })

        // Create particles
        this.createOpeningParticles(width / 2, height / 2 - 50, equipment.rarity)

        // Show equipment reveal after delay
        this.time.delayedCall(400, () => {
          this.showEquipmentReveal(equipment, overlay, currencyRewards)
        })
      },
    })
  }

  private createOpeningParticles(x: number, y: number, rarity: Rarity): void {
    const rarityConfig = RARITY_CONFIGS[rarity]
    const color = Phaser.Display.Color.HexStringToColor(rarityConfig.color).color

    // Create particle texture
    const graphics = this.add.graphics()
    graphics.fillStyle(color, 1)
    graphics.fillCircle(4, 4, 4)
    graphics.generateTexture('chest_particle', 8, 8)
    graphics.destroy()

    // Create particle emitter
    const emitter = this.add.particles(x, y, 'chest_particle', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 800,
      quantity: 20,
      blendMode: Phaser.BlendModes.ADD,
    })
    emitter.setDepth(103)

    // Stop and destroy after one burst
    this.time.delayedCall(100, () => {
      emitter.stop()
    })
    this.time.delayedCall(1000, () => {
      emitter.destroy()
    })
  }

  private showEquipmentReveal(equipment: Equipment, overlay: Phaser.GameObjects.Rectangle, currencyRewards?: ChestCurrencyRewards): void {
    const { width, height } = this.cameras.main
    const rarityConfig = RARITY_CONFIGS[equipment.rarity]
    const rarityColor = Phaser.Display.Color.HexStringToColor(rarityConfig.color).color

    // Adjust card height if currency rewards are present
    const hasCurrency = currencyRewards && (currencyRewards.gold > 0 || currencyRewards.gems > 0)
    const cardHeight = hasCurrency ? 400 : 360

    this.revealContainer = this.add.container(width / 2, height / 2)
    this.revealContainer.setDepth(104)
    this.revealContainer.setScale(0.5)
    this.revealContainer.setAlpha(0)

    // Card background
    const cardWidth = 280
    const card = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x1a1a2e, 1)
    card.setStrokeStyle(4, rarityColor)
    this.revealContainer.add(card)

    // Rarity glow effect
    const glowSize = cardWidth + 20
    const glow = this.add.rectangle(0, 0, glowSize, cardHeight + 20, rarityColor, 0.15)
    this.revealContainer.add(glow)
    this.revealContainer.sendToBack(glow)

    // "NEW!" banner (for higher rarities)
    if (equipment.rarity !== Rarity.COMMON) {
      const bannerY = -cardHeight / 2 - 15
      const banner = this.add.rectangle(0, bannerY, 80, 30, rarityColor, 1)
      this.revealContainer.add(banner)

      const bannerText = this.add
        .text(0, bannerY, 'NEW!', {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      this.revealContainer.add(bannerText)
    }

    // Equipment sprite - use setDisplaySize to avoid scaling issues with missing textures
    const iconY = -cardHeight / 2 + 80
    const equipSprite = this.add.image(0, iconY, `equip_${equipment.type}`)
    equipSprite.setDisplaySize(100, 100)
    this.revealContainer.add(equipSprite)

    // Equipment name
    const nameY = iconY + 65
    const nameText = this.add
      .text(0, nameY, equipment.name, {
        fontSize: '22px',
        color: rarityConfig.color,
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: cardWidth - 40 },
      })
      .setOrigin(0.5)
    this.revealContainer.add(nameText)

    // Rarity label
    const rarityY = nameY + 35
    const rarityText = this.add
      .text(0, rarityY, rarityConfig.name.toUpperCase(), {
        fontSize: '16px',
        color: rarityConfig.color,
      })
      .setOrigin(0.5)
    this.revealContainer.add(rarityText)

    // Stats section - combine base stats and perk stats to avoid duplicate entries
    const statsStartY = rarityY + 45
    let statsOffset = 0
    const combinedStats = this.getCombinedItemStats(equipment)
    const statsEntries = Object.entries(combinedStats).filter(
      ([_, value]) => value !== undefined && value !== 0
    )

    statsEntries.forEach(([stat, value]) => {
      const statName = this.formatStatName(stat)
      const numValue = value as number
      const sign = numValue >= 0 ? '+' : ''
      const statText = this.add
        .text(0, statsStartY + statsOffset, `${statName}: ${sign}${this.formatStatValue(numValue, stat)}`, {
          fontSize: '15px',
          color: numValue >= 0 ? '#88ff88' : '#ff6666',
        })
        .setOrigin(0.5)
      this.revealContainer?.add(statText)
      statsOffset += 24
    })

    // Show perk names for reference (they're already included in combined stats)
    if (equipment.perks.length > 0) {
      const perksY = statsStartY + statsOffset + 15

      const perksLabel = this.add
        .text(0, perksY, 'Unique Perks:', {
          fontSize: '14px',
          color: '#aaaaaa',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      this.revealContainer.add(perksLabel)

      equipment.perks.forEach((perk, i) => {
        const perkText = this.add
          .text(0, perksY + 20 + i * 20, this.formatPerkName(perk), {
            fontSize: '13px',
            color: '#ffaa00',
          })
          .setOrigin(0.5)
        this.revealContainer?.add(perkText)
      })
    }

    // Currency rewards display (if any)
    if (hasCurrency && currencyRewards) {
      const currencyY = cardHeight / 2 - 90
      const currencyContainer = this.add.container(0, currencyY)
      this.revealContainer.add(currencyContainer)

      // Background for currency row
      const currencyBg = this.add.rectangle(0, 0, cardWidth - 40, 30, 0x2d2d44, 1)
      currencyBg.setStrokeStyle(1, 0x444466)
      currencyContainer.add(currencyBg)

      // Build currency display text parts
      const currencyParts: string[] = []

      if (currencyRewards.gold > 0) {
        currencyParts.push(`💰+${currencyRewards.gold}`)
      }
      if (currencyRewards.gems > 0) {
        currencyParts.push(`💎+${currencyRewards.gems}`)
      }

      const currencyText = this.add.text(0, 0, currencyParts.join('  '), {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      currencyContainer.add(currencyText)

      // Animate currency appearing with bounce
      currencyContainer.setScale(0)
      this.tweens.add({
        targets: currencyContainer,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
        delay: 200,
      })
    }

    // Buttons
    const buttonY = cardHeight / 2 - 50

    // Equip button
    const equipBtn = this.add
      .text(-65, buttonY, 'EQUIP', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#44aa44',
        padding: { x: 25, y: 12 },
      })
      .setOrigin(0.5)

    equipBtn.setInteractive({ useHandCursor: true })
    equipBtn.on('pointerdown', () => {
      audioManager.playAbilitySelect()
      equipmentManager.equip(equipment)
      this.closeReveal(overlay)
    })
    UIAnimations.applyButtonEffects(this, equipBtn)
    this.revealContainer.add(equipBtn)

    // Close button
    const closeBtn = this.add
      .text(65, buttonY, 'CLOSE', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#666677',
        padding: { x: 25, y: 12 },
      })
      .setOrigin(0.5)

    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.closeReveal(overlay)
    })
    UIAnimations.applyButtonEffects(this, closeBtn)
    this.revealContainer.add(closeBtn)

    // Animate card appearing
    UIAnimations.showModal(this, this.revealContainer)

    // Pulsing glow animation
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.15, to: 0.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
  }

  private closeReveal(overlay: Phaser.GameObjects.Rectangle): void {
    // Animate out
    if (this.revealContainer) {
      this.tweens.add({
        targets: this.revealContainer,
        scale: 0.8,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.revealContainer?.destroy()
          this.revealContainer = null
        },
      })
    }

    // Fade out overlay
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        overlay.destroy()
        this.isOpening = false
      },
    })

    // Update chest counts
    this.updateChestCounts()
  }

  private openAllChests(chestType: ChestType): void {
    const count = chestManager.getChestCount(chestType)
    if (count === 0 || this.isOpening) return

    this.isOpening = true
    audioManager.playLevelUp()

    const items: Equipment[] = []
    const totalCurrency: ChestCurrencyRewards = { gold: 0, gems: 0 }

    for (let i = 0; i < count; i++) {
      chestManager.removeChest(chestType)
      const rarity = rollChestRarity(chestType)
      // generateRandomEquipment already adds to inventory via createEquipment
      const equipment = equipmentManager.generateRandomEquipment(rarity)
      items.push(equipment)

      // Roll currency for each chest
      const currencyRewards = rollChestCurrencyRewards(chestType)
      totalCurrency.gold += currencyRewards.gold
      totalCurrency.gems += currencyRewards.gems
    }

    // Award total currency
    if (totalCurrency.gold > 0) {
      currencyManager.add('gold', totalCurrency.gold)
    }
    if (totalCurrency.gems > 0) {
      currencyManager.add('gems', totalCurrency.gems)
    }

    this.showBulkReveal(items, chestType, totalCurrency)
  }

  private showBulkReveal(items: Equipment[], chestType: ChestType, currencyRewards?: ChestCurrencyRewards): void {
    const { width, height } = this.cameras.main
    const config = CHEST_CONFIGS[chestType]
    const hasCurrency = currencyRewards && (currencyRewards.gold > 0 || currencyRewards.gems > 0)

    // Create overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
    overlay.setDepth(100)
    this.tweens.add({
      targets: overlay,
      alpha: 0.85,
      duration: 200,
    })

    // Main container
    this.bulkRevealContainer = this.add.container(width / 2, height / 2)
    this.bulkRevealContainer.setDepth(101)
    this.bulkRevealContainer.setScale(0.8)
    this.bulkRevealContainer.setAlpha(0)

    // Background panel - slightly taller if currency rewards
    const panelWidth = 320
    const panelHeight = hasCurrency ? 520 : 480
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2e, 1)
    panel.setStrokeStyle(3, Phaser.Display.Color.HexStringToColor(config.color).color)
    this.bulkRevealContainer.add(panel)

    // Header
    const headerText = this.add
      .text(0, -panelHeight / 2 + 35, `Opened ${items.length} ${config.name}s!`, {
        fontSize: '20px',
        color: config.color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.bulkRevealContainer.add(headerText)

    // Divider
    const divider = this.add.rectangle(0, -panelHeight / 2 + 65, panelWidth - 40, 2, 0x444444)
    this.bulkRevealContainer.add(divider)

    // Currency rewards display (if any)
    let currencyOffset = 0
    if (hasCurrency && currencyRewards) {
      currencyOffset = 35
      const currencyY = -panelHeight / 2 + 90
      const currencyContainer = this.add.container(0, currencyY)
      this.bulkRevealContainer.add(currencyContainer)

      // "Also received:" label
      const labelText = this.add.text(0, -8, 'Also received:', {
        fontSize: '12px',
        color: '#aaaaaa',
      }).setOrigin(0.5)
      currencyContainer.add(labelText)

      // Build currency display text parts
      const currencyParts: string[] = []

      if (currencyRewards.gold > 0) {
        currencyParts.push(`💰+${currencyRewards.gold}`)
      }
      if (currencyRewards.gems > 0) {
        currencyParts.push(`💎+${currencyRewards.gems}`)
      }

      const currencyText = this.add.text(0, 12, currencyParts.join('  '), {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      currencyContainer.add(currencyText)

      // Animate currency appearing
      currencyContainer.setScale(0)
      this.tweens.add({
        targets: currencyContainer,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
        delay: 100,
      })
    }

    // Scrollable grid area
    const gridTop = -panelHeight / 2 + 80 + currencyOffset
    const gridHeight = 320 - (hasCurrency ? 0 : 0)
    const gridWidth = panelWidth - 40

    // Create mask for scrolling (GeometryMask requires Graphics, not Rectangle)
    const maskGraphics = this.add.graphics()
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(
      width / 2 - gridWidth / 2,
      height / 2 + gridTop,
      gridWidth,
      gridHeight
    )
    maskGraphics.setVisible(false)
    const mask = new Phaser.Display.Masks.GeometryMask(this, maskGraphics)

    // Grid container (will be scrolled)
    const gridContainer = this.add.container(0, gridTop + 10)
    gridContainer.setMask(mask)
    this.bulkRevealContainer.add(gridContainer)

    // Create item cards in grid (2 columns)
    const cardWidth = 130
    const cardHeight = 130
    const gap = 10
    const cols = 2
    const startX = -cardWidth / 2 - gap / 2

    items.forEach((equipment, index) => {
      const col = index % cols
      const row = Math.floor(index / cols)
      const x = startX + col * (cardWidth + gap)
      const y = row * (cardHeight + gap) + cardHeight / 2

      const card = this.createItemCard(equipment, x, y)
      gridContainer.add(card)
    })

    // Calculate total content height
    const totalRows = Math.ceil(items.length / cols)
    const contentHeight = totalRows * (cardHeight + gap)
    const maxScroll = Math.max(0, contentHeight - gridHeight + 20)

    // Scroll handling
    let scrollY = 0
    if (maxScroll > 0) {
      // Enable pointer drag scrolling
      const dragZone = this.add.rectangle(0, gridTop + gridHeight / 2, gridWidth, gridHeight, 0x000000, 0)
      dragZone.setInteractive()
      this.bulkRevealContainer.add(dragZone)

      let isDragging = false
      let lastPointerY = 0

      dragZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        isDragging = true
        lastPointerY = pointer.y
      })

      this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (isDragging) {
          const deltaY = pointer.y - lastPointerY
          scrollY = Phaser.Math.Clamp(scrollY - deltaY, 0, maxScroll)
          gridContainer.y = gridTop + 10 - scrollY
          lastPointerY = pointer.y
        }
      })

      this.input.on('pointerup', () => {
        isDragging = false
      })

      // Mouse wheel scrolling
      this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
        scrollY = Phaser.Math.Clamp(scrollY + deltaY * 0.5, 0, maxScroll)
        gridContainer.y = gridTop + 10 - scrollY
      })
    }

    // Footer message
    const footerY = panelHeight / 2 - 70
    const footerText = this.add
      .text(0, footerY, 'Added to inventory', {
        fontSize: '14px',
        color: '#88ff88',
      })
      .setOrigin(0.5)
    this.bulkRevealContainer.add(footerText)

    // Close button
    const closeBtn = this.add
      .text(0, panelHeight / 2 - 30, 'CLOSE', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#666677',
        padding: { x: 40, y: 12 },
      })
      .setOrigin(0.5)
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.closeBulkReveal(overlay, maskGraphics)
    })
    UIAnimations.applyButtonEffects(this, closeBtn)
    this.bulkRevealContainer.add(closeBtn)

    // Animate in
    UIAnimations.showModal(this, this.bulkRevealContainer)
  }

  private createItemCard(equipment: Equipment, x: number, y: number): Phaser.GameObjects.Container {
    const card = this.add.container(x, y)
    const rarityConfig = RARITY_CONFIGS[equipment.rarity]
    const rarityColor = Phaser.Display.Color.HexStringToColor(rarityConfig.color).color

    // Card background
    const cardWidth = 120
    const cardHeight = 120
    const bg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x2d2d44, 1)
    bg.setStrokeStyle(2, rarityColor)
    card.add(bg)

    // Equipment icon
    const icon = this.add.image(0, -20, `equip_${equipment.type}`)
    icon.setDisplaySize(48, 48)
    card.add(icon)

    // Equipment name (truncated if too long)
    let displayName = equipment.name
    if (displayName.length > 12) {
      displayName = displayName.substring(0, 11) + '...'
    }
    const nameText = this.add
      .text(0, 20, displayName, {
        fontSize: '11px',
        color: rarityConfig.color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    card.add(nameText)

    // Rarity label
    const rarityText = this.add
      .text(0, 40, rarityConfig.name, {
        fontSize: '10px',
        color: rarityConfig.color,
      })
      .setOrigin(0.5)
    card.add(rarityText)

    return card
  }

  private closeBulkReveal(overlay: Phaser.GameObjects.Rectangle, maskGraphics: Phaser.GameObjects.Graphics): void {
    // Remove input listeners
    this.input.off('pointermove')
    this.input.off('pointerup')
    this.input.off('wheel')

    // Animate out
    if (this.bulkRevealContainer) {
      this.tweens.add({
        targets: this.bulkRevealContainer,
        scale: 0.8,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => {
          this.bulkRevealContainer?.destroy()
          this.bulkRevealContainer = null
          maskGraphics.destroy()
        },
      })
    }

    // Fade out overlay
    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: 200,
      onComplete: () => {
        overlay.destroy()
        this.isOpening = false
      },
    })

    // Update chest counts
    this.updateChestCounts()
  }

  private formatStatName(stat: string): string {
    return stat
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('Percent', '%')
  }

  private formatStatValue(value: number, statKey?: string): string {
    // Percentage stats are stored as decimals (e.g., 0.15 = 15%)
    const percentageStats = new Set([
      'attackSpeedPercent',
      'attackDamagePercent',
      'maxHealthPercent',
      'damageReductionPercent',
      'critChance',
      'critDamage',
      'dodgeChance',
      'bonusXPPercent',
      'goldBonusPercent',
      'projectileSpeedPercent',
    ])

    let displayValue = value
    let isCapped = false

    // Dodge chance is capped at MAX_DODGE_CHANCE (3%)
    if (statKey === 'dodgeChance' && value > PlayerStats.MAX_DODGE_CHANCE) {
      displayValue = PlayerStats.MAX_DODGE_CHANCE
      isCapped = true
    }

    if (statKey && percentageStats.has(statKey)) {
      displayValue = displayValue * 100 // Convert 0.15 to 15
    }

    // Round to 1 decimal place, but show as integer if whole number
    const rounded = Math.round(displayValue * 10) / 10
    const valueStr = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
    return isCapped ? `${valueStr} (max)` : valueStr
  }

  /**
   * Combines item's base stats with all perk stats into a single object.
   * This ensures duplicate attributes are combined into single values.
   */
  private getCombinedItemStats(item: Equipment): EquipmentStats {
    const combined: EquipmentStats = {}

    // Add base stats
    for (const [key, value] of Object.entries(item.baseStats)) {
      if (value !== undefined && value !== 0) {
        const statKey = key as keyof EquipmentStats
        combined[statKey] = (combined[statKey] ?? 0) + value
      }
    }

    // Add perk stats
    for (const perkId of item.perks) {
      const perk = PERKS[perkId as PerkId]
      if (perk?.stats) {
        for (const [key, value] of Object.entries(perk.stats)) {
          if (value !== undefined && value !== 0) {
            const statKey = key as keyof EquipmentStats
            combined[statKey] = (combined[statKey] ?? 0) + value
          }
        }
      }
    }

    return combined
  }

  private formatPerkName(perk: string): string {
    return perk
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  shutdown(): void {
    // Clean up event listeners to prevent updates on destroyed objects
    if (this.inventoryChangedHandler) {
      chestManager.off('inventoryChanged', this.inventoryChangedHandler)
      this.inventoryChangedHandler = null
    }
    this.chestSlots = []
  }
}
