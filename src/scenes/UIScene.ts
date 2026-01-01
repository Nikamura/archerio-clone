import Phaser from 'phaser'

export default class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics
  private healthBarBg!: Phaser.GameObjects.Graphics

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    // Health bar background
    this.healthBarBg = this.add.graphics()
    this.healthBarBg.fillStyle(0x000000, 0.5)
    this.healthBarBg.fillRect(10, 10, 204, 24)

    // Health bar
    this.healthBar = this.add.graphics()
    this.updateHealthBar(100)

    // Listen for health updates from GameScene
    this.events.on('updateHealth', (healthPercentage: number) => {
      this.updateHealthBar(healthPercentage)
    })

    // Room counter
    const roomText = this.add.text(
      this.cameras.main.width / 2,
      20,
      'Room 1/10',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    )
    roomText.setOrigin(0.5, 0)

    console.log('UIScene: Created')
  }

  updateHealthBar(percentage: number) {
    this.healthBar.clear()

    // Health bar color based on percentage
    let color = 0x00ff00 // Green
    if (percentage < 50) color = 0xffaa00 // Orange
    if (percentage < 25) color = 0xff0000 // Red

    this.healthBar.fillStyle(color, 1)
    this.healthBar.fillRect(12, 12, percentage * 2, 20)
  }
}
