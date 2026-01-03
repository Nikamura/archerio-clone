/**
 * EncyclopediaScene - In-game guide/documentation browser
 *
 * Displays information about all game content:
 * - Equipment (weapons, armor, rings, spirits)
 * - Enemies and Bosses (chapter-locked until reached)
 * - Abilities (in-run upgrades)
 * - Talents (permanent upgrades)
 * - Heroes, Perks, Achievements, Chests
 */

import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { encyclopediaManager } from '../systems/EncyclopediaManager'
import { saveManager } from '../systems/SaveManager'
import * as UIAnimations from '../systems/UIAnimations'
import {
  EncyclopediaCategory,
  CATEGORY_TABS,
  getAllEquipmentEntries,
  getAllEnemyEntries,
  getAllBossEntries,
  getAllAbilityEntries,
  getAllTalentEntries,
  getAllHeroEntries,
  getAllPerkEntries,
  getAllAchievementEntries,
  getAllChestEntries,
  EquipmentEncyclopediaEntry,
  EnemyEncyclopediaEntry,
  BossEncyclopediaEntry,
  AbilityEncyclopediaEntry,
  TalentEncyclopediaEntry,
  HeroEncyclopediaEntry,
  PerkEncyclopediaEntry,
  AchievementEncyclopediaEntry,
  ChestEncyclopediaEntry,
} from '../config/encyclopediaData'
import { Rarity, RARITY_CONFIGS } from '../systems/Equipment'

// ============================================
// Types
// ============================================

type AnyEntry =
  | EquipmentEncyclopediaEntry
  | EnemyEncyclopediaEntry
  | BossEncyclopediaEntry
  | AbilityEncyclopediaEntry
  | TalentEncyclopediaEntry
  | HeroEncyclopediaEntry
  | PerkEncyclopediaEntry
  | AchievementEncyclopediaEntry
  | ChestEncyclopediaEntry

interface EntryCard {
  container: Phaser.GameObjects.Container
  background: Phaser.GameObjects.Rectangle
  entry: AnyEntry
  isLocked: boolean
}

// ============================================
// Scene
// ============================================

export default class EncyclopediaScene extends Phaser.Scene {
  // Layout constants
  private readonly TAB_HEIGHT = 36
  private readonly TAB_WIDTH = 70
  private readonly TAB_GAP = 4
  private readonly ENTRY_HEIGHT = 70
  private readonly ENTRY_GAP = 8
  private readonly CONTENT_PADDING = 15

  // State
  private activeCategory: EncyclopediaCategory = 'equipment'
  private tabContainer: Phaser.GameObjects.Container | null = null
  private tabButtons: Map<EncyclopediaCategory, Phaser.GameObjects.Container> = new Map()

  // Tab horizontal scroll
  private tabScrollOffset = 0
  private tabMaxScroll = 0
  private isTabDragging = false
  private tabDragStartX = 0
  private tabDragStartScroll = 0
  private tabDragDistance = 0

  // Scrolling
  private contentContainer: Phaser.GameObjects.Container | null = null
  private scrollOffset = 0
  private maxScroll = 0
  private contentStartY = 0
  private visibleHeight = 0
  private scrollIndicator: Phaser.GameObjects.Container | null = null

  // Touch scroll state
  private isDragging = false
  private dragStartY = 0
  private dragStartScroll = 0
  private dragDistance = 0
  private readonly DRAG_THRESHOLD = 10

  // Entry cards
  private entryCards: EntryCard[] = []

  // Detail panel
  private detailPanel: Phaser.GameObjects.Container | null = null

  constructor() {
    super({ key: 'EncyclopediaScene' })
  }

  create(): void {
    const { width, height } = this.cameras.main

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header
    this.createHeader()

    // Tab navigation
    this.createTabNavigation()

    // Content area
    this.createContentArea()

    // Back button
    this.createBackButton()

    // Initial render
    this.renderCategory(this.activeCategory)

    // Cleanup on shutdown
    this.events.once('shutdown', this.shutdown, this)
  }

