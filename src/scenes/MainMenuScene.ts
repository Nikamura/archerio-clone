import Phaser from 'phaser'
import { DifficultyLevel, DIFFICULTY_CONFIGS, setDifficulty, getCurrentDifficulty } from '../config/difficulty'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'
import { currencyManager } from '../systems/CurrencyManager'
import { chapterManager } from '../systems/ChapterManager'

export default class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: DifficultyLevel = DifficultyLevel.NORMAL
  private energyTimerText?: Phaser.GameObjects.Text

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Get saved difficulty or default to NORMAL
    this.selectedDifficulty = getCurrentDifficulty(this.game)

    // ============================================
    // CURRENCY DISPLAY (Top bar - compact)
    // ============================================

    currencyManager.updateEnergyRegeneration()

    // Single row: Gold | Gems | Energy
    const currentEnergy = currencyManager.get('energy')
    const maxEnergy = currencyManager.getMaxEnergy()

    this.add.text(10, 10, `💰${currencyManager.get('gold')}`, {
      fontSize: '14px',
      color: '#FFD700',
    })

    this.add.text(width / 2, 10, `💎${currencyManager.get('gems')}`, {
      fontSize: '14px',
      color: '#00FFFF',
    }).setOrigin(0.5, 0)

    this.add.text(width - 10, 10, `⚡${currentEnergy}/${maxEnergy}`, {
      fontSize: '14px',
      color: '#FFFF00',
    }).setOrigin(1, 0)

    // Energy timer (below energy)
    this.energyTimerText = this.add.text(width - 10, 28, '', {
      fontSize: '11px',
      color: '#888888',
    })
    this.energyTimerText.setOrigin(1, 0)
    this.updateEnergyTimer()

    // ============================================
    // TITLE
    // ============================================

    const title = this.add.text(width / 2, 60, 'ARCHER.IO', {
      fontSize: '36px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)

    // Stats line (compact)
    const stats = saveManager.getStatistics()
    const heroId = saveManager.getSelectedHeroId()
    const hero = saveManager.getHero(heroId)
    const heroName = hero ? hero.name : 'Atreus'
    const selectedChapter = chapterManager.getSelectedChapter()

    this.add.text(width / 2, 100, `${heroName} • Ch.${selectedChapter} • ${stats.totalKills} kills`, {
      fontSize: '12px',
      color: '#888888',
    }).setOrigin(0.5)

    // ============================================
    // DIFFICULTY SELECTION (Horizontal)
    // ============================================

    this.add.text(width / 2, 130, 'DIFFICULTY', {
      fontSize: '14px',
      color: '#666666',
    }).setOrigin(0.5)

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

      button.on('pointerover', () => {
        button.setStyle({ backgroundColor: '#7fa32f' })
      })

      button.on('pointerout', () => {
        button.setStyle({ backgroundColor: '#6b8e23' })
      })

      button.on('pointerdown', () => {
        audioManager.playMenuSelect()
        console.log(`${btn.action} - coming soon`)
      })
    })

    // Instructions (bottom)
    this.add.text(width / 2, height - 30, 'Move to dodge • Stop to shoot', {
      fontSize: '12px',
      color: '#666666',
    }).setOrigin(0.5)
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
}
