import Phaser from 'phaser'
import { audioManager } from '../../systems/AudioManager'
import { chapterManager } from '../../systems/ChapterManager'
import { saveManager } from '../../systems/SaveManager'
import { applyButtonEffects } from '../../systems/UIAnimations'
import { ChapterSelectPanel } from './ChapterSelectPanel'
import { DifficultyPanel } from './DifficultyPanel'
import { createModeSelector, GameMode } from '../../ui/components/ModeSelector'

export interface PlaySectionConfig {
  scene: Phaser.Scene
  x: number
  y: number
  width: number
  onPlay: (mode: GameMode) => void
  depth?: number
}

export interface PlaySectionResult {
  container: Phaser.GameObjects.Container
  getSelectedMode: () => GameMode
  destroy: () => void
}

/**
 * PlaySection - Contains mode selector, collapsible chapter/difficulty, and PLAY button
 */
export function createPlaySection(config: PlaySectionConfig): PlaySectionResult {
  const { scene, x, y, width, onPlay, depth = 10 } = config

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  let isExpanded = false
  let currentMode: GameMode = 'story'

  // Helper to get current header text
  const getHeaderText = () => {
    const selectedChapter = chapterManager.getSelectedChapter()
    const difficulty = saveManager.getDifficulty()
    return `Chapter ${selectedChapter} • ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`
  }

  // Collapsible header showing current chapter & difficulty
  const headerY = 0
  const headerContainer = scene.add.container(0, headerY)
  container.add(headerContainer)

  const headerBg = scene.add.rectangle(0, 0, width - 40, 32, 0x333344, 0.8)
  headerBg.setStrokeStyle(1, 0x555566)
  headerBg.setInteractive({ useHandCursor: true })
  headerContainer.add(headerBg)

  const headerLabel = scene.add.text(0, 0, `▼ ${getHeaderText()}`, {
    fontSize: '13px',
    color: '#aaaaaa',
  })
  headerLabel.setOrigin(0.5)
  headerContainer.add(headerLabel)

  // Expandable chapter/difficulty panels - rendered directly on scene for proper depth
  const expandableContainer = scene.add.container(x, y + 45)
  expandableContainer.setDepth(depth + 50)
  expandableContainer.setVisible(false)
  expandableContainer.setAlpha(0)

  // Background for expandable panel - interactive to block clicks through
  const expandableBg = scene.add.rectangle(0, 70, width - 20, 160, 0x1a1a2e, 0.95)
  expandableBg.setStrokeStyle(1, 0x333355)
  expandableBg.setInteractive() // Block clicks from passing through
  expandableContainer.add(expandableBg)

  // Chapter panel
  const chapterPanel = new ChapterSelectPanel({
    scene,
    x: 0,
    y: 0,
    width,
    onChapterSelect: () => {
      // Update header when chapter is selected
      headerLabel.setText(`${isExpanded ? '▲' : '▼'} ${getHeaderText()}`)
    },
  })
  expandableContainer.add(chapterPanel.getContainer())

  // Difficulty panel
  const difficultyPanel = new DifficultyPanel({
    scene,
    x: 0,
    y: 90,
    game: scene.game,
    onDifficultySelect: () => {
      // Update header when difficulty changes
      headerLabel.setText(`${isExpanded ? '▲' : '▼'} ${getHeaderText()}`)
    },
  })
  expandableContainer.add(difficultyPanel.getContainer())

  // Update header text
  const updateHeader = () => {
    headerLabel.setText(`${isExpanded ? '▲' : '▼'} ${getHeaderText()}`)
  }

  // Toggle expansion
  headerBg.on('pointerdown', () => {
    audioManager.playMenuSelect()
    isExpanded = !isExpanded

    if (isExpanded) {
      expandableContainer.setVisible(true)
      scene.tweens.add({
        targets: expandableContainer,
        alpha: 1,
        duration: 150,
      })
    } else {
      scene.tweens.add({
        targets: expandableContainer,
        alpha: 0,
        duration: 100,
        onComplete: () => {
          expandableContainer.setVisible(false)
        },
      })
    }
    updateHeader()
  })

  // Mode selector - use absolute scene coordinates for dropdown positioning
  const modeSelectorY = 50
  const modeSelector = createModeSelector({
    scene,
    x: x,  // Absolute scene X (PlaySection center)
    y: y + modeSelectorY,  // Absolute scene Y
    initialMode: 'story',
    onModeChange: (mode) => {
      currentMode = mode
    },
    depth,
  })
  // Don't add to container - it's positioned absolutely on the scene

  // PLAY button (large and prominent)
  const playButtonY = modeSelectorY + 70
  const playButton = scene.add.text(0, playButtonY, 'PLAY', {
    fontSize: '28px',
    color: '#ffffff',
    backgroundColor: '#4a9eff',
    padding: { x: 60, y: 18 },
    fontStyle: 'bold',
  })
  playButton.setOrigin(0.5)
  playButton.setInteractive({ useHandCursor: true })
  container.add(playButton)

  applyButtonEffects(scene, playButton, {
    scaleOnHover: 1.05,
    scaleOnPress: 0.95,
  })

  playButton.on('pointerover', () => {
    playButton.setStyle({ backgroundColor: '#6bb6ff' })
  })

  playButton.on('pointerout', () => {
    playButton.setStyle({ backgroundColor: '#4a9eff' })
  })

  playButton.on('pointerdown', () => {
    audioManager.playGameStart()
    onPlay(currentMode)
  })

  const getSelectedMode = () => currentMode

  const destroy = () => {
    chapterPanel.destroy()
    difficultyPanel.destroy()
    modeSelector.destroy()
    expandableContainer.destroy()
    container.destroy()
  }

  return {
    container,
    getSelectedMode,
    destroy,
  }
}