  private createHeader(): void {
    const { width } = this.cameras.main

    this.add
      .text(width / 2, 25, 'ENCYCLOPEDIA', {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
  }

  private createTabNavigation(): void {
    const { width } = this.cameras.main
    const tabY = 60
    const tabAreaPadding = 10

    // Mask for horizontal scroll
    const maskGraphics = this.make.graphics({})
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(tabAreaPadding, tabY - this.TAB_HEIGHT / 2, width - tabAreaPadding * 2, this.TAB_HEIGHT)
    const mask = maskGraphics.createGeometryMask()

    // Container for tabs
    this.tabContainer = this.add.container(0, tabY)
    this.tabContainer.setMask(mask)

    // Calculate total width and max scroll
    const totalTabWidth = CATEGORY_TABS.length * (this.TAB_WIDTH + this.TAB_GAP) - this.TAB_GAP
    const visibleWidth = width - tabAreaPadding * 2
    this.tabMaxScroll = Math.max(0, totalTabWidth - visibleWidth)

    // Position tabs - start from left edge with padding
    const startX = tabAreaPadding + this.TAB_WIDTH / 2

    CATEGORY_TABS.forEach((tab, index) => {
      const x = startX + index * (this.TAB_WIDTH + this.TAB_GAP)
      const tabButton = this.createTabButton(x, 0, tab.id, tab.label, tab.color)
      this.tabContainer!.add(tabButton)
      this.tabButtons.set(tab.id, tabButton)
    })

    // Setup horizontal tab scrolling
    this.setupTabScrolling(tabY)

    // Initial tab highlight
    this.updateTabHighlights()

    // Add scroll hint arrows if scrollable
    if (this.tabMaxScroll > 0) {
      this.addTabScrollHints(tabY)
    }
  }

  private setupTabScrolling(tabY: number): void {
    const tabAreaTop = tabY - this.TAB_HEIGHT / 2 - 5
    const tabAreaBottom = tabY + this.TAB_HEIGHT / 2 + 5

    // Handler for detecting tab area drags
    const onTabPointerDown = (pointer: Phaser.Input.Pointer) => {
      if (this.detailPanel) return
      if (pointer.y >= tabAreaTop && pointer.y <= tabAreaBottom) {
        this.isTabDragging = true
        this.tabDragStartX = pointer.x
        this.tabDragStartScroll = this.tabScrollOffset
        this.tabDragDistance = 0
      }
    }

    this.input.on('pointerdown', onTabPointerDown)

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isTabDragging || this.tabMaxScroll <= 0) return
      const deltaX = this.tabDragStartX - pointer.x
      this.tabDragDistance = Math.abs(deltaX)
      if (this.tabDragDistance >= this.DRAG_THRESHOLD) {
        this.tabScrollOffset = Phaser.Math.Clamp(this.tabDragStartScroll + deltaX, 0, this.tabMaxScroll)
        this.updateTabScroll()
      }
    })

