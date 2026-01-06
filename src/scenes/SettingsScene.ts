import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { saveManager, GameSettings, GraphicsQuality, ColorblindMode } from '../systems/SaveManager'
import { hapticManager } from '../systems/HapticManager'
import { saveExportManager } from '../systems/SaveExportManager'
import { createBackButton } from '../ui/components/BackButton'
import { ScrollContainer } from '../ui/components/ScrollContainer'

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
  private dangerZoneExpanded = false
  private dangerZoneContainer!: Phaser.GameObjects.Container
  private dangerZoneContent!: Phaser.GameObjects.Container
  private expandArrow!: Phaser.GameObjects.Text

  // Scroll container
  private scrollContainer?: ScrollContainer

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

    // Settings list (scrollable)
    this.createSettingsList(width, height)

    // Back button (fixed at bottom)
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
    const headerHeight = 70
    const footerHeight = 80
    const contentStartY = headerHeight
    const scrollAreaBottom = height - footerHeight

    // Create scroll container using reusable component
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width: width,
      bounds: { top: contentStartY, bottom: scrollAreaBottom },
    })

    const rowHeight = 60
    let currentY = contentStartY + 10 // Absolute position

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

    // Auto Room Advance
    this.createToggleSetting(
      width,
      currentY,
      'Auto Room Advance',
      'Skip door after clearing rooms',
      this.settings.autoRoomAdvance,
      (value) => {
        this.settings.autoRoomAdvance = value
        this.saveSettings()
      }
    )
    currentY += rowHeight

    // Colorblind Mode
    this.createColorblindModeSetting(width, currentY)
    currentY += rowHeight + 30 // Extra spacing before save data section

    // Save Data section (export/import)
    this.createSaveDataSection(width, currentY)
    currentY += 100 // Account for save data section height

    // Danger Zone (collapsible reset section)
    this.createDangerZone(width, currentY)
    currentY += 160 // Account for danger zone height (expanded)

    // Set content height for scroll calculations
    const contentHeight = currentY + 20 - contentStartY
    this.scrollContainer.setContentHeight(contentHeight)
  }

  private createGraphicsQualitySetting(width: number, y: number) {
    const leftX = 20
    const rightX = width - 20

    // Label
    const label = this.add
      .text(leftX, y, 'Graphics Quality', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
    this.scrollContainer!.add(label)

    // Description
    const desc = this.add
      .text(leftX, y + 18, 'Affects particles and effects', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)
    this.scrollContainer!.add(desc)

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
      this.scrollContainer!.add(button)

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
    const label = this.add
      .text(leftX, y, 'Colorblind Mode', {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
    this.scrollContainer!.add(label)

    // Description
    const desc = this.add
      .text(leftX, y + 18, 'Adjust colors for accessibility', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)
    this.scrollContainer!.add(desc)

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
      this.scrollContainer!.add(button)

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

  private createSaveDataSection(width: number, y: number) {
    const sectionWidth = width - 40
    const sectionHeight = 90
    const centerX = width / 2

    // Container
    const container = this.add.container(centerX, y)
    this.scrollContainer!.add(container)

    // Background
    const bg = this.add.rectangle(0, 0, sectionWidth, sectionHeight, 0x1a2a1a)
    bg.setStrokeStyle(2, 0x44aa44)

    // Title
    const title = this.add
      .text(-sectionWidth / 2 + 15, -28, 'Save Data', {
        fontSize: '14px',
        color: '#44aa44',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)

    // Description
    const desc = this.add
      .text(-sectionWidth / 2 + 15, -8, 'Export or import your progress', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)

    // Export button
    const exportBtn = this.add
      .text(-60, 25, 'Export', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#336633',
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    exportBtn.on('pointerover', () => {
      exportBtn.setStyle({ backgroundColor: '#448844' })
    })

    exportBtn.on('pointerout', () => {
      exportBtn.setStyle({ backgroundColor: '#336633' })
    })

    exportBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      const success = saveExportManager.downloadSave()
      if (success) {
        this.showExportSuccessMessage(width)
      } else {
        this.showExportErrorMessage(width)
      }
    })

    // Import button
    const importBtn = this.add
      .text(60, 25, 'Import', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#335588',
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    importBtn.on('pointerover', () => {
      importBtn.setStyle({ backgroundColor: '#4477aa' })
    })

    importBtn.on('pointerout', () => {
      importBtn.setStyle({ backgroundColor: '#335588' })
    })

    importBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.showImportConfirmation(width)
    })

    container.add([bg, title, desc, exportBtn, importBtn])
  }

  private showExportSuccessMessage(width: number) {
    const height = this.cameras.main.height

    // Toast message at bottom
    const toast = this.add.container(width / 2, height - 120)
    toast.setDepth(102)
    toast.setAlpha(0)

    const toastBg = this.add.rectangle(0, 0, 200, 40, 0x336633, 0.95)
    toastBg.setStrokeStyle(1, 0x44aa44)

    const toastText = this.add
      .text(0, 0, 'Save exported!', {
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    toast.add([toastBg, toastText])

    // Fade in, wait, fade out
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => toast.destroy(),
          })
        })
      },
    })
  }

  private showExportErrorMessage(width: number) {
    const height = this.cameras.main.height

    // Toast message at bottom
    const toast = this.add.container(width / 2, height - 120)
    toast.setDepth(102)
    toast.setAlpha(0)

    const toastBg = this.add.rectangle(0, 0, 220, 40, 0x663333, 0.95)
    toastBg.setStrokeStyle(1, 0xaa4444)

    const toastText = this.add
      .text(0, 0, 'Export failed', {
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    toast.add([toastBg, toastText])

    // Fade in, wait, fade out
    this.tweens.add({
      targets: toast,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: toast,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => toast.destroy(),
          })
        })
      },
    })
  }

  private showImportConfirmation(width: number) {
    const height = this.cameras.main.height

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setDepth(100)
    overlay.setInteractive()

    // Dialog container
    const dialog = this.add.container(width / 2, height / 2)
    dialog.setDepth(101)

    // Background
    const bg = this.add.rectangle(0, 0, 300, 200, 0x222233)
    bg.setStrokeStyle(2, 0x4488cc)

    // Title
    const title = this.add
      .text(0, -70, 'Import Save Data', {
        fontSize: '18px',
        color: '#4488cc',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Warning text
    const warning = this.add
      .text(0, -25, 'This will overwrite your\ncurrent progress with the\nimported save data.', {
        fontSize: '13px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)

    // Continue button
    const continueBtn = this.add
      .text(-65, 55, 'Continue', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#335588',
        padding: { x: 15, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    continueBtn.on('pointerover', () => {
      continueBtn.setStyle({ backgroundColor: '#4477aa' })
    })

    continueBtn.on('pointerout', () => {
      continueBtn.setStyle({ backgroundColor: '#335588' })
    })

    continueBtn.on('pointerdown', async () => {
      audioManager.playMenuSelect()
      overlay.destroy()
      dialog.destroy()
      await this.performImport(width)
    })

    // Cancel button
    const cancelBtn = this.add
      .text(65, 55, 'Cancel', {
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

    dialog.add([bg, title, warning, continueBtn, cancelBtn])
  }

  private async performImport(width: number) {
    try {
      const result = await saveExportManager.pickAndImportFile()

      if (result.success) {
        // Build success message with any warnings
        let message = `Imported ${result.imported} save entries.`
        if (result.warnings.length > 0) {
          // Filter out the "exported on" info message for the success dialog
          const importantWarnings = result.warnings.filter((w) => !w.startsWith('Save exported on'))
          if (importantWarnings.length > 0) {
            message += `\n\n${importantWarnings.slice(0, 2).join('\n')}`
          }
        }
        message += '\n\nRestarting game...'
        this.showImportResultDialog(width, true, message)
      } else if (result.errors.length > 0 && result.errors[0] !== 'File selection cancelled') {
        const errorMsg = result.errors.slice(0, 3).join('\n')
        this.showImportResultDialog(width, false, errorMsg)
      }
    } catch (error) {
      console.error('Import error:', error)
      this.showImportResultDialog(width, false, 'Unexpected error during import')
    }
  }

  private showImportResultDialog(width: number, success: boolean, message: string) {
    const height = this.cameras.main.height

    // Overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
    overlay.setDepth(100)
    overlay.setInteractive()

    // Dialog container
    const dialog = this.add.container(width / 2, height / 2)
    dialog.setDepth(101)

    // Background
    const bgColor = success ? 0x223322 : 0x332222
    const borderColor = success ? 0x44aa44 : 0xaa4444
    const bg = this.add.rectangle(0, 0, 280, 160, bgColor)
    bg.setStrokeStyle(2, borderColor)

    // Title
    const titleColor = success ? '#44aa44' : '#aa4444'
    const titleText = success ? 'Import Successful' : 'Import Failed'
    const title = this.add
      .text(0, -50, titleText, {
        fontSize: '18px',
        color: titleColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Message
    const msg = this.add
      .text(0, 0, message, {
        fontSize: '12px',
        color: '#ffffff',
        align: 'center',
        wordWrap: { width: 250 },
      })
      .setOrigin(0.5)

    // OK button
    const okBtn = this.add
      .text(0, 55, 'OK', {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: success ? '#336633' : '#663333',
        padding: { x: 30, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })

    okBtn.on('pointerover', () => {
      okBtn.setStyle({ backgroundColor: success ? '#448844' : '#884444' })
    })

    okBtn.on('pointerout', () => {
      okBtn.setStyle({ backgroundColor: success ? '#336633' : '#663333' })
    })

    okBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      overlay.destroy()
      dialog.destroy()

      if (success) {
        // Reload the game to apply imported data
        window.location.reload()
      }
    })

    dialog.add([bg, title, msg, okBtn])
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
    const labelText = this.add
      .text(leftX, y, label, {
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0, 0.5)
    this.scrollContainer!.add(labelText)

    // Description
    const descText = this.add
      .text(leftX, y + 18, description, {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)
    this.scrollContainer!.add(descText)

    // Toggle switch
    const toggleWidth = 50
    const toggleHeight = 26
    const toggleX = rightX - toggleWidth / 2

    // Container for toggle
    const toggle = this.add.container(toggleX, y)
    this.scrollContainer!.add(toggle)

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

  private createDangerZone(width: number, y: number) {
    const zoneWidth = width - 40
    const headerHeight = 44
    const contentHeight = 100
    const centerX = width / 2

    // Reset expanded state
    this.dangerZoneExpanded = false

    // Main container
    this.dangerZoneContainer = this.add.container(centerX, y)
    this.scrollContainer!.add(this.dangerZoneContainer)

    // === HEADER (always visible) ===
    const headerBg = this.add.rectangle(0, 0, zoneWidth, headerHeight, 0x1a0808)
    headerBg.setStrokeStyle(2, 0xff4444)
    headerBg.setInteractive({ useHandCursor: true })

    const headerLabel = this.add
      .text(-zoneWidth / 2 + 15, 0, '⚠️ DANGER ZONE', {
        fontSize: '14px',
        color: '#ff4444',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)

    this.expandArrow = this.add
      .text(zoneWidth / 2 - 15, 0, '▼', {
        fontSize: '14px',
        color: '#ff4444',
      })
      .setOrigin(1, 0.5)

    this.dangerZoneContainer.add([headerBg, headerLabel, this.expandArrow])

    // === CONTENT (hidden by default) ===
    this.dangerZoneContent = this.add.container(0, headerHeight / 2 + contentHeight / 2)
    this.dangerZoneContent.setVisible(false)

    const contentBg = this.add.rectangle(0, 0, zoneWidth, contentHeight, 0x220808)
    contentBg.setStrokeStyle(2, 0xff4444)

    const warningText = this.add
      .text(0, -25, 'This will permanently delete ALL\nyour progress and currencies.', {
        fontSize: '12px',
        color: '#cccccc',
        align: 'center',
      })
      .setOrigin(0.5)

    const resetButton = this.add
      .text(0, 25, 'Reset All Progress', {
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

    this.dangerZoneContent.add([contentBg, warningText, resetButton])
    this.dangerZoneContainer.add(this.dangerZoneContent)

    // === TOGGLE LOGIC ===
    headerBg.on('pointerover', () => {
      headerBg.setFillStyle(0x2a1010)
    })

    headerBg.on('pointerout', () => {
      headerBg.setFillStyle(0x1a0808)
    })

    headerBg.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.dangerZoneExpanded = !this.dangerZoneExpanded
      this.dangerZoneContent.setVisible(this.dangerZoneExpanded)
      this.expandArrow.setText(this.dangerZoneExpanded ? '▲' : '▼')
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

  private createBackButton(_width: number, height: number) {
    createBackButton({
      scene: this,
      y: height - 50,
      targetScene: 'MainMenuScene',
    })
  }

  private saveSettings() {
    saveManager.updateSettings(this.settings)
  }
}
