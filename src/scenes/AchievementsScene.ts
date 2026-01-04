import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { achievementManager, AchievementProgress } from '../systems/AchievementManager'
import {
  Achievement,
  ACHIEVEMENTS,
  getTierName,
  getTierColor,
} from '../config/achievementData'
import { ScrollContainer } from '../ui/components/ScrollContainer'
import { createBackButton, createBackButtonFooter } from '../ui/components/BackButton'
import { createSceneHeader } from '../ui/components/SceneHeader'

/**
 * AchievementsScene - UI for viewing achievements and claiming rewards
 *
 * Features:
 * - List of all achievements with progress bars
 * - Tier indicators (bronze/silver/gold/platinum)
 * - Claim buttons for unclaimed rewards
 * - Total earned display
 *
 * Refactored to use reusable UI components from src/ui/components
 */
export default class AchievementsScene extends Phaser.Scene {
  // UI Elements
  private totalEarnedText?: Phaser.GameObjects.Text
  private achievementCards: Map<string, Phaser.GameObjects.Container> = new Map()

  // Scroll container (using reusable component)
  private scrollContainer?: ScrollContainer
  private scrollBounds = { top: 90, bottom: 590 }

  // Track interactive tier circles for visibility-based interactivity
  private interactiveTierCircles: Array<{
    circle: Phaser.GameObjects.Arc
    container: Phaser.GameObjects.Container
  }> = []

  // Header reference for currency updates
  private headerRef?: { updateCurrency: () => void }

  constructor() {
    super({ key: 'AchievementsScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Clear interactive circles from previous scene runs
    this.interactiveTierCircles = []

    // Background (lowest depth)
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e).setDepth(0)

    // Header using reusable component
    this.createHeader(width)

    // Achievement list
    this.createAchievementList(width, height)

    // Total earned display at bottom
    this.createTotalEarnedDisplay(width, height)

    // Back button using reusable component
    this.createBackButtonSection(width, height)

    // Check achievements on entry
    achievementManager.checkAchievements()
  }

  private createHeader(width: number) {
    // Header background to cover scroll content
    this.add.rectangle(width / 2, 45, width, 90, 0x1a1a2e).setDepth(10)

    // Use reusable header component
    this.headerRef = createSceneHeader({
      scene: this,
      title: 'ACHIEVEMENTS',
      showCurrency: true,
      currencyTypes: ['gold', 'gems'],
      y: 0,
      titleFontSize: '24px',
      depth: 11,
      showBackground: false,
    })

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

    // Create scroll container using reusable component
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width,
      bounds: this.scrollBounds,
      depth: 1,
      onScroll: () => this.updateTierCircleInteractivity(),
    })

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

    // Set content height for scroll calculations
    const contentHeight = currentY - this.scrollBounds.top + 10
    this.scrollContainer.setContentHeight(contentHeight)

    // Initial interactivity update for items outside visible area
    this.updateTierCircleInteractivity()
  }

  /**
   * Enable/disable input on tier circles based on whether they're visible in the masked area.
   * This prevents invisible (scrolled-out) items from capturing clicks meant for other UI elements.
   */
  private updateTierCircleInteractivity(): void {
    if (!this.scrollContainer || !this.scene || !this.sys?.isActive()) return

    const maskTop = this.scrollBounds.top
    const maskBottom = this.scrollBounds.bottom
    const container = this.scrollContainer.getContainer()

    this.interactiveTierCircles.forEach(({ circle, container: cardContainer }) => {
      // Skip if circle was destroyed
      if (!circle || !circle.scene) return

      // Calculate the container's world Y position
      const containerWorldY = container.y + cardContainer.y

      // Check if the container's CENTER is within the visible mask area
      const isVisible = containerWorldY >= maskTop && containerWorldY <= maskBottom

      // Enable or disable interactivity based on visibility
      if (isVisible) {
        if (!circle.input?.enabled) {
          circle.setInteractive({ useHandCursor: true })
        }
      } else {
        if (circle.input?.enabled) {
          circle.disableInteractive()
        }
      }
    })
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
        const checkmark = this.add
          .text(tierX, tierY, '✓', {
            fontSize: '14px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
        container.add(checkmark)
      } else if (isCompleted) {
        const exclaim = this.add
          .text(tierX, tierY, '!', {
            fontSize: '16px',
            color: '#ffffff',
            fontStyle: 'bold',
          })
          .setOrigin(0.5)
        container.add(exclaim)
      } else {
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

        // Track this circle for visibility-based interactivity updates
        this.interactiveTierCircles.push({ circle, container })
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

    const rewardLines: string[] = []
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

  private createBackButtonSection(width: number, height: number) {
    // Footer background using reusable component
    createBackButtonFooter(this, width, height, 50, 0x1a1a2e, 20)

    // Back button using reusable component
    createBackButton({
      scene: this,
      x: width / 2,
      y: height - 25,
      targetScene: 'MainMenuScene',
      depth: 20,
    })
  }

  private updateUI() {
    // Update currency display using header component
    if (this.headerRef) {
      this.headerRef.updateCurrency()
    }

    // Update total earned
    if (this.totalEarnedText) {
      const goldEarned = achievementManager.getTotalGoldEarned()
      const gemsEarned = achievementManager.getTotalGemsEarned()
      this.totalEarnedText.setText(`${goldEarned} Gold  |  ${gemsEarned} Gems`)
    }

    // Recreate the scene to update achievement cards
    this.scene.restart()
  }
}