    this.input.on('pointerup', () => {
      this.isTabDragging = false
    })
  }

  private updateTabScroll(): void {
    if (this.tabContainer) {
      this.tabContainer.x = -this.tabScrollOffset
    }
  }

  private addTabScrollHints(tabY: number): void {
    const { width } = this.cameras.main

    // Left arrow hint
    const leftArrow = this.add
      .text(5, tabY, '◀', {
        fontSize: '14px',
        color: '#666688',
      })
      .setOrigin(0.5)
      .setDepth(5)

    // Right arrow hint
    const rightArrow = this.add
      .text(width - 5, tabY, '▶', {
        fontSize: '14px',
        color: '#666688',
      })
      .setOrigin(0.5)
      .setDepth(5)

    // Make arrows interactive for convenience
    leftArrow.setInteractive({ useHandCursor: true })
    leftArrow.on('pointerdown', () => {
      this.tabScrollOffset = Math.max(0, this.tabScrollOffset - 150)
      this.updateTabScroll()
    })

    rightArrow.setInteractive({ useHandCursor: true })
    rightArrow.on('pointerdown', () => {
      this.tabScrollOffset = Math.min(this.tabMaxScroll, this.tabScrollOffset + 150)
      this.updateTabScroll()
    })
  }

  private createTabButton(
    x: number,
    y: number,
    category: EncyclopediaCategory,
    label: string,
    color: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    // Background
    const bg = this.add.rectangle(0, 0, this.TAB_WIDTH, this.TAB_HEIGHT, 0x2d2d44, 1)
    bg.setStrokeStyle(1, 0x444466)
    container.add(bg)

    // Label
    const text = this.add
      .text(0, 0, label, {
        fontSize: '11px',
        color: '#aaaaaa',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    text.setName('label')
    container.add(text)

    // Interaction
    bg.setInteractive({ useHandCursor: true })
    bg.on('pointerup', () => {
      // Only trigger click if we weren't dragging
      if (this.tabDragDistance < this.DRAG_THRESHOLD) {
        audioManager.playMenuSelect()
        this.switchToCategory(category)
      }
    })
    bg.on('pointerover', () => {
      if (category !== this.activeCategory) {
        bg.setFillStyle(0x3d3d54)
      }
    })
    bg.on('pointerout', () => {
      if (category !== this.activeCategory) {
        bg.setFillStyle(0x2d2d44)
      }
    })

    container.setData('category', category)
    container.setData('color', color)

    return container
  }

  private updateTabHighlights(): void {
    this.tabButtons.forEach((button, category) => {
      const bg = button.first as Phaser.GameObjects.Rectangle
      const label = button.getByName('label') as Phaser.GameObjects.Text

      if (category === this.activeCategory) {
        const color = button.getData('color') as number
        bg.setFillStyle(color)
        bg.setStrokeStyle(2, 0xffffff)
        label.setStyle({ color: '#ffffff' })
      } else {
        bg.setFillStyle(0x2d2d44)
        bg.setStrokeStyle(1, 0x444466)
        label.setStyle({ color: '#aaaaaa' })
      }
    })
  }

  private createContentArea(): void {
    const { width, height } = this.cameras.main
    this.contentStartY = 105
    this.visibleHeight = height - this.contentStartY - 60

    // Mask for scrolling
    const maskGraphics = this.make.graphics({})
    maskGraphics.fillStyle(0xffffff)
    maskGraphics.fillRect(
      this.CONTENT_PADDING,
      this.contentStartY,
      width - this.CONTENT_PADDING * 2,
      this.visibleHeight
    )
    const mask = maskGraphics.createGeometryMask()

    // Content container
    this.contentContainer = this.add.container(0, this.contentStartY)
    this.contentContainer.setMask(mask)
    this.contentContainer.setDepth(1)

    // Scroll input - wheel for desktop
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        if (this.maxScroll <= 0 || this.detailPanel) return
        this.scrollOffset = Phaser.Math.Clamp(this.scrollOffset + deltaY, 0, this.maxScroll)
        this.updateContentScroll()
      }
    )

    // Touch scrolling
    this.setupTouchScrolling()
  }

  private setupTouchScrolling(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.detailPanel) return
      if (pointer.y >= this.contentStartY && pointer.y <= this.contentStartY + this.visibleHeight) {
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
      if (this.dragDistance >= this.DRAG_THRESHOLD) {
        this.scrollOffset = Phaser.Math.Clamp(this.dragStartScroll + deltaY, 0, this.maxScroll)
        this.updateContentScroll()
      }
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
    })
  }

  private updateContentScroll(): void {
    if (this.contentContainer) {
      this.contentContainer.y = this.contentStartY - this.scrollOffset
    }
    this.updateScrollIndicator()
    this.updateEntryCardInteractivity()
  }

  private updateEntryCardInteractivity(): void {
    if (!this.contentContainer || !this.scene || !this.sys?.isActive()) return

    const maskTop = this.contentStartY
    const maskBottom = this.contentStartY + this.visibleHeight

    this.entryCards.forEach((card) => {
      if (!card.background || !card.background.scene) return

      const containerY = this.contentContainer!.y
      const cardWorldY = containerY + card.container.y

      // Check if the card's CENTER is within the visible mask area
      // Using center-based check prevents items just outside the mask from catching clicks
      const isVisible = cardWorldY >= maskTop && cardWorldY <= maskBottom

      if (isVisible) {
        if (!card.background.input?.enabled) {
          card.background.setInteractive({ useHandCursor: true })
        }
      } else {
        if (card.background.input?.enabled) {
          card.background.disableInteractive()
        }
      }
    })
  }

  private createScrollIndicator(): void {
    if (this.scrollIndicator) {
      this.scrollIndicator.destroy()
      this.scrollIndicator = null
    }

    if (this.maxScroll <= 0) return

    const { width } = this.cameras.main
    const indicatorX = width - 12
    const indicatorHeight = this.visibleHeight - 20
    const indicatorY = this.contentStartY + 10

    this.scrollIndicator = this.add.container(indicatorX, indicatorY)
    this.scrollIndicator.setDepth(10)

    // Track
    const track = this.add.rectangle(0, indicatorHeight / 2, 4, indicatorHeight, 0x333355, 0.5)
    this.scrollIndicator.add(track)

    // Thumb
    const thumbHeight = Math.max(30, (this.visibleHeight / (this.visibleHeight + this.maxScroll)) * indicatorHeight)
    const thumb = this.add.rectangle(0, thumbHeight / 2, 4, thumbHeight, 0x666688, 1)
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

  private switchToCategory(category: EncyclopediaCategory): void {
    if (category === this.activeCategory) return
    this.activeCategory = category
    this.updateTabHighlights()
    this.scrollOffset = 0
    this.scrollTabToCategory(category)
    this.renderCategory(category)
  }

  private scrollTabToCategory(category: EncyclopediaCategory): void {
    if (this.tabMaxScroll <= 0) return

    // Find index of the category
    const index = CATEGORY_TABS.findIndex((t) => t.id === category)
    if (index < 0) return

    const { width } = this.cameras.main
    const tabAreaPadding = 10
    const visibleWidth = width - tabAreaPadding * 2

    // Calculate tab position
    const tabX = tabAreaPadding + index * (this.TAB_WIDTH + this.TAB_GAP)

    // Scroll so the tab is visible with some padding
    const tabPadding = 20
    if (tabX - this.tabScrollOffset < tabPadding) {
      // Tab is to the left - scroll left
      this.tabScrollOffset = Math.max(0, tabX - tabPadding)
    } else if (tabX + this.TAB_WIDTH - this.tabScrollOffset > visibleWidth - tabPadding) {
      // Tab is to the right - scroll right
      this.tabScrollOffset = Math.min(this.tabMaxScroll, tabX + this.TAB_WIDTH - visibleWidth + tabPadding)
    }
    this.updateTabScroll()
  }

  private renderCategory(category: EncyclopediaCategory): void {
    // Clear existing entries
    this.entryCards.forEach((card) => card.container.destroy())
    this.entryCards = []

    if (this.scrollIndicator) {
      this.scrollIndicator.destroy()
      this.scrollIndicator = null
    }

    const { width } = this.cameras.main
    const cardWidth = width - this.CONTENT_PADDING * 2 - 10
    let currentY = this.ENTRY_HEIGHT / 2 + 5

    // Get entries based on category
    const entries = this.getEntriesForCategory(category)

    entries.forEach((entry) => {
      const isLocked = this.isEntryLocked(category, entry)
      const card = this.createEntryCard(
        width / 2,
        currentY,
        cardWidth,
        entry,
        category,
        isLocked
      )
      this.entryCards.push(card)
      currentY += this.ENTRY_HEIGHT + this.ENTRY_GAP
    })

    // Calculate scroll
    const contentHeight = currentY + 10
    this.maxScroll = Math.max(0, contentHeight - this.visibleHeight)

    // Create scroll indicator
    this.createScrollIndicator()
    this.updateContentScroll()
  }

  private getEntriesForCategory(category: EncyclopediaCategory): AnyEntry[] {
    switch (category) {
      case 'equipment':
        return getAllEquipmentEntries()
      case 'enemies':
        return getAllEnemyEntries()
      case 'bosses':
        return getAllBossEntries()
      case 'abilities':
        return getAllAbilityEntries()
      case 'talents':
        return getAllTalentEntries()
      case 'heroes':
        return getAllHeroEntries()
      case 'perks':
        return getAllPerkEntries()
      case 'achievements':
        return getAllAchievementEntries()
      case 'chests':
        return getAllChestEntries()
      default:
        return []
    }
  }

  private isEntryLocked(category: EncyclopediaCategory, entry: AnyEntry): boolean {
    if (category === 'enemies') {
      const enemyEntry = entry as EnemyEncyclopediaEntry
      return !encyclopediaManager.isEnemyUnlocked(enemyEntry.id)
    }
    if (category === 'bosses') {
      const bossEntry = entry as BossEncyclopediaEntry
      return !encyclopediaManager.isBossUnlocked(bossEntry.id)
    }
    return false
  }

  private createEntryCard(
    x: number,
    y: number,
    cardWidth: number,
    entry: AnyEntry,
    category: EncyclopediaCategory,
    isLocked: boolean
  ): EntryCard {
    const container = this.add.container(x, y)
    if (this.contentContainer) {
      this.contentContainer.add(container)
    }

    // Background
    const bgColor = isLocked ? 0x1a1a2a : 0x2d2d44
    const bg = this.add.rectangle(0, 0, cardWidth, this.ENTRY_HEIGHT, bgColor, 1)
    bg.setStrokeStyle(1, isLocked ? 0x333344 : 0x444466)
    container.add(bg)

    // Icon area
    const iconX = -cardWidth / 2 + 35
    const iconSize = 40
    if (isLocked) {
      // Locked: show question mark
      const lockIcon = this.add
        .text(iconX, 0, '?', {
          fontSize: '32px',
          color: '#444455',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      container.add(lockIcon)
    } else {
      // Try to get sprite key from entry
      const spriteKey = this.getSpriteKeyForEntry(category, entry)

      if (spriteKey && this.textures.exists(spriteKey)) {
        // Show actual sprite
        const sprite = this.add.image(iconX, 0, spriteKey)
        // Scale sprite to fit icon area
        const maxDim = Math.max(sprite.width, sprite.height)
        const scale = iconSize / maxDim
        sprite.setScale(scale)
        container.add(sprite)
      } else {
        // Fallback: show colored circle with letter
        const iconColor = this.getIconColorForEntry(category, entry)
        const iconCircle = this.add.circle(iconX, 0, 20, iconColor, 1)
        container.add(iconCircle)

        const iconText = this.getIconTextForEntry(category, entry)
        const iconLabel = this.add
          .text(iconX, 0, iconText, {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
        container.add(iconLabel)
      }
    }

    // Text area
    const textX = -cardWidth / 2 + 70
    const textWidth = cardWidth - 90

    if (isLocked) {
      // Locked text
      const lockedText = this.add
        .text(textX, -8, '???', {
          fontSize: '14px',
          color: '#555566',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
      container.add(lockedText)

      const unlockHint = this.getUnlockHint(category, entry)
      const hintText = this.add
        .text(textX, 10, unlockHint, {
          fontSize: '11px',
          color: '#444455',
        })
        .setOrigin(0, 0.5)
      container.add(hintText)
    } else {
      // Entry name
      const nameText = this.add
        .text(textX, -12, this.getEntryName(entry), {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
      container.add(nameText)

      // Entry subtitle/description
      const subtitle = this.getEntrySubtitle(category, entry)
      const subtitleText = this.add
        .text(textX, 8, subtitle, {
          fontSize: '11px',
          color: '#888899',
          wordWrap: { width: textWidth },
        })
        .setOrigin(0, 0.5)
      container.add(subtitleText)
    }

    // Interaction
    bg.setInteractive({ useHandCursor: !isLocked })
    if (!isLocked) {
      bg.on('pointerup', () => {
        if (this.dragDistance < this.DRAG_THRESHOLD) {
          this.showDetailPanel(category, entry)
        }
      })
      bg.on('pointerover', () => {
        bg.setFillStyle(0x3d3d54)
      })
      bg.on('pointerout', () => {
        bg.setFillStyle(0x2d2d44)
      })
    }

    return { container, background: bg, entry, isLocked }
  }

  private getIconColorForEntry(category: EncyclopediaCategory, entry: AnyEntry): number {
    switch (category) {
      case 'equipment': {
        const eq = entry as EquipmentEncyclopediaEntry
        if (eq.slot === 'weapon') return 0xff6644
        if (eq.slot === 'armor') return 0x4488ff
        if (eq.slot === 'ring') return 0xffdd00
        return 0x88ff88
      }
      case 'enemies':
        return 0xff4444
      case 'bosses':
        return 0x990000
      case 'abilities': {
        const ab = entry as AbilityEncyclopediaEntry
        return ab.color
      }
      case 'talents': {
        const ta = entry as TalentEncyclopediaEntry
        return parseInt(ta.tierColor.replace('#', ''), 16)
      }
      case 'heroes':
        return 0x22cc66
      case 'perks': {
        const pe = entry as PerkEncyclopediaEntry
        return parseInt(pe.rarityColor.replace('#', ''), 16)
      }
      case 'achievements':
        return 0xffd700
      case 'chests': {
        const ch = entry as ChestEncyclopediaEntry
        return parseInt(ch.color.replace('#', ''), 16)
      }
      default:
        return 0x666666
    }
  }

  private getIconTextForEntry(category: EncyclopediaCategory, entry: AnyEntry): string {
    switch (category) {
      case 'equipment': {
        const eq = entry as EquipmentEncyclopediaEntry
        if (eq.slot === 'weapon') return 'W'
        if (eq.slot === 'armor') return 'A'
        if (eq.slot === 'ring') return 'R'
        return 'S'
      }
      case 'enemies':
        return 'E'
      case 'bosses':
        return 'B'
      case 'abilities':
        return 'A'
      case 'talents':
        return 'T'
      case 'heroes':
        return 'H'
      case 'perks':
        return 'P'
      case 'achievements':
        return 'A'
      case 'chests':
        return 'C'
      default:
        return '?'
    }
  }

  private getSpriteKeyForEntry(category: EncyclopediaCategory, entry: AnyEntry): string | null {
    switch (category) {
      case 'equipment': {
        const eq = entry as EquipmentEncyclopediaEntry
        return eq.spriteKey
      }
      case 'enemies': {
        const en = entry as EnemyEncyclopediaEntry
        return en.spriteKey
      }
      case 'bosses': {
        const bo = entry as BossEncyclopediaEntry
        return bo.spriteKey
      }
      case 'abilities': {
        const ab = entry as AbilityEncyclopediaEntry
        return ab.spriteKey
      }
      case 'heroes': {
        const he = entry as HeroEncyclopediaEntry
        return he.spriteKey
      }
      default:
        // Talents, perks, achievements, chests don't have sprites yet
        return null
    }
  }

  private getEntryName(entry: AnyEntry): string {
    return entry.name
  }

  private getEntrySubtitle(category: EncyclopediaCategory, entry: AnyEntry): string {
    switch (category) {
      case 'equipment': {
        const eq = entry as EquipmentEncyclopediaEntry
        return eq.statSummary
      }
      case 'enemies': {
        const en = entry as EnemyEncyclopediaEntry
        const kills = saveManager.getEnemyKillCount(en.id)
        return kills > 0 ? `${en.behavior} • Defeated: ${kills.toLocaleString()}` : en.behavior
      }
      case 'bosses': {
        const bo = entry as BossEncyclopediaEntry
        const kills = saveManager.getBossKillCount(bo.id)
        const base = `Chapter ${bo.chapter} - ${bo.attackPatterns.length} attacks`
        return kills > 0 ? `${base} • Defeated: ${kills.toLocaleString()}` : base
      }
      case 'abilities': {
        const ab = entry as AbilityEncyclopediaEntry
        return ab.description
      }
      case 'talents': {
        const ta = entry as TalentEncyclopediaEntry
        return `${ta.tier.toUpperCase()} - Max Lv.${ta.maxLevel}`
      }
      case 'heroes': {
        const he = entry as HeroEncyclopediaEntry
        return he.abilityName
      }
      case 'perks': {
        const pe = entry as PerkEncyclopediaEntry
        return pe.description
      }
      case 'achievements': {
        const ac = entry as AchievementEncyclopediaEntry
        return `${ac.tierCount} tiers`
      }
      case 'chests': {
        const ch = entry as ChestEncyclopediaEntry
        return ch.description
      }
      default:
        return ''
    }
  }

  private getUnlockHint(category: EncyclopediaCategory, entry: AnyEntry): string {
    if (category === 'enemies') {
      const en = entry as EnemyEncyclopediaEntry
      return `Reach Chapter ${en.introducedChapter} to unlock`
    }
    if (category === 'bosses') {
      const bo = entry as BossEncyclopediaEntry
      return `Reach Chapter ${bo.chapter} to unlock`
    }
    return 'Locked'
  }

  // ============================================
  // Detail Panel
  // ============================================

  private showDetailPanel(category: EncyclopediaCategory, entry: AnyEntry): void {
    if (this.detailPanel) return

    audioManager.playMenuSelect()

    const { width, height } = this.cameras.main

    this.detailPanel = this.add.container(width / 2, height / 2)
    this.detailPanel.setDepth(100)

    // Backdrop
    const backdrop = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
    backdrop.setInteractive()
    backdrop.on('pointerdown', () => this.hideDetailPanel())
    this.detailPanel.add(backdrop)

    // Panel
    const panelWidth = width - 40
    const panelHeight = 320
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x2a2a40, 1)
    panel.setStrokeStyle(2, 0x4a4a6a)
    this.detailPanel.add(panel)

    // Title
    const title = this.add
      .text(0, -panelHeight / 2 + 25, entry.name, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    this.detailPanel.add(title)

    // Content based on category
    const contentY = -panelHeight / 2 + 60
    this.addDetailContent(category, entry, contentY, panelWidth - 30)

    // Close button
    const closeBtn = this.add
      .text(0, panelHeight / 2 - 30, 'TAP TO CLOSE', {
        fontSize: '12px',
        color: '#888899',
      })
      .setOrigin(0.5)
    this.detailPanel.add(closeBtn)

    // Animation
    UIAnimations.showModal(this, this.detailPanel)
  }

  private addDetailContent(
    category: EncyclopediaCategory,
    entry: AnyEntry,
    startY: number,
    _maxWidth: number
  ): void {
    if (!this.detailPanel) return

    let y = startY

    switch (category) {
      case 'equipment': {
        const eq = entry as EquipmentEncyclopediaEntry
        this.addDetailLine(`Slot: ${eq.slot.toUpperCase()}`, y)
        y += 25
        this.addDetailLine(eq.description, y, '#aaaacc')
        y += 30
        this.addDetailLine('Base Stats:', y, '#ffdd00')
        y += 22
        this.addDetailLine(eq.statSummary, y, '#88ff88')
        break
      }
      case 'enemies': {
        const en = entry as EnemyEncyclopediaEntry
        const enemyKills = saveManager.getEnemyKillCount(en.id)
        this.addDetailLine(en.description, y, '#aaaacc')
        y += 35
        this.addDetailLine('Behavior:', y, '#ffdd00')
        y += 22
        this.addDetailLine(en.behavior, y, '#ffffff')
        y += 35
        this.addDetailLine(`First appears in Chapter ${en.introducedChapter}`, y, '#888899')
        y += 30
        this.addDetailLine(`Defeated: ${enemyKills.toLocaleString()}`, y, '#66ff66')
        break
      }
      case 'bosses': {
        const bo = entry as BossEncyclopediaEntry
        const bossKills = saveManager.getBossKillCount(bo.id)
        this.addDetailLine(bo.description, y, '#aaaacc')
        y += 35
        this.addDetailLine(`Chapter ${bo.chapter} ${bo.isMainBoss ? '(Main Boss)' : ''}`, y, '#ffdd00')
        y += 25
        this.addDetailLine('Attack Patterns:', y, '#ff6644')
        y += 22
        this.addDetailLine(bo.attackPatterns.join(', '), y, '#ffffff')
        y += 30
        this.addDetailLine(`Defeated: ${bossKills.toLocaleString()}`, y, '#66ff66')
        break
      }
      case 'abilities': {
        const ab = entry as AbilityEncyclopediaEntry
        this.addDetailLine('In-Run Upgrade', y, '#888899')
        y += 30
        this.addDetailLine('Effect:', y, '#ffdd00')
        y += 22
        this.addDetailLine(ab.description, y, '#88ff88')
        y += 35
        this.addDetailLine('Choose from 3 random abilities each level-up', y, '#666677')
        break
      }
      case 'talents': {
        const ta = entry as TalentEncyclopediaEntry
        this.addDetailLine(`Tier: ${ta.tier.toUpperCase()}`, y, ta.tierColor)
        y += 25
        this.addDetailLine(`Max Level: ${ta.maxLevel}`, y, '#ffffff')
        y += 30
        this.addDetailLine('Effect:', y, '#ffdd00')
        y += 22
        this.addDetailLine(ta.description, y, '#88ff88')
        y += 35
        this.addDetailLine('Permanent bonus that persists across runs', y, '#666677')
        break
      }
      case 'heroes': {
        const he = entry as HeroEncyclopediaEntry
        this.addDetailLine(he.description, y, '#aaaacc')
        y += 35
        this.addDetailLine(`Ability: ${he.abilityName}`, y, '#ffdd00')
        y += 22
        this.addDetailLine(he.abilityDescription, y, '#88ff88')
        y += 35
        const costText = he.unlockCurrency === 'free' ? 'Free' : `${he.unlockCost} ${he.unlockCurrency}`
        this.addDetailLine(`Unlock: ${costText}`, y, '#888899')
        y += 22
        this.addDetailLine(`${he.perkCount} perks to unlock`, y, '#888899')
        break
      }
      case 'perks': {
        const pe = entry as PerkEncyclopediaEntry
        this.addDetailLine(`Rarity: ${pe.rarity}`, y, pe.rarityColor)
        y += 30
        this.addDetailLine('Bonus:', y, '#ffdd00')
        y += 22
        this.addDetailLine(pe.description, y, '#88ff88')
        y += 35
        this.addDetailLine('Found on equipment based on rarity', y, '#666677')
        break
      }
      case 'achievements': {
        const ac = entry as AchievementEncyclopediaEntry
        this.addDetailLine(ac.description, y, '#aaaacc')
        y += 35
        this.addDetailLine('Tier Requirements:', y, '#ffdd00')
        y += 22
        const tierNames = ['Bronze', 'Silver', 'Gold', 'Platinum']
        ac.tierRequirements.forEach((req, i) => {
          if (i < tierNames.length) {
            this.addDetailLine(`${tierNames[i]}: ${req}`, y, '#ffffff')
            y += 20
          }
        })
        break
      }
      case 'chests': {
        const ch = entry as ChestEncyclopediaEntry
        this.addDetailLine(ch.description, y, '#aaaacc')
        y += 35
        this.addDetailLine('Drop Rates:', y, '#ffdd00')
        y += 22
        const rarities: Rarity[] = [Rarity.COMMON, Rarity.GREAT, Rarity.RARE, Rarity.EPIC, Rarity.LEGENDARY]
        rarities.forEach((rarity) => {
          const rate = ch.dropRates[rarity]
          if (rate > 0) {
            const color = RARITY_CONFIGS[rarity].color
            this.addDetailLine(`${rarity}: ${rate}%`, y, color)
            y += 18
          }
        })
        break
      }
    }
  }

  private addDetailLine(text: string, y: number, color: string = '#ffffff'): void {
    if (!this.detailPanel) return

    const line = this.add
      .text(0, y, text, {
        fontSize: '13px',
        color,
        wordWrap: { width: 280 },
        align: 'center',
      })
      .setOrigin(0.5, 0)
    this.detailPanel.add(line)
  }

  private hideDetailPanel(): void {
    if (!this.detailPanel) return

    audioManager.playMenuSelect()

    UIAnimations.hideModal(this, this.detailPanel, UIAnimations.DURATION.FAST, () => {
      if (this.detailPanel) {
        this.detailPanel.destroy()
        this.detailPanel = null
      }
    })
  }

  // ============================================
  // Back Button
  // ============================================

  private createBackButton(): void {
    const { width, height } = this.cameras.main

    const button = this.add
      .text(width / 2, height - 35, 'BACK', {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#444455',
        padding: { x: 50, y: 10 },
      })
      .setOrigin(0.5)
      .setDepth(20) // Above content container (depth 1) and scroll indicator (depth 10)

    button.setInteractive({ useHandCursor: true })
    button.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.scene.start('MainMenuScene')
    })
    button.on('pointerover', () => {
      button.setStyle({ backgroundColor: '#555566' })
    })
    button.on('pointerout', () => {
      button.setStyle({ backgroundColor: '#444455' })
    })

    UIAnimations.applyButtonEffects(this, button)
  }

  // ============================================
  // Cleanup
  // ============================================

  private shutdown(): void {
    this.input.off('wheel')
    this.input.off('pointerdown')
    this.input.off('pointermove')
    this.input.off('pointerup')
  }
}
