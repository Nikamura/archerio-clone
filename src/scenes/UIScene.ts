import Phaser from 'phaser'
import { saveManager } from '../systems/SaveManager'
import { themeManager } from '../systems/ThemeManager'
import { ABILITIES, type AbilityData } from './LevelUpScene'

interface AcquiredAbility {
  id: string
  level: number
}

export default class UIScene extends Phaser.Scene {
  // Top HUD elements
  private healthBar!: Phaser.GameObjects.Graphics
  private healthBarBg!: Phaser.GameObjects.Graphics
  private healthText!: Phaser.GameObjects.Text
  private levelBadge!: Phaser.GameObjects.Container
  private levelText!: Phaser.GameObjects.Text
  private xpBar!: Phaser.GameObjects.Graphics
  private roomText!: Phaser.GameObjects.Text

  // Boss health bar
  private bossHealthBar!: Phaser.GameObjects.Graphics
  private bossHealthBarBg!: Phaser.GameObjects.Graphics
  private bossNameText!: Phaser.GameObjects.Text
  private bossHealthContainer!: Phaser.GameObjects.Container

  // HUD container for toggling visibility
  private hudContainer!: Phaser.GameObjects.Container
  private isHudVisible: boolean = true

  // Menu system
  private menuButton!: Phaser.GameObjects.Container
  private menuPanel!: Phaser.GameObjects.Container
  private isMenuOpen: boolean = false

  // Skills bar (bottom)
  private skillsContainer!: Phaser.GameObjects.Container

  // FPS counter (debug only)
  private fpsText?: Phaser.GameObjects.Text

  // Notification queue
  private notificationContainer!: Phaser.GameObjects.Container
  private notificationQueue: Array<{ ability: AbilityData; isDouble?: boolean; ability2?: AbilityData }> = []
  private isShowingNotification: boolean = false

  constructor() {
    super({ key: 'UIScene' })
  }

  create() {
    this.events.once('shutdown', this.shutdown, this)

    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Create HUD container
    this.hudContainer = this.add.container(0, 0)
    this.isHudVisible = true

    // === TOP HUD BAR ===
    this.createTopHUD(width)

    // === MENU BUTTON & PANEL ===
    this.createMenuSystem(width, height)

    // === SKILLS BAR (bottom) ===
    this.createSkillsBar(height)

    // === BOSS HEALTH BAR ===
    this.createBossHealthBar(width, height)

    // === NOTIFICATION AREA ===
    this.notificationContainer = this.add.container(width / 2, 70)
    this.notificationContainer.setDepth(100)

    // === FPS COUNTER (debug only) ===
    if (this.game.registry.get('debug')) {
      this.fpsText = this.add.text(width - 10, 10, 'FPS: 60', {
        fontSize: '11px',
        color: '#00ff00',
        fontStyle: 'bold',
      })
      this.fpsText.setOrigin(1, 0)
      this.fpsText.setDepth(100)
      this.fpsText.setAlpha(0.7)

      // Debug mode indicator
      const debugText = this.add.text(10, height - 20, 'DEBUG', {
        fontSize: '10px',
        color: '#ff0000',
        fontStyle: 'bold',
      })
      debugText.setAlpha(0.5)

      // Debug skip button (DOM for reliability)
      const btn = document.createElement('button')
      btn.innerText = 'SKIP'
      btn.style.cssText = `
        position: absolute; top: 60px; right: 10px; z-index: 10000;
        background: #cc0000; color: white; border: none; padding: 6px 10px;
        font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 11px;
      `
      btn.onclick = (e) => {
        e.preventDefault()
        e.stopPropagation()
        this.game.events.emit('debugSkipLevel')
      }
      document.body.appendChild(btn)
      this.events.once('shutdown', () => btn.remove())
    }

    // === EVENT LISTENERS ===
    this.setupEventListeners()

    console.log('UIScene: Created (modern layout)')
  }

