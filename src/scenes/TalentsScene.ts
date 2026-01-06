import Phaser from 'phaser'
import { audioManager } from '../systems/AudioManager'
import { talentManager, SpinResult } from '../systems/TalentManager'
import { currencyManager } from '../systems/CurrencyManager'
import {
  TalentId,
  TalentTier,
  Talent,
  TALENTS,
  TIER_NAMES,
} from '../config/talentData'
import { ScrollContainer } from '../ui/components/ScrollContainer'
import { createBackButton } from '../ui/components/BackButton'
import { hapticManager } from '../systems/HapticManager'

/**
 * TalentsScene - UI for the talent lottery system
 *
 * Features:
 * - Spin button to perform lottery spins
 * - Display of all talents with their current levels
 * - Total bonus display at bottom
 * - Spin animation with visual feedback
 *
 * Refactored to use reusable UI components from src/ui/components
 */
export default class TalentsScene extends Phaser.Scene {
  // UI Elements
  private spinButton?: Phaser.GameObjects.Container
  private spinCostText?: Phaser.GameObjects.Text
  private spinsRemainingText?: Phaser.GameObjects.Text
  private goldText?: Phaser.GameObjects.Text
  private talentCards: Map<TalentId, Phaser.GameObjects.Container> = new Map()
  private bonusTexts: Phaser.GameObjects.Text[] = []

  // Scroll container (using reusable component)
  private scrollContainer?: ScrollContainer
  private scrollBounds = { top: 140, bottom: 557 }

  // Animation state
  private isSpinning: boolean = false
  private lastTickIndex: number = -1

  // Tier colors from requirements
  private readonly TIER_DISPLAY_COLORS: Record<TalentTier, string> = {
    [TalentTier.COMMON]: '#888888',
    [TalentTier.RARE]: '#0066FF',
    [TalentTier.EPIC]: '#AA00FF',
  }

