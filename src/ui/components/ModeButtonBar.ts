import Phaser from 'phaser'
import { audioManager } from '../../systems/AudioManager'
import { saveManager } from '../../systems/SaveManager'

export type GameMode = 'story' | 'endless' | 'daily'

export interface ModeButtonBarConfig {
  scene: Phaser.Scene
  x: number
  y: number
  initialMode?: GameMode
  onModeChange?: (mode: GameMode) => void
  depth?: number
}

export interface ModeButtonBarResult {
  container: Phaser.GameObjects.Container
  getMode: () => GameMode
  setMode: (mode: GameMode) => void
  destroy: () => void
}

const MODE_LABELS: Record<GameMode, string> = {
  story: 'Story',
  endless: 'Endless',
  daily: 'Daily',
}

const MODE_COLORS: Record<GameMode, number> = {
  story: 0x4a9eff,
  endless: 0xff6b35,
  daily: 0x00ddff,
}

const BUTTON_WIDTH = 100
const BUTTON_HEIGHT = 36
const BUTTON_GAP = 8

/**
 * ModeButtonBar - Three horizontal buttons for game mode selection
 */
export function createModeButtonBar(config: ModeButtonBarConfig): ModeButtonBarResult {
  const { scene, x, y, initialMode = 'story', onModeChange, depth = 10 } = config

  let currentMode: GameMode = initialMode

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  const modes: GameMode[] = ['story', 'endless', 'daily']
  const totalWidth = modes.length * BUTTON_WIDTH + (modes.length - 1) * BUTTON_GAP
  const startX = -totalWidth / 2 + BUTTON_WIDTH / 2

  // Get daily challenge status
  const dailyCompleted = saveManager.isDailyChallengeCompleted()
  const dailyStats = saveManager.getDailyChallengeStats()

  const getDisplayLabel = (mode: GameMode): string => {
    if (mode === 'daily' && dailyCompleted) {
      return `✓ ${dailyStats.bestWave}`
    }
    return MODE_LABELS[mode]
  }

  const buttons: Map<
    GameMode,
    {
      bg: Phaser.GameObjects.Rectangle
      text: Phaser.GameObjects.Text
    }
  > = new Map()

  modes.forEach((mode, index) => {
    const btnX = startX + index * (BUTTON_WIDTH + BUTTON_GAP)
    const isActive = mode === currentMode

    // Button background
    const bg = scene.add.rectangle(
      btnX,
      0,
      BUTTON_WIDTH,
      BUTTON_HEIGHT,
      isActive ? MODE_COLORS[mode] : 0x333344,
      isActive ? 1 : 0.6
    )
    bg.setStrokeStyle(2, isActive ? 0xffffff : 0x555566, isActive ? 0.5 : 0.3)
    bg.setInteractive({ useHandCursor: true })
    container.add(bg)

    // Button text
    const text = scene.add.text(btnX, 0, getDisplayLabel(mode), {
      fontSize: '13px',
      color: isActive ? '#ffffff' : '#aaaaaa',
      fontStyle: isActive ? 'bold' : 'normal',
    })
    text.setOrigin(0.5)
    container.add(text)

    buttons.set(mode, { bg, text })

    // Hover effects
    bg.on('pointerover', () => {
      if (mode !== currentMode) {
        bg.setFillStyle(MODE_COLORS[mode], 0.4)
        bg.setStrokeStyle(2, 0x888899, 0.5)
        text.setColor('#dddddd')
      }
    })

    bg.on('pointerout', () => {
      if (mode !== currentMode) {
        bg.setFillStyle(0x333344, 0.6)
        bg.setStrokeStyle(2, 0x555566, 0.3)
        text.setColor('#aaaaaa')
      }
    })

    // Click handler
    bg.on('pointerdown', () => {
      if (mode !== currentMode) {
        audioManager.playMenuSelect()
        setMode(mode)
      }
    })
  })

  const updateButtonStyles = () => {
    modes.forEach((mode) => {
      const button = buttons.get(mode)
      if (!button) return

      const isActive = mode === currentMode
      button.bg.setFillStyle(isActive ? MODE_COLORS[mode] : 0x333344, isActive ? 1 : 0.6)
      button.bg.setStrokeStyle(2, isActive ? 0xffffff : 0x555566, isActive ? 0.5 : 0.3)
      button.text.setColor(isActive ? '#ffffff' : '#aaaaaa')
      button.text.setFontStyle(isActive ? 'bold' : 'normal')
    })
  }

  const getMode = () => currentMode

  const setMode = (mode: GameMode) => {
    currentMode = mode
    updateButtonStyles()
    onModeChange?.(mode)
  }

  const destroy = () => {
    container.destroy()
  }

  return {
    container,
    getMode,
    setMode,
    destroy,
  }
}
