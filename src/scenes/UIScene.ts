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

  // HUD container for toggling visibility
  private hudContainer!: Phaser.GameObjects.Container
  private isHudVisible: boolean = true

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    // Register shutdown event
    this.events.once('shutdown', this.shutdown, this)

    // Create HUD container for easy visibility toggling
    this.hudContainer = this.add.container(0, 0)
    this.isHudVisible = true

    // Health bar background
    this.healthBarBg = this.add.graphics()
    this.healthBarBg.fillStyle(0x000000, 0.5)
    this.healthBarBg.fillRect(10, 10, 204, 24)
    this.hudContainer.add(this.healthBarBg)

    // Health bar
    this.healthBar = this.add.graphics()
    this.updateHealthBar(100)
    this.hudContainer.add(this.healthBar)

    // XP bar background (below health bar)
    this.xpBarBg = this.add.graphics()
    this.xpBarBg.fillStyle(0x000000, 0.5)
    this.xpBarBg.fillRect(10, 40, 154, 16)
    this.hudContainer.add(this.xpBarBg)

    // XP bar
    this.xpBar = this.add.graphics()
    this.updateXPBar(0)
    this.hudContainer.add(this.xpBar)

    // Level text (right of XP bar)
    this.levelText = this.add.text(170, 40, 'Lv.1', {
      fontSize: '14px',
      color: '#ffdd00',
      fontStyle: 'bold',
    })
    this.hudContainer.add(this.levelText)

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

    // Listen for room cleared/entered events to toggle HUD visibility
    this.events.on('roomCleared', () => {
      this.fadeOutHUD()
    })
    this.events.on('roomEntered', () => {
      this.fadeInHUD()
    })

    // Room counter
    this.roomText = this.add.text(
      this.cameras.main.width / 2,
      20,
      '',
      {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
      }
    )
    this.roomText.setOrigin(0.5, 0)
    this.hudContainer.add(this.roomText)

    // Debug skip button
    if (this.game.registry.get('debug')) {
      // Visible indicator that debug mode is active
      const debugModeText = this.add.text(10, this.cameras.main.height - 20, 'DEBUG MODE ACTIVE', {
        fontSize: '10px',
        color: '#ff0000',
        fontStyle: 'bold',
      })
      debugModeText.setDepth(100)

      // Create a DOM button for debug skip to avoid being blocked by the joystick
      const btn = document.createElement('button')
      btn.innerText = 'DEBUG SKIP'
      btn.style.position = 'absolute'
      btn.style.top = '70px'
      btn.style.right = '10px'
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
        console.log('UIScene: Debug Skip DOM Button Pressed')
        this.game.events.emit('debugSkipLevel')
      }
      
      document.body.appendChild(btn)
      
      // Cleanup DOM button on scene shutdown
      this.events.once('shutdown', () => {
        if (btn.parentNode) {
          btn.parentNode.removeChild(btn)
        }
      })
    }

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

  /**
   * Fade out HUD elements when room is cleared for cleaner presentation
   */
  private fadeOutHUD(): void {
    if (!this.isHudVisible) return
    this.isHudVisible = false

    this.tweens.add({
      targets: this.hudContainer,
      alpha: 0.3,
      duration: 300,
      ease: 'Power2.easeOut',
    })
  }

  /**
   * Fade in HUD elements when entering a new room
   */
  private fadeInHUD(): void {
    if (this.isHudVisible) return
    this.isHudVisible = true

    this.tweens.add({
      targets: this.hudContainer,
      alpha: 1,
      duration: 200,
      ease: 'Power2.easeOut',
    })
  }

  shutdown() {
    // Remove all event listeners to prevent memory leaks
    this.events.off('updateHealth')
    this.events.off('updateXP')
    this.events.off('updateRoom')
    this.events.off('showBossHealth')
    this.events.off('updateBossHealth')
    this.events.off('hideBossHealth')
    this.events.off('roomCleared')
    this.events.off('roomEntered')
  }
}
