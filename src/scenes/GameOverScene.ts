import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'

export interface GameOverData {
  roomsCleared: number
  enemiesKilled: number
  isVictory?: boolean
  playTimeMs?: number
  abilitiesGained?: number
}

export default class GameOverScene extends Phaser.Scene {
  private stats: GameOverData = { roomsCleared: 0, enemiesKilled: 0, isVictory: false }

  constructor() {
    super({ key: 'GameOverScene' })
  }

  init(data: GameOverData) {
    this.stats = data || { roomsCleared: 0, enemiesKilled: 0, isVictory: false }

    // Record run statistics to save data
    this.recordRunStats()
  }

  /**
   * Record this run's statistics to persistent save data
   */
  private recordRunStats(): void {
    saveManager.recordRun({
      kills: this.stats.enemiesKilled,
      roomsCleared: this.stats.roomsCleared,
      playTimeMs: this.stats.playTimeMs ?? 0,
      bossDefeated: this.stats.isVictory === true,
      abilitiesGained: this.stats.abilitiesGained ?? 0,
      victory: this.stats.isVictory === true,
    })

    // Log updated statistics
    const totalStats = saveManager.getStatistics()
    console.log(
      `GameOverScene: Run recorded - Total runs: ${totalStats.totalRuns}, Total kills: ${totalStats.totalKills}`
    )
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const isVictory = this.stats.isVictory

    // Dark overlay background
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.8).setOrigin(0)

    // Title text
    const titleText = isVictory ? 'VICTORY!' : 'GAME OVER'
    const titleColor = isVictory ? '#00ff88' : '#ff4444'

    this.add
      .text(width / 2, height / 3, titleText, {
        fontSize: '48px',
        fontFamily: 'Arial',
        color: titleColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Stats
    const statsText = [
      `Rooms Cleared: ${this.stats.roomsCleared}`,
      `Enemies Killed: ${this.stats.enemiesKilled}`,
    ].join('\n')

    this.add
      .text(width / 2, height / 2, statsText, {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 10,
      })
      .setOrigin(0.5)

    // Button
    const buttonWidth = 180
    const buttonHeight = 50
    const buttonY = height * 0.7
    const buttonText = isVictory ? 'PLAY AGAIN' : 'TRY AGAIN'
    const buttonColor = isVictory ? 0x00ff88 : 0x4a9eff

    const button = this.add
      .rectangle(width / 2, buttonY, buttonWidth, buttonHeight, buttonColor, 1)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, buttonY, buttonText, {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Button hover effects
    const hoverColor = isVictory ? 0x33ffaa : 0x6ab0ff
    const pressColor = isVictory ? 0x00cc66 : 0x3a8edf

    button.on('pointerover', () => {
      button.setFillStyle(hoverColor)
    })

    button.on('pointerout', () => {
      button.setFillStyle(buttonColor)
    })

    button.on('pointerdown', () => {
      button.setFillStyle(pressColor)
    })

    button.on('pointerup', () => {
      this.restartGame()
    })

    // Allow keyboard restart
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.restartGame()
    })

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.restartGame()
    })

    // Add victory particles if won
    if (isVictory) {
      this.addVictoryEffect()
    }

    console.log('GameOverScene: Created', isVictory ? '(Victory)' : '(Defeat)')
  }

  private addVictoryEffect() {
    // Simple star burst effect
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    for (let i = 0; i < 20; i++) {
      const star = this.add.text(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(50, height - 100),
        '★',
        {
          fontSize: `${Phaser.Math.Between(16, 32)}px`,
          color: '#ffdd00',
        }
      )
      star.setAlpha(0)

      this.tweens.add({
        targets: star,
        alpha: 1,
        y: star.y - 50,
        duration: 1000,
        delay: i * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private restartGame() {
    // Play game start sound
    audioManager.playGameStart()

    // Stop other scenes first
    this.scene.stop('GameScene')
    this.scene.stop('UIScene')

    // Start fresh game
    this.scene.start('GameScene')
    this.scene.launch('UIScene')

    // Stop this scene last
    this.scene.stop('GameOverScene')
  }
}
