import Phaser from 'phaser'
import { DifficultyLevel, DIFFICULTY_CONFIGS, setDifficulty, getCurrentDifficulty } from '../config/difficulty'
import { ChapterId } from '../config/chapterData'
import { audioManager } from '../systems/AudioManager'
import { saveManager } from '../systems/SaveManager'
import { currencyManager } from '../systems/CurrencyManager'
import { chapterManager } from '../systems/ChapterManager'
import { dailyRewardManager } from '../systems/DailyRewardManager'
import { achievementManager } from '../systems/AchievementManager'
import { chestManager } from '../systems/ChestManager'
import { themeManager } from '../systems/ThemeManager'
import {
  fadeInScene,
  transitionToScene,
  TransitionType,
  applyButtonEffects,
  staggerIn,
  DURATION,
} from '../systems/UIAnimations'

export default class MainMenuScene extends Phaser.Scene {
  private selectedDifficulty: DifficultyLevel = DifficultyLevel.NORMAL
  private energyTimerText?: Phaser.GameObjects.Text
  private leftTorch?: Phaser.GameObjects.Image
  private rightTorch?: Phaser.GameObjects.Image
  private chapterButtons: Phaser.GameObjects.Container[] = []
  private menuButtons: Phaser.GameObjects.Text[] = []
  private customSeed: string = '' // Custom seed for seeded runs

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

    // Get saved difficulty or default to NORMAL
    this.selectedDifficulty = getCurrentDifficulty(this.game)

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
        for (let i = 1; i <= 5; i++) {
          chapterManager.forceUnlockChapter(i as ChapterId)
        }
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
    // CHAPTER SELECTION
    // ============================================

    this.createChapterSelection(width)

    // ============================================
    // DIFFICULTY SELECTION (Horizontal)
    // ============================================

