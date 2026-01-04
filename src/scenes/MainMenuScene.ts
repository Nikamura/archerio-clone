import Phaser from 'phaser'
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
import { fadeInScene, transitionToScene, TransitionType, DURATION } from '../systems/UIAnimations'
import {
  createCurrencyBar,
  CurrencyBarResult,
  showNoEnergyModal,
  showMockAdPopup,
  createBottomNavBar,
  BottomNavBarResult,
  createMoreDrawer,
  MoreDrawerResult,
  GameMode,
} from '../ui/components'
import { createPlaySection } from './menus/PlaySection'

export default class MainMenuScene extends Phaser.Scene {
  private currencyBar?: CurrencyBarResult
  private bottomNavBar?: BottomNavBarResult
  private moreDrawer?: MoreDrawerResult

  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    fadeInScene(this, DURATION.NORMAL)
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Background
    this.createBackground(width, height)

    // Debug mode
    this.setupDebugMode(width, height)

    // Header (currency + title + settings)
    this.createHeader(width)

    // Play section (mode selector + collapsible chapter/difficulty + PLAY button)
    this.createPlaySection(width)

    // Bottom navigation bar
    this.createBottomNavBar()

    // More drawer (secondary navigation)
    this.createMoreDrawer()

    // Instructions footer
    this.createFooter(width, height)
  }

  update() {
    this.currencyBar?.updateEnergy()
  }

  private createBackground(width: number, height: number) {
    const themeAssets = themeManager.getAssets()
    const bg = this.add.image(width / 2, height / 2, themeAssets.menuBg)
    bg.setDisplaySize(width, height)
    bg.setDepth(0)

    // Animated torches
    this.createTorches(width)
  }

  private createHeader(width: number) {
    // Currency bar
    currencyManager.updateEnergyRegeneration()
    this.currencyBar = createCurrencyBar({
      scene: this,
      y: 10,
      depth: 10,
    })

    // Title
    const title = this.add.text(width / 2, 55, 'ARROW GAME', {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    })
    title.setOrigin(0.5)
    title.setDepth(10)

    // High score
    const highScore = saveManager.getStatistics().highestScore
    if (highScore > 0) {
      const highScoreText = this.add.text(width / 2, 80, `Best: ${highScore.toLocaleString()}`, {
        fontSize: '14px',
        color: '#FFD700',
        stroke: '#000000',
        strokeThickness: 2,
      })
      highScoreText.setOrigin(0.5)
      highScoreText.setDepth(10)
    }

    // Settings button (top right)
    const settingsBtn = this.add.text(width - 15, 55, '⚙️', {
      fontSize: '24px',
    })
    settingsBtn.setOrigin(1, 0.5)
    settingsBtn.setInteractive({ useHandCursor: true })
    settingsBtn.setDepth(10)

    settingsBtn.on('pointerdown', () => {
      audioManager.playMenuSelect()
      transitionToScene(this, 'SettingsScene', TransitionType.FADE, DURATION.FAST)
    })
  }

  private createPlaySection(width: number) {
    createPlaySection({
      scene: this,
      x: width / 2,
      y: 130,
      width,
      onPlay: (mode: GameMode) => {
        if (!this.trySpendEnergy()) return

        // Set game mode
        this.game.registry.set('isEndlessMode', mode === 'endless' || mode === 'daily')
        this.game.registry.set('isDailyChallengeMode', mode === 'daily')

        transitionToScene(this, 'GameScene', TransitionType.FADE, DURATION.NORMAL)
        this.scene.launch('UIScene')
      },
      depth: 10,
    })
  }

  private createBottomNavBar() {
    const chestCount = chestManager.getTotalChests()
    const moreBadge = this.getMoreBadgeCount()

    this.bottomNavBar = createBottomNavBar({
      scene: this,
      activeId: 'home',
      items: [
        { id: 'home', icon: '🏠', label: 'Home' },
        { id: 'gear', icon: '⚔️', label: 'Gear', scene: 'EquipmentScene' },
        { id: 'rewards', icon: '🎁', label: 'Rewards', scene: 'ChestScene', badge: chestCount },
        { id: 'shop', icon: '🛒', label: 'Shop', scene: 'ShopScene' },
        {
          id: 'more',
          icon: '•••',
          label: 'More',
          badge: moreBadge,
          onClick: () => this.moreDrawer?.show(),
        },
      ],
      depth: 50,
    })
  }

  private createMoreDrawer() {
    const dailyBadge = dailyRewardManager.canClaimToday() ? 1 : 0
    const achieveBadge = achievementManager.getUnclaimedRewardsCount()

    this.moreDrawer = createMoreDrawer({
      scene: this,
      items: [
        { id: 'heroes', icon: '🦸', label: 'Heroes', scene: 'HeroesScene' },
        { id: 'talents', icon: '⭐', label: 'Talents', scene: 'TalentsScene' },
        { id: 'daily', icon: '📅', label: 'Daily Rewards', scene: 'DailyRewardScene', badge: dailyBadge },
        { id: 'achievements', icon: '🏆', label: 'Achievements', scene: 'AchievementsScene', badge: achieveBadge },
        { id: 'guide', icon: '📖', label: 'Encyclopedia', scene: 'EncyclopediaScene' },
      ],
    })
  }

  private createFooter(width: number, height: number) {
    const navBarHeight = this.bottomNavBar?.getHeight() ?? 60
    const instructionsText = this.add.text(width / 2, height - navBarHeight - 15, 'Move to dodge • Stop to shoot', {
      fontSize: '11px',
      color: '#666666',
      stroke: '#000000',
      strokeThickness: 1,
    })
    instructionsText.setOrigin(0.5)
    instructionsText.setDepth(10)
  }

  private getMoreBadgeCount(): number {
    const daily = dailyRewardManager.canClaimToday() ? 1 : 0
    const achieve = achievementManager.getUnclaimedRewardsCount()
    return daily + achieve
  }

  private trySpendEnergy(): boolean {
    const currentEnergy = currencyManager.get('energy')
    if (currentEnergy <= 0) {
      showNoEnergyModal({
        scene: this,
        onWatchAd: () => {
          showMockAdPopup({ scene: this })
        },
      })
      return false
    }
    currencyManager.spendEnergy(1)
    return true
  }

  private setupDebugMode(_width: number, height: number) {
    if (!this.game.registry.get('debug')) return

    this.add
      .text(10, height - 20, 'DEBUG MODE ACTIVE', {
        fontSize: '10px',
        color: '#ff0000',
        fontStyle: 'bold',
      })
      .setDepth(100)

    const btn = document.createElement('button')
    btn.innerText = 'DEBUG: UNLOCK ALL'
    btn.style.cssText = `
      position: absolute; top: 50px; left: 10px; z-index: 10000;
      background-color: #cc0000; color: white; border: none;
      padding: 10px; font-weight: bold; cursor: pointer; border-radius: 5px;
    `

    btn.onclick = (e) => {
      e.preventDefault()
      e.stopPropagation()
      for (let i = 1; i <= 5; i++) {
        chapterManager.forceUnlockChapter(i as ChapterId)
      }
      themeManager.unlock('vaporwave')
      heroManager.forceUnlock('helix')
      heroManager.forceUnlock('meowgik')
      equipmentManager.createEquipment(WeaponType.DEATH_SCYTHE, Rarity.LEGENDARY, 70)
      equipmentManager.createEquipment(ArmorType.GOLDEN_CHESTPLATE, Rarity.LEGENDARY, 70)
      equipmentManager.createEquipment(RingType.LION_RING, Rarity.LEGENDARY, 70)
      equipmentManager.createEquipment(SpiritType.LASER_BAT, Rarity.LEGENDARY, 70)
      this.scene.restart()
    }

    document.body.appendChild(btn)
    this.events.once('shutdown', () => btn.parentNode?.removeChild(btn))
  }

  private createTorches(width: number) {
    const titleY = 55
    const torchOffsetX = 100

    // Left torch
    const leftTorch = this.add.image(width / 2 - torchOffsetX, titleY, 'torch')
    leftTorch.setDisplaySize(16, 16)
    leftTorch.setDepth(1)

    // Right torch
    const rightTorch = this.add.image(width / 2 + torchOffsetX, titleY, 'torch')
    rightTorch.setDisplaySize(16, 16)
    rightTorch.setDepth(1)

    // Flicker animations
    this.tweens.add({
      targets: [leftTorch, rightTorch],
      scaleX: { from: 0.98, to: 1.02 },
      scaleY: { from: 0.98, to: 1.02 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    this.tweens.add({
      targets: [leftTorch, rightTorch],
      alpha: { from: 0.9, to: 1.0 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Ember particles
    this.createEmberParticles(width, titleY, torchOffsetX)
  }

  private createEmberParticles(width: number, titleY: number, torchOffsetX: number) {
    const graphics = this.add.graphics()
    graphics.fillStyle(0xff6600, 1)
    graphics.fillCircle(1, 1, 1)
    graphics.generateTexture('ember', 2, 2)
    graphics.destroy()

    const emitterConfig = {
      speed: { min: 8, max: 20 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      lifespan: { min: 400, max: 800 },
      frequency: 400,
      quantity: 1,
      blendMode: Phaser.BlendModes.ADD,
      tint: [0xff6600, 0xff8800, 0xffaa00],
    }

    const leftEmitter = this.add.particles(width / 2 - torchOffsetX, titleY - 5, 'ember', emitterConfig)
    leftEmitter.setDepth(2)

    const rightEmitter = this.add.particles(width / 2 + torchOffsetX, titleY - 5, 'ember', emitterConfig)
    rightEmitter.setDepth(2)
  }
}
