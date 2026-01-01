import Phaser from 'phaser'
import { DifficultyLevel, DIFFICULTY_CONFIGS, setDifficulty, getCurrentDifficulty } from '../config/difficulty'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'
import { currencyManager } from '../systems/CurrencyManager'
import { chapterManager } from '../systems/ChapterManager'

export default class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: DifficultyLevel = DifficultyLevel.NORMAL
  private energyTimerText?: Phaser.GameObjects.Text
  private leftTorch?: Phaser.GameObjects.Image
  private rightTorch?: Phaser.GameObjects.Image

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // ============================================
    // BACKGROUND (depth 0)
    // ============================================
    const bg = this.add.image(width / 2, height / 2, 'menuBg')
    bg.setDisplaySize(width, height)
    bg.setDepth(0)

    // ============================================
    // ANIMATED TORCHES
    // ============================================
    this.createTorches(width)

    // Get saved difficulty or default to NORMAL
    this.selectedDifficulty = getCurrentDifficulty(this.game)

    // ============================================
    // CURRENCY DISPLAY (Top bar - compact)
    // ============================================

    currencyManager.updateEnergyRegeneration()

    // Single row: Gold | Gems | Energy
    const currentEnergy = currencyManager.get('energy')
    const maxEnergy = currencyManager.getMaxEnergy()

    const goldText = this.add.text(10, 10, `💰${currencyManager.get('gold')}`, {
      fontSize: '14px',
      color: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2,
    })
    goldText.setDepth(10)

    const gemsText = this.add.text(width / 2, 10, `💎${currencyManager.get('gems')}`, {
      fontSize: '14px',
      color: '#00FFFF',
      stroke: '#000000',
      strokeThickness: 2,
    })
    gemsText.setOrigin(0.5, 0)
    gemsText.setDepth(10)

    const energyText = this.add.text(width - 10, 10, `⚡${currentEnergy}/${maxEnergy}`, {
      fontSize: '14px',
      color: '#FFFF00',
      stroke: '#000000',
      strokeThickness: 2,
    })
    energyText.setOrigin(1, 0)
    energyText.setDepth(10)

    // Energy timer (below energy)
    this.energyTimerText = this.add.text(width - 10, 28, '', {
      fontSize: '11px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    })
    this.energyTimerText.setOrigin(1, 0)
    this.energyTimerText.setDepth(10)
    this.updateEnergyTimer()

    // ============================================
    // TITLE (depth 10 to ensure visibility over background)
    // ============================================

    const title = this.add.text(width / 2, 60, 'ARCHER.IO', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    title.setOrigin(0.5)
    title.setDepth(10)

    // Stats line (compact)
    const stats = saveManager.getStatistics()
    const heroId = saveManager.getSelectedHeroId()
    const hero = saveManager.getHero(heroId)
    const heroName = hero ? hero.name : 'Atreus'
    const selectedChapter = chapterManager.getSelectedChapter()

    const statsText = this.add.text(width / 2, 100, `${heroName} • Ch.${selectedChapter} • ${stats.totalKills} kills`, {
      fontSize: '12px',
      color: '#cccccc',
      stroke: '#000000',
      strokeThickness: 2,
    })
    statsText.setOrigin(0.5)
    statsText.setDepth(10)

    // ============================================
    // DIFFICULTY SELECTION (Horizontal)
    // ============================================

    const difficultyLabel = this.add.text(width / 2, 130, 'DIFFICULTY', {
      fontSize: '14px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    })
    difficultyLabel.setOrigin(0.5)
    difficultyLabel.setDepth(10)

    // Horizontal difficulty buttons
    const difficulties = [DifficultyLevel.EASY, DifficultyLevel.NORMAL, DifficultyLevel.HARD]
    const buttonWidth = 90
    const totalWidth = buttonWidth * 3 + 20
    const startX = (width - totalWidth) / 2 + buttonWidth / 2

    difficulties.forEach((difficulty, index) => {
      const config = DIFFICULTY_CONFIGS[difficulty]
      const xPos = startX + index * (buttonWidth + 10)

      const button = this.add.text(xPos, 160, config.label, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: difficulty === this.selectedDifficulty ? config.color : '#444444',
        padding: { x: 12, y: 8 },
      })
      button.setOrigin(0.5)
      button.setInteractive({ useHandCursor: true })
      button.setData('difficulty', difficulty)
      button.setDepth(10)

      button.on('pointerover', () => {
        if (this.selectedDifficulty !== difficulty) {
          button.setStyle({ backgroundColor: '#666666' })
        }
      })

      button.on('pointerout', () => {
        if (this.selectedDifficulty !== difficulty) {
          button.setStyle({ backgroundColor: '#444444' })
        }
      })

      button.on('pointerdown', () => {
        audioManager.resume()
        audioManager.playMenuSelect()
        this.selectedDifficulty = difficulty
        setDifficulty(this.game, difficulty)
        saveManager.setDifficulty(difficulty)

        this.children.list.forEach((child) => {
          if (child instanceof Phaser.GameObjects.Text && child.getData('difficulty')) {
            const childDifficulty = child.getData('difficulty') as DifficultyLevel
            const childConfig = DIFFICULTY_CONFIGS[childDifficulty]
            child.setStyle({
              backgroundColor: childDifficulty === difficulty ? childConfig.color : '#444444',
            })
          }
        })
      })
    })

    // ============================================
    // PLAY BUTTON (Center)
    // ============================================

    const playButton = this.add.text(width / 2, 240, 'PLAY', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#4a9eff',
      padding: { x: 50, y: 15 },
    })
    playButton.setOrigin(0.5)
    playButton.setInteractive({ useHandCursor: true })
    playButton.setDepth(10)

    playButton.on('pointerover', () => {
      playButton.setStyle({ backgroundColor: '#6bb6ff' })
    })

    playButton.on('pointerout', () => {
      playButton.setStyle({ backgroundColor: '#4a9eff' })
    })

    playButton.on('pointerdown', () => {
      audioManager.resume()
      audioManager.playGameStart()
      this.scene.start('GameScene')
      this.scene.launch('UIScene')
    })

    // ============================================
    // MENU BUTTONS (Horizontal row)
    // ============================================

    const menuY = 320
    const menuButtons = [
      { label: 'Heroes', action: 'Heroes menu' },
      { label: 'Equip', action: 'Equipment menu' },
      { label: 'Talents', action: 'Talents menu' },
    ]
    const menuBtnWidth = 100
    const menuStartX = (width - menuBtnWidth * 3 - 20) / 2 + menuBtnWidth / 2

    menuButtons.forEach((btn, index) => {
      const xPos = menuStartX + index * (menuBtnWidth + 10)
      const button = this.add.text(xPos, menuY, btn.label, {
        fontSize: '14px',
        color: '#ffffff',
        backgroundColor: '#6b8e23',
        padding: { x: 15, y: 10 },
      })
      button.setOrigin(0.5)
      button.setInteractive({ useHandCursor: true })
      button.setDepth(10)

      button.on('pointerover', () => {
        button.setStyle({ backgroundColor: '#7fa32f' })
      })

      button.on('pointerout', () => {
        button.setStyle({ backgroundColor: '#6b8e23' })
      })

      button.on('pointerdown', () => {
        audioManager.playMenuSelect()
        if (btn.label === 'Heroes') {
          this.scene.start('HeroesScene')
        } else if (btn.label === 'Equip') {
          this.scene.start('EquipmentScene')
        } else if (btn.label === 'Talents') {
          this.scene.start('TalentsScene')
        } else {
          console.log(`${btn.action} - coming soon`)
        }
      })
    })

    // Instructions (bottom)
    const instructionsText = this.add.text(width / 2, height - 30, 'Move to dodge • Stop to shoot', {
      fontSize: '12px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    })
    instructionsText.setOrigin(0.5)
    instructionsText.setDepth(10)
  }

  update() {
    // Update energy timer every frame
    this.updateEnergyTimer()
  }

  private updateEnergyTimer() {
    if (!this.energyTimerText) return

    const currentEnergy = currencyManager.get('energy')
    const maxEnergy = currencyManager.getMaxEnergy()

    if (currentEnergy >= maxEnergy) {
      this.energyTimerText.setText('')
      return
    }

    const timeString = currencyManager.getFormattedTimeUntilNextEnergy()
    this.energyTimerText.setText(`Next: ${timeString}`)
  }

  private createTorches(width: number) {
    // Title Y position (matches title in create())
    const titleY = 60
    const torchOffsetX = 80 // Distance from center to each torch

    // Create left torch - small size
    this.leftTorch = this.add.image(width / 2 - torchOffsetX, titleY, 'torch')
    this.leftTorch.setDisplaySize(16, 16)
    this.leftTorch.setDepth(1)

    // Create right torch - small size
    this.rightTorch = this.add.image(width / 2 + torchOffsetX, titleY, 'torch')
    this.rightTorch.setDisplaySize(16, 16)
    this.rightTorch.setDepth(1)

    // Animate left torch - subtle flickering effect (slower)
    this.tweens.add({
      targets: this.leftTorch,
      scaleX: { from: 0.98, to: 1.02 },
      scaleY: { from: 0.98, to: 1.02 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.tweens.add({
      targets: this.leftTorch,
      alpha: { from: 0.9, to: 1.0 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Animate right torch - slightly different timing for natural look
    this.tweens.add({
      targets: this.rightTorch,
      scaleX: { from: 0.98, to: 1.02 },
      scaleY: { from: 0.98, to: 1.02 },
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 100,
    })

    this.tweens.add({
      targets: this.rightTorch,
      alpha: { from: 0.9, to: 1.0 },
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 80,
    })

    // Add ember particles rising from torches
    this.createEmberParticles(width, titleY, torchOffsetX)
  }

  private createEmberParticles(width: number, titleY: number, torchOffsetX: number) {
    // Create a simple ember particle texture
    const graphics = this.add.graphics()
    graphics.fillStyle(0xff6600, 1)
    graphics.fillCircle(1, 1, 1)
    graphics.generateTexture('ember', 2, 2)
    graphics.destroy()

    // Create ember emitter for left torch - smaller and less frequent
    const leftEmitter = this.add.particles(width / 2 - torchOffsetX, titleY - 5, 'ember', {
      speed: { min: 8, max: 20 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 400,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff6600, 0xff8800, 0xffaa00],
    })
    leftEmitter.setDepth(2)

    // Create ember emitter for right torch
    const rightEmitter = this.add.particles(width / 2 + torchOffsetX, titleY - 5, 'ember', {
      speed: { min: 8, max: 20 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 400,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff6600, 0xff8800, 0xffaa00],
    })
    rightEmitter.setDepth(2)
  }
}
