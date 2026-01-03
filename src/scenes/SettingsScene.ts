import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { saveManager, GameSettings, GraphicsQuality, ColorblindMode } from '../systems/SaveManager'
import { hapticManager } from '../systems/HapticManager'

/**
 * SettingsScene - Game options and preferences
 *
 * Features:
 * - Graphics quality toggle (Low/Medium/High)
 * - Screen shake toggle
 * - Audio toggle with volume slider
 * - Damage numbers toggle
 * - Vibration toggle
 */
export default class SettingsScene extends Phaser.Scene {
  private settings!: GameSettings

  constructor() {
    super({ key: 'SettingsScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Load current settings
    this.settings = { ...saveManager.getSettings() }

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header
    this.createHeader(width)

    // Settings list
    this.createSettingsList(width, height)

    // Back button
    this.createBackButton(width, height)
  }

  private createHeader(width: number) {
    this.add
      .text(width / 2, 40, 'SETTINGS', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
  }

  private createSettingsList(width: number, height: number) {
    const startY = 100
    const rowHeight = 60
    let currentY = startY

    // Graphics Quality
    this.createGraphicsQualitySetting(width, currentY)
    currentY += rowHeight

    // Screen Shake
    this.createToggleSetting(
      width,
      currentY,
      'Screen Shake',
      'Shake effect when taking damage',
      this.settings.screenShakeEnabled,
      (value) => {
        this.settings.screenShakeEnabled = value
        this.saveSettings()
      }
    )
    currentY += rowHeight

    // Audio
    this.createToggleSetting(
      width,
      currentY,
      'Sound Effects',
      'Enable game audio',
      this.settings.audioEnabled,
      (value) => {
        this.settings.audioEnabled = value
        audioManager.setEnabled(value)
        this.saveSettings()
      }
    )
    currentY += rowHeight

    // Damage Numbers
    this.createToggleSetting(
      width,
      currentY,
      'Damage Numbers',
      'Show floating damage text',
      this.settings.showDamageNumbers,
      (value) => {
        this.settings.showDamageNumbers = value
        this.saveSettings()
      }
    )
    currentY += rowHeight

    // Vibration
    this.createToggleSetting(
      width,
      currentY,
      'Vibration',
      'Haptic feedback on mobile',
      this.settings.vibrationEnabled,
      (value) => {
        this.settings.vibrationEnabled = value
        hapticManager.enabled = value
        if (value) {
          hapticManager.light() // Test vibration
        }
        this.saveSettings()
      }
    )
    currentY += rowHeight

    // Auto Level Up
    this.createToggleSetting(
      width,
      currentY,
      'Auto Level Up',
      'Automatically select abilities',
      this.settings.autoLevelUp,
      (value) => {
        this.settings.autoLevelUp = value
        this.saveSettings()
      }
    )
    currentY += rowHeight

    // Colorblind Mode
    this.createColorblindModeSetting(width, currentY)
    currentY += rowHeight + 20

    // Reset Progress button (dangerous)
    this.createResetButton(width, currentY, height)
  }

  private createGraphicsQualitySetting(width: number, y: number) {
    const leftX = 20
    const rightX = width - 20

    // Label
    this.add
      .text(leftX, y, 'Graphics Quality', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)

    // Description
    this.add
      .text(leftX, y + 18, 'Affects particles and effects', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)

    // Quality buttons
    const qualities: GraphicsQuality[] = [GraphicsQuality.LOW, GraphicsQuality.MEDIUM, GraphicsQuality.HIGH]
    const labels = ['Low', 'Med', 'High']
    const buttonWidth = 55
    const buttonGap = 8
    const totalButtonWidth = buttonWidth * 3 + buttonGap * 2
    const buttonStartX = rightX - totalButtonWidth

    const buttons: Phaser.GameObjects.Text[] = []

    qualities.forEach((quality, index) => {
      const x = buttonStartX + index * (buttonWidth + buttonGap) + buttonWidth / 2
      const isSelected = this.settings.graphicsQuality === quality

      const button = this.add
        .text(x, y, labels[index], {
          fontSize: '14px',
          color: '#ffffff',
          backgroundColor: isSelected ? '#4a9eff' : '#444444',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })

      button.on('pointerover', () => {
        if (this.settings.graphicsQuality !== quality) {
          button.setStyle({ backgroundColor: '#666666' })
        }
      })

      button.on('pointerout', () => {
        if (this.settings.graphicsQuality !== quality) {
          button.setStyle({ backgroundColor: '#444444' })
        }
      })

      button.on('pointerdown', () => {
        audioManager.playMenuSelect()
        this.settings.graphicsQuality = quality
        this.saveSettings()

        // Update all button styles
        buttons.forEach((btn, i) => {
          btn.setStyle({
            backgroundColor: qualities[i] === quality ? '#4a9eff' : '#444444',
          })
        })
      })

      buttons.push(button)
    })
  }

  private createColorblindModeSetting(width: number, y: number) {
    const leftX = 20
    const rightX = width - 20

    // Label
    this.add
      .text(leftX, y, 'Colorblind Mode', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)

    // Description
    this.add
      .text(leftX, y + 18, 'Adjust colors for accessibility', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)

    // Mode buttons
    const modes: ColorblindMode[] = [
      ColorblindMode.NONE,
      ColorblindMode.PROTANOPIA,
      ColorblindMode.DEUTERANOPIA,
      ColorblindMode.TRITANOPIA,
    ]
    const labels = ['Off', 'Pro', 'Deu', 'Tri']
    const buttonWidth = 42
    const buttonGap = 6
    const totalButtonWidth = buttonWidth * 4 + buttonGap * 3
    const buttonStartX = rightX - totalButtonWidth

    const buttons: Phaser.GameObjects.Text[] = []

    modes.forEach((mode, index) => {
      const x = buttonStartX + index * (buttonWidth + buttonGap) + buttonWidth / 2
      const isSelected = this.settings.colorblindMode === mode

      const button = this.add
        .text(x, y, labels[index], {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: isSelected ? '#4a9eff' : '#444444',
          padding: { x: 6, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })

      button.on('pointerover', () => {
        if (this.settings.colorblindMode !== mode) {
          button.setStyle({ backgroundColor: '#666666' })
        }
      })

      button.on('pointerout', () => {
        if (this.settings.colorblindMode !== mode) {
          button.setStyle({ backgroundColor: '#444444' })
        }
      })

      button.on('pointerdown', () => {
        audioManager.playMenuSelect()
        this.settings.colorblindMode = mode
        this.saveSettings()

        // Update all button styles
        buttons.forEach((btn, i) => {
          btn.setStyle({
            backgroundColor: modes[i] === mode ? '#4a9eff' : '#444444',
          })
        })
      })

      buttons.push(button)
    })
  }

  private createToggleSetting(
    width: number,
    y: number,
    label: string,
    description: string,
    initialValue: boolean,
    onChange: (value: boolean) => void
  ) {
    const leftX = 20
    const rightX = width - 20

    // Label
    this.add
      .text(leftX, y, label, {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)

    // Description
    this.add
      .text(leftX, y + 18, description, {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)

    // Toggle switch
    const toggleWidth = 50
    const toggleHeight = 26
    const toggleX = rightX - toggleWidth / 2

    // Container for toggle
    const toggle = this.add.container(toggleX, y)

    // Background track
    const trackColor = initialValue ? 0x4a9eff : 0x444444
    const track = this.add.rectangle(0, 0, toggleWidth, toggleHeight, trackColor, 1)
    track.setStrokeStyle(1, 0x666666)

    // Knob
    const knobX = initialValue ? toggleWidth / 2 - 13 : -toggleWidth / 2 + 13
    const knob = this.add.circle(knobX, 0, 10, 0xffffff)

    toggle.add([track, knob])

    // Make interactive
    track.setInteractive({ useHandCursor: true })

    let currentValue = initialValue

    track.on('pointerdown', () => {
      audioManager.playMenuSelect()
      currentValue = !currentValue
      onChange(currentValue)

      // Animate toggle
      this.tweens.add({
        targets: knob,
        x: currentValue ? toggleWidth / 2 - 13 : -toggleWidth / 2 + 13,
        duration: 150,
        ease: 'Power2',
      })

      track.setFillStyle(currentValue ? 0x4a9eff : 0x444444)
    })
  }

  private createResetButton(width: number, y: number, _height: number) {
    const resetButton = this.add
      .text(width / 2, y, 'Reset All Progress', {
        fontSize: '14px',
        color: '#ff4444',
        backgroundColor: '#331111',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    resetButton.on('pointerover', () => {
      resetButton.setStyle({ backgroundColor: '#552222' })
    })

    resetButton.on('pointerout', () => {
      resetButton.setStyle({ backgroundColor: '#331111' })
    })

    resetButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.showResetConfirmation(width)
    })
  }

  private showResetConfirmation(width: number) {
    const height = this.cameras.main.height

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setDepth(100)
    overlay.setInteractive() // Block clicks through

    // Dialog container
    const dialog = this.add.container(width / 2, height / 2)
    dialog.setDepth(101)

    // Background
    const bg = this.add.rectangle(0, 0, 280, 180, 0x222233)
    bg.setStrokeStyle(2, 0xff4444)

    // Title
    const title = this.add
      .text(0, -60, 'Reset Progress?', {
        fontSize: '20px',
        color: '#ff4444',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Warning text
    const warning = this.add
      .text(0, -20, 'This will delete ALL your\nsave data permanently!', {
        fontSize: '14px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)

    // Confirm button
    const confirmBtn = this.add
      .text(-60, 50, 'DELETE', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#cc2222',
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    confirmBtn.on('pointerover', () => {
      confirmBtn.setStyle({ backgroundColor: '#ff3333' })
    })

    confirmBtn.on('pointerout', () => {
      confirmBtn.setStyle({ backgroundColor: '#cc2222' })
    })

    confirmBtn.on('pointerdown', () => {
      saveManager.reset()
      // Restart the game from the beginning
      this.scene.start('MainMenuScene')
    })

    // Cancel button
    const cancelBtn = this.add
      .text(60, 50, 'Cancel', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    cancelBtn.on('pointerover', () => {
      cancelBtn.setStyle({ backgroundColor: '#666666' })
    })

    cancelBtn.on('pointerout', () => {
      cancelBtn.setStyle({ backgroundColor: '#444444' })
    })

    cancelBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      overlay.destroy()
      dialog.destroy()
    })

    dialog.add([bg, title, warning, confirmBtn, cancelBtn])
  }

  private createBackButton(width: number, height: number) {
    const backButton = this.add
      .text(width / 2, height - 50, '< BACK', {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    backButton.on('pointerover', () => {
      backButton.setStyle({ backgroundColor: '#666666' })
    })

    backButton.on('pointerout', () => {
      backButton.setStyle({ backgroundColor: '#444444' })
    })

    backButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.scene.start('MainMenuScene')
    })
  }

  private saveSettings() {
    saveManager.updateSettings(this.settings)
  }
}
