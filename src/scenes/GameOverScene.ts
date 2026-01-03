import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'
import { achievementManager } from '../systems/AchievementManager'
import { currencyManager } from '../systems/CurrencyManager'
import { chestManager } from '../systems/ChestManager'
import { chapterManager, type ChapterCompletionResult } from '../systems/ChapterManager'
import { heroManager } from '../systems/HeroManager'
import type { HeroLevelUpEvent } from '../systems/Hero'
import { debugToast } from '../systems/DebugToast'
import { ABILITIES } from './LevelUpScene'
import { errorReporting } from '../systems/ErrorReportingManager'
import {
  calculateChestRewards,
  getTotalChests,
  ChestRewards,
  CHEST_CONFIGS,
  CHEST_ORDER,
  ChestType,
} from '../data/chestData'

export interface AcquiredAbility {
  id: string
  level: number
}

export interface GameOverData {
  roomsCleared: number
  enemiesKilled: number
  isVictory?: boolean
  playTimeMs?: number
  abilitiesGained?: number
  bossDefeated?: boolean
  goldEarned?: number
  completionResult?: ChapterCompletionResult
  runSeed?: string
  acquiredAbilities?: AcquiredAbility[]
  heroXPEarned?: number
  isEndlessMode?: boolean
  endlessWave?: number
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

/**
 * Score breakdown for display
 */
interface ScoreBreakdown {
  killPoints: number
  roomPoints: number
  goldPoints: number
  timeBonus: number
  victoryBonus: number
  total: number
}

/** Maximum time (5 minutes) for time bonus calculation */
const MAX_TIME_BONUS_MS = 5 * 60 * 1000

/**
 * Calculate run score from performance metrics
 */
function calculateScore(
  enemiesKilled: number,
  roomsCleared: number,
  goldEarned: number,
  playTimeMs: number,
  isVictory: boolean
): ScoreBreakdown {
  const killPoints = enemiesKilled * 10
  const roomPoints = roomsCleared * roomsCleared * 25
  const goldPoints = Math.floor(goldEarned * 0.5)
  const timeBonus = Math.max(0, Math.floor((MAX_TIME_BONUS_MS - playTimeMs) / 1000) * 2)
  const victoryBonus = isVictory ? 500 : 0

  return {
    killPoints,
    roomPoints,
    goldPoints,
    timeBonus,
    victoryBonus,
    total: killPoints + roomPoints + goldPoints + timeBonus + victoryBonus,
  }
}

export default class GameOverScene extends Phaser.Scene {
  private stats: GameOverData = { roomsCleared: 0, enemiesKilled: 0, isVictory: false }
  private goldEarned: number = 0
  private chestRewards: ChestRewards = { wooden: 0, silver: 0, golden: 0 }
  private rewardsCollected: boolean = false
  private runSeed: string = ''
  private acquiredAbilities: AcquiredAbility[] = []
  private scoreBreakdown: ScoreBreakdown | null = null
  private isNewHighScore: boolean = false
  private heroXPEarned: number = 0
  private heroLevelUps: HeroLevelUpEvent[] = []
  private isEndlessMode: boolean = false
  private endlessWave: number = 1
  private isNewEndlessHighScore: boolean = false

  constructor() {
    super({ key: 'GameOverScene' })
  }

