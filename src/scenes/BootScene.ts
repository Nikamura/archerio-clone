import Phaser from 'phaser'

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
    this.scene.start('PreloaderScene')
  }
}
