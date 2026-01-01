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
import { ChestType, CHEST_CONFIGS, CHEST_ORDER, rollChestRarity } from '../data/chestData'
import { chestManager } from '../systems/ChestManager'
import { equipmentManager } from '../systems/EquipmentManager'
import { Equipment, Rarity, RARITY_CONFIGS } from '../systems/Equipment'
import { audioManager } from '../systems/AudioManager'
import * as UIAnimations from '../systems/UIAnimations'

interface ChestSlot {
  container: Phaser.GameObjects.Container
  type: ChestType
  countText: Phaser.GameObjects.Text
}

export default class ChestScene extends Phaser.Scene {
  private chestSlots: ChestSlot[] = []
  private revealContainer: Phaser.GameObjects.Container | null = null
  private isOpening = false
  private instructionText: Phaser.GameObjects.Text | null = null

  constructor() {
    super({ key: 'ChestScene' })
  }

  create(): void {
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

    // Chest icon
    const chestSprite = this.add.image(-100, 0, `chest_${chestType}`)
    chestSprite.setScale(64 / chestSprite.width)
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

    // Count text (right side)
    const countText = this.add
      .text(130, 0, 'x0', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    container.add(countText)

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
    }
  }

  private createBackButton(): void {
    const { width, height } = this.cameras.main

    const backButton = this.add
      .text(width / 2, height - 40, 'BACK TO MENU', {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#444455',
        padding: { x: 30, y: 10 },
      })
      .setOrigin(0.5)

    backButton.setInteractive({ useHandCursor: true })
    backButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.scene.start('MainMenuScene')
    })
    backButton.on('pointerover', () => backButton.setStyle({ backgroundColor: '#555566' }))
    backButton.on('pointerout', () => backButton.setStyle({ backgroundColor: '#444455' }))
  }

  private setupEventListeners(): void {
    chestManager.on('inventoryChanged', () => {
      this.updateChestCounts()
    })
  }

  private updateChestCounts(): void {
    this.chestSlots.forEach((slot) => {
      const count = chestManager.getChestCount(slot.type)
      slot.countText.setText(`x${count}`)

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
    if (this.instructionText) {
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

    // Play opening animation
    this.playChestOpenAnimation(chestType, equipment)
  }

  private playChestOpenAnimation(chestType: ChestType, equipment: Equipment): void {
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

    const chestSprite = this.add.image(0, 0, `chest_${chestType}`)
    chestSprite.setScale(100 / chestSprite.width)
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
          this.showEquipmentReveal(equipment, overlay)
        })
      },
    })
  }

  private createOpeningParticles(x: number, y: number, rarity: Rarity): void {
    const color = RARITY_COLORS[rarity]

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

  private showEquipmentReveal(equipment: Equipment, overlay: Phaser.GameObjects.Rectangle): void {
    const { width, height } = this.cameras.main
    const rarityConfig = RARITY_CONFIGS[equipment.rarity]
    const rarityColor = Phaser.Display.Color.HexStringToColor(rarityConfig.color).color

    this.revealContainer = this.add.container(width / 2, height / 2)
    this.revealContainer.setDepth(104)
    this.revealContainer.setScale(0.5)
    this.revealContainer.setAlpha(0)

    // Card background
    const cardWidth = 280
    const cardHeight = 360
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

    // Equipment sprite
    const iconY = -cardHeight / 2 + 80
    const equipSprite = this.add.image(0, iconY, `equip_${equipment.type}`)
    equipSprite.setScale(100 / equipSprite.width)
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

    // Stats section
    const statsStartY = rarityY + 45
    let statsOffset = 0
    const statsEntries = Object.entries(equipment.baseStats)

    statsEntries.forEach(([stat, value]) => {
      if (value !== undefined && value !== 0) {
        const statName = this.formatStatName(stat)
        const statText = this.add
          .text(0, statsStartY + statsOffset, `${statName}: +${value}`, {
            fontSize: '15px',
            color: '#88ff88',
          })
          .setOrigin(0.5)
        this.revealContainer?.add(statText)
        statsOffset += 24
      }
    })

    // Perks section (if any)
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

  private formatStatName(stat: string): string {
    return stat
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('Percent', '%')
  }

  private formatPerkName(perk: string): string {
    return perk
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  shutdown(): void {
    // Clean up event listeners
    // Note: chestManager uses custom event system, not Phaser's
  }
}
