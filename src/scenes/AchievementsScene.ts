import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { achievementManager, AchievementProgress } from '../systems/AchievementManager'
import { currencyManager } from '../systems/CurrencyManager'
import {
  Achievement,
  ACHIEVEMENTS,
  getTierName,
  getTierColor,
} from '../config/achievementData'

/**
 * AchievementsScene - UI for viewing achievements and claiming rewards
 *
 * Features:
 * - List of all achievements with progress bars
 * - Tier indicators (bronze/silver/gold/platinum)
 * - Claim buttons for unclaimed rewards
 * - Total earned display
 */
export default class AchievementsScene extends Phaser.Scene {
  // UI Elements
  private goldText?: Phaser.GameObjects.Text
  private gemsText?: Phaser.GameObjects.Text
  private totalEarnedText?: Phaser.GameObjects.Text
  private achievementCards: Map<string, Phaser.GameObjects.Container> = new Map()

  // Scroll container for achievement list
  private scrollContainer?: Phaser.GameObjects.Container
  private scrollMask?: Phaser.GameObjects.Graphics
  private scrollBounds = { top: 90, bottom: 590, contentHeight: 0 }
  private scrollY = 0
  private isDragging = false
  private dragStartY = 0
  private scrollStartY = 0

  constructor() {
    super({ key: 'AchievementsScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Background (lowest depth)
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e).setDepth(0)

    // Header (high depth to stay above scroll content)
    this.createHeader(width)

    // Achievement list
    this.createAchievementList(width, height)

    // Total earned display at bottom
    this.createTotalEarnedDisplay(width, height)

    // Back button
    this.createBackButton(width, height)

    // Check achievements on entry
    achievementManager.checkAchievements()
  }

  private createHeader(width: number) {
    // Header background to cover scroll content
    this.add.rectangle(width / 2, 45, width, 90, 0x1a1a2e).setDepth(10)

    // Title
    this.add
      .text(width / 2, 30, 'ACHIEVEMENTS', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11)

    // Currency display
    this.goldText = this.add
      .text(15, 60, `Gold: ${currencyManager.get('gold')}`, {
        fontSize: '14px',
        color: '#FFD700',
      })
      .setOrigin(0, 0.5)
      .setDepth(11)

    this.gemsText = this.add
      .text(width - 15, 60, `Gems: ${currencyManager.get('gems')}`, {
        fontSize: '14px',
        color: '#00FFFF',
      })
      .setOrigin(1, 0.5)
      .setDepth(11)

    // Claim All button (if rewards available)
    const unclaimed = achievementManager.getUnclaimedRewardsCount()
    if (unclaimed > 0) {
      const claimAllBtn = this.add
        .text(width / 2, 60, `CLAIM ALL (${unclaimed})`, {
          fontSize: '12px',
          color: '#ffffff',
          backgroundColor: '#44aa44',
          padding: { x: 10, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(11)
        .setInteractive({ useHandCursor: true })

      claimAllBtn.on('pointerover', () => {
        claimAllBtn.setStyle({ backgroundColor: '#55bb55' })
      })

      claimAllBtn.on('pointerout', () => {
        claimAllBtn.setStyle({ backgroundColor: '#44aa44' })
      })

      claimAllBtn.on('pointerdown', () => {
        this.claimAllRewards()
        claimAllBtn.destroy()
      })
    }
  }

  private createAchievementList(width: number, _height: number) {
    const cardHeight = 90
    const cardSpacing = 100
    const cardWidth = width - 30
    const cardX = width / 2

    // Create the scroll container (depth 1 to be above background, below header/footer)
    this.scrollContainer = this.add.container(0, 0)
    this.scrollContainer.setDepth(1)

    // Create mask for the scrollable area
    const scrollAreaHeight = this.scrollBounds.bottom - this.scrollBounds.top
    this.scrollMask = this.add.graphics()
    this.scrollMask.fillStyle(0xffffff)
    this.scrollMask.fillRect(0, this.scrollBounds.top, width, scrollAreaHeight)
    this.scrollMask.setVisible(false)

    // Apply mask to scroll container
    const mask = this.scrollMask.createGeometryMask()
    this.scrollContainer.setMask(mask)

    // Create achievement cards
    let currentY = this.scrollBounds.top + 10

    ACHIEVEMENTS.forEach((achievement) => {
      const progress = achievementManager.getProgress(achievement.id)
      if (!progress) return

      const card = this.createAchievementCard(
        cardX,
        currentY + cardHeight / 2,
        cardWidth,
        cardHeight,
        achievement,
        progress
      )
      this.scrollContainer!.add(card)
      this.achievementCards.set(achievement.id, card)
      currentY += cardSpacing
    })

    // Calculate total content height
    this.scrollBounds.contentHeight = currentY - this.scrollBounds.top + 10

    // Setup scroll input
    this.setupScrollInput(width)
  }

  private setupScrollInput(width: number) {
    const scrollAreaHeight = this.scrollBounds.bottom - this.scrollBounds.top

    // Create an invisible interactive zone for the scroll area
    const scrollZone = this.add.zone(
      width / 2,
      this.scrollBounds.top + scrollAreaHeight / 2,
      width,
      scrollAreaHeight
    )
    scrollZone.setInteractive()

    // Mouse wheel scrolling
    this.input.on(
      'wheel',
      (
        _pointer: Phaser.Input.Pointer,
        _gameObjects: Phaser.GameObjects.GameObject[],
        _deltaX: number,
        deltaY: number
      ) => {
        this.scrollContent(deltaY * 0.5)
      }
    )

    // Touch/mouse drag scrolling
    scrollZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true
      this.dragStartY = pointer.y
      this.scrollStartY = this.scrollY
    })

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const deltaY = this.dragStartY - pointer.y
        this.setScrollPosition(this.scrollStartY + deltaY)
      }
    })

