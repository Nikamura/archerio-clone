import Phaser from 'phaser'

export default class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Title
    const title = this.add.text(width / 2, height / 3, 'ARCHER.IO', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    title.setOrigin(0.5)

    // Play button
    const playButton = this.add.text(width / 2, height / 2, 'PLAY', {
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#4a9eff',
      padding: { x: 40, y: 20 },
    })
    playButton.setOrigin(0.5)
    playButton.setInteractive({ useHandCursor: true })

    // Button hover effects
    playButton.on('pointerover', () => {
      playButton.setStyle({ backgroundColor: '#6bb6ff' })
    })

    playButton.on('pointerout', () => {
      playButton.setStyle({ backgroundColor: '#4a9eff' })
    })

    playButton.on('pointerdown', () => {
      this.scene.start('GameScene')
      this.scene.launch('UIScene')
    })

    // Instructions
    const instructions = this.add.text(
      width / 2,
      height - 100,
      'Touch left side to move • Stop to shoot',
      {
        fontSize: '18px',
        color: '#aaaaaa',
      }
    )
    instructions.setOrigin(0.5)
  }
}
