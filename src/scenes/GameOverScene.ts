import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'
import { achievementManager } from '../systems/AchievementManager'
import { currencyManager } from '../systems/CurrencyManager'
import { chestManager } from '../systems/ChestManager'
import {
  calculateChestRewards,
  getTotalChests,
  ChestRewards,
  CHEST_CONFIGS,
  CHEST_ORDER,
  ChestType,
} from '../data/chestData'

export interface GameOverData {
  roomsCleared: number
  enemiesKilled: number
  isVictory?: boolean
  playTimeMs?: number
  abilitiesGained?: number
  bossDefeated?: boolean
  goldEarned?: number
}

/**
 * Gold calculation for enemies killed
 * Average gold per enemy type (from CurrencyManager ranges):
 * - melee: 5-10 (avg 7.5)
 * - ranged: 8-15 (avg 11.5)
 * - spreader: 10-20 (avg 15)
 * - boss: 50-100 (avg 75)
 *
 * We approximate with a weighted average assuming mix of enemy types
 */
function calculateGoldEarned(enemiesKilled: number, bossDefeated: boolean): number {
  // Approximate 10 gold per regular enemy (weighted average)
  const baseGold = enemiesKilled * 10

  // Boss bonus
  const bossGold = bossDefeated ? 75 : 0

  return baseGold + bossGold
}

export default class GameOverScene extends Phaser.Scene {
  private stats: GameOverData = { roomsCleared: 0, enemiesKilled: 0, isVictory: false }
  private goldEarned: number = 0
  private chestRewards: ChestRewards = { wooden: 0, silver: 0, golden: 0 }
  private rewardsCollected: boolean = false

  constructor() {
    super({ key: 'GameOverScene' })
  }

  init(data: GameOverData) {
    this.stats = data || { roomsCleared: 0, enemiesKilled: 0, isVictory: false }
    this.rewardsCollected = false

    // Use passed goldEarned if available (from actual gold drops), otherwise estimate
    const bossDefeated = this.stats.bossDefeated ?? this.stats.isVictory ?? false
    this.goldEarned = this.stats.goldEarned ?? calculateGoldEarned(this.stats.enemiesKilled, bossDefeated)
    this.chestRewards = calculateChestRewards(
      this.stats.roomsCleared,
      this.stats.enemiesKilled,
      bossDefeated,
      this.stats.isVictory ?? false
    )

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

    // Check achievements after recording stats
    achievementManager.checkAchievements()
  }

  /**
   * Collect rewards (gold and chests)
   */
  private collectRewards(): void {
    if (this.rewardsCollected) return
    this.rewardsCollected = true

    // Add gold
    currencyManager.add('gold', this.goldEarned)

    // Add chests
    chestManager.addChests(this.chestRewards)

    console.log(
      `GameOverScene: Rewards collected - Gold: ${this.goldEarned}, Chests: ${getTotalChests(this.chestRewards)}`
    )
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const isVictory = this.stats.isVictory

    // Dark overlay background
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.85).setOrigin(0)

    // Title text
    const titleText = isVictory ? 'RUN COMPLETE!' : 'GAME OVER'
    const titleColor = isVictory ? '#00ff88' : '#ff4444'