    this.input.on('pointerup', () => {
      this.isDragging = false
    })

    this.input.on('pointerupoutside', () => {
      this.isDragging = false
    })
  }

  private scrollContent(deltaY: number) {
    this.setScrollPosition(this.scrollY + deltaY)
  }

  private setScrollPosition(newY: number) {
    const scrollAreaHeight = this.scrollBounds.bottom - this.scrollBounds.top
    const maxScroll = Math.max(0, this.scrollBounds.contentHeight - scrollAreaHeight)

    // Clamp scroll position
    this.scrollY = Phaser.Math.Clamp(newY, 0, maxScroll)

    // Apply scroll position to container
    if (this.scrollContainer) {
      this.scrollContainer.y = -this.scrollY
    }
  }

  private createAchievementCard(
    x: number,
    y: number,
    width: number,
    height: number,
    achievement: Achievement,
    progress: AchievementProgress
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0x2a2a3e)
    bg.setStrokeStyle(1, 0x3a3a4e)
    container.add(bg)

    // Achievement name
    const nameText = this.add
      .text(-width / 2 + 10, -height / 2 + 12, achievement.name, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)
    container.add(nameText)

    // Description
    const descText = this.add
      .text(-width / 2 + 10, -height / 2 + 30, achievement.description, {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)
    container.add(descText)

    // Tier indicators
    const tierY = -height / 2 + 52
    const tierSpacing = 65
    const tierStartX = -width / 2 + 35

    for (let i = 0; i < achievement.tiers.length; i++) {
      const tier = achievement.tiers[i]
      const tierX = tierStartX + i * tierSpacing
      const tierName = getTierName(i)
      const tierColor = getTierColor(i)
      const tierColorNum = parseInt(tierColor.replace('#', ''), 16)

      const isCompleted = progress.currentValue >= tier.requirement
      const isClaimed = i <= progress.highestClaimedTier
      const isClaimable = isCompleted && !isClaimed

      // Tier circle background
      const circleRadius = 12
      const circle = this.add.circle(tierX, tierY, circleRadius, isCompleted ? tierColorNum : 0x444444)
      circle.setStrokeStyle(2, tierColorNum)
      container.add(circle)

      // Tier icon/check mark
      if (isClaimed) {
        // Show checkmark for claimed
        const checkmark = this.add
          .text(tierX, tierY, '✓', {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
        container.add(checkmark)
      } else if (isCompleted) {
        // Show "!" for claimable
        const exclaim = this.add
          .text(tierX, tierY, '!', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
        container.add(exclaim)
      } else {
        // Show tier number for incomplete
        const tierNum = this.add
          .text(tierX, tierY, `${i + 1}`, {
            fontSize: '12px',
            color: '#888888',
          })
          .setOrigin(0.5)
        container.add(tierNum)
      }

      // Tier name label
      const tierLabel = this.add
        .text(tierX, tierY + 20, tierName.slice(0, 3), {
          fontSize: '8px',
          color: isCompleted ? tierColor : '#555555',
        })
        .setOrigin(0.5)
      container.add(tierLabel)

      // Requirement text
      const reqText = this.add
        .text(tierX, tierY + 32, `${tier.requirement}`, {
          fontSize: '9px',
          color: isCompleted ? '#ffffff' : '#666666',
        })
        .setOrigin(0.5)
      container.add(reqText)

      // Make claimable tiers interactive
      if (isClaimable) {
        circle.setInteractive({ useHandCursor: true })

        circle.on('pointerover', () => {
          circle.setScale(1.15)
        })

        circle.on('pointerout', () => {
          circle.setScale(1)
        })

        circle.on('pointerdown', () => {
          this.claimReward(achievement.id, i, tier.reward)
        })

        // Pulse animation for claimable
        this.tweens.add({
          targets: circle,
          alpha: 0.7,
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        })
      }
    }

    // Progress bar
    const progressBarY = height / 2 - 15
    const progressBarWidth = width - 20
    const progressBarHeight = 8

    // Background bar
    const progressBg = this.add.rectangle(
      0,
      progressBarY,
      progressBarWidth,
      progressBarHeight,
      0x333333
    )
    container.add(progressBg)

    // Get next target for progress calculation
    let nextTarget = achievement.tiers[achievement.tiers.length - 1].requirement
    let prevTarget = 0
    for (let i = 0; i < achievement.tiers.length; i++) {
      if (progress.currentValue < achievement.tiers[i].requirement) {
        nextTarget = achievement.tiers[i].requirement
        prevTarget = i > 0 ? achievement.tiers[i - 1].requirement : 0
        break
      }
    }

    // Calculate progress percentage for current tier
    const tierProgress = Math.min(
      1,
      (progress.currentValue - prevTarget) / Math.max(1, nextTarget - prevTarget)
    )
    const fillWidth = progressBarWidth * tierProgress

    // Progress fill
    const progressFill = this.add.rectangle(
      -progressBarWidth / 2 + fillWidth / 2,
      progressBarY,
      fillWidth,
      progressBarHeight,
      0x44aa44
    )
    container.add(progressFill)

    // Progress text
    const progressText = this.add
      .text(width / 2 - 10, progressBarY, `${progress.currentValue}/${nextTarget}`, {
        fontSize: '9px',
        color: '#ffffff',
      })
      .setOrigin(1, 0.5)
    container.add(progressText)

    return container
  }

  private claimReward(
    achievementId: string,
    tierIndex: number,
    _reward: { gold?: number; gems?: number }
  ) {
    const success = achievementManager.claimReward(achievementId, tierIndex)
    if (success) {
      audioManager.playLevelUp()
      this.showClaimAnimation(achievementId, tierIndex)
      this.updateUI()
    }
  }

  private claimAllRewards() {
    const rewards = achievementManager.claimAllRewards()
    if ((rewards.gold ?? 0) > 0 || (rewards.gems ?? 0) > 0) {
      audioManager.playLevelUp()
      this.showClaimAllAnimation(rewards)
      this.updateUI()
    }
  }

  private showClaimAnimation(achievementId: string, tierIndex: number) {
    const card = this.achievementCards.get(achievementId)
    if (!card) return

    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const achievement = ACHIEVEMENTS.find((a) => a.id === achievementId)
    if (!achievement) return

    const tier = achievement.tiers[tierIndex]
    const tierName = getTierName(tierIndex)
    const tierColor = getTierColor(tierIndex)

    // Create popup
    const popup = this.add.container(width / 2, height / 2)
    popup.setDepth(100)

    const bg = this.add.rectangle(0, 0, 200, 80, 0x1a1a2e)
    bg.setStrokeStyle(2, parseInt(tierColor.replace('#', ''), 16))

    const tierText = this.add
      .text(0, -25, `${tierName} Unlocked!`, {
        fontSize: '14px',
        color: tierColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    let rewardText = ''
    if (tier.reward.gold) rewardText += `+${tier.reward.gold} Gold`
    if (tier.reward.gems) {
      if (rewardText) rewardText += ' '
      rewardText += `+${tier.reward.gems} Gems`
    }

    const rewardLabel = this.add
      .text(0, 5, rewardText, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    popup.add([bg, tierText, rewardLabel])

    // Animate popup
    popup.setScale(0.5)
    popup.setAlpha(0)

    this.tweens.add({
      targets: popup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: popup,
        alpha: 0,
        y: popup.y - 30,
        duration: 300,
        onComplete: () => popup.destroy(),
      })
    })
  }

  private showClaimAllAnimation(rewards: { gold?: number; gems?: number }) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    const popup = this.add.container(width / 2, height / 2)
    popup.setDepth(100)

    const bg = this.add.rectangle(0, 0, 220, 100, 0x1a1a2e)
    bg.setStrokeStyle(2, 0x44aa44)

    const titleText = this.add
      .text(0, -30, 'Rewards Claimed!', {
        fontSize: '16px',
        color: '#44aa44',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    let rewardLines: string[] = []
    if (rewards.gold && rewards.gold > 0) rewardLines.push(`+${rewards.gold} Gold`)
    if (rewards.gems && rewards.gems > 0) rewardLines.push(`+${rewards.gems} Gems`)

    const rewardLabel = this.add
      .text(0, 10, rewardLines.join('\n'), {
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)

    popup.add([bg, titleText, rewardLabel])

    popup.setScale(0.5)
    popup.setAlpha(0)

    this.tweens.add({
      targets: popup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: popup,
        alpha: 0,
        y: popup.y - 30,
        duration: 300,
        onComplete: () => popup.destroy(),
      })
    })
  }

  private createTotalEarnedDisplay(width: number, height: number) {
    const displayY = height - 70

    // Background (high depth to cover scroll content)
    this.add.rectangle(width / 2, displayY, width - 20, 40, 0x2a2a3e, 0.8).setDepth(10)

    // Label
    this.add
      .text(15, displayY - 10, 'Total Earned:', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)
      .setDepth(11)

    // Values
    const goldEarned = achievementManager.getTotalGoldEarned()
    const gemsEarned = achievementManager.getTotalGemsEarned()

    this.totalEarnedText = this.add
      .text(width / 2, displayY + 8, `${goldEarned} Gold  |  ${gemsEarned} Gems`, {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(11)
  }

  private createBackButton(width: number, height: number) {
    // Footer background to cover scroll content
    this.add.rectangle(width / 2, height - 25, width, 50, 0x1a1a2e).setDepth(10)

    const backButton = this.add
      .text(width / 2, height - 25, '< BACK', {
        fontSize: '16px',
        color: '#ffffff',
        backgroundColor: '#444444',
        padding: { x: 20, y: 8 },
      })
      .setOrigin(0.5)
      .setDepth(11)
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

  private updateUI() {
    // Update currency display
    if (this.goldText) {
      this.goldText.setText(`Gold: ${currencyManager.get('gold')}`)
    }
    if (this.gemsText) {
      this.gemsText.setText(`Gems: ${currencyManager.get('gems')}`)
    }

    // Update total earned
    if (this.totalEarnedText) {
      const goldEarned = achievementManager.getTotalGoldEarned()
      const gemsEarned = achievementManager.getTotalGemsEarned()
      this.totalEarnedText.setText(`${goldEarned} Gold  |  ${gemsEarned} Gems`)
    }

    // Recreate the scene to update achievement cards
    // This is simpler than updating each card individually
    this.scene.restart()
  }
}
