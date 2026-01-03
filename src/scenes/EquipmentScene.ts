/**
 * EquipmentScene - Equipment management screen
 *
 * Displays equipped items, inventory grid, and allows
 * equipping/unequipping, upgrading, and fusing items.
 */

import Phaser from 'phaser'
import {
  Equipment,
  EquipmentSlotType,
  EQUIPMENT_SLOTS,
  RARITY_CONFIGS,
} from '../systems/Equipment'
import { equipmentManager, EQUIPMENT_EVENTS } from '../systems/EquipmentManager'
import { currencyManager } from '../systems/CurrencyManager'
import { audioManager } from '../systems/AudioManager'
import * as UIAnimations from '../systems/UIAnimations'

// Slot display names
const SLOT_NAMES: Record<EquipmentSlotType, string> = {
  weapon: 'Weapon',
  armor: 'Armor',
  ring: 'Ring',
  spirit: 'Spirit',
}

// Slot icons (emoji fallback)
const SLOT_ICONS: Record<EquipmentSlotType, string> = {
  weapon: '⚔',
  armor: '🛡',
  ring: '💍',
  spirit: '👻',
}

interface InventorySlot {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Rectangle
  item: Equipment | null
}

export default class EquipmentScene extends Phaser.Scene {
  // Layout constants
  private readonly SLOT_SIZE = 70
  private readonly SLOT_GAP = 10
  private readonly INVENTORY_COLS = 4
  private readonly INVENTORY_ROWS = 4
  private readonly INVENTORY_SLOT_SIZE = 60

  // UI elements
  private equippedSlots: Map<EquipmentSlotType, Phaser.GameObjects.Container> = new Map()
  private inventorySlots: InventorySlot[] = []
  private detailPanel: Phaser.GameObjects.Container | null = null
  private goldText: Phaser.GameObjects.Text | null = null
  private fusionButton: Phaser.GameObjects.Text | null = null
  private fuseAllButton: Phaser.GameObjects.Text | null = null

  // Event handler references for cleanup
  private inventoryChangedHandler: (() => void) | null = null
  private equippedChangedHandler: (() => void) | null = null
  private itemUpgradedHandler: (() => void) | null = null
  private itemFusedHandler: (() => void) | null = null
  private itemSoldHandler: (() => void) | null = null

  // Scroll state for inventory
  private inventoryContainer: Phaser.GameObjects.Container | null = null
  private scrollOffset = 0
  private maxScroll = 0
  private inventoryStartY = 0
  private visibleHeight = 0
  private scrollIndicator: Phaser.GameObjects.Container | null = null

  // Touch scroll state
  private isDragging = false
  private dragStartY = 0
  private dragStartScroll = 0
  private dragDistance = 0
  private readonly DRAG_THRESHOLD = 10 // Pixels before considering it a drag

  constructor() {
    super({ key: 'EquipmentScene' })
  }

  create(): void {
    const { width, height } = this.cameras.main

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header
    this.createHeader()

    // Equipped slots
    this.createEquippedSlots()

    // Inventory
    this.createInventory()

    // Gold display
    this.createGoldDisplay()

    // Back button
    this.createBackButton()

    // Listen for equipment changes
    this.setupEventListeners()

    // Ensure cleanup when scene shuts down (handles all transition types)
    this.events.once('shutdown', this.shutdown, this)

    // Initial render
    this.refreshDisplay()
  }

