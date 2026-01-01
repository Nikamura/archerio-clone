import Phaser from 'phaser'
import { saveManager } from '../systems/SaveManager'
import { setDifficulty } from '../config/difficulty'

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

    // Store save manager reference in registry for global access
    this.game.registry.set('saveManager', saveManager)

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
