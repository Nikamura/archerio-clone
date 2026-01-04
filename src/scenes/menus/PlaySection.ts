import Phaser from 'phaser'
import { audioManager } from '../../systems/AudioManager'
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
 * PlaySection - Contains chapter selector, difficulty selector, mode selector, and PLAY button
 */
export function createPlaySection(config: PlaySectionConfig): PlaySectionResult {
  const { scene, x, y, width, onPlay, depth = 10 } = config

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  let currentMode: GameMode = 'story'

  // Chapter panel - directly visible
  const chapterPanel = new ChapterSelectPanel({
    scene,
    x: 0,
    y: 0,
    width,
  })
  container.add(chapterPanel.getContainer())

  // Difficulty panel - directly visible below chapters
  const difficultyPanel = new DifficultyPanel({
    scene,
    x: 0,
    y: 80,
    game: scene.game,
  })
  container.add(difficultyPanel.getContainer())

  // Mode selector - use absolute scene coordinates for dropdown positioning
  const modeSelectorY = 150
  const modeSelector = createModeSelector({
    scene,
    x: x, // Absolute scene X (PlaySection center)
    y: y + modeSelectorY, // Absolute scene Y
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
    container.destroy()
  }

  return {
    container,
    getSelectedMode,
    destroy,
  }
}
