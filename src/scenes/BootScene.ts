import Phaser from 'phaser'
import { saveManager } from '../systems/SaveManager'
import { heroManager } from '../systems/HeroManager'
import { themeManager } from '../systems/ThemeManager'
import { currencyManager } from '../systems/CurrencyManager'
import { setDifficulty } from '../config/difficulty'
import { audioManager } from '../systems/AudioManager'
import { hapticManager } from '../systems/HapticManager'

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Load minimal core assets here
    // For now, we'll skip to preloader
  }

  create() {
    console.log('BootScene: Starting game...')

    // Load save data and apply settings
    this.initializeSaveData()

    this.scene.start('PreloaderScene')
  }

  /**
   * Initialize save data and apply saved settings to the game
   */
  private initializeSaveData(): void {
    // SaveManager singleton is already initialized on import
    // Load settings from save data
    const settings = saveManager.getSettings()

    // Apply difficulty setting to game registry
    setDifficulty(this.game, settings.difficulty)

    // Apply audio and haptic settings
    audioManager.setEnabled(settings.audioEnabled)
    audioManager.setVolume(settings.audioVolume)
    hapticManager.enabled = settings.vibrationEnabled

    // Initialize HeroManager with currency integration
    heroManager.setCurrencyCallbacks({
      getGold: () => currencyManager.get('gold'),
      getGems: () => currencyManager.get('gems'),
      spendGold: (amount) => currencyManager.spend('gold', amount),
      spendGems: (amount) => currencyManager.spend('gems', amount),
      onSave: () => saveManager.save()
    })

    // Initialize ThemeManager with currency integration
    themeManager.setCurrencyCallbacks({
      getGold: () => currencyManager.get('gold'),
      spendGold: (amount) => currencyManager.spend('gold', amount),
      getGems: () => currencyManager.get('gems'),
      spendGems: (amount) => currencyManager.spend('gems', amount),
      onSave: () => saveManager.save()
    })

    // Check for debug mode in URL
    const urlParams = new window.URLSearchParams(window.location.search)
    const isDebug = urlParams.has('debug')
    this.game.registry.set('debug', isDebug)
    if (isDebug) {
      console.log('BootScene: Debug mode enabled via URL')
    }

    // Store save manager reference in registry for global access
    this.game.registry.set('saveManager', saveManager)
    this.game.registry.set('heroManager', heroManager)

    // Log save status
    if (saveManager.exists()) {
      const stats = saveManager.getStatistics()
      console.log(
        `BootScene: Loaded save data - ${stats.totalRuns} runs, ${stats.totalKills} kills`
      )
    } else {
      console.log('BootScene: New game - created fresh save data')
    }
  }
}
