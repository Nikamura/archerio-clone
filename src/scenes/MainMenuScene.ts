import Phaser from 'phaser'
import '../config/difficulty'
import { ChapterId } from '../config/chapterData'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'
import { currencyManager } from '../systems/CurrencyManager'
import { chapterManager } from '../systems/ChapterManager'
import { dailyRewardManager } from '../systems/DailyRewardManager'
import { achievementManager } from '../systems/AchievementManager'
import { chestManager } from '../systems/ChestManager'
import { themeManager } from '../systems/ThemeManager'
import { equipmentManager } from '../systems/EquipmentManager'
import { heroManager } from '../systems/HeroManager'
import { Rarity, WeaponType, ArmorType, RingType, SpiritType } from '../systems/Equipment'
import {
  fadeInScene,
  transitionToScene,
  TransitionType,
  applyButtonEffects,
  staggerIn,
  DURATION,
} from '../systems/UIAnimations'
import { ChapterSelectPanel } from './menus/ChapterSelectPanel'
import { DifficultyPanel } from './menus/DifficultyPanel'

export default class MainMenuScene extends Phaser.Scene {
  private energyTimerText?: Phaser.GameObjects.Text
  private leftTorch?: Phaser.GameObjects.Image
  private rightTorch?: Phaser.GameObjects.Image
  private chapterPanel?: ChapterSelectPanel
  private difficultyPanel?: DifficultyPanel
  private menuButtons: Phaser.GameObjects.Text[] = []

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    // Fade in scene on entry
    fadeInScene(this, DURATION.NORMAL)
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // ============================================
    // BACKGROUND (depth 0) - use themed background
    // ============================================
    const themeAssets = themeManager.getAssets()
    const bg = this.add.image(width / 2, height / 2, themeAssets.menuBg)
    bg.setDisplaySize(width, height)
    bg.setDepth(0)

    // ============================================
    // ANIMATED TORCHES
    // ============================================
    this.createTorches(width)

    // Debug: Unlock all chapters button
    if (this.game.registry.get('debug')) {
      // Visible indicator
      this.add.text(10, height - 20, 'DEBUG MODE ACTIVE', {
        fontSize: '10px',
        color: '#ff0000',
        fontStyle: 'bold',
      }).setDepth(100)

      // Create a DOM button for debug unlock to avoid being blocked by the joystick
      const btn = document.createElement('button')
      btn.innerText = 'DEBUG: UNLOCK ALL'
      btn.style.position = 'absolute'
      btn.style.top = '50px'
      btn.style.left = '10px'
      btn.style.zIndex = '10000'
      btn.style.backgroundColor = '#cc0000'
      btn.style.color = 'white'
      btn.style.border = 'none'
      btn.style.padding = '10px'
      btn.style.fontWeight = 'bold'
      btn.style.cursor = 'pointer'
      btn.style.borderRadius = '5px'

      btn.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        // Unlock all chapters
        for (let i = 1; i <= 5; i++) {
          chapterManager.forceUnlockChapter(i as ChapterId)
        }
        // Unlock vaporwave theme
        themeManager.unlock('vaporwave')
        // Unlock all heroes
        heroManager.forceUnlock('helix')
        heroManager.forceUnlock('meowgik')
        // Add legendary equipment (one of each slot at max level 70)
        equipmentManager.createEquipment(WeaponType.DEATH_SCYTHE, Rarity.LEGENDARY, 70)
        equipmentManager.createEquipment(ArmorType.GOLDEN_CHESTPLATE, Rarity.LEGENDARY, 70)
        equipmentManager.createEquipment(RingType.LION_RING, Rarity.LEGENDARY, 70)
        equipmentManager.createEquipment(SpiritType.LASER_BAT, Rarity.LEGENDARY, 70)
        this.scene.restart()
      }

      document.body.appendChild(btn)

