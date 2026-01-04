import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { abilityPriorityManager } from '../systems/AbilityPriorityManager'
import { AbilityData } from '../config/abilityData'
import { createBackButton, createBackButtonFooter } from '../ui/components/BackButton'

/**
 * AbilityPriorityScene - UI for setting ability priority order
 *
 * Features:
 * - Drag-and-drop reorderable list of all abilities
 * - Touch-friendly with dedicated drag handles
 * - Reset to default button
 * - Persistent priority order via AbilityPriorityManager
 */
export default class AbilityPriorityScene extends Phaser.Scene {
  // UI Elements
  private scrollContainer!: Phaser.GameObjects.Container
  private scrollMask!: Phaser.GameObjects.Graphics
  private abilityCards: Phaser.GameObjects.Container[] = []

  // Scroll bounds
  private scrollBounds = { top: 90, bottom: 557 }

  // Scroll state
  private scrollY: number = 0
  private contentHeight: number = 0
  private isScrollDragging: boolean = false
  private scrollDragStartY: number = 0
  private scrollStartY: number = 0

  // Drag state for reordering
  private draggedCard: Phaser.GameObjects.Container | null = null
  private draggedIndex: number = -1
  private dragStartY: number = 0
  private cardStartY: number = 0
  private currentOrder: string[] = []
  private cardPositions: number[] = []
  private isDragging: boolean = false

  // Auto-scroll state
  private autoScrollTimer?: Phaser.Time.TimerEvent
  private autoScrollSpeed: number = 0

  // Card dimensions
  private readonly CARD_HEIGHT = 52
  private readonly CARD_SPACING = 58

  // Auto-scroll settings
  private readonly AUTO_SCROLL_EDGE_SIZE = 60
  private readonly AUTO_SCROLL_MAX_SPEED = 8

