import Phaser from 'phaser'

export default class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics
  private healthBarBg!: Phaser.GameObjects.Graphics
  private xpBar!: Phaser.GameObjects.Graphics
  private xpBarBg!: Phaser.GameObjects.Graphics
  private levelText!: Phaser.GameObjects.Text
  private roomText!: Phaser.GameObjects.Text

  // Boss health bar
  private bossHealthBar!: Phaser.GameObjects.Graphics
  private bossHealthBarBg!: Phaser.GameObjects.Graphics
  private bossNameText!: Phaser.GameObjects.Text
  private bossHealthContainer!: Phaser.GameObjects.Container

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

    // XP bar background (below health bar)
    this.xpBarBg = this.add.graphics()
    this.xpBarBg.fillStyle(0x000000, 0.5)
    this.xpBarBg.fillRect(10, 40, 154, 16)

    // XP bar
    this.xpBar = this.add.graphics()
    this.updateXPBar(0)

    // Level text (right of XP bar)
    this.levelText = this.add.text(170, 40, 'Lv.1', {
      fontSize: '14px',
      color: '#ffdd00',
      fontStyle: 'bold',
    })

    // Listen for health updates from GameScene
    this.events.on('updateHealth', (healthPercentage: number) => {
      this.updateHealthBar(healthPercentage)
    })

    // Listen for XP updates from GameScene
    this.events.on('updateXP', (xpPercentage: number, level: number) => {
      this.updateXPBar(xpPercentage)
      this.updateLevel(level)
    })

    // Listen for room updates from GameScene
    this.events.on('updateRoom', (currentRoom: number, totalRooms: number) => {
      this.updateRoomCounter(currentRoom, totalRooms)
    })

    // Listen for boss health events
    this.events.on('showBossHealth', (health: number, maxHealth: number) => {
      this.showBossHealthBar(health, maxHealth)
    })
    this.events.on('updateBossHealth', (health: number, maxHealth: number) => {
      this.updateBossHealthBar(health, maxHealth)
    })
    this.events.on('hideBossHealth', () => {
      this.hideBossHealthBar()
    })

    // Room counter
    this.roomText = this.add.text(
      this.cameras.main.width / 2,
      20,
      'Room 1/10',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    )
    this.roomText.setOrigin(0.5, 0)

    // Create boss health bar (initially hidden)
    this.createBossHealthBar()

    console.log('UIScene: Created')
  }

  private createBossHealthBar() {
    const width = this.cameras.main.width
    const barWidth = width - 40 // Full width with padding
    const barHeight = 16
    const yPos = this.cameras.main.height - 50 // Bottom of screen

    // Container to group all boss UI elements
    this.bossHealthContainer = this.add.container(0, 0)

    // Background
    this.bossHealthBarBg = this.add.graphics()
    this.bossHealthBarBg.fillStyle(0x000000, 0.7)
    this.bossHealthBarBg.fillRect(20, yPos, barWidth, barHeight)

    // Health bar
    this.bossHealthBar = this.add.graphics()

    // Boss name
    this.bossNameText = this.add.text(width / 2, yPos - 20, 'BOSS', {
      fontSize: '16px',
      color: '#ff4444',
      fontStyle: 'bold',
    })
    this.bossNameText.setOrigin(0.5, 0.5)

    // Add to container
    this.bossHealthContainer.add([this.bossHealthBarBg, this.bossHealthBar, this.bossNameText])
    this.bossHealthContainer.setVisible(false)
  }

  private showBossHealthBar(health: number, maxHealth: number) {
    this.bossHealthContainer.setVisible(true)
    this.updateBossHealthBar(health, maxHealth)
  }

  private updateBossHealthBar(health: number, maxHealth: number) {
    const width = this.cameras.main.width
    const barWidth = width - 44
    const barHeight = 12
    const yPos = this.cameras.main.height - 48

    const percentage = Math.max(0, health / maxHealth)

    this.bossHealthBar.clear()
    this.bossHealthBar.fillStyle(0xff2222, 1) // Red for boss
    this.bossHealthBar.fillRect(22, yPos, barWidth * percentage, barHeight)
  }

  private hideBossHealthBar() {
    if (this.bossHealthContainer) {
      this.bossHealthContainer.setVisible(false)
    }
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

  updateRoomCounter(currentRoom: number, totalRooms: number) {
    this.roomText.setText(`Room ${currentRoom}/${totalRooms}`)
  }

  updateXPBar(percentage: number) {
    this.xpBar.clear()
    this.xpBar.fillStyle(0x4488ff, 1) // Blue for XP
    this.xpBar.fillRect(12, 42, percentage * 150, 12)
  }

  updateLevel(level: number) {
    this.levelText.setText(`Lv.${level}`)
  }
}
