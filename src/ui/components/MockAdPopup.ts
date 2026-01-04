import Phaser from 'phaser'
import { currencyManager } from '../../systems/CurrencyManager'
import { audioManager } from '../../systems/AudioManager'

export interface MockAdPopupConfig {
  scene: Phaser.Scene
  onComplete?: () => void
  buttonText?: string
}

export interface MockAdPopupResult {
  destroy: () => void
}

/**
 * MockAdPopup - Shows a mock ad with a cute cat drawing
 * Grants +1 energy after "watching" (3 second progress bar)
 */
export function showMockAdPopup(config: MockAdPopupConfig): MockAdPopupResult {
  const { scene, onComplete, buttonText = 'Close' } = config
  const width = scene.cameras.main.width
  const height = scene.cameras.main.height

  const elements: Phaser.GameObjects.GameObject[] = []
  let closeButton: Phaser.GameObjects.Rectangle | null = null
  let closeText: Phaser.GameObjects.Text | null = null
  let rewardText: Phaser.GameObjects.Text | null = null

  // Create overlay - set interactive to block clicks on background elements
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
  overlay.setDepth(200)
  overlay.setInteractive()
  elements.push(overlay)

  // Ad container
  const adBox = scene.add.rectangle(width / 2, height / 2, 300, 400, 0xffffff, 1)
  adBox.setStrokeStyle(3, 0x333333)
  adBox.setDepth(201)
  elements.push(adBox)

  // "AD" label in top corner
  const adLabel = scene.add.text(width / 2 - 130, height / 2 - 180, 'AD', {
    fontSize: '14px',
    color: '#ffffff',
    backgroundColor: '#ffaa00',
    padding: { x: 6, y: 2 },
  })
  adLabel.setDepth(202)
  elements.push(adLabel)

  // Draw cute cat face using graphics
  const catGraphics = scene.add.graphics()
  catGraphics.setDepth(202)
  elements.push(catGraphics)

  const catX = width / 2
  const catY = height / 2 - 40

  // Cat face (circle)
  catGraphics.fillStyle(0xffcc66)
  catGraphics.fillCircle(catX, catY, 80)

  // Cat ears
  catGraphics.fillStyle(0xffcc66)
  catGraphics.fillTriangle(catX - 70, catY - 50, catX - 40, catY - 90, catX - 20, catY - 50)
  catGraphics.fillTriangle(catX + 70, catY - 50, catX + 40, catY - 90, catX + 20, catY - 50)

  // Inner ears
  catGraphics.fillStyle(0xffaa88)
  catGraphics.fillTriangle(catX - 60, catY - 55, catX - 45, catY - 80, catX - 30, catY - 55)
  catGraphics.fillTriangle(catX + 60, catY - 55, catX + 45, catY - 80, catX + 30, catY - 55)

  // Eyes
  catGraphics.fillStyle(0x333333)
  catGraphics.fillCircle(catX - 30, catY - 10, 15)
  catGraphics.fillCircle(catX + 30, catY - 10, 15)

  // Eye highlights
  catGraphics.fillStyle(0xffffff)
  catGraphics.fillCircle(catX - 35, catY - 15, 5)
  catGraphics.fillCircle(catX + 25, catY - 15, 5)

  // Nose
  catGraphics.fillStyle(0xff8888)
  catGraphics.fillTriangle(catX, catY + 15, catX - 10, catY + 5, catX + 10, catY + 5)

  // Mouth - vertical line from nose
  catGraphics.lineStyle(3, 0x333333)
  catGraphics.beginPath()
  catGraphics.moveTo(catX, catY + 15)
  catGraphics.lineTo(catX, catY + 25)
  catGraphics.strokePath()

  // Mouth - smile arc
  catGraphics.beginPath()
  catGraphics.arc(catX, catY + 25, 20, 0.2, Math.PI - 0.2, false)
  catGraphics.strokePath()

  // Whiskers
  catGraphics.lineStyle(2, 0x333333)
  catGraphics.beginPath()
  // Left whiskers
  catGraphics.moveTo(catX - 40, catY + 10)
  catGraphics.lineTo(catX - 80, catY)
  catGraphics.moveTo(catX - 40, catY + 20)
  catGraphics.lineTo(catX - 80, catY + 20)
  catGraphics.moveTo(catX - 40, catY + 30)
  catGraphics.lineTo(catX - 80, catY + 40)
  // Right whiskers
  catGraphics.moveTo(catX + 40, catY + 10)
  catGraphics.lineTo(catX + 80, catY)
  catGraphics.moveTo(catX + 40, catY + 20)
  catGraphics.lineTo(catX + 80, catY + 20)
  catGraphics.moveTo(catX + 40, catY + 30)
  catGraphics.lineTo(catX + 80, catY + 40)
  catGraphics.strokePath()

  // Ad text
  const adTitle = scene.add.text(width / 2, height / 2 + 90, 'Cute Cat Wants to Help!', {
    fontSize: '18px',
    color: '#333333',
    fontStyle: 'bold',
  })
  adTitle.setOrigin(0.5)
  adTitle.setDepth(202)
  elements.push(adTitle)

  const adDesc = scene.add.text(width / 2, height / 2 + 115, 'Watch this adorable cat for energy', {
    fontSize: '12px',
    color: '#666666',
  })
  adDesc.setOrigin(0.5)
  adDesc.setDepth(202)
  elements.push(adDesc)

  // Progress bar for "watching" the ad
  const progressBg = scene.add.rectangle(width / 2, height / 2 + 150, 200, 20, 0xdddddd)
  progressBg.setDepth(202)
  elements.push(progressBg)

  const progressBar = scene.add.rectangle(width / 2 - 100, height / 2 + 150, 0, 18, 0x4a9eff)
  progressBar.setOrigin(0, 0.5)
  progressBar.setDepth(203)
  elements.push(progressBar)

  const progressText = scene.add.text(width / 2, height / 2 + 150, 'Loading...', {
    fontSize: '12px',
    color: '#333333',
  })
  progressText.setOrigin(0.5)
  progressText.setDepth(204)
  elements.push(progressText)

  const destroy = () => {
    elements.forEach((el) => el.destroy())
    if (closeButton) closeButton.destroy()
    if (closeText) closeText.destroy()
    if (rewardText) rewardText.destroy()
  }

  // Animate progress bar over 3 seconds
  scene.tweens.add({
    targets: progressBar,
    width: 200,
    duration: 3000,
    ease: 'Linear',
    onUpdate: () => {
      const progress = Math.floor((progressBar.width / 200) * 100)
      progressText.setText(`${progress}%`)
    },
    onComplete: () => {
      progressText.setText('Complete!')

      // Give energy reward
      currencyManager.add('energy', 1)
      audioManager.playLevelUp()

      // Show reward message
      rewardText = scene.add.text(width / 2, height / 2 + 180, '+1 Energy Received!', {
        fontSize: '16px',
        color: '#00cc00',
        fontStyle: 'bold',
      })
      rewardText.setOrigin(0.5)
      rewardText.setDepth(202)

      // Close button
      closeButton = scene.add.rectangle(width / 2, height / 2 + 220, 120, 36, 0x4a9eff)
      closeButton.setStrokeStyle(2, 0x6bb6ff)
      closeButton.setDepth(202)
      closeButton.setInteractive({ useHandCursor: true })

      closeText = scene.add.text(width / 2, height / 2 + 220, buttonText, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      closeText.setOrigin(0.5)
      closeText.setDepth(203)

      closeButton.on('pointerover', () => closeButton?.setFillStyle(0x6bb6ff))
      closeButton.on('pointerout', () => closeButton?.setFillStyle(0x4a9eff))
      closeButton.on('pointerdown', () => {
        audioManager.playMenuSelect()
        destroy()
        onComplete?.()
      })
    },
  })

  return { destroy }
}