  constructor() {
    super({ key: 'AbilityPriorityScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header
    this.createHeader(width)

    // Ability list with custom scroll
    this.createAbilityList(width)

    // Reset button
    this.createResetButton(width)

    // Footer and back button
    createBackButtonFooter(this, width, height)
    createBackButton({
      scene: this,
      x: width / 2,
      y: height - 25,
      targetScene: 'MainMenuScene',
    })

    // Setup input handlers
    this.setupInput()
  }

  private createHeader(width: number) {
    // Title
    this.add
      .text(width / 2, 30, 'ABILITY PRIORITY', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Help text
    this.add
      .text(width / 2, 58, 'Drag to reorder. Tap number to set max level.', {
        fontSize: '12px',
        color: '#888888',
      })
      .setOrigin(0.5)
  }

  private createAbilityList(width: number) {
    // Get current priority order
    this.currentOrder = abilityPriorityManager.getPriorityOrder()

    // Create scroll container
    this.scrollContainer = this.add.container(0, 0)

    // Create mask for scroll area
    const scrollHeight = this.scrollBounds.bottom - this.scrollBounds.top
    this.scrollMask = this.add.graphics()
    this.scrollMask.fillStyle(0xffffff)
    this.scrollMask.fillRect(0, this.scrollBounds.top, width, scrollHeight)
    this.scrollMask.setVisible(false)

    const geometryMask = this.scrollMask.createGeometryMask()
    this.scrollContainer.setMask(geometryMask)

    // Create cards for each ability
    const cardWidth = width - 30
    const cardX = width / 2
    let currentY = this.scrollBounds.top + 35

    this.abilityCards = []
    this.cardPositions = []

    this.currentOrder.forEach((abilityId, index) => {
      const ability = abilityPriorityManager.getAbilityById(abilityId)
      if (!ability) return

      const card = this.createAbilityCard(cardX, currentY, cardWidth, this.CARD_HEIGHT, ability, index)
      this.scrollContainer.add(card)
      this.abilityCards.push(card)
      this.cardPositions.push(currentY)

      currentY += this.CARD_SPACING
    })

    // Set content height for scroll calculations
    this.contentHeight = currentY - this.scrollBounds.top + 10
  }

  private createAbilityCard(
    x: number,
    y: number,
    width: number,
    height: number,
    ability: AbilityData,
    index: number
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0x2a2a3e)
    bg.setStrokeStyle(1, ability.color)
    container.add(bg)

    // Drag handle (left side) - three horizontal lines
    const handleX = -width / 2 + 25
    const handleColor = 0x666666
    for (let i = -1; i <= 1; i++) {
      const line = this.add.rectangle(handleX, i * 6, 20, 2, handleColor)
      container.add(line)
    }

    // Drag handle hit area (invisible, larger touch target)
    const dragHandle = this.add.rectangle(handleX, 0, 44, 44, 0x000000, 0)
    dragHandle.setInteractive({ useHandCursor: true })
    dragHandle.setData('cardIndex', index)
    dragHandle.setData('isDragHandle', true)
    container.add(dragHandle)

    // Ability icon - use actual texture if available
    const iconX = -width / 2 + 65
    if (this.textures.exists(ability.iconKey)) {
      const icon = this.add.image(iconX, 0, ability.iconKey)
      icon.setDisplaySize(32, 32)
      container.add(icon)
    } else {
      // Fallback to colored circle with letter
      const iconCircle = this.add.circle(iconX, 0, 16, ability.color)
      container.add(iconCircle)

      const iconText = this.add
        .text(iconX, 0, ability.name.charAt(0).toUpperCase(), {
          fontSize: '14px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
      container.add(iconText)
    }

    // Ability name
    const nameText = this.add
      .text(-width / 2 + 95, -6, ability.name, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    container.add(nameText)

    // Ability description
    const descText = this.add
      .text(-width / 2 + 95, 10, ability.description, {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)
    container.add(descText)

    // One-time indicator for abilities with maxLevel: 1
    if (ability.maxLevel === 1) {
      const oneTimeBadge = this.add
        .text(width / 2 - 95, 0, '1x', {
          fontSize: '10px',
          color: '#ffaa00',
          fontStyle: 'bold',
          backgroundColor: '#3a3a4e',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5)
      container.add(oneTimeBadge)
    }

    // Priority max level selector (right side, before priority number)
    const priorityMaxLevel = abilityPriorityManager.getPriorityMaxLevel(ability.id)
    const maxLevelX = width / 2 - 60

    // Background for max level control
    const maxLevelBg = this.add.rectangle(maxLevelX, 0, 32, 24, 0x3a3a4e)
    maxLevelBg.setStrokeStyle(1, 0x555555)
    maxLevelBg.setInteractive({ useHandCursor: true })
    container.add(maxLevelBg)

    // Max level text
    const maxLevelText = this.add
      .text(maxLevelX, 0, priorityMaxLevel === 0 ? '∞' : `${priorityMaxLevel}`, {
        fontSize: '12px',
        color: priorityMaxLevel === 0 ? '#888888' : '#00ff88',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    maxLevelText.setData('isMaxLevelText', true)
    container.add(maxLevelText)

    // Click handler to cycle max level
    maxLevelBg.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      pointer.event.stopPropagation()
      this.cycleMaxLevel(ability.id, maxLevelText)
    })

    // Hover effects for max level control
    maxLevelBg.on('pointerover', () => {
      maxLevelBg.setFillStyle(0x4a4a5e)
    })
    maxLevelBg.on('pointerout', () => {
      maxLevelBg.setFillStyle(0x3a3a4e)
    })

    // Priority number (right side)
    const priorityText = this.add
      .text(width / 2 - 25, 0, `#${index + 1}`, {
        fontSize: '14px',
        color: '#4a9eff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
    priorityText.setData('isPriorityText', true)
    container.add(priorityText)

    // Store ability id in container
    container.setData('abilityId', ability.id)
    container.setData('originalIndex', index)

    return container
  }

  private setupInput() {
    // Mouse wheel scrolling
    this.input.on(
      'wheel',
      (_pointer: Phaser.Input.Pointer, _gameObjects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
        if (!this.isDragging) {
          this.scrollContent(deltaY * 0.5)
        }
      }
    )

    // Pointer down - check for drag handle or scroll
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check if we clicked on a drag handle
      const hitObjects = this.input.hitTestPointer(pointer)

      for (const obj of hitObjects) {
        if (obj.getData('isDragHandle')) {
          // Find the parent container and its current index in abilityCards
          const parentContainer = obj.parentContainer
          if (parentContainer) {
            const currentIndex = this.abilityCards.indexOf(parentContainer)
            if (currentIndex !== -1) {
              this.startDrag(pointer, currentIndex)
              return
            }
          }
        }
      }

      // Otherwise, check for scroll
      const inScrollArea = pointer.y >= this.scrollBounds.top && pointer.y <= this.scrollBounds.bottom

      if (inScrollArea && this.getMaxScroll() > 0) {
        this.isScrollDragging = true
        this.scrollDragStartY = pointer.y
        this.scrollStartY = this.scrollY
      }
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging && this.draggedCard) {
        this.handleDrag(pointer)
      } else if (this.isScrollDragging) {
        const deltaY = this.scrollDragStartY - pointer.y
        this.setScrollPosition(this.scrollStartY + deltaY)
      }
    })

    this.input.on('pointerup', () => {
      if (this.isDragging) {
        this.endDrag()
      }
      this.isScrollDragging = false
    })

    this.input.on('pointerupoutside', () => {
      if (this.isDragging) {
        this.endDrag()
      }
      this.isScrollDragging = false
    })
  }

  private getMaxScroll(): number {
    const scrollAreaHeight = this.scrollBounds.bottom - this.scrollBounds.top
    return Math.max(0, this.contentHeight - scrollAreaHeight)
  }

  private scrollContent(deltaY: number): void {
    this.setScrollPosition(this.scrollY + deltaY)
  }

  private setScrollPosition(newY: number): void {
    const maxScroll = this.getMaxScroll()
    this.scrollY = Phaser.Math.Clamp(newY, 0, maxScroll)
    this.scrollContainer.y = -this.scrollY
  }

  private startDrag(pointer: Phaser.Input.Pointer, index: number) {
    // Find the actual current index based on current card positions
    // The cardIndex stored in the handle may be stale after reordering
    const card = this.abilityCards[index]
    if (!card) return

    this.isDragging = true
    this.draggedIndex = index
    this.draggedCard = card
    this.dragStartY = pointer.y
    this.cardStartY = card.y

    // Bring card to front and scale up slightly
    card.setDepth(100)
    this.tweens.add({
      targets: card,
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 100,
    })

    // Start auto-scroll timer
    this.startAutoScrollTimer()

    // Play feedback sound
    audioManager.playMenuSelect()
  }

  private startAutoScrollTimer() {
    this.autoScrollSpeed = 0
    this.autoScrollTimer = this.time.addEvent({
      delay: 16, // ~60fps
      callback: this.updateAutoScroll,
      callbackScope: this,
      loop: true,
    })
  }

  private stopAutoScrollTimer() {
    if (this.autoScrollTimer) {
      this.autoScrollTimer.destroy()
      this.autoScrollTimer = undefined
    }
    this.autoScrollSpeed = 0
  }

  private updateAutoScroll() {
    if (!this.isDragging || this.autoScrollSpeed === 0) return

    // Apply scroll
    const oldScrollY = this.scrollY
    this.setScrollPosition(this.scrollY + this.autoScrollSpeed)

    // If scroll position changed, keep the dragged card under the finger
    const scrollDelta = this.scrollY - oldScrollY
    if (scrollDelta !== 0 && this.draggedCard) {
      // The scrollContainer moved, so the dragged card moved with it in screen space.
      // To keep the card under the finger, we need to counteract the scroll movement.
      // scrollContainer.y = -scrollY, so when scrollY increases, container.y decreases (moves up)
      // We need to move the card down in container space to keep same screen position
      this.draggedCard.y += scrollDelta

      // Update cardStartY so the final snap position is correct
      this.cardStartY += scrollDelta
    }
  }

  private handleDrag(pointer: Phaser.Input.Pointer) {
    if (!this.draggedCard || this.draggedIndex === -1) return

    // Calculate new Y position, accounting for scroll
    const deltaY = pointer.y - this.dragStartY
    const newY = this.cardStartY + deltaY

    // Move the dragged card
    this.draggedCard.y = newY

    // Check for auto-scroll based on pointer position
    this.updateAutoScrollSpeed(pointer.y)

    // Check for swap with adjacent cards
    const currentCenterY = newY

    // Check card above
    if (this.draggedIndex > 0) {
      const aboveCard = this.abilityCards[this.draggedIndex - 1]
      const aboveCenterY = aboveCard.y

      if (currentCenterY < aboveCenterY) {
        this.swapCards(this.draggedIndex, this.draggedIndex - 1)
      }
    }

    // Check card below
    if (this.draggedIndex < this.abilityCards.length - 1) {
      const belowCard = this.abilityCards[this.draggedIndex + 1]
      const belowCenterY = belowCard.y

      if (currentCenterY > belowCenterY) {
        this.swapCards(this.draggedIndex, this.draggedIndex + 1)
      }
    }
  }

  private updateAutoScrollSpeed(pointerY: number) {
    const topEdge = this.scrollBounds.top + this.AUTO_SCROLL_EDGE_SIZE
    const bottomEdge = this.scrollBounds.bottom - this.AUTO_SCROLL_EDGE_SIZE

    if (pointerY < topEdge && this.scrollY > 0) {
      // Scroll up - speed increases as pointer gets closer to edge
      const distance = topEdge - pointerY
      const ratio = Math.min(distance / this.AUTO_SCROLL_EDGE_SIZE, 1)
      this.autoScrollSpeed = -this.AUTO_SCROLL_MAX_SPEED * ratio
    } else if (pointerY > bottomEdge && this.scrollY < this.getMaxScroll()) {
      // Scroll down - speed increases as pointer gets closer to edge
      const distance = pointerY - bottomEdge
      const ratio = Math.min(distance / this.AUTO_SCROLL_EDGE_SIZE, 1)
      this.autoScrollSpeed = this.AUTO_SCROLL_MAX_SPEED * ratio
    } else {
      this.autoScrollSpeed = 0
    }
  }

  private swapCards(fromIndex: number, toIndex: number) {
    // Swap in arrays
    const temp = this.abilityCards[fromIndex]
    this.abilityCards[fromIndex] = this.abilityCards[toIndex]
    this.abilityCards[toIndex] = temp

    // Swap in current order
    const tempId = this.currentOrder[fromIndex]
    this.currentOrder[fromIndex] = this.currentOrder[toIndex]
    this.currentOrder[toIndex] = tempId

    // Animate the non-dragged card to its new position
    const otherCard = this.abilityCards[fromIndex]
    const targetY = this.cardPositions[fromIndex]

    this.tweens.add({
      targets: otherCard,
      y: targetY,
      duration: 150,
      ease: 'Power2',
    })

    // Update dragged index
    this.draggedIndex = toIndex

    // Update priority numbers
    this.updatePriorityNumbers()
  }

  private endDrag() {
    if (!this.draggedCard) return

    // Stop auto-scroll
    this.stopAutoScrollTimer()

    // Animate card to final position
    const finalY = this.cardPositions[this.draggedIndex]

    this.tweens.add({
      targets: this.draggedCard,
      y: finalY,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Power2',
      onComplete: () => {
        if (this.draggedCard) {
          this.draggedCard.setDepth(0)
        }
      },
    })

    // Save the new order
    abilityPriorityManager.setPriorityOrder(this.currentOrder)

    // Reset drag state
    this.isDragging = false
    this.draggedCard = null
    this.draggedIndex = -1
  }

  private updatePriorityNumbers() {
    // Update priority text for all cards
    this.abilityCards.forEach((card, index) => {
      // Find the priority text in this card
      const children = card.getAll() as Phaser.GameObjects.GameObject[]
      for (const child of children) {
        if (child instanceof Phaser.GameObjects.Text && child.getData('isPriorityText')) {
          child.setText(`#${index + 1}`)
          break
        }
      }
    })
  }

  private cycleMaxLevel(abilityId: string, maxLevelText: Phaser.GameObjects.Text) {
    // Get the ability to check its inherent maxLevel
    const ability = abilityPriorityManager.getAbilityById(abilityId)

    // Get current priority max level
    let currentMax = abilityPriorityManager.getPriorityMaxLevel(abilityId)

    // Determine the ceiling for cycling:
    // - If ability has inherent maxLevel (like extra_life with maxLevel: 1), use that as ceiling
    // - Otherwise use 10 as a reasonable max
    const ceiling = ability?.maxLevel ?? 10

    // Cycle: 0 (∞) -> 1 -> 2 -> ... -> ceiling -> 0 (∞)
    currentMax = currentMax + 1
    if (currentMax > ceiling) {
      currentMax = 0
    }

    // Save the new max level
    abilityPriorityManager.setPriorityMaxLevel(abilityId, currentMax)

    // Update the text
    maxLevelText.setText(currentMax === 0 ? '∞' : `${currentMax}`)
    maxLevelText.setColor(currentMax === 0 ? '#888888' : '#00ff88')

    // Play feedback sound
    audioManager.playMenuSelect()
  }

  private createResetButton(width: number) {
    const resetButton = this.add.container(width / 2, this.scrollBounds.bottom + 25)
    resetButton.setDepth(20)

    const buttonBg = this.add.rectangle(0, 0, 150, 36, 0x444444)
    buttonBg.setStrokeStyle(1, 0x666666)
    buttonBg.setInteractive({ useHandCursor: true })

    const buttonText = this.add
      .text(0, 0, 'Reset to Default', {
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    resetButton.add([buttonBg, buttonText])

    // Hover effects
    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x555555)
    })

    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x444444)
    })

    // Click handler
    buttonBg.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.resetToDefault()
    })
  }

  private resetToDefault() {
    // Reset in manager
    abilityPriorityManager.resetToDefault()

    // Rebuild the list
    this.rebuildList()
  }

  private rebuildList() {
    // Clear existing cards
    this.abilityCards.forEach((card) => card.destroy())
    this.abilityCards = []
    this.cardPositions = []

    // Destroy scroll container and recreate
    this.scrollContainer.destroy()
    this.scrollMask.destroy()

    this.scrollY = 0

    // Recreate
    this.createAbilityList(this.cameras.main.width)
  }

  shutdown() {
    // Clean up
    this.stopAutoScrollTimer()
    this.input.off('wheel')
    this.input.off('pointerdown')
    this.input.off('pointermove')
    this.input.off('pointerup')
    this.input.off('pointerupoutside')
  }
}
