/**
 * ChapterSelectPanel - Reusable chapter selection component
 *
 * Displays chapter buttons with unlock states and handles selection.
 */

import Phaser from 'phaser'
import { ChapterId } from '../../config/chapterData'
import { chapterManager } from '../../systems/ChapterManager'
import { audioManager } from '../../systems/AudioManager'
import { themeManager } from '../../systems/ThemeManager'

export interface ChapterSelectConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width: number
  onChapterSelect?: (chapterId: ChapterId) => void
}

// Theme colors for each chapter
const CHAPTER_COLORS: Record<ChapterId, number> = {
  1: 0x4a4a4a, // Dark Dungeon - gray stone
  2: 0x2d5a27, // Forest Ruins - green
  3: 0x4a8ab5, // Frozen Caves - ice blue
  4: 0x8b2500, // Volcanic Depths - red/orange
  5: 0x3d1a5c, // Shadow Realm - purple
}

interface ChapterButtonData {
  container: Phaser.GameObjects.Container
  bg: Phaser.GameObjects.Rectangle
  themeColor: number
  hoverColor: number
  chapterId: ChapterId
}

export class ChapterSelectPanel {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private chapterButtons: ChapterButtonData[] = []
  private onChapterSelect?: (chapterId: ChapterId) => void

  private readonly BUTTON_SIZE = 60
  private readonly GAP = 8

  constructor(config: ChapterSelectConfig) {
    this.scene = config.scene
    this.onChapterSelect = config.onChapterSelect
    this.container = this.scene.add.container(config.x, config.y)

    this.createLabel()
    this.createChapterButtons(config.width)
  }

  private createLabel(): void {
    const label = this.scene.add.text(0, -20, 'SELECT CHAPTER', {
      fontSize: '12px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    })
    label.setOrigin(0.5)
    label.setDepth(10)
    this.container.add(label)
  }

  private createChapterButtons(_width: number): void {
    const chapterIds: ChapterId[] = [1, 2, 3, 4, 5]
    const selectedChapterId = chapterManager.getSelectedChapter()
    const unlockedChapters = chapterManager.getUnlockedChapters()

    const totalWidth = chapterIds.length * this.BUTTON_SIZE + (chapterIds.length - 1) * this.GAP
    const startX = -totalWidth / 2 + this.BUTTON_SIZE / 2

    chapterIds.forEach((chapterId, index) => {
      const isUnlocked = unlockedChapters.includes(chapterId)
      const isSelected = chapterId === selectedChapterId
      const xPos = startX + index * (this.BUTTON_SIZE + this.GAP)

      const buttonData = this.createChapterButton(xPos, 22, chapterId, isUnlocked, isSelected)
      this.chapterButtons.push(buttonData)
    })
  }

  private createChapterButton(
    x: number,
    y: number,
    chapterId: ChapterId,
    isUnlocked: boolean,
    isSelected: boolean
  ): ChapterButtonData {
    const btnContainer = this.scene.add.container(x, y)
    const themeColor = CHAPTER_COLORS[chapterId]
    const hoverColor = Phaser.Display.Color.ValueToColor(themeColor).lighten(30).color

    // Background with chapter theme color
    const bgColor = isSelected ? 0x4a9eff : (isUnlocked ? themeColor : 0x222222)
    const bg = this.scene.add.rectangle(0, 0, this.BUTTON_SIZE, this.BUTTON_SIZE, bgColor, 1)
    bg.setStrokeStyle(3, isSelected ? 0xffffff : (isUnlocked ? 0xaaaaaa : 0x444444))
    btnContainer.add(bg)

    // Chapter icon (if loaded) or fallback to number
    const themeAssets = themeManager.getAssets()
    const iconKey = themeAssets[`chapter${chapterId}Icon` as keyof typeof themeAssets] as string
    if (iconKey && this.scene.textures.exists(iconKey)) {
      const icon = this.scene.add.image(0, 0, iconKey)
      icon.setDisplaySize(this.BUTTON_SIZE - 8, this.BUTTON_SIZE - 8)
      if (!isUnlocked) {
        icon.setTint(0x444444)
      }
      btnContainer.add(icon)
      btnContainer.sendToBack(icon)
    }

    // Chapter number overlay
    const numText = this.scene.add.text(0, 0, `${chapterId}`, {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    numText.setOrigin(0.5)
    if (!isUnlocked) {
      numText.setAlpha(0.4)
    }
    btnContainer.add(numText)

    // Lock overlay for locked chapters
    if (!isUnlocked) {
      const lockOverlay = this.scene.add.rectangle(0, 0, this.BUTTON_SIZE, this.BUTTON_SIZE, 0x000000, 0.6)
      const lockIcon = this.scene.add.text(0, 0, '🔒', { fontSize: '24px' })
      lockIcon.setOrigin(0.5)
      btnContainer.add([lockOverlay, lockIcon])
    }

    btnContainer.sendToBack(bg)

    // Make interactive if unlocked
    if (isUnlocked) {
      bg.setInteractive({ useHandCursor: true })

      bg.on('pointerover', () => {
        if (chapterId !== chapterManager.getSelectedChapter()) {
          bg.setFillStyle(hoverColor)
        }
      })

      bg.on('pointerout', () => {
        if (chapterId !== chapterManager.getSelectedChapter()) {
          bg.setFillStyle(themeColor)
        }
      })

      bg.on('pointerdown', () => {
        audioManager.playMenuSelect()
        chapterManager.selectChapter(chapterId)
        this.updateButtonStates()
        this.onChapterSelect?.(chapterId)
      })
    }

    this.container.add(btnContainer)

    return {
      container: btnContainer,
      bg,
      themeColor,
      hoverColor,
      chapterId,
    }
  }

  private updateButtonStates(): void {
    const selectedChapterId = chapterManager.getSelectedChapter()

    this.chapterButtons.forEach((button) => {
      const isSelected = button.chapterId === selectedChapterId
      button.bg.setFillStyle(isSelected ? 0x4a9eff : button.themeColor)
      button.bg.setStrokeStyle(3, isSelected ? 0xffffff : 0xaaaaaa)
    })
  }

  /**
   * Refresh the panel (e.g., after chapter unlock)
   */
  refresh(): void {
    // Destroy existing buttons
    this.chapterButtons.forEach((btn) => btn.container.destroy())
    this.chapterButtons = []

    // Recreate buttons
    const width = this.container.getData('width') || 375
    this.createChapterButtons(width)
  }

  /**
   * Get the container for positioning
   */
  getContainer(): Phaser.GameObjects.Container {
    return this.container
  }

  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.container.setVisible(visible)
  }

  /**
   * Set depth
   */
  setDepth(depth: number): void {
    this.container.setDepth(depth)
  }

  /**
   * Destroy the panel
   */
  destroy(): void {
    this.chapterButtons = []
    this.container.destroy()
  }
}