      // Cleanup DOM button on scene shutdown
      this.events.once('shutdown', () => {
        if (btn.parentNode) {
          btn.parentNode.removeChild(btn)
        }
      })
    }

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

    const title = this.add.text(width / 2, 55, 'ARROW GAME', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    title.setOrigin(0.5)
    title.setDepth(10)

    // ============================================
    // HIGHSCORE DISPLAY
    // ============================================
    const highScore = saveManager.getStatistics().highestScore
    if (highScore > 0) {
      const highScoreText = this.add.text(width / 2, 78, `Best: ${highScore.toLocaleString()}`, {
        fontSize: '14px',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 2,
      })
      highScoreText.setOrigin(0.5)
      highScoreText.setDepth(10)
    }

    // ============================================
    // CHAPTER SELECTION (using ChapterSelectPanel)
    // ============================================

    this.chapterPanel = new ChapterSelectPanel({
      scene: this,
      x: width / 2,
      y: 110,
      width: width,
    })
    this.chapterPanel.setDepth(10)

    // ============================================
    // DIFFICULTY SELECTION (using DifficultyPanel)
    // ============================================

    this.difficultyPanel = new DifficultyPanel({
      scene: this,
      x: width / 2,
      y: 190,
      game: this.game,
    })
    this.difficultyPanel.setDepth(10)

    // ============================================
    // PLAY BUTTONS (Center - two buttons side by side)
    // ============================================

    const buttonY = 265

    // PLAY button (left)
    const playButton = this.add.text(width / 2 - 60, buttonY, 'PLAY', {
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#4a9eff',
      padding: { x: 28, y: 12 },
    })
    playButton.setOrigin(0.5)
    playButton.setInteractive({ useHandCursor: true })
    playButton.setDepth(10)

    // Apply enhanced button effects
    applyButtonEffects(this, playButton, {
      scaleOnHover: 1.08,
      scaleOnPress: 0.95,
    })

    playButton.on('pointerover', () => {
      playButton.setStyle({ backgroundColor: '#6bb6ff' })
    })

    playButton.on('pointerout', () => {
      playButton.setStyle({ backgroundColor: '#4a9eff' })
    })

    playButton.on('pointerdown', () => {
      audioManager.resume()
      // Check and spend energy before starting
      if (!this.trySpendEnergy()) {
        return
      }
      audioManager.playGameStart()
      // Disable special modes for normal play
      this.game.registry.set('isEndlessMode', false)
      this.game.registry.set('isDailyChallengeMode', false)
      // Use fade transition when starting game
      transitionToScene(this, 'GameScene', TransitionType.FADE, DURATION.NORMAL)
      this.scene.launch('UIScene')
    })

    // ENDLESS button (right)
    const endlessButton = this.add.text(width / 2 + 60, buttonY, 'ENDLESS', {
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: '#ff6b35',
      padding: { x: 16, y: 12 },
    })
    endlessButton.setOrigin(0.5)
    endlessButton.setInteractive({ useHandCursor: true })
    endlessButton.setDepth(10)

    // Apply enhanced button effects
    applyButtonEffects(this, endlessButton, {
      scaleOnHover: 1.08,
      scaleOnPress: 0.95,
    })

    endlessButton.on('pointerover', () => {
      endlessButton.setStyle({ backgroundColor: '#ff8855' })
    })

    endlessButton.on('pointerout', () => {
      endlessButton.setStyle({ backgroundColor: '#ff6b35' })
    })

    endlessButton.on('pointerdown', () => {
      audioManager.resume()
      // Check and spend energy before starting
      if (!this.trySpendEnergy()) {
        return
      }
      audioManager.playGameStart()
      // Enable endless mode, disable daily challenge mode
      this.game.registry.set('isEndlessMode', true)
      this.game.registry.set('isDailyChallengeMode', false)
      // Use fade transition when starting game
      transitionToScene(this, 'GameScene', TransitionType.FADE, DURATION.NORMAL)
      this.scene.launch('UIScene')
    })

    // DAILY CHALLENGE button (below play buttons)
    const dailyCompleted = saveManager.isDailyChallengeCompleted()
    const dailyStats = saveManager.getDailyChallengeStats()
    const dailyChallengeColor = dailyCompleted ? '#4a6a4a' : '#00ddff'
    const dailyChallengeHoverColor = dailyCompleted ? '#5a7a5a' : '#44eeff'
    const dailyLabel = dailyCompleted ? `DAILY ✓ (Wave ${dailyStats.bestWave})` : 'DAILY CHALLENGE'

    const dailyChallengeButton = this.add.text(width / 2, 305, dailyLabel, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: dailyChallengeColor,
      padding: { x: 20, y: 8 },
    })
    dailyChallengeButton.setOrigin(0.5)
    dailyChallengeButton.setInteractive({ useHandCursor: true })
    dailyChallengeButton.setDepth(10)

    // Apply enhanced button effects
    applyButtonEffects(this, dailyChallengeButton, {
      scaleOnHover: 1.05,
      scaleOnPress: 0.95,
    })

    dailyChallengeButton.on('pointerover', () => {
      dailyChallengeButton.setStyle({ backgroundColor: dailyChallengeHoverColor })
    })

    dailyChallengeButton.on('pointerout', () => {
      dailyChallengeButton.setStyle({ backgroundColor: dailyChallengeColor })
    })

    dailyChallengeButton.on('pointerdown', () => {
      audioManager.resume()
      // Check and spend energy before starting
      if (!this.trySpendEnergy()) {
        return
      }
      audioManager.playGameStart()
      // Enable daily challenge mode (uses endless mechanics with fixed daily seed)
      this.game.registry.set('isDailyChallengeMode', true)
      this.game.registry.set('isEndlessMode', false) // Will be set to true in GameScene
      // Use fade transition when starting game
      transitionToScene(this, 'GameScene', TransitionType.FADE, DURATION.NORMAL)
      this.scene.launch('UIScene')
    })

    // ============================================
    // MENU BUTTONS (Two rows for better layout)
    // ============================================

    const menuY = 340
    const menuButtonConfigs = [
      { label: 'Heroes', scene: 'HeroesScene' },
      { label: 'Equip', scene: 'EquipmentScene' },
      { label: 'Talents', scene: 'TalentsScene' },
      { label: 'Guide', scene: 'EncyclopediaScene' },
    ]
    const menuBtnWidth = 80
    const menuGap = 8
    const buttonsPerRow = 4
    const totalRowWidth = buttonsPerRow * menuBtnWidth + (buttonsPerRow - 1) * menuGap
    const menuStartX = (width - totalRowWidth) / 2 + menuBtnWidth / 2
    this.menuButtons = []

    menuButtonConfigs.forEach((btn, index) => {
      const col = index % buttonsPerRow
      const xPos = menuStartX + col * (menuBtnWidth + menuGap)
      const button = this.add.text(xPos, menuY, btn.label, {
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#6b8e23',
        padding: { x: 12, y: 10 },
      })
      button.setOrigin(0.5)
      button.setInteractive({ useHandCursor: true })
      button.setDepth(10)

      // Apply enhanced button effects
      applyButtonEffects(this, button, {
        scaleOnHover: 1.1,
        scaleOnPress: 0.9,
      })

      button.on('pointerover', () => {
        button.setStyle({ backgroundColor: '#7fa32f' })
      })

      button.on('pointerout', () => {
        button.setStyle({ backgroundColor: '#6b8e23' })
      })

      button.on('pointerdown', () => {
        audioManager.playMenuSelect()
        // Use slide transition for sub-menus
        transitionToScene(this, btn.scene, TransitionType.FADE, DURATION.FAST)
      })

      this.menuButtons.push(button)
    })

    // Stagger animate menu buttons entrance
    staggerIn(this, this.menuButtons, 'up', DURATION.FAST, 50)

    // ============================================
    // DAILY REWARD & CHESTS BUTTONS (Below menu buttons)
    // ============================================

    const dailyY = menuY + 55
    const buttonGapX = 10

    // Chests button (left side)
    const chestsButton = this.add.text(width / 2 - 75 - buttonGapX / 2, dailyY, 'Chests', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#6b4423',
      padding: { x: 25, y: 10 },
    })
    chestsButton.setOrigin(0.5)
    chestsButton.setInteractive({ useHandCursor: true })
    chestsButton.setDepth(10)

    chestsButton.on('pointerover', () => {
      chestsButton.setStyle({ backgroundColor: '#7d5530' })
    })

    chestsButton.on('pointerout', () => {
      chestsButton.setStyle({ backgroundColor: '#6b4423' })
    })

    chestsButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      transitionToScene(this, 'ChestScene', TransitionType.FADE, DURATION.FAST)
    })

    applyButtonEffects(this, chestsButton, { scaleOnHover: 1.05, scaleOnPress: 0.95 })

    // Notification badge for Chests button (if player has chests)
    const totalChests = chestManager.getTotalChests()
    if (totalChests > 0) {
      const chestBadgeX = chestsButton.x + chestsButton.width / 2 + 5
      const chestBadgeY = dailyY - chestsButton.height / 2

      // Red circle badge with count
      const chestBadge = this.add.circle(chestBadgeX, chestBadgeY, 10, 0xff4444)
      chestBadge.setDepth(11)

      // Badge count text
      const chestBadgeCount = this.add.text(chestBadgeX, chestBadgeY, `${totalChests}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      chestBadgeCount.setOrigin(0.5)
      chestBadgeCount.setDepth(12)

      // Pulse animation on badge
      this.tweens.add({
        targets: chestBadge,
        scale: { from: 1, to: 1.2 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
    const canClaimDaily = dailyRewardManager.canClaimToday()

    // Daily Rewards button (right side)
    const dailyButton = this.add.text(width / 2 + 75 + buttonGapX / 2, dailyY, 'Daily', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#8b4513',
      padding: { x: 20, y: 10 },
    })
    dailyButton.setOrigin(0.5)
    dailyButton.setInteractive({ useHandCursor: true })
    dailyButton.setDepth(10)

    dailyButton.on('pointerover', () => {
      dailyButton.setStyle({ backgroundColor: '#a0522d' })
    })

    dailyButton.on('pointerout', () => {
      dailyButton.setStyle({ backgroundColor: '#8b4513' })
    })

    dailyButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      transitionToScene(this, 'DailyRewardScene', TransitionType.FADE, DURATION.FAST)
    })

    // Apply button effects to daily button
    applyButtonEffects(this, dailyButton, { scaleOnHover: 1.05, scaleOnPress: 0.95 })

    // Notification badge (if reward available)
    if (canClaimDaily) {
      const badgeX = dailyButton.x + dailyButton.width / 2 + 5
      const badgeY = dailyButton.y - dailyButton.height / 2

      // Red circle badge
      const badge = this.add.circle(badgeX, badgeY, 8, 0xff4444)
      badge.setDepth(11)

      // Exclamation mark
      const exclamation = this.add.text(badgeX, badgeY, '!', {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      exclamation.setOrigin(0.5)
      exclamation.setDepth(12)

      // Pulse animation on badge
      this.tweens.add({
        targets: badge,
        scale: { from: 1, to: 1.2 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // ============================================
    // ACHIEVEMENTS BUTTON (Below daily rewards)
    // ============================================

    const achieveY = dailyY + 45
    const unclaimedCount = achievementManager.getUnclaimedRewardsCount()

    const achieveButton = this.add.text(width / 2, achieveY, 'Achievements', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#4a4a8a',
      padding: { x: 20, y: 10 },
    })
    achieveButton.setOrigin(0.5)
    achieveButton.setInteractive({ useHandCursor: true })
    achieveButton.setDepth(10)

    achieveButton.on('pointerover', () => {
      achieveButton.setStyle({ backgroundColor: '#5a5a9a' })
    })

    achieveButton.on('pointerout', () => {
      achieveButton.setStyle({ backgroundColor: '#4a4a8a' })
    })

    achieveButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      transitionToScene(this, 'AchievementsScene', TransitionType.FADE, DURATION.FAST)
    })

    // Apply button effects to achievements button
    applyButtonEffects(this, achieveButton, { scaleOnHover: 1.05, scaleOnPress: 0.95 })

    // Notification badge (if unclaimed rewards)
    if (unclaimedCount > 0) {
      const achieveBadgeX = achieveButton.x + achieveButton.width / 2 + 5
      const achieveBadgeY = achieveButton.y - achieveButton.height / 2

      // Red circle badge with count
      const achieveBadge = this.add.circle(achieveBadgeX, achieveBadgeY, 10, 0xff4444)
      achieveBadge.setDepth(11)

      // Badge count text
      const badgeCount = this.add.text(achieveBadgeX, achieveBadgeY, `${unclaimedCount}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      badgeCount.setOrigin(0.5)
      badgeCount.setDepth(12)

      // Pulse animation on badge
      this.tweens.add({
        targets: achieveBadge,
        scale: { from: 1, to: 1.2 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }

    // ============================================
    // SHOP BUTTON (Below achievements)
    // ============================================

    const shopY = achieveY + 45

    const shopButton = this.add.text(width / 2, shopY, 'Shop', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#9932cc',
      padding: { x: 20, y: 10 },
    })
    shopButton.setOrigin(0.5)
    shopButton.setInteractive({ useHandCursor: true })
    shopButton.setDepth(10)

    shopButton.on('pointerover', () => {
      shopButton.setStyle({ backgroundColor: '#ba55d3' })
    })

    shopButton.on('pointerout', () => {
      shopButton.setStyle({ backgroundColor: '#9932cc' })
    })

    shopButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      transitionToScene(this, 'ShopScene', TransitionType.FADE, DURATION.FAST)
    })

    // Apply button effects to shop button
    applyButtonEffects(this, shopButton, { scaleOnHover: 1.05, scaleOnPress: 0.95 })

    // ============================================
    // SETTINGS BUTTON (Below shop)
    // ============================================

    const settingsY = shopY + 45

    const settingsButton = this.add.text(width / 2, settingsY, 'Settings', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#555555',
      padding: { x: 20, y: 10 },
    })
    settingsButton.setOrigin(0.5)
    settingsButton.setInteractive({ useHandCursor: true })
    settingsButton.setDepth(10)

    settingsButton.on('pointerover', () => {
      settingsButton.setStyle({ backgroundColor: '#777777' })
    })

    settingsButton.on('pointerout', () => {
      settingsButton.setStyle({ backgroundColor: '#555555' })
    })

    settingsButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      transitionToScene(this, 'SettingsScene', TransitionType.FADE, DURATION.FAST)
    })

    // Apply button effects to settings button
    applyButtonEffects(this, settingsButton, { scaleOnHover: 1.05, scaleOnPress: 0.95 })

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

  /**
   * Attempt to start a game run by spending energy
   * @returns true if energy was spent and game can start, false otherwise
   */
  private trySpendEnergy(): boolean {
    const currentEnergy = currencyManager.get('energy')
    if (currentEnergy <= 0) {
      this.showNoEnergyMessage()
      return false
    }

    currencyManager.spendEnergy(1)
    return true
  }

  /**
   * Show a temporary "No Energy" message on screen
   */
  private showNoEnergyMessage(): void {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Create semi-transparent overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
    overlay.setDepth(100)

    // Create message container
    const messageBox = this.add.rectangle(width / 2, height / 2, 280, 120, 0x222222, 1)
    messageBox.setStrokeStyle(2, 0xff4444)
    messageBox.setDepth(101)

    // No energy icon and title
    const title = this.add.text(width / 2, height / 2 - 30, '⚡ No Energy!', {
      fontSize: '22px',
      color: '#ff4444',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)
    title.setDepth(102)

    // Description text
    const timeString = currencyManager.getFormattedTimeUntilNextEnergy()
    const desc = this.add.text(width / 2, height / 2 + 5, `Next energy in: ${timeString}`, {
      fontSize: '14px',
      color: '#cccccc',
    })
    desc.setOrigin(0.5)
    desc.setDepth(102)

    // Tap to dismiss text
    const dismissText = this.add.text(width / 2, height / 2 + 35, 'Tap to dismiss', {
      fontSize: '12px',
      color: '#888888',
    })
    dismissText.setOrigin(0.5)
    dismissText.setDepth(102)

    // Make overlay interactive to dismiss
    overlay.setInteractive()
    overlay.on('pointerdown', () => {
      overlay.destroy()
      messageBox.destroy()
      title.destroy()
      desc.destroy()
      dismissText.destroy()
    })

    // Auto-dismiss after 3 seconds
    this.time.delayedCall(3000, () => {
      if (overlay.active) {
        overlay.destroy()
        messageBox.destroy()
        title.destroy()
        desc.destroy()
        dismissText.destroy()
      }
    })
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