  constructor() {
    super({ key: 'TalentsScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e)

    // Header
    this.createHeader(width)

    // Spin section
    this.createSpinSection(width)

    // Talent grid
    this.createTalentGrid(width, height)

    // Bonus display at bottom
    this.createBonusDisplay(width, height)

    // Back button using reusable component
    createBackButton({
      scene: this,
      x: width / 2,
      y: height - 25,
      targetScene: 'MainMenuScene',
    })

    // Initial update
    this.updateUI()
  }

  private createHeader(width: number) {
    // Title
    this.add
      .text(width / 2, 30, 'TALENTS', {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Gold display (top right)
    this.goldText = this.add
      .text(width - 15, 30, `Gold: ${currencyManager.get('gold')}`, {
        fontSize: '14px',
        color: '#FFD700',
      })
      .setOrigin(1, 0.5)
  }

  private createSpinSection(width: number) {
    const spinY = 85

    // Spin button container
    this.spinButton = this.add.container(width / 2, spinY)

    // Button background
    const buttonBg = this.add.rectangle(0, 0, 160, 50, 0x4a9eff)
    buttonBg.setStrokeStyle(2, 0x6bb6ff)
    buttonBg.setInteractive({ useHandCursor: true })

    // Button text
    const buttonText = this.add
      .text(0, -5, 'SPIN', {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Cost text (below SPIN)
    this.spinCostText = this.add
      .text(0, 15, '', {
        fontSize: '12px',
        color: '#FFD700',
      })
      .setOrigin(0.5)

    this.spinButton.add([buttonBg, buttonText, this.spinCostText])

    // Hover effects
    buttonBg.on('pointerover', () => {
      if (!this.isSpinning) {
        buttonBg.setFillStyle(0x6bb6ff)
      }
    })

    buttonBg.on('pointerout', () => {
      if (!this.isSpinning) {
        buttonBg.setFillStyle(0x4a9eff)
      }
    })

    // Click handler
    buttonBg.on('pointerdown', () => {
      if (!this.isSpinning) {
        this.performSpin()
      }
    })

    // Spins remaining text
    this.spinsRemainingText = this.add
      .text(width / 2, spinY + 40, '', {
        fontSize: '12px',
        color: '#888888',
      })
      .setOrigin(0.5)
  }

  private createTalentGrid(width: number, _height: number) {
    const cardHeight = 45
    const cardSpacing = 52
    const cardWidth = width - 30
    const cardX = width / 2

    // Create scroll container using reusable component
    this.scrollContainer = new ScrollContainer({
      scene: this,
      width,
      bounds: this.scrollBounds,
    })

    // Group talents by tier for display
    const talentsByTier: Record<TalentTier, Talent[]> = {
      [TalentTier.COMMON]: [],
      [TalentTier.RARE]: [],
      [TalentTier.EPIC]: [],
    }

    Object.values(TALENTS).forEach((talent) => {
      talentsByTier[talent.tier].push(talent)
    })

    // Content starts at the top of scroll area (relative to scroll bounds)
    let currentY = this.scrollBounds.top + 10
    const tiers = [TalentTier.COMMON, TalentTier.RARE, TalentTier.EPIC]

    tiers.forEach((tier) => {
      // Tier header - add to scroll container
      const tierColor = this.TIER_DISPLAY_COLORS[tier]
      const tierHeader = this.add
        .text(15, currentY, TIER_NAMES[tier].toUpperCase(), {
          fontSize: '11px',
          color: tierColor,
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
      this.scrollContainer!.add(tierHeader)

      currentY += 18

      // Talent cards for this tier - add to scroll container
      talentsByTier[tier].forEach((talent) => {
        const card = this.createTalentCard(
          cardX,
          currentY,
          cardWidth,
          cardHeight,
          talent
        )
        this.scrollContainer!.add(card)
        this.talentCards.set(talent.id, card)
        currentY += cardSpacing
      })

      currentY += 5 // Extra spacing between tiers
    })

    // Set content height for scroll calculations
    const contentHeight = currentY - this.scrollBounds.top + 10
    this.scrollContainer.setContentHeight(contentHeight)
  }

  private createTalentCard(
    x: number,
    y: number,
    width: number,
    height: number,
    talent: Talent
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y)
    const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]
    const tierColorNum = parseInt(tierColor.replace('#', ''), 16)

    // Card background
    const bg = this.add.rectangle(0, 0, width, height, 0x2a2a3e)
    bg.setStrokeStyle(1, tierColorNum)

    // Talent name
    const nameText = this.add
      .text(-width / 2 + 10, -8, talent.name, {
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5)

    // Level display (right side)
    const level = talentManager.getTalentLevel(talent.id)
    const levelText = this.add
      .text(width / 2 - 10, -8, `Lv.${level}/${talent.maxLevel}`, {
        fontSize: '12px',
        color: level > 0 ? tierColor : '#555555',
      })
      .setOrigin(1, 0.5)
    levelText.setData('levelText', true)

    // Description
    const descText = this.add
      .text(-width / 2 + 10, 10, talent.description, {
        fontSize: '10px',
        color: '#888888',
      })
      .setOrigin(0, 0.5)

    // Current bonus value (right side, below level)
    const bonusValue = talentManager.getTalentBonus(talent.id)
    const bonusText = this.add
      .text(width / 2 - 10, 10, bonusValue > 0 ? `+${bonusValue}` : '-', {
        fontSize: '10px',
        color: bonusValue > 0 ? '#44ff44' : '#555555',
      })
      .setOrigin(1, 0.5)
    bonusText.setData('bonusText', true)

    container.add([bg, nameText, levelText, descText, bonusText])
    return container
  }

  private createBonusDisplay(width: number, height: number) {
    const bonusY = height - 90
    const bonuses = talentManager.calculateTotalBonuses()

    // Background panel
    this.add.rectangle(width / 2, bonusY + 20, width - 20, 70, 0x2a2a3e, 0.8)

    // Title
    this.add
      .text(width / 2, bonusY - 10, 'TOTAL BONUSES', {
        fontSize: '11px',
        color: '#888888',
      })
      .setOrigin(0.5)

    // Bonus values in two columns
    const leftX = 25
    const rightX = width / 2 + 15
    const col1Y = bonusY + 10
    const lineHeight = 14

    const bonusItems = [
      { label: 'HP', value: bonuses.flatHp, suffix: '' },
      { label: 'Attack', value: bonuses.flatAttack, suffix: '' },
      { label: 'Dmg Reduction', value: bonuses.percentDamageReduction, suffix: '%' },
      { label: 'Atk Speed', value: bonuses.percentAttackSpeed, suffix: '%' },
      { label: 'Crit Chance', value: bonuses.percentCritChance, suffix: '%' },
      { label: 'Equip Bonus', value: bonuses.percentEquipmentStats, suffix: '%' },
    ]

    this.bonusTexts = []

    bonusItems.forEach((item, index) => {
      const col = index < 3 ? leftX : rightX
      const row = index < 3 ? index : index - 3
      const y = col1Y + row * lineHeight

      const text = this.add
        .text(col, y, `${item.label}: +${item.value}${item.suffix}`, {
          fontSize: '11px',
          color: item.value > 0 ? '#44ff44' : '#555555',
        })
        .setOrigin(0, 0.5)

      this.bonusTexts.push(text)
    })
  }

  private performSpin() {
    const cost = talentManager.getSpinCost()
    const canAfford = currencyManager.canAfford('gold', cost)
    const canSpin = talentManager.canSpin()

    if (!canAfford) {
      // Play error sound or show message
      this.showMessage('Not enough gold!', '#ff4444')
      return
    }

    if (!canSpin) {
      // Check which condition failed
      if (talentManager.areAllTalentsMaxed()) {
        this.showMessage('All talents maxed!', '#ff4444')
      } else {
        this.showMessage('Daily limit reached!', '#ff4444')
      }
      return
    }

    // Perform the actual spin FIRST so we know the real result
    const result = talentManager.spin(currencyManager.get('gold'), (amount) =>
      currencyManager.spend('gold', amount)
    )

    // If spin failed, show error and don't animate
    if (!result.success || !result.talent) {
      this.showMessage(result.error || 'Spin failed!', '#ff4444')
      return
    }

    // Start spin animation with the ACTUAL result
    this.isSpinning = true
    this.updateSpinButtonState()

    // Play sound
    audioManager.playMenuSelect()

    // Animate the spin effect, passing the actual result
    this.playSpinAnimation(result.talent, () => {
      this.handleSpinResult(result)
    })
  }

  /**
   * Casino-style slot machine spin animation
   * Creates a reel of talents that scrolls and slows down like CS:GO cases
   * Tap to speed up, tap again to skip to reveal
   * @param actualResult - The actual talent won (spin already performed)
   */
  private playSpinAnimation(actualResult: Talent, onComplete: () => void) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const centerY = height / 2

    // Use the actual result from the spin (already performed)
    const resultTalent = actualResult
    const resultTier = resultTalent.tier

    // Skip/speed state
    let tapCount = 0
    let isRevealing = false
    let reelTween: Phaser.Tweens.Tween | null = null
    let arrowTween: Phaser.Tweens.Tween | null = null

    // Create dark overlay (interactive for skip)
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
    overlay.setDepth(100)
    overlay.setInteractive()

    // "Tap to skip" hint
    const skipHint = this.add.text(width / 2, height - 80, 'Tap to speed up', {
      fontSize: '14px',
      color: '#888888',
    }).setOrigin(0.5).setDepth(103)

    // Create the slot machine frame
    const frameWidth = 300
    const frameHeight = 100
    const frame = this.add.container(width / 2, centerY)
    frame.setDepth(101)

    // Frame background with glow
    const frameBg = this.add.rectangle(0, 0, frameWidth, frameHeight, 0x1a1a2e)
    frameBg.setStrokeStyle(3, 0x4a9eff)

    // Selection indicator (the line that shows where it lands)
    const selectorLine = this.add.rectangle(0, 0, frameWidth - 20, 4, 0xffd700)
    selectorLine.setAlpha(0.8)

    // Arrow indicators pointing to center
    const leftArrow = this.add.triangle(-frameWidth / 2 - 15, 0, 0, -10, 0, 10, 15, 0, 0xffd700)
    const rightArrow = this.add.triangle(frameWidth / 2 + 15, 0, 0, -10, 0, 10, -15, 0, 0xffd700)

    frame.add([frameBg, selectorLine, leftArrow, rightArrow])

    // Create mask for the reel
    const maskShape = this.make.graphics({ x: 0, y: 0 })
    maskShape.fillStyle(0xffffff)
    maskShape.fillRect(width / 2 - frameWidth / 2 + 10, centerY - frameHeight / 2 + 5, frameWidth - 20, frameHeight - 10)
    const mask = maskShape.createGeometryMask()

    // Create the scrolling reel container
    const reel = this.add.container(width / 2, centerY)
    reel.setDepth(102)
    reel.setMask(mask)

    // Build the reel items - mix of talents with the result placed strategically
    const itemHeight = 50
    const allTalents = Object.values(TALENTS)
    const reelItems: { talent: Talent; text: Phaser.GameObjects.Text; bg: Phaser.GameObjects.Rectangle }[] = []

    // Generate ~40 items for the reel, with result near the end
    const totalItems = 40
    const resultPosition = totalItems - 5 // Result lands 5 from end for suspense

    for (let i = 0; i < totalItems; i++) {
      let talent: Talent
      if (i === resultPosition) {
        talent = resultTalent
      } else {
        // Random talent, weighted slightly toward showing all types
        talent = allTalents[Math.floor(Math.random() * allTalents.length)]
      }

      const yPos = i * itemHeight
      const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]
      const tierColorNum = parseInt(tierColor.replace('#', ''), 16)

      // Item background
      const itemBg = this.add.rectangle(0, yPos, frameWidth - 30, itemHeight - 4, 0x2a2a3e)
      itemBg.setStrokeStyle(2, tierColorNum)

      // Talent name
      const itemText = this.add.text(0, yPos, talent.name, {
        fontSize: '18px',
        color: tierColor,
        fontStyle: 'bold',
      }).setOrigin(0.5)

      reel.add([itemBg, itemText])
      reelItems.push({ talent, text: itemText, bg: itemBg })
    }

    // Calculate animation parameters
    const endY = -(resultPosition * itemHeight) // Land on result position

    // Physics-based easing for slot machine feel
    const totalDuration = 4000 // 4 seconds total

    // Start position
    reel.y = centerY

    // Cleanup function for all resources
    const cleanup = () => {
      overlay.destroy()
      frame.destroy()
      reel.destroy()
      maskShape.destroy()
      skipHint.destroy()
    }

    // Reveal function - shows the final result with effects
    const triggerReveal = () => {
      if (isRevealing) return
      isRevealing = true

      // Stop the reel tween and snap to final position
      if (reelTween) {
        reelTween.stop()
      }
      if (arrowTween) {
        arrowTween.stop()
      }

      // Snap reel to final position
      reel.y = centerY + endY
      this.lastTickIndex = -1

      // Highlight winning item
      reelItems.forEach((item, idx) => {
        if (idx === resultPosition) {
          item.bg.setFillStyle(0x3a3a5e)
        } else {
          item.bg.setFillStyle(0x2a2a3e)
        }
      })

      // Hide skip hint
      skipHint.setVisible(false)

      // Screen shake based on tier
      this.playTierScreenShake(resultTier)

      // Particle explosion based on tier
      this.playTierParticles(width / 2, centerY, resultTier)

      // Haptic feedback based on tier
      this.playTierHaptic(resultTier)

      // Highlight the winning item with glow effect
      const winningItem = reelItems[resultPosition]
      this.playWinningGlow(winningItem.bg, winningItem.text, resultTier)

      // Flash the frame border with tier color
      const tierColorNum = parseInt(this.TIER_DISPLAY_COLORS[resultTier].replace('#', ''), 16)
      this.tweens.add({
        targets: frameBg,
        strokeColor: { from: 0xffffff, to: tierColorNum },
        duration: 100,
        yoyo: true,
        repeat: 3,
      })

      // Wait for effects then complete (shorter wait if skipped)
      const waitTime = tapCount >= 2 ? 800 : 1500
      this.time.delayedCall(waitTime, () => {
        // Fade out everything
        this.tweens.add({
          targets: [overlay, frame, reel, skipHint],
          alpha: 0,
          duration: tapCount >= 2 ? 150 : 300,
          onComplete: () => {
            cleanup()
            onComplete()
          },
        })
      })
    }

    // Handle tap to speed up / skip
    overlay.on('pointerdown', () => {
      tapCount++
      hapticManager.light()

      if (tapCount === 1 && !isRevealing) {
        // First tap: speed up animation (3x faster)
        if (reelTween && reelTween.isPlaying()) {
          reelTween.timeScale = 3
        }
        skipHint.setText('Tap again to skip')
      } else if (tapCount >= 2 && !isRevealing) {
        // Second tap: skip directly to reveal
        triggerReveal()
      }
    })

    // Animate the reel with custom easing (fast start, slow end like CS:GO)
    reelTween = this.tweens.add({
      targets: reel,
      y: centerY + endY,
      duration: totalDuration,
      ease: 'Cubic.easeOut',
      onUpdate: (_tween, target) => {
        if (isRevealing) return

        // Calculate which item is at center
        const currentOffset = target.y - centerY
        const currentIndex = Math.floor(-currentOffset / itemHeight)

        // Tick sound and haptic on each item pass (throttle sound to every 3rd item)
        if (currentIndex !== this.lastTickIndex && currentIndex >= 0 && currentIndex < reelItems.length) {
          this.lastTickIndex = currentIndex

          // Play sound every 3rd item to avoid audio spam
          if (currentIndex % 3 === 0) {
            audioManager.playMenuSelect()
          }
          hapticManager.light()

          // Highlight current center item
          reelItems.forEach((item, idx) => {
            if (idx === currentIndex) {
              item.bg.setFillStyle(0x3a3a5e)
            } else {
              item.bg.setFillStyle(0x2a2a3e)
            }
          })
        }
      },
      onComplete: () => {
        // Clean up tick tracking
        this.lastTickIndex = -1

        // Dramatic pause before reveal (skip if already revealing)
        if (!isRevealing) {
          this.time.delayedCall(200, () => {
            triggerReveal()
          })
        }
      },
    })

    // Pulsing arrows during spin
    arrowTween = this.tweens.add({
      targets: [leftArrow, rightArrow],
      alpha: { from: 1, to: 0.3 },
      duration: 200,
      yoyo: true,
      repeat: -1,
    })

  }

  /**
   * Screen shake effect scaled by tier rarity
   */
  private playTierScreenShake(tier: TalentTier) {
    let intensity: number
    let duration: number

    switch (tier) {
      case TalentTier.EPIC:
        intensity = 15
        duration = 500
        break
      case TalentTier.RARE:
        intensity = 8
        duration = 300
        break
      case TalentTier.COMMON:
      default:
        intensity = 3
        duration = 150
        break
    }

    this.cameras.main.shake(duration, intensity / 1000)
  }

  /**
   * Haptic feedback scaled by tier rarity
   */
  private playTierHaptic(tier: TalentTier) {
    switch (tier) {
      case TalentTier.EPIC:
        // Epic gets a dramatic multi-pulse haptic pattern
        hapticManager.heavy()
        this.time.delayedCall(100, () => hapticManager.heavy())
        this.time.delayedCall(200, () => hapticManager.heavy())
        break
      case TalentTier.RARE:
        hapticManager.heavy()
        break
      case TalentTier.COMMON:
      default:
        hapticManager.medium()
        break
    }
  }

  /**
   * Particle explosion effect scaled by tier rarity
   */
  private playTierParticles(x: number, y: number, tier: TalentTier) {
    const tierColor = this.TIER_DISPLAY_COLORS[tier]
    const colorNum = parseInt(tierColor.replace('#', ''), 16)

    let particleCount: number
    let particleSpeed: number
    let particleScale: number
    let additionalColors: number[] = []

    switch (tier) {
      case TalentTier.EPIC:
        particleCount = 60
        particleSpeed = 400
        particleScale = 1.5
        additionalColors = [0xffd700, 0xffffff, 0xff00ff] // Gold, white, magenta bursts
        break
      case TalentTier.RARE:
        particleCount = 35
        particleSpeed = 300
        particleScale = 1.2
        additionalColors = [0xffffff, 0x00ffff] // White, cyan
        break
      case TalentTier.COMMON:
      default:
        particleCount = 15
        particleSpeed = 200
        particleScale = 0.8
        break
    }

    // Create particle graphics
    const allColors = [colorNum, ...additionalColors]

    allColors.forEach((color, colorIndex) => {
      const count = Math.floor(particleCount / allColors.length)
      const delay = colorIndex * 50 // Stagger colors slightly

      this.time.delayedCall(delay, () => {
        for (let i = 0; i < count; i++) {
          const particle = this.add.circle(x, y, 4 * particleScale, color)
          particle.setDepth(150)
          particle.setAlpha(1)

          const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
          const speed = particleSpeed * (0.5 + Math.random() * 0.5)
          const vx = Math.cos(angle) * speed
          const vy = Math.sin(angle) * speed

          this.tweens.add({
            targets: particle,
            x: particle.x + vx * 0.5,
            y: particle.y + vy * 0.5,
            alpha: 0,
            scale: { from: particleScale, to: 0 },
            duration: 800 + Math.random() * 400,
            ease: 'Quad.easeOut',
            onComplete: () => particle.destroy(),
          })
        }
      })
    })

    // Epic tier gets extra sparkle ring
    if (tier === TalentTier.EPIC) {
      this.playEpicRingEffect(x, y)
    }
  }

  /**
   * Special ring explosion for epic tier
   */
  private playEpicRingEffect(x: number, y: number) {
    const ring = this.add.circle(x, y, 10, 0xaa00ff, 0)
    ring.setStrokeStyle(4, 0xaa00ff)
    ring.setDepth(149)

    this.tweens.add({
      targets: ring,
      radius: 150,
      strokeAlpha: { from: 1, to: 0 },
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    })

    // Second delayed ring
    this.time.delayedCall(150, () => {
      const ring2 = this.add.circle(x, y, 10, 0xffd700, 0)
      ring2.setStrokeStyle(3, 0xffd700)
      ring2.setDepth(149)

      this.tweens.add({
        targets: ring2,
        radius: 120,
        strokeAlpha: { from: 1, to: 0 },
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => ring2.destroy(),
      })
    })
  }

  /**
   * Glowing highlight effect for the winning talent
   */
  private playWinningGlow(bg: Phaser.GameObjects.Rectangle, text: Phaser.GameObjects.Text, tier: TalentTier) {
    const tierColor = parseInt(this.TIER_DISPLAY_COLORS[tier].replace('#', ''), 16)

    // Pulse the background
    this.tweens.add({
      targets: bg,
      fillColor: { from: 0x2a2a3e, to: tierColor },
      duration: 200,
      yoyo: true,
      repeat: 2,
    })

    // Scale bounce the text
    this.tweens.add({
      targets: text,
      scale: { from: 1, to: 1.3 },
      duration: 150,
      yoyo: true,
      repeat: 1,
      ease: 'Bounce.easeOut',
    })

    // Add glow rectangle behind
    const glow = this.add.rectangle(bg.x, bg.y, bg.width + 20, bg.height + 20, tierColor, 0.3)
    glow.setDepth(bg.depth - 1)

    this.tweens.add({
      targets: glow,
      alpha: { from: 0.5, to: 0 },
      scale: { from: 1, to: 1.5 },
      duration: 800,
      onComplete: () => glow.destroy(),
    })
  }

  private handleSpinResult(result: SpinResult) {
    this.isSpinning = false
    this.updateSpinButtonState()

    if (result.success && result.talent) {
      // Show result animation
      this.showTalentResult(result.talent, result.newLevel || 1)

      // Play success sound
      audioManager.playLevelUp()

      // Highlight the talent card
      this.highlightTalentCard(result.talent.id)

      // Update all UI
      this.updateUI()
    } else if (result.error) {
      this.showMessage(result.error, '#ff4444')
    }
  }

  private showTalentResult(talent: Talent, newLevel: number) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]

    // Result popup
    const popup = this.add.container(width / 2, height / 2 - 50)
    popup.setDepth(100)

    // Background
    const bg = this.add.rectangle(0, 0, 280, 120, 0x1a1a2e)
    bg.setStrokeStyle(3, parseInt(tierColor.replace('#', ''), 16))

    // Tier label
    const tierLabel = this.add
      .text(0, -40, TIER_NAMES[talent.tier].toUpperCase(), {
        fontSize: '12px',
        color: tierColor,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Talent name
    const nameText = this.add
      .text(0, -15, talent.name, {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    // Level
    const levelText = this.add
      .text(0, 15, `Level ${newLevel}/${talent.maxLevel}`, {
        fontSize: '16px',
        color: tierColor,
      })
      .setOrigin(0.5)

    // Bonus gained
    const bonusText = this.add
      .text(0, 40, `+${talent.effectPerLevel} ${this.getEffectLabel(talent)}`, {
        fontSize: '14px',
        color: '#44ff44',
      })
      .setOrigin(0.5)

    popup.add([bg, tierLabel, nameText, levelText, bonusText])

    // Animate in
    popup.setScale(0.5)
    popup.setAlpha(0)

    this.tweens.add({
      targets: popup,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    })

    // Fade out after delay
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

  private getEffectLabel(talent: Talent): string {
    switch (talent.effectType) {
      case 'flat_hp':
        return 'HP'
      case 'flat_attack':
        return 'Attack'
      case 'percent_damage_reduction':
        return '% Damage Reduction'
      case 'percent_attack_speed':
        return '% Attack Speed'
      case 'flat_heal_on_level':
        return ' HP on Level-Up'
      case 'percent_crit_chance':
        return '% Crit Chance'
      case 'percent_equipment_stats':
        return '% Equipment Stats'
      case 'starting_abilities':
        return ' Starting Ability'
      case 'percent_hp_when_low':
        return '% HP when Low'
      default:
        return ''
    }
  }

  private highlightTalentCard(talentId: TalentId) {
    const card = this.talentCards.get(talentId)
    if (!card) return

    // Flash animation
    this.tweens.add({
      targets: card,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 150,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
    })
  }

  private showMessage(text: string, color: string) {
    const width = this.cameras.main.width

    const message = this.add
      .text(width / 2, 130, text, {
        fontSize: '14px',
        color: color,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(50)

    this.tweens.add({
      targets: message,
      alpha: 0,
      y: message.y - 20,
      duration: 1000,
      delay: 500,
      onComplete: () => message.destroy(),
    })
  }

  private updateUI() {
    // Update gold display
    if (this.goldText) {
      this.goldText.setText(`Gold: ${currencyManager.get('gold')}`)
    }

    // Update spin cost
    if (this.spinCostText) {
      const cost = talentManager.getSpinCost()
      this.spinCostText.setText(`Cost: ${cost}`)
    }

    // Update spins remaining
    if (this.spinsRemainingText) {
      const remaining = talentManager.getSpinsRemaining()
      const max = talentManager.getMaxDailySpins()
      this.spinsRemainingText.setText(`Spins today: ${max - remaining}/${max}`)
    }

    // Update talent cards
    this.talentCards.forEach((card, talentId) => {
      const talent = TALENTS[talentId]
      const level = talentManager.getTalentLevel(talentId)
      const bonus = talentManager.getTalentBonus(talentId)
      const tierColor = this.TIER_DISPLAY_COLORS[talent.tier]

      // Update level text
      card.list.forEach((child) => {
        if (child instanceof Phaser.GameObjects.Text) {
          if (child.getData('levelText')) {
            child.setText(`Lv.${level}/${talent.maxLevel}`)
            child.setColor(level > 0 ? tierColor : '#555555')
          }
          if (child.getData('bonusText')) {
            child.setText(bonus > 0 ? `+${bonus}` : '-')
            child.setColor(bonus > 0 ? '#44ff44' : '#555555')
          }
        }
      })
    })

    // Update bonus display
    const bonuses = talentManager.calculateTotalBonuses()
    const bonusValues = [
      bonuses.flatHp,
      bonuses.flatAttack,
      bonuses.percentDamageReduction,
      bonuses.percentAttackSpeed,
      bonuses.percentCritChance,
      bonuses.percentEquipmentStats,
    ]
    const suffixes = ['', '', '%', '%', '%', '%']
    const labels = [
      'HP',
      'Attack',
      'Dmg Reduction',
      'Atk Speed',
      'Crit Chance',
      'Equip Bonus',
    ]

    this.bonusTexts.forEach((text, index) => {
      const value = bonusValues[index]
      // Round to 1 decimal place, show as integer if whole number
      const rounded = Math.round(value * 10) / 10
      const displayValue = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
      text.setText(`${labels[index]}: +${displayValue}${suffixes[index]}`)
      text.setColor(value > 0 ? '#44ff44' : '#555555')
    })

    this.updateSpinButtonState()
  }

  private updateSpinButtonState() {
    if (!this.spinButton) return

    const cost = talentManager.getSpinCost()
    const canAfford = currencyManager.canAfford('gold', cost)
    const canSpin = talentManager.canSpin()
    const isEnabled = canAfford && canSpin && !this.isSpinning

    // Update button appearance
    const bg = this.spinButton.list[0] as Phaser.GameObjects.Rectangle
    if (bg) {
      if (this.isSpinning) {
        bg.setFillStyle(0x666666)
      } else if (!isEnabled) {
        bg.setFillStyle(0x444444)
      } else {
        bg.setFillStyle(0x4a9eff)
      }
    }

    // Update cost text color
    if (this.spinCostText) {
      this.spinCostText.setColor(canAfford ? '#FFD700' : '#ff4444')
    }
  }
}
