import Phaser from 'phaser'
import { audioManager } from '../../systems/AudioManager'

/**
 * Configuration for Button
 */
export interface ButtonConfig {
  scene: Phaser.Scene
  x: number
  y: number
  text: string
  width?: number
  height?: number
  backgroundColor?: number
  hoverColor?: number
  disabledColor?: number
  textColor?: string
  fontSize?: string
  fontStyle?: string
  padding?: { x: number; y: number }
  onClick: () => void
  disabled?: boolean
  playSound?: boolean
  depth?: number
}

export interface ButtonResult {
  container: Phaser.GameObjects.Container
  text: Phaser.GameObjects.Text
  setDisabled: (disabled: boolean) => void
  setText: (text: string) => void
  destroy: () => void
}

/**
 * Button - Reusable button component with hover effects
 *
 * Provides a styled button with hover effects, disabled state, and click handling.
 * Eliminates 78+ occurrences of button hover code across the codebase.
 */
export function createButton(config: ButtonConfig): ButtonResult {
  const {
    scene,
    x,
    y,
    text,
    backgroundColor = 0x444444,
    hoverColor = 0x666666,
    disabledColor = 0x333333,
    textColor = '#ffffff',
    fontSize = '16px',
    fontStyle = 'normal',
    padding = { x: 20, y: 10 },
    onClick,
    disabled = false,
    playSound = true,
    depth = 0,
  } = config

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  let isDisabled = disabled
  let currentBgColor = disabled ? disabledColor : backgroundColor

  // Create button text with background
  const buttonText = scene.add
    .text(0, 0, text, {
      fontSize,
      fontStyle,
      color: disabled ? '#666666' : textColor,
      backgroundColor: `#${currentBgColor.toString(16).padStart(6, '0')}`,
      padding,
    })
    .setOrigin(0.5)

  container.add(buttonText)

  // Set interactivity
  if (!disabled) {
    buttonText.setInteractive({ useHandCursor: true })
  }

  // Hover effects
  buttonText.on('pointerover', () => {
    if (!isDisabled) {
      buttonText.setStyle({
        backgroundColor: `#${hoverColor.toString(16).padStart(6, '0')}`,
      })
    }
  })

  buttonText.on('pointerout', () => {
    if (!isDisabled) {
      buttonText.setStyle({
        backgroundColor: `#${backgroundColor.toString(16).padStart(6, '0')}`,
      })
    }
  })

  // Click handler
  buttonText.on('pointerdown', () => {
    if (!isDisabled) {
      if (playSound) {
        audioManager.playMenuSelect()
      }
      onClick()
    }
  })

  // Helper methods
  const setDisabled = (newDisabled: boolean) => {
    isDisabled = newDisabled
    currentBgColor = newDisabled ? disabledColor : backgroundColor

    buttonText.setStyle({
      color: newDisabled ? '#666666' : textColor,
      backgroundColor: `#${currentBgColor.toString(16).padStart(6, '0')}`,
    })

    if (newDisabled) {
      buttonText.disableInteractive()
    } else {
      buttonText.setInteractive({ useHandCursor: true })
    }
  }

  const setText = (newText: string) => {
    buttonText.setText(newText)
  }

  const destroy = () => {
    container.destroy()
  }

  return {
    container,
    text: buttonText,
    setDisabled,
    setText,
    destroy,
  }
}

/**
 * Configuration for IconButton
 */
export interface IconButtonConfig {
  scene: Phaser.Scene
  x: number
  y: number
  icon: string // Emoji or text icon
  size?: number
  backgroundColor?: number
  hoverColor?: number
  onClick: () => void
  disabled?: boolean
  playSound?: boolean
  depth?: number
}

/**
 * IconButton - Circular button with icon
 */
export function createIconButton(config: IconButtonConfig): ButtonResult {
  const {
    scene,
    x,
    y,
    icon,
    size = 40,
    backgroundColor = 0x444444,
    hoverColor = 0x666666,
    onClick,
    disabled = false,
    playSound = true,
    depth = 0,
  } = config

  const container = scene.add.container(x, y)
  container.setDepth(depth)

  let isDisabled = disabled

  // Create circular background
  const circle = scene.add.circle(0, 0, size / 2, disabled ? 0x333333 : backgroundColor)
  container.add(circle)

  // Create icon text
  const iconText = scene.add
    .text(0, 0, icon, {
      fontSize: `${size * 0.5}px`,
      color: disabled ? '#666666' : '#ffffff',
    })
    .setOrigin(0.5)
  container.add(iconText)

  // Set interactivity on circle
  if (!disabled) {
    circle.setInteractive({ useHandCursor: true })
  }

  // Hover effects
  circle.on('pointerover', () => {
    if (!isDisabled) {
      circle.setFillStyle(hoverColor)
    }
  })

  circle.on('pointerout', () => {
    if (!isDisabled) {
      circle.setFillStyle(backgroundColor)
    }
  })

  // Click handler
  circle.on('pointerdown', () => {
    if (!isDisabled) {
      if (playSound) {
        audioManager.playMenuSelect()
      }
      onClick()
    }
  })

  // Helper methods
  const setDisabled = (newDisabled: boolean) => {
    isDisabled = newDisabled
    circle.setFillStyle(newDisabled ? 0x333333 : backgroundColor)
    iconText.setColor(newDisabled ? '#666666' : '#ffffff')

    if (newDisabled) {
      circle.disableInteractive()
    } else {
      circle.setInteractive({ useHandCursor: true })
    }
  }

  const setText = (newIcon: string) => {
    iconText.setText(newIcon)
  }

  const destroy = () => {
    container.destroy()
  }

  return {
    container,
    text: iconText,
    setDisabled,
    setText,
    destroy,
  }
}

export default createButton
