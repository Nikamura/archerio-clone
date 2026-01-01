import Phaser from 'phaser'
import { DifficultyLevel, DIFFICULTY_CONFIGS, setDifficulty, getCurrentDifficulty } from '../config/difficulty'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'

export default class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: DifficultyLevel = DifficultyLevel.NORMAL

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Get saved difficulty or default to NORMAL
    this.selectedDifficulty = getCurrentDifficulty(this.game)

    // Title
    const title = this.add.text(width / 2, 60, 'ARCHER.IO', {
      fontSize: '48px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)

    // Difficulty label
    const difficultyLabel = this.add.text(width / 2, 150, 'SELECT DIFFICULTY', {
      fontSize: '20px',
      color: '#aaaaaa',
      fontStyle: 'bold',
    })
    difficultyLabel.setOrigin(0.5)

    // Create difficulty buttons
    const buttonY = 200
    const buttonSpacing = 100
    const difficulties = [DifficultyLevel.EASY, DifficultyLevel.NORMAL, DifficultyLevel.HARD]

    difficulties.forEach((difficulty, index) => {
      const config = DIFFICULTY_CONFIGS[difficulty]
      const yPos = buttonY + index * buttonSpacing

      // Button background
      const button = this.add.text(width / 2, yPos, config.label, {
        fontSize: '24px',
        color: '#ffffff',
        backgroundColor: difficulty === this.selectedDifficulty ? config.color : '#555555',
        padding: { x: 30, y: 12 },
      })
      button.setOrigin(0.5)
      button.setInteractive({ useHandCursor: true })
      button.setData('difficulty', difficulty)

      // Description text
      const description = this.add.text(width / 2, yPos + 28, config.description, {
        fontSize: '12px',
        color: '#aaaaaa',
      })
      description.setOrigin(0.5)

      // Hover effects
      button.on('pointerover', () => {
        if (this.selectedDifficulty !== difficulty) {
          button.setStyle({ backgroundColor: '#777777' })
        }
      })

      button.on('pointerout', () => {
        if (this.selectedDifficulty !== difficulty) {
          button.setStyle({ backgroundColor: '#555555' })
        }
      })

      // Click handler
      button.on('pointerdown', () => {
        // Resume audio context on first interaction
        audioManager.resume()
        audioManager.playMenuSelect()

        // Update selected difficulty
        this.selectedDifficulty = difficulty
        setDifficulty(this.game, difficulty)

        // Persist difficulty to save data
        saveManager.setDifficulty(difficulty)

        // Update all buttons
        this.children.list.forEach((child) => {
          if (child instanceof Phaser.GameObjects.Text && child.getData('difficulty')) {
            const childDifficulty = child.getData('difficulty') as DifficultyLevel
            const childConfig = DIFFICULTY_CONFIGS[childDifficulty]
            child.setStyle({
              backgroundColor: childDifficulty === difficulty ? childConfig.color : '#555555',
            })
          }
        })
      })
    })

    // Play button
    const playButton = this.add.text(width / 2, height - 140, 'PLAY', {
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#4a9eff',
      padding: { x: 40, y: 20 },
    })
    playButton.setOrigin(0.5)
    playButton.setInteractive({ useHandCursor: true })

    // Button hover effects
    playButton.on('pointerover', () => {
      playButton.setStyle({ backgroundColor: '#6bb6ff' })
    })

    playButton.on('pointerout', () => {
      playButton.setStyle({ backgroundColor: '#4a9eff' })
    })

    playButton.on('pointerdown', () => {
      // Resume audio context on first interaction
      audioManager.resume()
      audioManager.playGameStart()

      this.scene.start('GameScene')
      this.scene.launch('UIScene')
    })

    // Instructions
    const instructions = this.add.text(
      width / 2,
      height - 80,
      'Touch left side to move • Stop to shoot',
      {
        fontSize: '16px',
        color: '#aaaaaa',
      }
    )
    instructions.setOrigin(0.5)
  }
}
