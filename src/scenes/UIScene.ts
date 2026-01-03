import Phaser from 'phaser'
import { saveManager } from '../systems/SaveManager'
import { themeManager } from '../systems/ThemeManager'
import { ABILITIES, type AbilityData } from './LevelUpScene'

interface AcquiredAbility {
  id: string
  level: number
}

export default class UIScene extends Phaser.Scene {
  private healthBar!: Phaser.GameObjects.Graphics
  private healthBarBg!: Phaser.GameObjects.Graphics
  private healthText!: Phaser.GameObjects.Text
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

  // Auto level up toggle
  private autoLevelUpToggle!: Phaser.GameObjects.Container
  private autoLevelUpIcon!: Phaser.GameObjects.Text

  // Auto room advance toggle
  private autoRoomAdvanceToggle!: Phaser.GameObjects.Container
  private autoRoomAdvanceIcon!: Phaser.GameObjects.Text

  // Reset level button (always visible)
  private resetLevelButton!: Phaser.GameObjects.Container
  private resetLevelText!: Phaser.GameObjects.Text

  // Skills bar (shows acquired abilities)
  private skillsContainer!: Phaser.GameObjects.Container

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
    this.hudContainer.add(this.healthBar)

    // Health text (displayed on the health bar)
    this.healthText = this.add.text(112, 22, '100/100', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    })
    this.healthText.setOrigin(0.5)
    this.healthText.setStroke('#000000', 2)
    this.hudContainer.add(this.healthText)

    // Initialize health bar display (must be after healthText is created)
    this.updateHealthBar(100, 100, 100)

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
    this.events.on('updateHealth', (currentHealth: number, maxHealth: number) => {
      const percentage = (currentHealth / maxHealth) * 100
      this.updateHealthBar(percentage, currentHealth, maxHealth)
    })

    // Listen for XP updates from GameScene
    this.events.on('updateXP', (xpPercentage: number, level: number) => {
      this.updateXPBar(xpPercentage)
      this.updateLevel(level)
      this.updateResetLevelText(level)
    })

    // Listen for room updates from GameScene
    this.events.on('updateRoom', (currentRoom: number, totalRooms: number, endlessWave?: number) => {
      this.updateRoomCounter(currentRoom, totalRooms, endlessWave)
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

    // Listen for auto level up notifications
    this.events.on('showAutoLevelUp', (ability: AbilityData) => {
      this.showAutoLevelUpNotification(ability)
    })

    // Listen for double bonus auto level up notifications
    this.events.on('showAutoLevelUpDouble', (ability1: AbilityData, ability2: AbilityData) => {
      this.showDoubleAutoLevelUpNotification(ability1, ability2)
    })

    // Listen for abilities update
    this.events.on('updateAbilities', (abilities: AcquiredAbility[]) => {
      this.updateSkillsBar(abilities)
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

    // Create auto level up toggle button
    this.createAutoLevelUpToggle()

    // Create auto room advance toggle button
    this.createAutoRoomAdvanceToggle()

    // Create reset level button
    this.createResetLevelButton()

    // Create skills bar container
    this.createSkillsBar()

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

    const colors = themeManager.getColors()
    this.bossHealthBar.clear()
    this.bossHealthBar.fillStyle(colors.bossHealth, 1)
    this.bossHealthBar.fillRect(22, yPos, barWidth * percentage, barHeight)
  }

  private hideBossHealthBar() {
    if (this.bossHealthContainer) {
      this.bossHealthContainer.setVisible(false)
    }
  }

  updateHealthBar(percentage: number, currentHealth: number, maxHealth: number) {
    this.healthBar.clear()

    // Health bar color based on percentage - use theme colors
    const colors = themeManager.getColors()
    let color = colors.healthFull
    if (percentage < 50) color = colors.healthMid
    if (percentage < 25) color = colors.healthLow

    this.healthBar.fillStyle(color, 1)
    this.healthBar.fillRect(12, 12, percentage * 2, 20)

    // Update health text
    this.healthText.setText(`${Math.ceil(currentHealth)}/${Math.ceil(maxHealth)}`)
  }

  updateRoomCounter(currentRoom: number, totalRooms: number, endlessWave?: number) {
    if (endlessWave !== undefined) {
      // Endless mode: show wave number and room
      this.roomText.setText(`Wave ${endlessWave} - ${currentRoom}/${totalRooms}`)
    } else {
      this.roomText.setText(`Room ${currentRoom}/${totalRooms}`)
    }
  }

  updateXPBar(percentage: number) {
    this.xpBar.clear()
    const colors = themeManager.getColors()
    this.xpBar.fillStyle(colors.xpBar, 1)
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
      alpha: 0,
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

  /**
   * Create auto level up toggle button in top right corner
   */
  private createAutoLevelUpToggle(): void {
    const width = this.cameras.main.width
    const isEnabled = saveManager.getAutoLevelUp()

    // Create toggle container
    this.autoLevelUpToggle = this.add.container(width - 30, 60)
    this.autoLevelUpToggle.setDepth(50)

    // Background circle
    const bg = this.add.circle(0, 0, 18, 0x000000, 0.6)
    bg.setStrokeStyle(2, isEnabled ? 0x00ff88 : 0x666666)
    bg.setInteractive({ useHandCursor: true })
    this.autoLevelUpToggle.add(bg)

    // Lightning icon to represent auto/fast mode
    this.autoLevelUpIcon = this.add.text(0, 0, '⚡', {
      fontSize: '18px',
    }).setOrigin(0.5)
    this.autoLevelUpIcon.setAlpha(isEnabled ? 1 : 0.4)
    this.autoLevelUpToggle.add(this.autoLevelUpIcon)

    // Click handler to toggle
    bg.on('pointerdown', () => {
      const newState = saveManager.toggleAutoLevelUp()
      this.updateAutoLevelUpToggle(newState)
      console.log('UIScene: Auto level up toggled to', newState)
    })

    // Hover effects
    bg.on('pointerover', () => {
      bg.setScale(1.1)
    })
    bg.on('pointerout', () => {
      bg.setScale(1)
    })
  }

  /**
   * Create reset level button that allows restarting with all upgrades
   */
  private createResetLevelButton(): void {
    const width = this.cameras.main.width

    // Create button container in top-right area (below auto-level toggle)
    this.resetLevelButton = this.add.container(width - 45, 100)
    this.resetLevelButton.setDepth(50)

    // Background rectangle (visual only)
    const bg = this.add.rectangle(0, 0, 70, 36, 0x000000, 0.7)
    bg.setStrokeStyle(2, 0x00aaff)
    this.resetLevelButton.add(bg)

    // Reset icon (circular arrow symbol)
    const icon = this.add.text(-22, 0, '↺', {
      fontSize: '18px',
      color: '#00aaff',
    }).setOrigin(0.5)
    this.resetLevelButton.add(icon)

    // Text showing current level
    this.resetLevelText = this.add.text(12, 0, 'Lv.1', {
      fontSize: '12px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.resetLevelButton.add(this.resetLevelText)

    // Make container interactive with explicit hit area (required for Phaser containers)
    this.resetLevelButton.setInteractive(
      new Phaser.Geom.Rectangle(-35, -18, 70, 36),
      Phaser.Geom.Rectangle.Contains
    )
    this.resetLevelButton.input!.cursor = 'pointer'

    // Click handler to reset level
    this.resetLevelButton.on('pointerdown', () => {
      console.log('UIScene: Reset level button pressed')
      this.game.events.emit('resetLevel')

      // Brief press animation
      this.tweens.add({
        targets: this.resetLevelButton,
        scale: { from: 0.9, to: 1 },
        duration: 100,
        ease: 'Power2.easeOut',
      })
    })

    // Hover effects
    this.resetLevelButton.on('pointerover', () => {
      bg.setFillStyle(0x002244, 0.9)
      bg.setStrokeStyle(2, 0x00ccff)
    })

    this.resetLevelButton.on('pointerout', () => {
      bg.setFillStyle(0x000000, 0.7)
      bg.setStrokeStyle(2, 0x00aaff)
    })
  }

  /**
   * Update the reset level button text with current level
   */
  private updateResetLevelText(level: number): void {
    if (this.resetLevelText) {
      this.resetLevelText.setText(`Lv.${level}`)
    }
  }

  /**
   * Update toggle visual state
   */
  private updateAutoLevelUpToggle(enabled: boolean): void {
    const bg = this.autoLevelUpToggle.getAt(0) as Phaser.GameObjects.Arc
    bg.setStrokeStyle(2, enabled ? 0x00ff88 : 0x666666)
    this.autoLevelUpIcon.setAlpha(enabled ? 1 : 0.4)

    // Brief flash animation
    this.tweens.add({
      targets: this.autoLevelUpToggle,
      scale: { from: 1.2, to: 1 },
      duration: 150,
      ease: 'Power2.easeOut',
    })
  }

  /**
   * Create auto room advance toggle button (next to auto level up)
   */
  private createAutoRoomAdvanceToggle(): void {
    const width = this.cameras.main.width
    const isEnabled = saveManager.getAutoRoomAdvance()

    // Create toggle container (to the left of auto level up toggle)
    this.autoRoomAdvanceToggle = this.add.container(width - 70, 60)
    this.autoRoomAdvanceToggle.setDepth(50)

    // Background circle
    const bg = this.add.circle(0, 0, 18, 0x000000, 0.6)
    bg.setStrokeStyle(2, isEnabled ? 0x00ff88 : 0x666666)
    bg.setInteractive({ useHandCursor: true })
    this.autoRoomAdvanceToggle.add(bg)

    // Door/skip icon to represent auto room advance
    this.autoRoomAdvanceIcon = this.add.text(0, 0, '⏩', {
      fontSize: '16px',
    }).setOrigin(0.5)
    this.autoRoomAdvanceIcon.setAlpha(isEnabled ? 1 : 0.4)
    this.autoRoomAdvanceToggle.add(this.autoRoomAdvanceIcon)

    // Click handler to toggle
    bg.on('pointerdown', () => {
      const newState = saveManager.toggleAutoRoomAdvance()
      this.updateAutoRoomAdvanceToggle(newState)
      console.log('UIScene: Auto room advance toggled to', newState)
    })

    // Hover effects
    bg.on('pointerover', () => {
      bg.setScale(1.1)
    })
    bg.on('pointerout', () => {
      bg.setScale(1)
    })
  }

  /**
   * Update auto room advance toggle visual state
   */
  private updateAutoRoomAdvanceToggle(enabled: boolean): void {
    const bg = this.autoRoomAdvanceToggle.getAt(0) as Phaser.GameObjects.Arc
    bg.setStrokeStyle(2, enabled ? 0x00ff88 : 0x666666)
    this.autoRoomAdvanceIcon.setAlpha(enabled ? 1 : 0.4)

    // Brief flash animation
    this.tweens.add({
      targets: this.autoRoomAdvanceToggle,
      scale: { from: 1.2, to: 1 },
      duration: 150,
      ease: 'Power2.easeOut',
    })
  }

  /**
   * Show notification when auto level up selects an ability
   */
  private showAutoLevelUpNotification(ability: AbilityData): void {
    const width = this.cameras.main.width

    // Create notification container at center-top of screen
    const container = this.add.container(width / 2, 120)
    container.setDepth(100)
    container.setAlpha(0)
    container.setScale(0.8)

    // Background panel
    const panelWidth = 220
    const panelHeight = 60
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.85)
    panel.setStrokeStyle(2, ability.color)
    container.add(panel)

    // Ability icon on the left
    const iconX = -panelWidth / 2 + 30
    if (this.textures.exists(ability.iconKey)) {
      const icon = this.add.image(iconX, 0, ability.iconKey)
      icon.setDisplaySize(36, 36)
      container.add(icon)
    }

    // Text content offset to the right of the icon
    const textOffsetX = 15

    // "AUTO" label
    const autoLabel = this.add.text(textOffsetX, -18, 'AUTO', {
      fontSize: '10px',
      color: '#888888',
    }).setOrigin(0.5)
    container.add(autoLabel)

    // Ability name
    const abilityName = this.add.text(textOffsetX, 2, ability.name, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    container.add(abilityName)

    // Description
    const desc = this.add.text(textOffsetX, 20, ability.description, {
      fontSize: '11px',
      color: '#aaaaaa',
    }).setOrigin(0.5)
    container.add(desc)

    // Animate in
    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1,
      y: 130,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Hold for a moment then fade out
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            y: 100,
            duration: 300,
            ease: 'Power2.easeIn',
            onComplete: () => {
              container.destroy()
            },
          })
        })
      },
    })
  }

  /**
   * Show special notification when auto level up grants TWO abilities (5% bonus)
   */
  private showDoubleAutoLevelUpNotification(ability1: AbilityData, ability2: AbilityData): void {
    const width = this.cameras.main.width

    // Create notification container at center-top of screen
    const container = this.add.container(width / 2, 120)
    container.setDepth(100)
    container.setAlpha(0)
    container.setScale(0.8)

    // Taller background panel for two abilities
    const panelWidth = 240
    const panelHeight = 100
    const panel = this.add.rectangle(0, 0, panelWidth, panelHeight, 0x000000, 0.9)
    panel.setStrokeStyle(3, 0xffd700) // Gold border
    container.add(panel)

    // "2x BONUS!" label at top in gold
    const bonusLabel = this.add.text(0, -38, '2x BONUS!', {
      fontSize: '14px',
      color: '#ffd700',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    container.add(bonusLabel)

    // First ability row
    const row1Y = -10
    const iconSize = 28
    const iconX = -panelWidth / 2 + 30

    if (this.textures.exists(ability1.iconKey)) {
      const icon1 = this.add.image(iconX, row1Y, ability1.iconKey)
      icon1.setDisplaySize(iconSize, iconSize)
      container.add(icon1)
    }

    const name1 = this.add.text(15, row1Y, ability1.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    container.add(name1)

    // Second ability row
    const row2Y = 22

    if (this.textures.exists(ability2.iconKey)) {
      const icon2 = this.add.image(iconX, row2Y, ability2.iconKey)
      icon2.setDisplaySize(iconSize, iconSize)
      container.add(icon2)
    }

    const name2 = this.add.text(15, row2Y, ability2.name, {
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    container.add(name2)

    // Animate in with celebratory bounce
    this.tweens.add({
      targets: container,
      alpha: 1,
      scale: 1.05,
      y: 135,
      duration: 250,
      ease: 'Back.easeOut',
      onComplete: () => {
        // Pulse effect for celebration
        this.tweens.add({
          targets: container,
          scale: 1,
          duration: 150,
          ease: 'Power2.easeOut',
          onComplete: () => {
            // Hold longer for double bonus, then fade out
            this.time.delayedCall(1800, () => {
              this.tweens.add({
                targets: container,
                alpha: 0,
                y: 100,
                duration: 300,
                ease: 'Power2.easeIn',
                onComplete: () => {
                  container.destroy()
                },
              })
            })
          },
        })
      },
    })
  }

  /**
   * Create the skills bar container
   */
  private createSkillsBar(): void {
    // Position below level text, aligned to left
    this.skillsContainer = this.add.container(10, 65)
    this.skillsContainer.setDepth(10)
    this.hudContainer.add(this.skillsContainer)
  }

  /**
   * Update the skills bar when abilities are acquired
   */
  private updateSkillsBar(abilities: AcquiredAbility[]): void {
    // Clear existing skill icons
    this.skillsContainer.removeAll(true)

    // Display skills in a horizontal row
    const iconSize = 24
    const iconSpacing = 28
    const maxDisplay = 10 // Max skills to display in a row

    abilities.slice(0, maxDisplay).forEach((acquired, index) => {
      // Find the ability data
      const abilityData = ABILITIES.find(a => a.id === acquired.id)
      if (!abilityData) return

      const x = index * iconSpacing

      // Skill icon background (colored border)
      const iconBg = this.add.rectangle(x, 0, iconSize + 2, iconSize + 2, 0x111111)
      iconBg.setStrokeStyle(1, abilityData.color)
      this.skillsContainer.add(iconBg)

      // Skill icon
      if (this.textures.exists(abilityData.iconKey)) {
        const icon = this.add.image(x, 0, abilityData.iconKey)
        icon.setDisplaySize(iconSize, iconSize)
        this.skillsContainer.add(icon)
      } else {
        // Fallback: colored circle
        const circle = this.add.circle(x, 0, iconSize / 2 - 2, abilityData.color)
        this.skillsContainer.add(circle)
      }

      // Level badge (bottom-right corner) if level > 1
      if (acquired.level > 1) {
        const badgeX = x + iconSize / 2 - 4
        const badgeY = iconSize / 2 - 4

        // Badge background
        const badge = this.add.circle(badgeX, badgeY, 7, 0x000000, 0.9)
        this.skillsContainer.add(badge)

        // Level number
        const levelText = this.add.text(badgeX, badgeY, `${acquired.level}`, {
          fontSize: '9px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5)
        this.skillsContainer.add(levelText)
      }
    })

    // Show overflow indicator if more skills
    if (abilities.length > maxDisplay) {
      const moreText = this.add.text(maxDisplay * iconSpacing, 0, `+${abilities.length - maxDisplay}`, {
        fontSize: '12px',
        color: '#888888',
      }).setOrigin(0, 0.5)
      this.skillsContainer.add(moreText)
    }
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
    this.events.off('showAutoLevelUp')
    this.events.off('showAutoLevelUpDouble')
    this.events.off('updateAbilities')
  }
}