    const difficultyLabel = this.add.text(width / 2, 175, 'DIFFICULTY', {
      fontSize: '14px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    })
    difficultyLabel.setOrigin(0.5)
    difficultyLabel.setDepth(10)

    // Horizontal difficulty buttons
    const difficulties = [DifficultyLevel.EASY, DifficultyLevel.NORMAL, DifficultyLevel.HARD, DifficultyLevel.INSANITY]
    const buttonWidth = 80
    const totalWidth = buttonWidth * 4 + 30
    const startX = (width - totalWidth) / 2 + buttonWidth / 2

    difficulties.forEach((difficulty, index) => {
      const config = DIFFICULTY_CONFIGS[difficulty]
      const xPos = startX + index * (buttonWidth + 10)

      const button = this.add.text(xPos, 200, config.label, {
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

    const playButton = this.add.text(width / 2, 270, 'PLAY', {
      fontSize: '28px',
      color: '#ffffff',
      backgroundColor: '#4a9eff',
      padding: { x: 50, y: 15 },
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
      audioManager.playGameStart()
      // Set custom seed if provided
      if (this.customSeed) {
        this.game.registry.set('runSeed', this.customSeed)
      }
      // Use fade transition when starting game
      transitionToScene(this, 'GameScene', TransitionType.FADE, DURATION.NORMAL)
      this.scene.launch('UIScene')
    })

    // Seed input button (below play button)
    const seedButton = this.add.text(width / 2, 310, this.customSeed ? `Seed: ${this.customSeed}` : 'Enter Seed', {
      fontSize: '12px',
      color: this.customSeed ? '#00ddff' : '#888888',
      backgroundColor: '#333333',
      padding: { x: 12, y: 6 },
    })
    seedButton.setOrigin(0.5)
    seedButton.setInteractive({ useHandCursor: true })
    seedButton.setDepth(10)

    seedButton.on('pointerover', () => {
      seedButton.setStyle({ backgroundColor: '#444444' })
    })

    seedButton.on('pointerout', () => {
      seedButton.setStyle({ backgroundColor: '#333333' })
    })

    seedButton.on('pointerdown', () => {
      audioManager.playMenuSelect()
      this.showSeedInputDialog(seedButton)
    })

    // ============================================
    // MENU BUTTONS (Two rows for better layout)
    // ============================================

    const menuY = 340
    const menuButtonConfigs = [
      { label: 'Heroes', scene: 'HeroesScene' },
      { label: 'Equip', scene: 'EquipmentScene' },
      { label: 'Talents', scene: 'TalentsScene' },
      { label: 'Chests', scene: 'ChestScene' },
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

    // Notification badge for Chests button (if player has chests)
    const totalChests = chestManager.getTotalChests()
    if (totalChests > 0) {
      const chestsButton = this.menuButtons[3] // Chests is at index 3
      const chestBadgeX = chestsButton.x + chestsButton.width / 2 + 5
      const chestBadgeY = chestsButton.y - chestsButton.height / 2

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

    // ============================================
    // DAILY REWARD BUTTON (Below menu buttons)
    // ============================================

    const dailyY = menuY + 55
    const canClaimDaily = dailyRewardManager.canClaimToday()

    // Daily button container
    const dailyButton = this.add.text(width / 2, dailyY, 'Daily Rewards', {
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

  private createChapterSelection(width: number) {
    const selectedChapterId = chapterManager.getSelectedChapter()
    const unlockedChapters = chapterManager.getUnlockedChapters()
    console.log('MainMenuScene: Creating chapter selection. Unlocked chapters:', unlockedChapters)

    // Chapter selection label
    const chapterLabel = this.add.text(width / 2, 88, 'SELECT CHAPTER', {
      fontSize: '12px',
      color: '#aaaaaa',
      stroke: '#000000',
      strokeThickness: 2,
    })
    chapterLabel.setOrigin(0.5)
    chapterLabel.setDepth(10)

    // Create chapter buttons (5 chapters)
    const chapterIds: ChapterId[] = [1, 2, 3, 4, 5]
    const chapterBtnSize = 60
    const chapterGap = 8
    const totalChapterWidth = chapterIds.length * chapterBtnSize + (chapterIds.length - 1) * chapterGap
    const chapterStartX = (width - totalChapterWidth) / 2 + chapterBtnSize / 2
    const chapterY = 130

    this.chapterButtons = []

    // Theme colors for each chapter
    const chapterColors: Record<ChapterId, number> = {
      1: 0x4a4a4a, // Dark Dungeon - gray stone
      2: 0x2d5a27, // Forest Ruins - green
      3: 0x4a8ab5, // Frozen Caves - ice blue
      4: 0x8b2500, // Volcanic Depths - red/orange
      5: 0x3d1a5c, // Shadow Realm - purple
    }

    chapterIds.forEach((chapterId, index) => {
      const isUnlocked = unlockedChapters.includes(chapterId)
      const isSelected = chapterId === selectedChapterId
      const xPos = chapterStartX + index * (chapterBtnSize + chapterGap)

      // Pre-compute colors once
      const themeColor = chapterColors[chapterId]
      const hoverColor = Phaser.Display.Color.ValueToColor(themeColor).lighten(30).color

      // Create container for chapter button
      const container = this.add.container(xPos, chapterY)
      container.setDepth(10)

      // Background with chapter theme color
      const bgColor = isSelected ? 0x4a9eff : (isUnlocked ? themeColor : 0x222222)
      const bg = this.add.rectangle(0, 0, chapterBtnSize, chapterBtnSize, bgColor, 1)
      bg.setStrokeStyle(3, isSelected ? 0xffffff : (isUnlocked ? 0xaaaaaa : 0x444444))

      // Chapter icon (if loaded) or fallback to number
      const iconKey = `chapterIcon${chapterId}`
      let icon: Phaser.GameObjects.Image | null = null

      if (this.textures.exists(iconKey)) {
        icon = this.add.image(0, 0, iconKey)
        icon.setDisplaySize(chapterBtnSize - 8, chapterBtnSize - 8)
        if (!isUnlocked) {
          icon.setTint(0x444444)
        }
        container.add(icon)
      }

      // Chapter number overlay (always visible)
      const numText = this.add.text(0, 0, `${chapterId}`, {
        fontSize: '28px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      numText.setOrigin(0.5)
      if (!isUnlocked) {
        numText.setAlpha(0.4)
      }

      // Lock overlay for locked chapters
      if (!isUnlocked) {
        const lockOverlay = this.add.rectangle(0, 0, chapterBtnSize, chapterBtnSize, 0x000000, 0.6)
        const lockIcon = this.add.text(0, 0, '🔒', {
          fontSize: '24px',
        })
        lockIcon.setOrigin(0.5)
        container.add([lockOverlay, lockIcon])
      }

      container.add([bg, numText])
      if (icon) {
        container.sendToBack(icon)
      }
      container.sendToBack(bg)

      // Make interactive if unlocked - use the bg rectangle directly for cleaner hit detection
      if (isUnlocked) {
        bg.setInteractive({ useHandCursor: true })

        bg.on('pointerover', () => {
          if (chapterId !== chapterManager.getSelectedChapter()) {
            bg.setFillStyle(hoverColor)
          }
        })

        bg.on('pointerout', () => {
          if (chapterId !== chapterManager.getSelectedChapter()) {
            bg.setFillStyle(themeColor)
          }
        })

        bg.on('pointerdown', () => {
          audioManager.playMenuSelect()
          chapterManager.selectChapter(chapterId)
          this.updateChapterButtons()
        })
      }

      // Store reference
      container.setData('chapterId', chapterId)
      container.setData('bg', bg)
      container.setData('themeColor', themeColor)
      container.setData('hoverColor', hoverColor)
      this.chapterButtons.push(container)
    })
  }

  private updateChapterButtons() {
    const selectedChapterId = chapterManager.getSelectedChapter()

    this.chapterButtons.forEach((container) => {
      const chapterId = container.getData('chapterId') as ChapterId
      const bg = container.getData('bg') as Phaser.GameObjects.Rectangle
      const themeColor = container.getData('themeColor') as number
      const isSelected = chapterId === selectedChapterId

      bg.setFillStyle(isSelected ? 0x4a9eff : themeColor)
      bg.setStrokeStyle(3, isSelected ? 0xffffff : 0xaaaaaa)
    })
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

  /**
   * Show a DOM-based seed input dialog
   */
  private showSeedInputDialog(seedButton: Phaser.GameObjects.Text): void {
    // Create overlay container
    const overlay = document.createElement('div')
    overlay.style.position = 'absolute'
    overlay.style.top = '0'
    overlay.style.left = '0'
    overlay.style.width = '100%'
    overlay.style.height = '100%'
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
    overlay.style.display = 'flex'
    overlay.style.flexDirection = 'column'
    overlay.style.alignItems = 'center'
    overlay.style.justifyContent = 'center'
    overlay.style.zIndex = '10000'

    // Create dialog box
    const dialog = document.createElement('div')
    dialog.style.backgroundColor = '#222'
    dialog.style.border = '2px solid #444'
    dialog.style.borderRadius = '8px'
    dialog.style.padding = '20px'
    dialog.style.textAlign = 'center'
    dialog.style.maxWidth = '300px'
    dialog.style.width = '80%'

    // Title
    const title = document.createElement('div')
    title.textContent = 'Enter Run Seed'
    title.style.color = '#fff'
    title.style.fontSize = '18px'
    title.style.fontWeight = 'bold'
    title.style.marginBottom = '15px'
    dialog.appendChild(title)

    // Description
    const desc = document.createElement('div')
    desc.textContent = 'Use a seed to replay the same enemy spawns and boss selection.'
    desc.style.color = '#888'
    desc.style.fontSize = '12px'
    desc.style.marginBottom = '15px'
    dialog.appendChild(desc)

    // Input field
    const input = document.createElement('input')
    input.type = 'text'
    input.placeholder = 'Leave empty for random'
    input.value = this.customSeed
    input.style.width = '100%'
    input.style.padding = '10px'
    input.style.fontSize = '16px'
    input.style.fontFamily = 'monospace'
    input.style.textAlign = 'center'
    input.style.border = '1px solid #555'
    input.style.borderRadius = '4px'
    input.style.backgroundColor = '#333'
    input.style.color = '#00ddff'
    input.style.boxSizing = 'border-box'
    input.style.marginBottom = '15px'
    input.style.textTransform = 'uppercase'
    dialog.appendChild(input)

    // Button container
    const buttonContainer = document.createElement('div')
    buttonContainer.style.display = 'flex'
    buttonContainer.style.gap = '10px'
    buttonContainer.style.justifyContent = 'center'

    // Confirm button
    const confirmBtn = document.createElement('button')
    confirmBtn.textContent = 'Confirm'
    confirmBtn.style.padding = '10px 20px'
    confirmBtn.style.fontSize = '14px'
    confirmBtn.style.fontWeight = 'bold'
    confirmBtn.style.backgroundColor = '#4a9eff'
    confirmBtn.style.color = '#fff'
    confirmBtn.style.border = 'none'
    confirmBtn.style.borderRadius = '4px'
    confirmBtn.style.cursor = 'pointer'
    buttonContainer.appendChild(confirmBtn)

    // Clear button
    const clearBtn = document.createElement('button')
    clearBtn.textContent = 'Clear'
    clearBtn.style.padding = '10px 20px'
    clearBtn.style.fontSize = '14px'
    clearBtn.style.backgroundColor = '#666'
    clearBtn.style.color = '#fff'
    clearBtn.style.border = 'none'
    clearBtn.style.borderRadius = '4px'
    clearBtn.style.cursor = 'pointer'
    buttonContainer.appendChild(clearBtn)

    // Cancel button
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.padding = '10px 20px'
    cancelBtn.style.fontSize = '14px'
    cancelBtn.style.backgroundColor = '#444'
    cancelBtn.style.color = '#fff'
    cancelBtn.style.border = 'none'
    cancelBtn.style.borderRadius = '4px'
    cancelBtn.style.cursor = 'pointer'
    buttonContainer.appendChild(cancelBtn)

    dialog.appendChild(buttonContainer)
    overlay.appendChild(dialog)

    // Get canvas parent for proper positioning
    const canvasParent = this.game.canvas.parentElement
    if (canvasParent) {
      canvasParent.appendChild(overlay)
    } else {
      document.body.appendChild(overlay)
    }

    // Focus input
    input.focus()

    // Cleanup function
    const cleanup = () => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
    }

    // Event handlers
    confirmBtn.onclick = () => {
      const newSeed = input.value.trim().toUpperCase()
      this.customSeed = newSeed
      seedButton.setText(newSeed ? `Seed: ${newSeed}` : 'Enter Seed')
      seedButton.setStyle({ color: newSeed ? '#00ddff' : '#888888' })
      audioManager.playMenuSelect()
      cleanup()
    }

    clearBtn.onclick = () => {
      input.value = ''
      this.customSeed = ''
      seedButton.setText('Enter Seed')
      seedButton.setStyle({ color: '#888888' })
      audioManager.playMenuSelect()
      cleanup()
    }

    cancelBtn.onclick = () => {
      cleanup()
    }

    // Close on overlay click (outside dialog)
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        cleanup()
      }
    }

    // Handle Enter key
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn.click()
      } else if (e.key === 'Escape') {
        cleanup()
      }
    }
  }
}