    this.add
      .text(width / 2, 60, titleText, {
        fontSize: '36px',
        fontFamily: 'Arial',
        color: titleColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Stats section
    const statsStartY = 120
    const lineHeight = 32

    // Rooms cleared
    this.add
      .text(width / 2, statsStartY, `Rooms: ${this.stats.roomsCleared}/10`, {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // Enemies killed
    this.add
      .text(width / 2, statsStartY + lineHeight, `Enemies: ${this.stats.enemiesKilled}`, {
        fontSize: '20px',
        fontFamily: 'Arial',
        color: '#ffffff',
      })
      .setOrigin(0.5)

    // Gold earned (highlighted)
    this.add
      .text(width / 2, statsStartY + lineHeight * 2, `Gold: +${this.goldEarned}`, {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#FFD700', // Gold color
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Chest rewards section
    const chestsY = statsStartY + lineHeight * 3.5

    this.add
      .text(width / 2, chestsY, 'REWARDS', {
        fontSize: '18px',
        fontFamily: 'Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)

    // Display chest rewards
    const totalChests = getTotalChests(this.chestRewards)
    if (totalChests > 0) {
      this.displayChestRewards(chestsY + 35)
    } else {
      this.add
        .text(width / 2, chestsY + 35, 'No chests earned', {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: '#888888',
        })
        .setOrigin(0.5)
    }

    // Continue button
    const buttonY = height - 100
    this.createContinueButton(buttonY, isVictory ?? false)

    // Allow keyboard shortcuts
    this.input.keyboard?.once('keydown-SPACE', () => {
      this.continueGame()
    })

    this.input.keyboard?.once('keydown-ENTER', () => {
      this.continueGame()
    })

    // Add victory particles if won
    if (isVictory) {
      this.addVictoryEffect()
    }

    console.log(
      `GameOverScene: Created - Gold: ${this.goldEarned}, Chests: ${JSON.stringify(this.chestRewards)}`
    )
  }

  /**
   * Display chest rewards with icons and counts
   */
  private displayChestRewards(startY: number): void {
    const width = this.cameras.main.width

    // Calculate which chests to display
    const chestsToDisplay: { type: ChestType; count: number }[] = []

    for (const type of CHEST_ORDER) {
      const count = this.chestRewards[type]
      if (count > 0) {
        chestsToDisplay.push({ type, count })
      }
    }

    if (chestsToDisplay.length === 0) return

    // Calculate total width for centering
    const chestDisplayWidth = 70 // Width per chest display
    const totalWidth = chestsToDisplay.length * chestDisplayWidth
    const startX = (width - totalWidth) / 2 + chestDisplayWidth / 2

    chestsToDisplay.forEach((chest, index) => {
      const x = startX + index * chestDisplayWidth
      const config = CHEST_CONFIGS[chest.type]

      // Chest icon (using emoji as fallback)
      this.add
        .text(x, startY, config.icon, {
          fontSize: '32px',
        })
        .setOrigin(0.5)

      // Count
      this.add
        .text(x, startY + 35, `x${chest.count}`, {
          fontSize: '18px',
          fontFamily: 'Arial',
          color: config.color,
          fontStyle: 'bold',
        })
        .setOrigin(0.5)

      // Chest name (small)
      this.add
        .text(x, startY + 55, chest.type.charAt(0).toUpperCase() + chest.type.slice(1), {
          fontSize: '12px',
          fontFamily: 'Arial',
          color: '#888888',
        })
        .setOrigin(0.5)
    })
  }

  /**
   * Create the continue button
   */
  private createContinueButton(y: number, isVictory: boolean): void {
    const width = this.cameras.main.width
    const buttonWidth = 200
    const buttonHeight = 50
    const buttonText = 'CONTINUE'
    const buttonColor = isVictory ? 0x00ff88 : 0x4a9eff

    const button = this.add
      .rectangle(width / 2, y, buttonWidth, buttonHeight, buttonColor, 1)
      .setInteractive({ useHandCursor: true })

    this.add
      .text(width / 2, y, buttonText, {
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
      this.continueGame()
    })
  }

  private addVictoryEffect() {
    // Simple star burst effect
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    for (let i = 0; i < 20; i++) {
      const star = this.add.text(
        Phaser.Math.Between(20, width - 20),
        Phaser.Math.Between(50, height - 100),
        '\u2605', // Star character
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

  /**
   * Collect rewards and return to main menu or restart
   */
  private continueGame() {
    // Collect rewards first
    this.collectRewards()

    // Play game start sound
    audioManager.playGameStart()

    // GameScene already stopped itself before launching GameOverScene
    // UIScene was also stopped by GameScene
    // Just start fresh game scenes
    this.scene.start('GameScene')
    this.scene.launch('UIScene')

    // Stop this scene last - following CLAUDE.md guidance
    this.scene.stop('GameOverScene')
  }
}
