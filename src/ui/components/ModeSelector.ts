import Phaser from 'phaser'
import { audioManager } from '../../systems/AudioManager'
import { saveManager } from '../../systems/SaveManager'

export type GameMode = 'story' | 'endless' | 'daily'

export interface ModeSelectorConfig {
  scene: Phaser.Scene
  x: number
  y: number
  initialMode?: GameMode
  onModeChange?: (mode: GameMode) => void
  depth?: number
}

export interface ModeSelectorResult {
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

/**
 * ModeSelector - Dropdown for selecting game mode (Story/Endless/Daily)
 */
export function createModeSelector(config: ModeSelectorConfig): ModeSelectorResult {
  const { scene, x, y, initialMode = 'story', onModeChange, depth = 10 } = config

  let currentMode: GameMode = initialMode
  let isOpen = false

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  // Get daily challenge status
  const dailyCompleted = saveManager.isDailyChallengeCompleted()
  const dailyStats = saveManager.getDailyChallengeStats()

  const getDisplayLabel = (mode: GameMode): string => {
    if (mode === 'daily' && dailyCompleted) {
      return `Daily ✓ (Wave ${dailyStats.bestWave})`
    }
    return MODE_LABELS[mode]
  }

  // Main button (shows current selection)
  const buttonWidth = 140
  const buttonHeight = 36

  const buttonBg = scene.add.rectangle(0, 0, buttonWidth, buttonHeight, MODE_COLORS[currentMode])
  buttonBg.setStrokeStyle(2, 0xffffff, 0.3)
  buttonBg.setInteractive({ useHandCursor: true })
  container.add(buttonBg)

  const buttonText = scene.add.text(-10, 0, getDisplayLabel(currentMode), {
    fontSize: '14px',
    color: '#ffffff',
    fontStyle: 'bold',
  })
  buttonText.setOrigin(0.5)
  container.add(buttonText)

  const arrow = scene.add.text(buttonWidth / 2 - 15, 0, '▼', {
    fontSize: '10px',
    color: '#ffffff',
  })
  arrow.setOrigin(0.5)
  container.add(arrow)

  // Dropdown options container - rendered directly on scene (not in container) for proper depth
  const dropdownContainer = scene.add.container(x, y + buttonHeight / 2 + 5)
  dropdownContainer.setDepth(depth + 100)
  dropdownContainer.setVisible(false)

  const modes: GameMode[] = ['story', 'endless', 'daily']
  const optionHeight = 36

  // Dropdown background
  const dropdownBg = scene.add.rectangle(0, (modes.length * optionHeight) / 2, buttonWidth, modes.length * optionHeight + 8, 0x222233)
  dropdownBg.setStrokeStyle(1, 0x444466)
  dropdownContainer.add(dropdownBg)

  // Create option items
  modes.forEach((mode, index) => {
    const optionY = 4 + index * optionHeight + optionHeight / 2

    const optionBg = scene.add.rectangle(0, optionY, buttonWidth - 4, optionHeight - 4, MODE_COLORS[mode], 0.2)
    optionBg.setInteractive({ useHandCursor: true })
    dropdownContainer.add(optionBg)

    const optionText = scene.add.text(0, optionY, getDisplayLabel(mode), {
      fontSize: '13px',
      color: '#ffffff',
    })
    optionText.setOrigin(0.5)
    dropdownContainer.add(optionText)

    optionBg.on('pointerover', () => {
      optionBg.setFillStyle(MODE_COLORS[mode], 0.5)
    })

    optionBg.on('pointerout', () => {
      optionBg.setFillStyle(MODE_COLORS[mode], 0.2)
    })

    optionBg.on('pointerdown', () => {
      audioManager.playMenuSelect()
      setMode(mode)
      closeDropdown()
    })
  })

  const openDropdown = () => {
    if (isOpen) return
    isOpen = true
    dropdownContainer.setVisible(true)
    arrow.setText('▲')

    scene.tweens.add({
      targets: dropdownContainer,
      alpha: { from: 0, to: 1 },
      scaleY: { from: 0.8, to: 1 },
      duration: 100,
    })
  }

  const closeDropdown = () => {
    if (!isOpen) return
    isOpen = false
    arrow.setText('▼')

    scene.tweens.add({
      targets: dropdownContainer,
      alpha: 0,
      duration: 80,
      onComplete: () => {
        dropdownContainer.setVisible(false)
        dropdownContainer.setAlpha(1)
      },
    })
  }

  // Toggle dropdown on button click
  buttonBg.on('pointerdown', () => {
    audioManager.playMenuSelect()
    if (isOpen) {
      closeDropdown()
    } else {
      openDropdown()
    }
  })

  // Close dropdown when clicking elsewhere
  scene.input.on('pointerdown', (_pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
    if (isOpen && !currentlyOver.some((obj) => obj === buttonBg || dropdownContainer.list.includes(obj))) {
      closeDropdown()
    }
  })

  const getMode = () => currentMode

  const setMode = (mode: GameMode) => {
    currentMode = mode
    buttonBg.setFillStyle(MODE_COLORS[mode])
    buttonText.setText(getDisplayLabel(mode))
    onModeChange?.(mode)
  }

  const destroy = () => {
    dropdownContainer.destroy()
    container.destroy()
  }

  return {
    container,
    getMode,
    setMode,
    destroy,
  }
}