  /**
   * Create the top HUD bar with health, room counter, and level
   */
  private createTopHUD(width: number) {
    // Semi-transparent top bar background
    const topBarBg = this.add.graphics()
    topBarBg.fillStyle(0x000000, 0.4)
    topBarBg.fillRoundedRect(8, 8, width - 16, 44, 8)
    this.hudContainer.add(topBarBg)

    // --- HEALTH BAR (left side) ---
    const healthX = 16
    const healthY = 16
    const healthWidth = 120
    const healthHeight = 14

    // Health bar background
    this.healthBarBg = this.add.graphics()
    this.healthBarBg.fillStyle(0x000000, 0.6)
    this.healthBarBg.fillRoundedRect(healthX, healthY, healthWidth, healthHeight, 4)
    this.hudContainer.add(this.healthBarBg)

    // Health bar fill
    this.healthBar = this.add.graphics()
    this.hudContainer.add(this.healthBar)

    // Health text
    this.healthText = this.add.text(healthX + healthWidth / 2, healthY + healthHeight / 2, '100', {
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.healthText.setOrigin(0.5)
    this.healthText.setStroke('#000000', 2)
    this.hudContainer.add(this.healthText)

    // Initialize health bar
    this.updateHealthBar(100, 100, 100)

    // --- ROOM COUNTER (center) ---
    this.roomText = this.add.text(width / 2, 28, 'Room 1/20', {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.roomText.setOrigin(0.5)
    this.roomText.setStroke('#000000', 3)
    this.hudContainer.add(this.roomText)

    // --- LEVEL BADGE with XP (right side, before menu) ---
    const levelX = width - 70
    this.levelBadge = this.add.container(levelX, 28)

    // XP bar background
    const xpBarWidth = 40
    const xpBarHeight = 4
    const xpBg = this.add.graphics()
    xpBg.fillStyle(0x000000, 0.6)
    xpBg.fillRoundedRect(-xpBarWidth / 2, 8, xpBarWidth, xpBarHeight, 2)
    this.levelBadge.add(xpBg)

    // XP bar fill
    this.xpBar = this.add.graphics()
    this.levelBadge.add(this.xpBar)
    this.updateXPBar(0)

    // Level text
    this.levelText = this.add.text(0, -2, 'Lv.1', {
      fontSize: '14px',
      color: '#ffdd00',
      fontStyle: 'bold',
    })
    this.levelText.setOrigin(0.5)
    this.levelText.setStroke('#000000', 2)
    this.levelBadge.add(this.levelText)

    this.hudContainer.add(this.levelBadge)
  }

  /**
   * Create menu button and slide-out panel
   */
  private createMenuSystem(width: number, _height: number) {
    // Menu button (gear icon)
    this.menuButton = this.add.container(width - 26, 28)
    this.menuButton.setDepth(50)

    const menuBg = this.add.circle(0, 0, 14, 0x000000, 0.6)
    menuBg.setStrokeStyle(2, 0x666666)
    menuBg.setInteractive({ useHandCursor: true })
    this.menuButton.add(menuBg)

    const menuIcon = this.add.text(0, 0, '☰', {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5)
    this.menuButton.add(menuIcon)

    // Menu panel (hidden by default)
    this.menuPanel = this.add.container(width + 100, 60)
    this.menuPanel.setDepth(51)
    this.menuPanel.setAlpha(0)

    const panelBg = this.add.graphics()
    panelBg.fillStyle(0x111111, 0.95)
    panelBg.fillRoundedRect(-90, 0, 100, 160, 8)
    panelBg.lineStyle(2, 0x444444)
    panelBg.strokeRoundedRect(-90, 0, 100, 160, 8)
    this.menuPanel.add(panelBg)

    // Menu items
    const menuItems = [
      { icon: '⚡', label: 'Auto Level', key: 'autoLevel', y: 25 },
      { icon: '⏩', label: 'Auto Room', key: 'autoRoom', y: 60 },
      { icon: '↺', label: 'Reset', key: 'reset', y: 95 },
      { icon: '🚪', label: 'End Run', key: 'skip', y: 130 },
    ]

    menuItems.forEach(item => {
      const row = this.add.container(-40, item.y)

      const rowBg = this.add.rectangle(0, 0, 80, 28, 0x222222, 0)
      rowBg.setInteractive({ useHandCursor: true })
      row.add(rowBg)

      const icon = this.add.text(-30, 0, item.icon, { fontSize: '14px' }).setOrigin(0.5)
      row.add(icon)

      const label = this.add.text(5, 0, item.label, {
        fontSize: '11px',
        color: '#ffffff',
      }).setOrigin(0, 0.5)
      row.add(label)

      // Toggle indicators for auto options
      if (item.key === 'autoLevel' || item.key === 'autoRoom') {
        const isEnabled = item.key === 'autoLevel'
          ? saveManager.getAutoLevelUp()
          : saveManager.getAutoRoomAdvance()
        const indicator = this.add.circle(32, 0, 4, isEnabled ? 0x00ff88 : 0x444444)
        row.add(indicator)
        row.setData('indicator', indicator)
        row.setData('enabled', isEnabled)
      }

      // Hover effects
      rowBg.on('pointerover', () => rowBg.setFillStyle(0x333333, 1))
      rowBg.on('pointerout', () => rowBg.setFillStyle(0x222222, 0))

      // Click handlers
      rowBg.on('pointerdown', () => {
        this.handleMenuAction(item.key, row)
      })

      this.menuPanel.add(row)
    })

    // Menu button click handler
    menuBg.on('pointerdown', () => this.toggleMenu())
    menuBg.on('pointerover', () => menuBg.setStrokeStyle(2, 0x888888))
    menuBg.on('pointerout', () => menuBg.setStrokeStyle(2, 0x666666))

    // Close menu when clicking outside
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMenuOpen) {
        const menuBounds = new Phaser.Geom.Rectangle(width - 100, 50, 100, 170)
        const buttonBounds = new Phaser.Geom.Rectangle(width - 40, 14, 28, 28)
        if (!menuBounds.contains(pointer.x, pointer.y) && !buttonBounds.contains(pointer.x, pointer.y)) {
          this.closeMenu()
        }
      }
    })
  }

  private toggleMenu() {
    if (this.isMenuOpen) {
      this.closeMenu()
    } else {
      this.openMenu()
    }
  }

  private openMenu() {
    if (this.isMenuOpen) return
    this.isMenuOpen = true

    const width = this.cameras.main.width
    this.tweens.add({
      targets: this.menuPanel,
      x: width - 10,
      alpha: 1,
      duration: 150,
      ease: 'Power2.easeOut',
    })
  }

  private closeMenu() {
    if (!this.isMenuOpen) return
    this.isMenuOpen = false

    const width = this.cameras.main.width
    this.tweens.add({
      targets: this.menuPanel,
      x: width + 100,
      alpha: 0,
      duration: 150,
      ease: 'Power2.easeIn',
    })
  }

  private handleMenuAction(key: string, row: Phaser.GameObjects.Container) {
    switch (key) {
      case 'autoLevel': {
        const newState = saveManager.toggleAutoLevelUp()
        const indicator = row.getData('indicator') as Phaser.GameObjects.Arc
        indicator.setFillStyle(newState ? 0x00ff88 : 0x444444)
        row.setData('enabled', newState)
        break
      }
      case 'autoRoom': {
        const newState = saveManager.toggleAutoRoomAdvance()
        const indicator = row.getData('indicator') as Phaser.GameObjects.Arc
        indicator.setFillStyle(newState ? 0x00ff88 : 0x444444)
        row.setData('enabled', newState)
        break
      }
      case 'reset':
        this.game.events.emit('resetLevel')
        this.closeMenu()
        break
      case 'skip':
        this.game.events.emit('skipRun')
        this.closeMenu()
        break
    }
  }

  /**
   * Create skills bar at the bottom
   */
  private createSkillsBar(height: number) {
    this.skillsContainer = this.add.container(10, height - 45)
    this.skillsContainer.setDepth(10)
    this.hudContainer.add(this.skillsContainer)
  }

  /**
   * Create boss health bar (hidden by default)
   */
  private createBossHealthBar(width: number, height: number) {
    const barWidth = width - 40
    const barHeight = 12
    const yPos = height - 55

    this.bossHealthContainer = this.add.container(0, 0)

    // Background
    this.bossHealthBarBg = this.add.graphics()
    this.bossHealthBarBg.fillStyle(0x000000, 0.7)
    this.bossHealthBarBg.fillRoundedRect(20, yPos, barWidth, barHeight, 4)
    this.bossHealthContainer.add(this.bossHealthBarBg)

    // Health bar
    this.bossHealthBar = this.add.graphics()
    this.bossHealthContainer.add(this.bossHealthBar)

    // Boss name
    this.bossNameText = this.add.text(width / 2, yPos - 14, 'BOSS', {
      fontSize: '12px',
      color: '#ff4444',
      fontStyle: 'bold',
    })
    this.bossNameText.setOrigin(0.5, 0.5)
    this.bossNameText.setStroke('#000000', 2)
    this.bossHealthContainer.add(this.bossNameText)

    this.bossHealthContainer.setVisible(false)
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners() {
    // Health updates
    this.events.on('updateHealth', (currentHealth: number, maxHealth: number) => {
      const percentage = (currentHealth / maxHealth) * 100
      this.updateHealthBar(percentage, currentHealth, maxHealth)
    })

    // XP updates
    this.events.on('updateXP', (xpPercentage: number, level: number) => {
      this.updateXPBar(xpPercentage)
      this.updateLevel(level)
    })

    // Room updates
    this.events.on('updateRoom', (currentRoom: number, totalRooms: number, endlessWave?: number) => {
      this.updateRoomCounter(currentRoom, totalRooms, endlessWave)
    })

    // Boss health events
    this.events.on('showBossHealth', (health: number, maxHealth: number) => {
      this.showBossHealthBar(health, maxHealth)
    })
    this.events.on('updateBossHealth', (health: number, maxHealth: number) => {
      this.updateBossHealthBar(health, maxHealth)
    })
    this.events.on('hideBossHealth', () => {
      this.hideBossHealthBar()
    })

    // HUD visibility
    this.events.on('roomCleared', () => this.fadeOutHUD())
    this.events.on('roomEntered', () => this.fadeInHUD())

    // Auto level up notifications
    this.events.on('showAutoLevelUp', (ability: AbilityData) => {
      this.queueNotification(ability)
    })
    this.events.on('showAutoLevelUpDouble', (ability1: AbilityData, ability2: AbilityData) => {
      this.queueNotification(ability1, true, ability2)
    })

    // Abilities update
    this.events.on('updateAbilities', (abilities: AcquiredAbility[]) => {
      this.updateSkillsBar(abilities)
    })
  }

  update() {
    // Update FPS counter (debug only)
    if (this.fpsText) {
      const fps = Math.round(this.game.loop.actualFps)
      this.fpsText.setText(`${fps}`)
      this.fpsText.setColor(fps >= 55 ? '#00ff00' : fps >= 30 ? '#ffff00' : '#ff0000')
    }
  }

  updateHealthBar(percentage: number, currentHealth: number, _maxHealth: number) {
    const healthX = 16
    const healthY = 16
    const healthWidth = 120
    const healthHeight = 14

    this.healthBar.clear()

    const colors = themeManager.getColors()
    let color = colors.healthFull
    if (percentage < 50) color = colors.healthMid
    if (percentage < 25) color = colors.healthLow

    this.healthBar.fillStyle(color, 1)
    const fillWidth = Math.max(0, (percentage / 100) * (healthWidth - 4))
    this.healthBar.fillRoundedRect(healthX + 2, healthY + 2, fillWidth, healthHeight - 4, 3)

    this.healthText.setText(`${Math.ceil(currentHealth)}`)
  }

  updateRoomCounter(currentRoom: number, totalRooms: number, endlessWave?: number) {
    if (endlessWave !== undefined) {
      this.roomText.setText(`Wave ${endlessWave} • ${currentRoom}/${totalRooms}`)
    } else {
      this.roomText.setText(`${currentRoom}/${totalRooms}`)
    }
  }

  updateXPBar(percentage: number) {
    const xpBarWidth = 40
    const xpBarHeight = 4

    this.xpBar.clear()
    const colors = themeManager.getColors()
    this.xpBar.fillStyle(colors.xpBar, 1)
    const fillWidth = Math.max(0, (percentage / 100) * xpBarWidth)
    this.xpBar.fillRoundedRect(-xpBarWidth / 2, 8, fillWidth, xpBarHeight, 2)
  }

  updateLevel(level: number) {
    this.levelText.setText(`Lv.${level}`)
  }

  private fadeOutHUD(): void {
    if (!this.isHudVisible) return
    this.isHudVisible = false
    this.tweens.add({
      targets: this.hudContainer,
      alpha: 0,
      duration: 300,
      ease: 'Power2.easeOut',
    })
  }

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

  private showBossHealthBar(health: number, maxHealth: number) {
    this.bossHealthContainer.setVisible(true)
    this.updateBossHealthBar(health, maxHealth)
  }

  private updateBossHealthBar(health: number, maxHealth: number) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const barWidth = width - 44
    const barHeight = 8
    const yPos = height - 53

    const percentage = Math.max(0, health / maxHealth)
    const colors = themeManager.getColors()

    this.bossHealthBar.clear()
    this.bossHealthBar.fillStyle(colors.bossHealth, 1)
    this.bossHealthBar.fillRoundedRect(22, yPos, barWidth * percentage, barHeight, 3)
  }

  private hideBossHealthBar() {
    if (this.bossHealthContainer) {
      this.bossHealthContainer.setVisible(false)
    }
  }

  /**
   * Queue a notification to show
   */
  private queueNotification(ability: AbilityData, isDouble?: boolean, ability2?: AbilityData) {
    this.notificationQueue.push({ ability, isDouble, ability2 })
    this.processNotificationQueue()
  }

  /**
   * Process notification queue
   */
  private processNotificationQueue() {
    if (this.isShowingNotification || this.notificationQueue.length === 0) return
    this.isShowingNotification = true

    const notification = this.notificationQueue.shift()!
    this.showNotification(notification.ability, notification.isDouble, notification.ability2)
  }

  /**
   * Show a compact notification toast
   */
  private showNotification(ability: AbilityData, isDouble?: boolean, ability2?: AbilityData) {
    // Clear existing notifications
    this.notificationContainer.removeAll(true)

    const panelWidth = isDouble ? 160 : 140
    const panelHeight = isDouble ? 50 : 36

    // Background
    const bg = this.add.graphics()
    bg.fillStyle(0x000000, 0.85)
    bg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 6)
    bg.lineStyle(2, isDouble ? 0xffd700 : ability.color, 1)
    bg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 6)
    this.notificationContainer.add(bg)

    if (isDouble && ability2) {
      // Double bonus notification
      const bonusLabel = this.add.text(0, -14, '2× BONUS', {
        fontSize: '10px',
        color: '#ffd700',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      this.notificationContainer.add(bonusLabel)

      // First ability icon + name
      if (this.textures.exists(ability.iconKey)) {
        const icon1 = this.add.image(-panelWidth / 2 + 20, 4, ability.iconKey)
        icon1.setDisplaySize(20, 20)
        this.notificationContainer.add(icon1)
      }
      const name1 = this.add.text(-10, 4, ability.name, {
        fontSize: '10px',
        color: '#ffffff',
      }).setOrigin(0, 0.5)
      this.notificationContainer.add(name1)

      // Second ability icon + name
      if (this.textures.exists(ability2.iconKey)) {
        const icon2 = this.add.image(-panelWidth / 2 + 20, 20, ability2.iconKey)
        icon2.setDisplaySize(20, 20)
        this.notificationContainer.add(icon2)
      }
      const name2 = this.add.text(-10, 20, ability2.name, {
        fontSize: '10px',
        color: '#ffffff',
      }).setOrigin(0, 0.5)
      this.notificationContainer.add(name2)
    } else {
      // Single ability notification
      if (this.textures.exists(ability.iconKey)) {
        const icon = this.add.image(-panelWidth / 2 + 22, 0, ability.iconKey)
        icon.setDisplaySize(24, 24)
        this.notificationContainer.add(icon)
      }

      const name = this.add.text(0, 0, ability.name, {
        fontSize: '12px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5)
      this.notificationContainer.add(name)
    }

    // Animate in
    this.notificationContainer.setAlpha(0)
    this.notificationContainer.setY(50)

    this.tweens.add({
      targets: this.notificationContainer,
      alpha: 1,
      y: 70,
      duration: 150,
      ease: 'Power2.easeOut',
      onComplete: () => {
        // Hold then fade out
        this.time.delayedCall(isDouble ? 1500 : 1000, () => {
          this.tweens.add({
            targets: this.notificationContainer,
            alpha: 0,
            y: 50,
            duration: 200,
            ease: 'Power2.easeIn',
            onComplete: () => {
              this.isShowingNotification = false
              this.processNotificationQueue()
            },
          })
        })
      },
    })
  }

  /**
   * Update skills bar with acquired abilities
   */
  private updateSkillsBar(abilities: AcquiredAbility[]) {
    this.skillsContainer.removeAll(true)

    const iconSize = 22
    const iconSpacing = 26
    const maxDisplay = 12

    abilities.slice(0, maxDisplay).forEach((acquired, index) => {
      const abilityData = ABILITIES.find(a => a.id === acquired.id)
      if (!abilityData) return

      const x = index * iconSpacing

      // Icon background
      const iconBg = this.add.graphics()
      iconBg.fillStyle(0x000000, 0.6)
      iconBg.fillRoundedRect(x - iconSize / 2, -iconSize / 2, iconSize, iconSize, 4)
      iconBg.lineStyle(1, abilityData.color, 0.8)
      iconBg.strokeRoundedRect(x - iconSize / 2, -iconSize / 2, iconSize, iconSize, 4)
      this.skillsContainer.add(iconBg)

      // Icon
      if (this.textures.exists(abilityData.iconKey)) {
        const icon = this.add.image(x, 0, abilityData.iconKey)
        icon.setDisplaySize(iconSize - 4, iconSize - 4)
        this.skillsContainer.add(icon)
      }

      // Level badge (only if > 1)
      if (acquired.level > 1) {
        const badgeX = x + iconSize / 2 - 5
        const badgeY = iconSize / 2 - 5
        const badge = this.add.circle(badgeX, badgeY, 6, 0x000000, 0.9)
        badge.setStrokeStyle(1, abilityData.color)
        this.skillsContainer.add(badge)

        const levelNum = this.add.text(badgeX, badgeY, `${acquired.level}`, {
          fontSize: '8px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5)
        this.skillsContainer.add(levelNum)
      }
    })

    // Overflow indicator
    if (abilities.length > maxDisplay) {
      const moreText = this.add.text(maxDisplay * iconSpacing, 0, `+${abilities.length - maxDisplay}`, {
        fontSize: '11px',
        color: '#888888',
      }).setOrigin(0, 0.5)
      this.skillsContainer.add(moreText)
    }
  }

  shutdown() {
    this.events.off('updateHealth')
    this.events.off('updateXP')
    this.events.off('updateRoom')
    this.events.off('showBossHealth')
    this.events.off('updateBossHealth')
    this.events.off('hideBossHealth')
    this.events.off('roomCleared')
    this.events.off('roomEntered')
    this.events.off('showAutoLevelUp')
    this.events.off('showAutoLevelUpDouble')
    this.events.off('updateAbilities')
  }
}