  private createHeader(): void {
    const { width } = this.cameras.main

    this.add
      .text(width / 2, 30, 'EQUIPMENT', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Divider line
    this.add.rectangle(width / 2, 55, width - 40, 2, 0x444444)
  }

  private createEquippedSlots(): void {
    const { width } = this.cameras.main
    const startY = 90
    const totalWidth = EQUIPMENT_SLOTS.length * this.SLOT_SIZE + (EQUIPMENT_SLOTS.length - 1) * this.SLOT_GAP
    const startX = (width - totalWidth) / 2 + this.SLOT_SIZE / 2

    // Section label
    this.add
      .text(width / 2, startY - 15, 'EQUIPPED', {
        fontSize: '12px',
        color: '#666666',
      })
      .setOrigin(0.5)

    EQUIPMENT_SLOTS.forEach((slot, index) => {
      const x = startX + index * (this.SLOT_SIZE + this.SLOT_GAP)
      const y = startY + this.SLOT_SIZE / 2 + 10

      const container = this.createEquippedSlot(x, y, slot)
      // Set high depth to ensure equipped slots are always clickable above inventory
      container.setDepth(10)
      this.equippedSlots.set(slot, container)
    })
  }

  private createEquippedSlot(x: number, y: number, slot: EquipmentSlotType): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    // Background
    const bg = this.add.rectangle(0, 0, this.SLOT_SIZE, this.SLOT_SIZE, 0x2d2d44, 1)
    bg.setStrokeStyle(2, 0x444466)
    container.add(bg)

    // Slot icon (shown when empty)
    const icon = this.add
      .text(0, -5, SLOT_ICONS[slot], {
        fontSize: '24px',
      })
      .setOrigin(0.5)
    icon.setName('icon')
    container.add(icon)

    // Slot label
    const label = this.add
      .text(0, 25, SLOT_NAMES[slot], {
        fontSize: '10px',
        color: '#888888',
      })
      .setOrigin(0.5)
    container.add(label)

    // Item display (hidden by default)
    const itemBg = this.add.rectangle(0, 0, this.SLOT_SIZE - 8, this.SLOT_SIZE - 8, 0x333355, 1)
    itemBg.setVisible(false)
    itemBg.setName('itemBg')
    container.add(itemBg)

    const itemSprite = this.add.image(0, -5, '')
    itemSprite.setVisible(false)
    itemSprite.setName('itemSprite')
    container.add(itemSprite)

    const levelText = this.add
      .text(0, 20, '', {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
    levelText.setName('levelText')
    container.add(levelText)

    // Make interactive
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerdown', () => this.onEquippedSlotClick(slot))
    bg.on('pointerover', () => {
      bg.setFillStyle(0x3d3d54)
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x2d2d44)
    })

    container.setData('slot', slot)
    return container
  }

  private createInventory(): void {
    const { width, height } = this.cameras.main
    const inventoryY = 230
    this.inventoryStartY = inventoryY
    this.visibleHeight = height - inventoryY - 120 // Leave room for buttons

    // Section label
    this.add
      .text(width / 2, inventoryY - 15, 'INVENTORY', {
        fontSize: '12px',
        color: '#666666',
      })
      .setOrigin(0.5)

    // Create scrollable container
    const totalWidth =
      this.INVENTORY_COLS * this.INVENTORY_SLOT_SIZE + (this.INVENTORY_COLS - 1) * 8
    const startX = (width - totalWidth) / 2 + this.INVENTORY_SLOT_SIZE / 2

    // Mask for scrolling
    const maskGraphics = this.make.graphics({})
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(20, inventoryY, width - 40, this.visibleHeight)
    const mask = maskGraphics.createGeometryMask()

    // Container positioned at the inventory area start
    // Use lower depth than equipped slots to prevent scroll-overlap click issues
    this.inventoryContainer = this.add.container(0, inventoryY)
    this.inventoryContainer.setDepth(1)
    this.inventoryContainer.setMask(mask)

    // Create inventory slots - positions relative to container (which is at inventoryY)
    const inventory = equipmentManager.getInventory()
    const totalSlots = Math.max(this.INVENTORY_COLS * this.INVENTORY_ROWS, inventory.length + 8)
    const rows = Math.ceil(totalSlots / this.INVENTORY_COLS)

    // Start first row at half slot size to ensure it's fully visible within the mask
    const firstRowOffset = this.INVENTORY_SLOT_SIZE / 2 + 5

    for (let i = 0; i < totalSlots; i++) {
      const col = i % this.INVENTORY_COLS
      const row = Math.floor(i / this.INVENTORY_COLS)
      const x = startX + col * (this.INVENTORY_SLOT_SIZE + 8)
      const y = firstRowOffset + row * (this.INVENTORY_SLOT_SIZE + 8) // Relative to container

      const slotData = this.createInventorySlot(x, y, i)
      this.inventorySlots.push(slotData)
    }

    // Calculate max scroll - account for the firstRowOffset at start
    const contentHeight = firstRowOffset + rows * (this.INVENTORY_SLOT_SIZE + 8)
    this.maxScroll = Math.max(0, contentHeight - this.visibleHeight)

    // Create scroll indicator
    this.createScrollIndicator()

    // Setup scroll input - wheel for desktop
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (this.maxScroll <= 0) return
      this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + deltaY, 0, this.maxScroll)
      this.updateInventoryScroll()
    })

    // Setup touch/drag scrolling for mobile
    this.setupTouchScrolling()

    // Initial interactivity update - disable items outside visible area
    this.updateInventorySlotInteractivity()
  }

  private createInventorySlot(x: number, y: number, index: number): InventorySlot {
    const container = this.add.container(x, y)
    if (this.inventoryContainer) {
      this.inventoryContainer.add(container)
    }

    // Background
    const bg = this.add.rectangle(0, 0, this.INVENTORY_SLOT_SIZE, this.INVENTORY_SLOT_SIZE, 0x252540, 1)
    bg.setStrokeStyle(1, 0x3a3a55)
    container.add(bg)

    // Item sprite (hidden by default)
    const itemSprite = this.add.image(0, -6, '')
    itemSprite.setVisible(false)
    itemSprite.setName('itemSprite')
    container.add(itemSprite)

    const levelText = this.add
      .text(0, 18, '', {
        fontSize: '9px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      })
      .setOrigin(0.5)
    levelText.setName('levelText')
    container.add(levelText)

    // Make interactive - use pointerup to differentiate from scroll gestures
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerup', () => {
      // Only trigger click if we weren't scrolling (drag distance below threshold)
      if (this.dragDistance < this.DRAG_THRESHOLD) {
        this.onInventorySlotClick(index)
      }
    })
    bg.on('pointerover', () => {
      const slot = this.inventorySlots[index]
      if (slot && slot.item) {
        bg.setFillStyle(0x353550)
      }
    })
    bg.on('pointerout', () => {
      bg.setFillStyle(0x252540)
    })

    return {
      container,
      background: bg,
      item: null,
    }
  }

  private updateInventoryScroll(): void {
    if (this.inventoryContainer) {
      this.inventoryContainer.y = this.inventoryStartY - this.scrollOffset
    }
    this.updateScrollIndicator()
    this.updateInventorySlotInteractivity()
  }

  /**
   * Enable/disable input on inventory slots based on whether they're visible in the masked area.
   * This prevents invisible (scrolled-out) items from capturing clicks meant for other UI elements.
   */
  private updateInventorySlotInteractivity(): void {
    // Guard against scene not being active or inventory container not ready
    if (!this.inventoryContainer || !this.scene || !this.sys?.isActive()) return

    const maskTop = this.inventoryStartY
    const maskBottom = this.inventoryStartY + this.visibleHeight

    this.inventorySlots.forEach((slot) => {
      // Skip if background was destroyed
      if (!slot.background || !slot.background.scene) return

      // Calculate the slot's world Y position
      // The slot's local Y is relative to the container, which is positioned at (inventoryStartY - scrollOffset)
      const containerY = this.inventoryContainer!.y
      const slotWorldY = containerY + slot.container.y
      const slotHalfHeight = this.INVENTORY_SLOT_SIZE / 2

      // Check if the slot is within the visible mask area
      const isVisible =
        (slotWorldY + slotHalfHeight) > maskTop &&
        (slotWorldY - slotHalfHeight) < maskBottom

      // Enable or disable interactivity based on visibility
      if (isVisible) {
        if (!slot.background.input?.enabled) {
          slot.background.setInteractive({ useHandCursor: true })
        }
      } else {
        if (slot.background.input?.enabled) {
          slot.background.disableInteractive()
        }
      }
    })
  }

  private createScrollIndicator(): void {
    if (this.maxScroll <= 0) return

    const { width } = this.cameras.main
    const indicatorX = width - 15
    const indicatorHeight = this.visibleHeight - 20
    const indicatorY = this.inventoryStartY + 10

    this.scrollIndicator = this.add.container(indicatorX, indicatorY)

    // Track background
    const track = this.add.rectangle(0, indicatorHeight / 2, 6, indicatorHeight, 0x333355, 0.5)
    track.setStrokeStyle(1, 0x444466)
    this.scrollIndicator.add(track)

    // Thumb (scrollbar handle)
    const thumbHeight = Math.max(30, (this.visibleHeight / (this.visibleHeight + this.maxScroll)) * indicatorHeight)
    const thumb = this.add.rectangle(0, thumbHeight / 2, 6, thumbHeight, 0x6666aa)
    thumb.setName('thumb')
    this.scrollIndicator.add(thumb)
  }

  private updateScrollIndicator(): void {
    if (!this.scrollIndicator || this.maxScroll <= 0) return

    const thumb = this.scrollIndicator.getByName('thumb') as Phaser.GameObjects.Rectangle
    if (!thumb) return

    const indicatorHeight = this.visibleHeight - 20
    const thumbHeight = thumb.height
    const scrollRatio = this.scrollOffset / this.maxScroll
    const thumbY = thumbHeight / 2 + scrollRatio * (indicatorHeight - thumbHeight)
    thumb.y = thumbY
  }

  private setupTouchScrolling(): void {
    // Track pointer events at the scene level for scrolling
    // This allows click events to still pass through to inventory items

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check if pointer is within the inventory area
      const inInventoryArea =
        pointer.y >= this.inventoryStartY &&
        pointer.y <= this.inventoryStartY + this.visibleHeight

      if (inInventoryArea && this.maxScroll > 0) {
        this.isDragging = true
        this.dragStartY = pointer.y
        this.dragStartScroll = this.scrollOffset
        this.dragDistance = 0
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.maxScroll <= 0) return

      const deltaY = this.dragStartY - pointer.y
      this.dragDistance = Math.abs(deltaY)

      // Only scroll after exceeding the drag threshold
      if (this.dragDistance > this.DRAG_THRESHOLD) {
        this.scrollOffset = Phaser.Math.Clamp(this.dragStartScroll + deltaY, 0, this.maxScroll)
        this.updateInventoryScroll()
      }
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
      this.dragDistance = 0
    })

    this.input.on('pointerupoutside', () => {
      this.isDragging = false
      this.dragDistance = 0
    })
  }

  private createGoldDisplay(): void {
    const { width, height } = this.cameras.main
    const gold = currencyManager.get('gold')

    this.goldText = this.add
      .text(20, height - 100, `Gold: ${gold}`, {
        fontSize: '16px',
        color: '#FFD700',
      })
      .setOrigin(0, 0.5)

    // Fusion button
    this.fusionButton = this.add
      .text(width - 20, height - 100, 'FUSE', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#6b4aa3',
        padding: { x: 15, y: 8 },
      })
      .setOrigin(1, 0.5)

    this.fusionButton.setInteractive({ useHandCursor: true })
    this.fusionButton.on('pointerdown', () => this.onFusionClick())
    UIAnimations.applyButtonEffects(this, this.fusionButton)

    // Fuse All button (to the left of FUSE)
    this.fuseAllButton = this.add
      .text(width - 90, height - 100, 'FUSE ALL', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#6b4aa3',
        padding: { x: 10, y: 8 },
      })
      .setOrigin(1, 0.5)

    this.fuseAllButton.setInteractive({ useHandCursor: true })
    this.fuseAllButton.on('pointerdown', () => this.onFuseAllClick())
    UIAnimations.applyButtonEffects(this, this.fuseAllButton)

    this.updateFusionButton()
  }

  private createBackButton(): void {
    const { width, height } = this.cameras.main

    const backButton = this.add
      .text(width / 2, height - 40, 'BACK', {
        fontSize: '18px',
        color: '#ffffff',
        backgroundColor: '#444455',
        padding: { x: 40, y: 10 },
      })
      .setOrigin(0.5)

    backButton.setInteractive({ useHandCursor: true })
    backButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.scene.start('MainMenuScene')
    })
    UIAnimations.applyButtonEffects(this, backButton)
  }

  private setupEventListeners(): void {
    // Store handler references so we can properly unsubscribe in shutdown
    this.inventoryChangedHandler = () => {
      this.refreshDisplay()
    }
    this.equippedChangedHandler = () => {
      this.refreshDisplay()
    }
    this.itemUpgradedHandler = () => {
      this.refreshDisplay()
      this.updateGoldDisplay()
    }
    this.itemFusedHandler = () => {
      this.refreshDisplay()
      this.hideDetailPanel()
    }
    this.itemSoldHandler = () => {
      this.refreshDisplay()
      this.updateGoldDisplay()
    }

    equipmentManager.on(EQUIPMENT_EVENTS.INVENTORY_CHANGED, this.inventoryChangedHandler)
    equipmentManager.on(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, this.equippedChangedHandler)
    equipmentManager.on(EQUIPMENT_EVENTS.ITEM_UPGRADED, this.itemUpgradedHandler)
    equipmentManager.on(EQUIPMENT_EVENTS.ITEM_FUSED, this.itemFusedHandler)
    equipmentManager.on(EQUIPMENT_EVENTS.ITEM_SOLD, this.itemSoldHandler)
  }

  private refreshDisplay(): void {
    this.refreshEquippedSlots()
    this.refreshInventorySlots()
    this.updateFusionButton()
    this.updateGoldDisplay()
  }

  private refreshEquippedSlots(): void {
    EQUIPMENT_SLOTS.forEach((slot) => {
      const container = this.equippedSlots.get(slot)
      if (!container) return

      const equipped = equipmentManager.getEquipped(slot)
      const icon = container.getByName('icon') as Phaser.GameObjects.Text | null
      const itemBg = container.getByName('itemBg') as Phaser.GameObjects.Rectangle | null
      const itemSprite = container.getByName('itemSprite') as Phaser.GameObjects.Image | null
      const levelText = container.getByName('levelText') as Phaser.GameObjects.Text | null
      const bg = container.list[0] as Phaser.GameObjects.Rectangle | undefined

      // Guard against missing UI elements (can happen if scene not fully initialized)
      if (!icon || !itemBg || !itemSprite || !levelText || !bg) return

      if (equipped) {
        // Show item
        icon.setVisible(false)
        itemBg.setVisible(true)
        itemSprite.setVisible(true)
        levelText.setVisible(true)

        // Set rarity color
        const rarityColor = Phaser.Display.Color.HexStringToColor(RARITY_CONFIGS[equipped.rarity].color)
        itemBg.setStrokeStyle(2, rarityColor.color)
        bg.setStrokeStyle(2, rarityColor.color)

        // Set item sprite
        itemSprite.setTexture(`equip_${equipped.type}`)
        itemSprite.setScale((this.SLOT_SIZE - 20) / itemSprite.width)

        // Set level info
        levelText.setText(`Lv.${equipped.level}`)
      } else {
        // Show empty slot
        icon.setVisible(true)
        itemBg.setVisible(false)
        itemSprite.setVisible(false)
        levelText.setVisible(false)
        bg.setStrokeStyle(2, 0x444466)
      }
    })
  }

  private refreshInventorySlots(): void {
    const inventory = equipmentManager.getInventory()
    const allEquipped = equipmentManager.getAllEquipped()
    const equippedIds = new Set(
      Object.values(allEquipped)
        .filter((item): item is Equipment => item !== null)
        .map((item) => item.id)
    )

    // Filter out equipped items from inventory display
    const unequippedInventory = inventory.filter((item) => !equippedIds.has(item.id))

    this.inventorySlots.forEach((slot, index) => {
      const item = unequippedInventory[index] ?? null
      slot.item = item

      const itemSprite = slot.container.getByName('itemSprite') as Phaser.GameObjects.Image | null
      const levelText = slot.container.getByName('levelText') as Phaser.GameObjects.Text | null

      // Guard against missing UI elements (can happen if scene not fully initialized)
      if (!itemSprite || !levelText) return

      if (item) {
        const rarityColor = Phaser.Display.Color.HexStringToColor(RARITY_CONFIGS[item.rarity].color)
        slot.background.setStrokeStyle(2, rarityColor.color)

        itemSprite.setTexture(`equip_${item.type}`)
        itemSprite.setScale((this.INVENTORY_SLOT_SIZE - 16) / itemSprite.width)
        itemSprite.setVisible(true)

        levelText.setText(`Lv.${item.level}`)
        levelText.setVisible(true)
      } else {
        slot.background.setStrokeStyle(1, 0x3a3a55)
        itemSprite.setVisible(false)
        levelText.setVisible(false)
      }
    })
  }

  private onEquippedSlotClick(slot: EquipmentSlotType): void {
    audioManager.playMenuSelect()
    const equipped = equipmentManager.getEquipped(slot)

    if (equipped) {
      // Show detail panel with unequip option
      this.showDetailPanel(equipped, true)
    }
  }

  private onInventorySlotClick(index: number): void {
    const slot = this.inventorySlots[index]
    if (!slot || !slot.item) return

    audioManager.playMenuSelect()
    this.showDetailPanel(slot.item, false)
  }

  private showDetailPanel(item: Equipment, isEquipped: boolean): void {
    this.hideDetailPanel()

    const { width, height } = this.cameras.main
    const panelWidth = width - 40
    const panelHeight = 280 // Increased height
    const panelY = height / 2

    this.detailPanel = this.add.container(width / 2, panelY)
    // Set high depth to ensure popup appears above inventory (depth 1) and equipped slots (depth 10)
    this.detailPanel.setDepth(100)

    // Backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
    backdrop.setInteractive()
    backdrop.on('pointerdown', () => this.hideDetailPanel())
    this.detailPanel.add(backdrop)

    // Panel background
    const bg = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x1a1a2e, 1)
    const rarityColor = Phaser.Display.Color.HexStringToColor(RARITY_CONFIGS[item.rarity].color)
    bg.setStrokeStyle(3, rarityColor.color)
    this.detailPanel.add(bg)

    // Close button
    const closeBtn = this.add
      .text(panelWidth / 2 - 20, -panelHeight / 2 + 20, '✕', {
        fontSize: '24px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
    closeBtn.setInteractive({ useHandCursor: true })
    closeBtn.on('pointerdown', () => this.hideDetailPanel())
    UIAnimations.applyButtonEffects(this, closeBtn)
    this.detailPanel.add(closeBtn)

    // Item large sprite - use setDisplaySize to avoid scaling issues with missing textures
    const largeSprite = this.add.image(-panelWidth / 2 + 60, -panelHeight / 2 + 70, `equip_${item.type}`)
    largeSprite.setDisplaySize(80, 80)
    this.detailPanel.add(largeSprite)

    // Item name with rarity
    const rarityConfig = RARITY_CONFIGS[item.rarity]
    const nameText = this.add
      .text(-panelWidth / 2 + 110, -panelHeight / 2 + 50, item.name, {
        fontSize: '20px',
        color: rarityConfig.color,
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    this.detailPanel.add(nameText)

    const rarityText = this.add
      .text(-panelWidth / 2 + 110, -panelHeight / 2 + 75, rarityConfig.name, {
        fontSize: '14px',
        color: rarityConfig.color,
      })
      .setOrigin(0, 0.5)
    this.detailPanel.add(rarityText)

    // Level and max level
    const levelInfo = this.add
      .text(-panelWidth / 2 + 110, -panelHeight / 2 + 95, `Level ${item.level} / ${rarityConfig.maxLevel}`, {
        fontSize: '12px',
        color: '#aaaaaa',
      })
      .setOrigin(0, 0.5)
    this.detailPanel.add(levelInfo)

    // Divider
    const divider = this.add.rectangle(0, -panelHeight / 2 + 130, panelWidth - 40, 1, 0x444466)
    this.detailPanel.add(divider)

    // Stats display
    const statsY = -panelHeight / 2 + 150
    let yOffset = 0
    const statsEntries = Object.entries(item.baseStats)

    statsEntries.forEach(([stat, value]) => {
      if (value !== undefined && value !== 0) {
        const statName = this.formatStatName(stat)
        const statText = this.add
          .text(-panelWidth / 2 + 30, statsY + yOffset, `${statName}: +${this.formatStatValue(value)}`, {
            fontSize: '14px',
            color: '#88ff88',
          })
          .setOrigin(0, 0)
        this.detailPanel?.add(statText)
        yOffset += 22
      }
    })

    // Perks display
    if (item.perks.length > 0) {
      yOffset += 10
      const perksLabel = this.add
        .text(-panelWidth / 2 + 30, statsY + yOffset, 'Unique Perks:', {
          fontSize: '14px',
          color: '#aaaaaa',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0)
      this.detailPanel.add(perksLabel)
      yOffset += 22

      item.perks.forEach((perk) => {
        const perkText = this.add
          .text(-panelWidth / 2 + 40, statsY + yOffset, `• ${this.formatPerkName(perk)}`, {
            fontSize: '13px',
            color: '#ffaa00',
          })
          .setOrigin(0, 0)
        this.detailPanel?.add(perkText)
        yOffset += 20
      })
    }

    // Action buttons
    const buttonY = panelHeight / 2 - 40

    if (isEquipped) {
      // Unequip button (left)
      const unequipBtn = this.add
        .text(-80, buttonY, 'UNEQUIP', {
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#aa4444',
          padding: { x: 20, y: 10 },
        })
        .setOrigin(0.5)

      unequipBtn.setInteractive({ useHandCursor: true })
      unequipBtn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        equipmentManager.unequip(item.slot)
        this.hideDetailPanel()
      })
      UIAnimations.applyButtonEffects(this, unequipBtn)
      this.detailPanel.add(unequipBtn)
    } else {
      // Equip button (left)
      const equipBtn = this.add
        .text(-110, buttonY, 'EQUIP', {
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#44aa44',
          padding: { x: 15, y: 10 },
        })
        .setOrigin(0.5)

      equipBtn.setInteractive({ useHandCursor: true })
      equipBtn.on('pointerdown', () => {
        audioManager.playMenuSelect()
        equipmentManager.equip(item)
        this.hideDetailPanel()
      })
      UIAnimations.applyButtonEffects(this, equipBtn)
      this.detailPanel.add(equipBtn)

      // Sell button (center) - only for inventory items
      const sellPrice = equipmentManager.getSellPrice(item)
      const sellBtn = this.add
        .text(0, buttonY, `SELL (${sellPrice}g)`, {
          fontSize: '16px',
          color: '#ffffff',
          backgroundColor: '#aa6622',
          padding: { x: 15, y: 10 },
        })
        .setOrigin(0.5)

      sellBtn.setInteractive({ useHandCursor: true })
      sellBtn.on('pointerdown', () => this.onSellClick(item))
      UIAnimations.applyButtonEffects(this, sellBtn)
      this.detailPanel.add(sellBtn)
    }

    // Upgrade button (right)
    const canUpgrade = equipmentManager.canUpgrade(item)
    const upgradeCost = equipmentManager.getUpgradeCost(item)
    const canAfford = currencyManager.canAfford('gold', upgradeCost.gold)

    const upgradeColor = canUpgrade.canUpgrade && canAfford ? '#4477aa' : '#333344'
    const upgradeBtn = this.add
      .text(isEquipped ? 80 : 110, buttonY, `+LV (${upgradeCost.gold}g)`, {
        fontSize: '16px',
        color: canUpgrade.canUpgrade && canAfford ? '#ffffff' : '#888888',
        backgroundColor: upgradeColor,
        padding: { x: 15, y: 10 },
      })
      .setOrigin(0.5)

    if (canUpgrade.canUpgrade && canAfford) {
      upgradeBtn.setInteractive({ useHandCursor: true })
      upgradeBtn.on('pointerdown', () => this.onUpgradeClick(item))
      UIAnimations.applyButtonEffects(this, upgradeBtn)
    }
    this.detailPanel.add(upgradeBtn)

    // Animation in
    UIAnimations.showModal(this, this.detailPanel)
  }

  private hideDetailPanel(): void {
    if (this.detailPanel) {
      const panel = this.detailPanel
      UIAnimations.hideModal(this, panel, UIAnimations.DURATION.FAST, () => {
        panel.destroy()
      })
      this.detailPanel = null
    }
  }

  private formatStatName(stat: string): string {
    // Convert camelCase to readable format
    return stat
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('Percent', '%')
  }

  private formatStatValue(value: number): string {
    // Round to 1 decimal place, but show as integer if whole number
    const rounded = Math.round(value * 10) / 10
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
  }

  private formatPerkName(perk: string): string {
    // Convert snake_case to readable format
    return perk
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  private onUpgradeClick(item: Equipment): void {
    const result = equipmentManager.upgrade(item, (cost) => {
      return currencyManager.spend('gold', cost.gold)
    })

    if (result.success) {
      audioManager.playAbilitySelect()
      // Refresh the detail panel with updated stats
      const isEquipped = equipmentManager.isEquipped(item.id)
      this.showDetailPanel(item, isEquipped)
    } else {
      // Could show error message here
      console.warn('Upgrade failed:', result.error)
    }
  }

  private onSellClick(item: Equipment): void {
    const goldEarned = equipmentManager.sellItem(item.id)
    if (goldEarned > 0) {
      audioManager.playAbilitySelect()
      this.hideDetailPanel()
      this.updateGoldDisplay()
    }
  }

  private onFusionClick(): void {
    const fusionCandidates = equipmentManager.findFusionCandidates()

    if (fusionCandidates.size === 0) {
      // No fusion available
      return
    }

    // Get first available fusion group
    const firstGroup = fusionCandidates.values().next().value as Equipment[]
    if (firstGroup && firstGroup.length >= 3) {
      const itemsToFuse = firstGroup.slice(0, 3)
      const result = equipmentManager.fuse(itemsToFuse)

      if (result.success) {
        audioManager.playLevelUp()
        // Show the new item
        if (result.resultingItem) {
          this.showDetailPanel(result.resultingItem, false)
        }
      } else {
        console.warn('Fusion failed:', result.error)
      }
    }
  }

  private onFuseAllClick(): void {
    const result = equipmentManager.fuseAll()

    if (result.success) {
      audioManager.playLevelUp()
      // Show the highest rarity result item
      const bestResult = result.results.reduce((best, item) =>
        item.rarity > best.rarity ? item : best
      )
      this.showDetailPanel(bestResult, false)
    }
  }

  private updateFusionButton(): void {
    const fusionCandidates = equipmentManager.findFusionCandidates()
    const hasFusionAvailable = fusionCandidates.size > 0

    const buttons = [this.fusionButton, this.fuseAllButton].filter(
      (btn): btn is Phaser.GameObjects.Text => btn !== null
    )

    for (const button of buttons) {
      if (hasFusionAvailable) {
        button.setStyle({ backgroundColor: '#6b4aa3', color: '#ffffff' })
        button.setInteractive({ useHandCursor: true })
      } else {
        button.setStyle({ backgroundColor: '#3a3a55', color: '#666666' })
        button.disableInteractive()
      }
    }
  }

  private updateGoldDisplay(): void {
    if (this.goldText) {
      const gold = currencyManager.get('gold')
      this.goldText.setText(`Gold: ${gold}`)
    }
  }

  shutdown(): void {
    // Clean up event listeners to prevent updates on destroyed objects
    if (this.inventoryChangedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.INVENTORY_CHANGED, this.inventoryChangedHandler)
      this.inventoryChangedHandler = null
    }
    if (this.equippedChangedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.EQUIPPED_CHANGED, this.equippedChangedHandler)
      this.equippedChangedHandler = null
    }
    if (this.itemUpgradedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.ITEM_UPGRADED, this.itemUpgradedHandler)
      this.itemUpgradedHandler = null
    }
    if (this.itemFusedHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.ITEM_FUSED, this.itemFusedHandler)
      this.itemFusedHandler = null
    }
    if (this.itemSoldHandler) {
      equipmentManager.off(EQUIPMENT_EVENTS.ITEM_SOLD, this.itemSoldHandler)
      this.itemSoldHandler = null
    }
  }
}