  init(data: GameOverData) {
    this.stats = data || { roomsCleared: 0, enemiesKilled: 0, isVictory: false }
    this.rewardsCollected = false
    this.runSeed = data?.runSeed ?? ''
    this.acquiredAbilities = data?.acquiredAbilities ?? []
    this.isEndlessMode = data?.isEndlessMode ?? false
    this.endlessWave = data?.endlessWave ?? 1

    // Use passed goldEarned if available (from actual gold drops), otherwise estimate
    const bossDefeated = this.stats.bossDefeated ?? this.stats.isVictory ?? false
    this.goldEarned = this.stats.goldEarned ?? calculateGoldEarned(this.stats.enemiesKilled, bossDefeated)
    this.chestRewards = calculateChestRewards(
      this.stats.roomsCleared,
      this.stats.enemiesKilled,
      bossDefeated,
      this.stats.isVictory ?? false
    )

    // Calculate score
    this.scoreBreakdown = calculateScore(
      this.stats.enemiesKilled,
      this.stats.roomsCleared,
      this.goldEarned,
      this.stats.playTimeMs ?? 0,
      this.stats.isVictory ?? false
    )

    // Check if new high score (regular or endless)
    if (this.isEndlessMode) {
      const previousEndlessHighWave = saveManager.getStatistics().endlessHighWave ?? 0
      this.isNewEndlessHighScore = this.endlessWave > previousEndlessHighWave
      this.isNewHighScore = false // Don't track regular high score in endless mode
    } else {
      const previousHighScore = saveManager.getStatistics().highestScore
      this.isNewHighScore = this.scoreBreakdown.total > previousHighScore
      this.isNewEndlessHighScore = false
    }

    // Record run statistics to save data
    this.recordRunStats()

    // Process hero XP
    this.heroXPEarned = data?.heroXPEarned ?? 0
    this.heroLevelUps = []
    if (this.heroXPEarned > 0) {
      const selectedHeroId = heroManager.getSelectedHeroId()
      this.heroLevelUps = heroManager.addXP(selectedHeroId, this.heroXPEarned)
    }
  }

  /**
   * Record this run's statistics to persistent save data
   */
  private recordRunStats(): void {
    const selectedChapter = chapterManager.getSelectedChapter()
    const isVictory = this.stats.isVictory === true
    const stars = this.stats.completionResult?.stars ?? 0

    saveManager.recordRun({
      kills: this.stats.enemiesKilled,
      roomsCleared: this.stats.roomsCleared,
      playTimeMs: this.stats.playTimeMs ?? 0,
      bossDefeated: isVictory,
      abilitiesGained: this.stats.abilitiesGained ?? 0,
      victory: isVictory,
      score: this.scoreBreakdown?.total ?? 0,
      isEndlessMode: this.isEndlessMode,
      endlessWave: this.endlessWave,
    })

    // Update chapter progress in SaveManager for persistence (only for normal mode)
    if (!this.isEndlessMode) {
      saveManager.updateChapterProgress(
        selectedChapter,
        this.stats.roomsCleared,
        isVictory,
        stars
      )
    }

    // Log updated statistics
    const totalStats = saveManager.getStatistics()
    if (this.isEndlessMode) {
      console.log(
        `GameOverScene: Endless run recorded - Wave ${this.endlessWave}, High Wave: ${totalStats.endlessHighWave ?? 0}`
      )
    } else {
      console.log(
        `GameOverScene: Run recorded - Total runs: ${totalStats.totalRuns}, Total kills: ${totalStats.totalKills}, Chapter ${selectedChapter} completed: ${isVictory}`
      )
    }

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

    // Track game end for error context
    errorReporting.setScene('GameOverScene')
    errorReporting.addBreadcrumb('game', isVictory ? 'Victory' : 'Game Over', {
      roomsCleared: this.stats.roomsCleared,
      enemiesKilled: this.stats.enemiesKilled,
    })

    // Register shutdown event
    this.events.once('shutdown', this.shutdown, this)

    // CRITICAL: Ensure this scene receives input and is on top
    this.input.enabled = true
    this.scene.bringToTop()

    // Debug: Log any pointer events to diagnose input issues (use once to avoid listener accumulation)
    this.input.once('pointerdown', (pointer: Phaser.Input.Pointer) => {
      console.log('GameOverScene: Global pointerdown at', pointer.x, pointer.y)

      // Debug toast for mobile debugging
      debugToast.logPointer('pointerdown', pointer.x, pointer.y, 'GameOverScene')

      // Visual feedback: show a small circle where user tapped (debug mode)
      if (debugToast.enabled) {
        const circle = this.add.circle(pointer.x, pointer.y, 20, 0xff0000, 0.5)
        this.tweens.add({
          targets: circle,
          alpha: 0,
          scale: 2,
          duration: 500,
          onComplete: () => circle.destroy()
        })
      }
    })

    // Dark overlay background
    this.add.rectangle(0, 0, width * 2, height * 2, 0x000000, 0.85).setOrigin(0)

    // Title text - different for endless mode
    let titleText: string
    let titleColor: string
    if (this.isEndlessMode) {
      titleText = `WAVE ${this.endlessWave}`
      titleColor = this.isNewEndlessHighScore ? '#ffdd00' : '#ff6b35'
    } else {
      titleText = isVictory ? 'RUN COMPLETE!' : 'GAME OVER'
      titleColor = isVictory ? '#00ff88' : '#ff4444'
    }

    this.add
      .text(width / 2, 60, titleText, {
        fontSize: '36px',
        fontFamily: 'Arial',
        color: titleColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Show new high wave badge for endless mode
    if (this.isEndlessMode && this.isNewEndlessHighScore) {
      this.add
        .text(width / 2, 95, 'NEW BEST!', {
          fontSize: '16px',
          fontFamily: 'Arial',
          color: '#ffdd00',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    }

    // Stats section
    const statsStartY = this.isEndlessMode && this.isNewEndlessHighScore ? 130 : 120
    const lineHeight = 32

    // Rooms cleared
    const totalRooms = chapterManager.getTotalRooms()
    if (this.isEndlessMode) {
      // Show total rooms cleared across all waves
      this.add
        .text(width / 2, statsStartY, `Rooms Cleared: ${this.stats.roomsCleared}`, {
          fontSize: '20px',
          fontFamily: 'Arial',
          color: '#ffffff',
        })
        .setOrigin(0.5)
    } else {
      this.add
        .text(width / 2, statsStartY, `Rooms: ${this.stats.roomsCleared}/${totalRooms}`, {
          fontSize: '20px',
          fontFamily: 'Arial',
          color: '#ffffff',
        })
        .setOrigin(0.5)
    }

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

    // Hero XP earned
    let heroXPOffset = 0
    if (this.heroXPEarned > 0) {
      this.add
        .text(width / 2, statsStartY + lineHeight * 2.8, `Hero XP: +${this.heroXPEarned}`, {
          fontSize: '18px',
          fontFamily: 'Arial',
          color: '#88ccff',
        })
        .setOrigin(0.5)
      heroXPOffset = lineHeight * 0.8

      // Hero level-up notification
      if (this.heroLevelUps.length > 0) {
        const lastLevelUp = this.heroLevelUps[this.heroLevelUps.length - 1]
        const heroState = heroManager.getHeroState(lastLevelUp.heroId)

        this.add
          .text(
            width / 2,
            statsStartY + lineHeight * 3.4,
            `${heroState.name} reached Level ${lastLevelUp.newLevel}!`,
            {
              fontSize: '20px',
              fontFamily: 'Arial',
              color: '#00ff88',
              fontStyle: 'bold',
            }
          )
          .setOrigin(0.5)
        heroXPOffset += lineHeight * 0.8

        // Show new perks if any
        if (lastLevelUp.newPerks.length > 0) {
          const perkNames = lastLevelUp.newPerks.map((p) => p.name).join(', ')
          this.add
            .text(width / 2, statsStartY + lineHeight * 4, `New Perk: ${perkNames}`, {
              fontSize: '14px',
              fontFamily: 'Arial',
              color: '#ffdd00',
            })
            .setOrigin(0.5)
          heroXPOffset += lineHeight * 0.6
        }
      }
    }

    // Score display (adjusted for hero XP section)
    this.displayScore(statsStartY + lineHeight * 3 + heroXPOffset)

    // Chest rewards section (adjusted for hero XP section)
    const chestsY = statsStartY + lineHeight * 5.5 + heroXPOffset

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

    // Skills acquired section
    const skillsY = chestsY + 110
    const skillsSectionHeight = this.displayAcquiredSkills(skillsY)

    // Seed display section
    if (this.runSeed) {
      this.createSeedDisplay(skillsY + skillsSectionHeight + 10)
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

    // Log scene input state for debugging
    if (debugToast.enabled) {
      debugToast.show(`Scene: ${this.scene.key}`)
      debugToast.show(`Input enabled: ${this.input.enabled}`)
      debugToast.show(`isActive: ${this.scene.isActive()}`)

      // List all running scenes
      const activeScenes = this.scene.manager.getScenes(true).map(s => s.scene.key)
      debugToast.show(`Active scenes: ${activeScenes.join(', ')}`)
    }
  }

  /**
   * Display score with breakdown
   */
  private displayScore(startY: number): void {
    const width = this.cameras.main.width
    if (!this.scoreBreakdown) return

    // Main score
    const scoreText = this.isNewHighScore
      ? `SCORE: ${this.scoreBreakdown.total.toLocaleString()} - NEW BEST!`
      : `SCORE: ${this.scoreBreakdown.total.toLocaleString()}`

    const scoreColor = this.isNewHighScore ? '#00ff88' : '#ffffff'

    this.add
      .text(width / 2, startY, scoreText, {
        fontSize: this.isNewHighScore ? '26px' : '22px',
        fontFamily: 'Arial',
        color: scoreColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Score breakdown (smaller text)
    const breakdown = [
      `Kills: +${this.scoreBreakdown.killPoints}`,
      `Rooms: +${this.scoreBreakdown.roomPoints}`,
      `Gold: +${this.scoreBreakdown.goldPoints}`,
    ]
    if (this.scoreBreakdown.timeBonus > 0) {
      breakdown.push(`Speed: +${this.scoreBreakdown.timeBonus}`)
    }
    if (this.scoreBreakdown.victoryBonus > 0) {
      breakdown.push(`Victory: +${this.scoreBreakdown.victoryBonus}`)
    }

    this.add
      .text(width / 2, startY + 24, breakdown.join(' | '), {
        fontSize: '11px',
        fontFamily: 'Arial',
        color: '#888888',
      })
      .setOrigin(0.5)

    // Personal best (if not new high score)
    if (!this.isNewHighScore && saveManager.getStatistics().highestScore > 0) {
      this.add
        .text(
          width / 2,
          startY + 42,
          `Best: ${saveManager.getStatistics().highestScore.toLocaleString()}`,
          {
            fontSize: '13px',
            fontFamily: 'Arial',
            color: '#666666',
          }
        )
        .setOrigin(0.5)
    }
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

      // Chest icon (fixed display size for consistent UI)
      this.add
        .image(x, startY, config.icon)
        .setOrigin(0.5)
        .setDisplaySize(48, 48)

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
   * Display acquired skills with icons and levels
   * Returns the total height used by this section
   */
  private displayAcquiredSkills(startY: number): number {
    const width = this.cameras.main.width

    // If no skills acquired, show message and return minimal height
    if (this.acquiredAbilities.length === 0) {
      this.add
        .text(width / 2, startY, 'No skills acquired', {
          fontSize: '14px',
          fontFamily: 'Arial',
          color: '#666666',
        })
        .setOrigin(0.5)
      return 30
    }

    // Section title
    this.add
      .text(width / 2, startY, 'SKILLS', {
        fontSize: '16px',
        fontFamily: 'Arial',
        color: '#aaaaaa',
      })
      .setOrigin(0.5)

    // Display skills in a grid (up to 6 per row)
    const iconSize = 36
    const iconSpacing = 44
    const maxPerRow = 6
    const skillCount = this.acquiredAbilities.length
    const rows = Math.ceil(skillCount / maxPerRow)

    // Calculate grid dimensions
    const gridStartY = startY + 28

    this.acquiredAbilities.forEach((acquired, index) => {
      // Find the ability data
      const abilityData = ABILITIES.find(a => a.id === acquired.id)
      if (!abilityData) return

      const row = Math.floor(index / maxPerRow)
      const col = index % maxPerRow

      // Recalculate X for rows with fewer items (center them)
      const itemsInRow = Math.min(maxPerRow, skillCount - row * maxPerRow)
      const rowWidth = itemsInRow * iconSpacing
      const rowStartX = (width - rowWidth) / 2 + iconSpacing / 2

      const x = rowStartX + col * iconSpacing
      const y = gridStartY + row * (iconSpacing + 8)

      // Skill icon background (colored border)
      const iconBg = this.add.rectangle(x, y, iconSize + 4, iconSize + 4, 0x222222)
      iconBg.setStrokeStyle(2, abilityData.color)

      // Skill icon
      if (this.textures.exists(abilityData.iconKey)) {
        this.add
          .image(x, y, abilityData.iconKey)
          .setDisplaySize(iconSize, iconSize)
      } else {
        // Fallback: colored circle
        this.add.circle(x, y, iconSize / 2 - 2, abilityData.color)
      }

      // Level badge (bottom-right corner)
      if (acquired.level > 1) {
        const badgeX = x + iconSize / 2 - 2
        const badgeY = y + iconSize / 2 - 2

        // Badge background
        this.add.circle(badgeX, badgeY, 10, 0x000000, 0.9)

        // Level number
        this.add
          .text(badgeX, badgeY, `${acquired.level}`, {
            fontSize: '12px',
            fontFamily: 'Arial',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
      }
    })

    // Return total height used (title + rows)
    return 28 + rows * (iconSpacing + 8)
  }

  /**
   * Display run seed with copy button
   */
  private createSeedDisplay(y: number): void {
    const width = this.cameras.main.width

    // Seed label
    this.add
      .text(width / 2, y, 'SEED', {
        fontSize: '12px',
        fontFamily: 'Arial',
        color: '#888888',
      })
      .setOrigin(0.5)

    // Seed value with tap-to-copy functionality
    const seedContainer = this.add.container(width / 2, y + 22)

    // Background for seed
    const bgWidth = 140
    const bgHeight = 32
    const seedBg = this.add.rectangle(0, 0, bgWidth, bgHeight, 0x333333, 1)
    seedBg.setStrokeStyle(1, 0x666666)

    // Seed text
    const seedText = this.add.text(0, 0, this.runSeed, {
      fontSize: '16px',
      fontFamily: 'monospace',
      color: '#00ddff',
      fontStyle: 'bold',
    })
    seedText.setOrigin(0.5)

    // Copy icon (small)
    const copyIcon = this.add.text(bgWidth / 2 - 15, 0, '\ud83d\udccb', {
      fontSize: '14px',
    })
    copyIcon.setOrigin(0.5)

    seedContainer.add([seedBg, seedText, copyIcon])

    // Make container interactive for copy
    seedContainer.setSize(bgWidth, bgHeight)
    seedContainer.setInteractive(
      new Phaser.Geom.Rectangle(-bgWidth / 2, -bgHeight / 2, bgWidth, bgHeight),
      Phaser.Geom.Rectangle.Contains
    )

    // Hover effects
    seedContainer.on('pointerover', () => {
      seedBg.setFillStyle(0x444444)
    })

    seedContainer.on('pointerout', () => {
      seedBg.setFillStyle(0x333333)
    })

    // Copy to clipboard on click
    seedContainer.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      debugToast.logPointer('Seed pointerdown', pointer.x, pointer.y, 'seed copy')
      this.copySeedToClipboard()
      // Flash feedback
      seedBg.setFillStyle(0x00ff88)
      this.time.delayedCall(200, () => {
        seedBg.setFillStyle(0x333333)
      })
    })

    // "Tap to copy" hint
    this.add
      .text(width / 2, y + 48, 'Tap to copy', {
        fontSize: '10px',
        fontFamily: 'Arial',
        color: '#666666',
      })
      .setOrigin(0.5)
  }

  /**
   * Copy seed to clipboard
   */
  private copySeedToClipboard(): void {
    if (!this.runSeed) return

    // Try to use the Clipboard API
    if (window.navigator?.clipboard?.writeText) {
      window.navigator.clipboard.writeText(this.runSeed).then(
        () => {
          console.log('Seed copied to clipboard:', this.runSeed)
        },
        (_err) => {
          // Clipboard API can fail on iOS Safari due to permission restrictions
          // This is expected behavior - silently fall back to execCommand
          this.fallbackCopyToClipboard()
        }
      )
    } else {
      this.fallbackCopyToClipboard()
    }
  }

  /**
   * Fallback copy method for older browsers
   */
  private fallbackCopyToClipboard(): void {
    const textArea = document.createElement('textarea')
    textArea.value = this.runSeed
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand('copy')
      console.log('Seed copied to clipboard (fallback):', this.runSeed)
    } catch {
      // Copy failed - user will need to manually copy the seed
      // This is not critical functionality, so we don't log an error
    }
    document.body.removeChild(textArea)
  }

  /**
   * Create the continue button
   */
  private createContinueButton(y: number, isVictory: boolean): void {
    const width = this.cameras.main.width
    const buttonWidth = 200
    const buttonHeight = 50
    const buttonText = 'MAIN MENU'
    const buttonColor = isVictory ? 0x00ff88 : 0x4a9eff

    const button = this.add
      .rectangle(width / 2, y, buttonWidth, buttonHeight, buttonColor, 1)
      .setInteractive({ useHandCursor: true })
      .setDepth(100) // Ensure button is above everything

    this.add
      .text(width / 2, y, buttonText, {
        fontSize: '24px',
        fontFamily: 'Arial',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(101) // Text above button

    // Button hover effects
    const hoverColor = isVictory ? 0x33ffaa : 0x6ab0ff
    const pressColor = isVictory ? 0x00cc66 : 0x3a8edf

    button.on('pointerover', () => {
      debugToast.show('Button: pointerover')
      button.setFillStyle(hoverColor)
    })

    button.on('pointerout', () => {
      debugToast.show('Button: pointerout')
      button.setFillStyle(buttonColor)
    })

    // Use pointerdown for immediate response on touch devices
    button.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      console.log('GameOverScene: Button clicked - navigating to MainMenuScene')
      debugToast.logPointer('Button pointerdown', pointer.x, pointer.y, 'MAIN MENU btn')
      button.setFillStyle(pressColor)
      this.continueGame()
    })

    // Log all interactive objects in scene for debugging
    if (debugToast.enabled) {
      debugToast.logInteractive('MAIN MENU btn', button.x, button.y, buttonWidth, buttonHeight)

      // Add pointerup and pointermove for more debugging
      button.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        debugToast.logPointer('Button pointerup', pointer.x, pointer.y)
      })
    }

    // Debug: Log if button is interactive
    console.log('GameOverScene: Continue button created', {
      interactive: button.input?.enabled,
      position: { x: button.x, y: button.y },
      size: { width: buttonWidth, height: buttonHeight }
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
   * Collect rewards and return to main menu
   */
  private continueGame() {
    console.log('GameOverScene: continueGame() called')
    
    // Prevent multiple calls
    if (this.rewardsCollected) {
      console.log('GameOverScene: Already continuing, ignoring duplicate call')
      return
    }
    
    // Collect rewards first
    this.collectRewards()

    // Play menu select sound
    audioManager.playMenuSelect()

    // Stop all tweens to prevent rendering updates during shutdown
    this.tweens.killAll()

    console.log('GameOverScene: Returning to main menu...')
    
    // GameScene already stopped itself before launching GameOverScene
    // UIScene was also stopped by GameScene
    // Return to main menu
    // start() will shut down the current scene (GameOverScene) correctly
    this.scene.start('MainMenuScene')
  }

  /**
   * Clean up scene resources
   */
  shutdown() {
    // CRITICAL: Remove all input listeners to prevent accumulation
    this.input.removeAllListeners()

    // Kill all tweens
    this.tweens.killAll()
  }
}
