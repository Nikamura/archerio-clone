import Phaser from 'phaser'
import Player from '../entities/Player'
import Enemy from '../entities/Enemy'
import RangedShooterEnemy from '../entities/RangedShooterEnemy'
import SpreaderEnemy from '../entities/SpreaderEnemy'
import Boss from '../entities/Boss'
import Bullet from '../entities/Bullet'
import Joystick from '../ui/Joystick'
import BulletPool from '../systems/BulletPool'
import EnemyBulletPool from '../systems/EnemyBulletPool'

export default class GameScene extends Phaser.Scene {
  private player!: Player
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private joystick!: Joystick
  private joystickAngle: number = 0
  private joystickForce: number = 0

  private bulletPool!: BulletPool
  private enemyBulletPool!: EnemyBulletPool
  private enemies!: Phaser.Physics.Arcade.Group
  private lastShotTime: number = 0
  private fireRate: number = 500 // ms between shots

  // Game state tracking
  private isGameOver: boolean = false
  private enemiesKilled: number = 0
  private currentRoom: number = 1
  private readonly totalRooms: number = 10
  private isRoomCleared: boolean = false
  private doorSprite: Phaser.GameObjects.Sprite | null = null
  private doorText: Phaser.GameObjects.Text | null = null
  private isTransitioning: boolean = false
  private boss: Boss | null = null

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    // Reset game state
    this.isGameOver = false
    this.enemiesKilled = 0
    this.currentRoom = 1
    this.isRoomCleared = false
    this.doorSprite = null
    this.doorText = null
    this.isTransitioning = false

    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Add background image
    const bg = this.add.image(0, 0, 'dungeonFloor').setOrigin(0)
    bg.setDisplaySize(width, height)

    // Create player in center
    this.player = new Player(this, width / 2, height / 2)

    // Create bullet pools
    this.bulletPool = new BulletPool(this)
    this.enemyBulletPool = new EnemyBulletPool(this)

    // Create enemy physics group
    this.enemies = this.physics.add.group()
    this.spawnEnemies()

    // Set up collisions
    this.physics.add.overlap(
      this.bulletPool,
      this.enemies,
      this.bulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Enemy bullets hit player
    this.physics.add.overlap(
      this.player,
      this.enemyBulletPool,
      this.enemyBulletHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Enemies hit player (melee damage)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.enemyHitPlayer as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Keyboard controls for desktop testing
    this.cursors = this.input.keyboard!.createCursorKeys()

    // Create virtual joystick
    this.joystick = new Joystick(this)
    const gameContainer = this.game.canvas.parentElement
    if (gameContainer) {
      this.joystick.create(gameContainer)

      // Set joystick callbacks
      this.joystick.setOnMove((angle: number, force: number) => {
        this.joystickAngle = angle
        this.joystickForce = force
      })

      this.joystick.setOnEnd(() => {
        this.joystickForce = 0
      })
    }

    // Debug text
    const debugText = this.add.text(10, 50, '', {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000',
      padding: { x: 5, y: 5 },
    })

    // Update debug text every frame
    this.events.on('update', () => {
      const enemyCount = this.enemies.getChildren().length
      debugText.setText(
        `Arrow keys or touch to move\nStop to shoot!\nEnemies: ${enemyCount}`
      )
    })

    // Update UIScene with room info
    this.updateRoomUI()

    console.log('GameScene: Created')
  }

  private updateRoomUI() {
    this.scene.get('UIScene').events.emit('updateRoom', this.currentRoom, this.totalRooms)
  }

  private spawnDoor() {
    if (this.doorSprite) return

    const width = this.cameras.main.width

    // Create door at top center of the room
    const doorX = width / 2
    const doorY = 70

    // Create the door sprite directly (not in a container - containers break physics)
    // Portal image is 1408x768, scale to ~60px wide
    this.doorSprite = this.add.sprite(doorX, doorY, 'portal')
    const targetSize = 60
    const scale = targetSize / this.doorSprite.width
    this.doorSprite.setScale(scale)

    // Add physics body for collision detection
    this.physics.add.existing(this.doorSprite, true) // static body
    const doorBody = this.doorSprite.body as Phaser.Physics.Arcade.StaticBody
    // Set hitbox to match scaled size - offset to center the circle
    const hitboxRadius = 25
    const offsetX = (this.doorSprite.width * scale) / 2 - hitboxRadius
    const offsetY = (this.doorSprite.height * scale) / 2 - hitboxRadius
    doorBody.setCircle(hitboxRadius, offsetX, offsetY)

    // Add overlap with player - this is the key collision
    this.physics.add.overlap(
      this.player,
      this.doorSprite,
      this.enterDoor as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this
    )

    // Add "ENTER" text below door
    this.doorText = this.add.text(doorX, doorY + 45, 'ENTER', {
      fontSize: '12px',
      color: '#00ff88',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    // Glow animation - pulse scale and alpha
    this.tweens.add({
      targets: this.doorSprite,
      scale: { from: scale * 0.9, to: scale * 1.1 },
      alpha: { from: 0.8, to: 1 },
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })

    // Text pulse animation
    this.tweens.add({
      targets: this.doorText,
      alpha: { from: 0.6, to: 1 },
      duration: 400,
      yoyo: true,
      repeat: -1,
    })

    console.log('Door spawned at', doorX, doorY)
  }

  private enterDoor() {
    if (this.isTransitioning || this.isGameOver) return

    this.isTransitioning = true
    console.log('Entering door to room', this.currentRoom + 1)

    // Fade out
    this.cameras.main.fadeOut(300, 0, 0, 0)

    this.time.delayedCall(300, () => {
      this.transitionToNextRoom()
    })
  }

  private transitionToNextRoom() {
    this.currentRoom++

    // Check for victory
    if (this.currentRoom > this.totalRooms) {
      this.triggerVictory()
      return
    }

    // Clean up current room
    this.cleanupRoom()

    // Spawn new enemies
    this.spawnEnemiesForRoom()

    // Reset room state
    this.isRoomCleared = false
    this.isTransitioning = false

    // Update UI
    this.updateRoomUI()

    // Fade back in
    this.cameras.main.fadeIn(300, 0, 0, 0)

    console.log('Entered room', this.currentRoom)
  }

  private cleanupRoom() {
    // Destroy door
    if (this.doorSprite) {
      this.doorSprite.destroy()
      this.doorSprite = null
    }
    if (this.doorText) {
      this.doorText.destroy()
      this.doorText = null
    }

    // Reset boss state
    this.boss = null
    this.scene.get('UIScene').events.emit('hideBossHealth')

    // Destroy all enemies
    this.enemies.clear(true, true)

    // Clear all bullets
    this.bulletPool.clear(true, true)
    this.enemyBulletPool.clear(true, true)

    // Reset player position
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    this.player.setPosition(width / 2, height - 100)
    this.player.setVelocity(0, 0)
  }

  private spawnEnemiesForRoom() {
    // Room 10 is the boss room
    if (this.currentRoom === this.totalRooms) {
      this.spawnBoss()
      return
    }

    // Scale difficulty based on room number
    const baseEnemies = 4
    const additionalEnemies = Math.floor(this.currentRoom / 2)
    const totalEnemies = Math.min(baseEnemies + additionalEnemies, 10)

    // Generate enemy types based on room progress
    const enemyTypes: string[] = []
    for (let i = 0; i < totalEnemies; i++) {
      const roll = Math.random()
      if (this.currentRoom < 3) {
        // Early rooms: mostly melee
        enemyTypes.push(roll < 0.7 ? 'melee' : 'ranged')
      } else if (this.currentRoom < 6) {
        // Mid rooms: balanced
        if (roll < 0.4) enemyTypes.push('melee')
        else if (roll < 0.8) enemyTypes.push('ranged')
        else enemyTypes.push('spreader')
      } else {
        // Late rooms: more dangerous
        if (roll < 0.3) enemyTypes.push('melee')
        else if (roll < 0.6) enemyTypes.push('ranged')
        else enemyTypes.push('spreader')
      }
    }

    this.spawnEnemiesOfTypes(enemyTypes)
  }

  private spawnBoss() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Spawn boss at center-top of screen
    const bossX = width / 2
    const bossY = height / 3

    this.boss = new Boss(this, bossX, bossY, this.enemyBulletPool)
    this.add.existing(this.boss)
    this.physics.add.existing(this.boss)

    // Set up physics body for boss (larger hitbox)
    const body = this.boss.body as Phaser.Physics.Arcade.Body
    if (body) {
      body.setCircle(25, 7, 7) // Larger hitbox for boss
      body.setCollideWorldBounds(true)
    }

    this.enemies.add(this.boss)

    // Show boss health bar in UI
    this.scene.get('UIScene').events.emit('showBossHealth', this.boss.getHealth(), this.boss.getMaxHealth())

    console.log('Boss spawned at', bossX, bossY)
  }

  private checkRoomCleared() {
    if (this.isRoomCleared) return

    const enemyCount = this.enemies.getChildren().filter(e => e.active).length
    if (enemyCount === 0) {
      this.isRoomCleared = true
      console.log('Room', this.currentRoom, 'cleared!')

      // Show door after brief delay
      this.time.delayedCall(500, () => {
        if (!this.isGameOver) {
          this.spawnDoor()
        }
      })
    }
  }

  private triggerVictory() {
    this.isGameOver = true
    console.log('Victory! All rooms cleared!')

    // Clean up joystick
    if (this.joystick) {
      this.joystick.destroy()
    }

    // Brief delay before showing victory screen
    this.time.delayedCall(500, () => {
      // Stop UIScene
      this.scene.stop('UIScene')

      // Launch victory scene (reusing GameOverScene for now)
      this.scene.launch('GameOverScene', {
        roomsCleared: this.totalRooms,
        enemiesKilled: this.enemiesKilled,
        isVictory: true,
      })
    })
  }

  private spawnEnemies() {
    // Initial spawn for room 1
    const enemyTypes = ['melee', 'melee', 'ranged', 'ranged']
    this.spawnEnemiesOfTypes(enemyTypes)
  }

  private spawnEnemiesOfTypes(enemyTypes: string[]) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Create enemy textures first
    if (!this.textures.exists('enemy')) {
      const graphics = this.make.graphics({ x: 0, y: 0 }, false)
      graphics.fillStyle(0xff4444, 1)
      graphics.fillCircle(0, 0, 15)
      graphics.generateTexture('enemy', 30, 30)
      graphics.destroy()
    }

    let spawned = 0
    let attempts = 0
    const maxAttempts = 50

    while (spawned < enemyTypes.length && attempts < maxAttempts) {
      const x = Phaser.Math.Between(50, width - 50)
      const y = Phaser.Math.Between(80, height - 150)

      // Don't spawn too close to player
      if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) > 120) {
        const enemyType = enemyTypes[spawned]
        let enemy: Enemy

        switch (enemyType) {
          case 'ranged':
            enemy = new RangedShooterEnemy(this, x, y, this.enemyBulletPool)
            break
          case 'spreader':
            enemy = new SpreaderEnemy(this, x, y, this.enemyBulletPool)
            break
          default:
            enemy = new Enemy(this, x, y)
        }

        this.add.existing(enemy)
        this.physics.add.existing(enemy)

        // Set up physics body with smaller hitbox
        const body = enemy.body as Phaser.Physics.Arcade.Body
        if (body) {
          body.setCircle(10)
          body.setCollideWorldBounds(true)
        }

        this.enemies.add(enemy)
        spawned++
      }
      attempts++
    }

    console.log(`Room ${this.currentRoom}: Spawned ${spawned} enemies`)
  }

  private bulletHitEnemy(
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ) {
    if (this.isGameOver || this.isTransitioning) return

    const bulletSprite = bullet as Bullet
    const enemySprite = enemy as Enemy

    // Calculate damage based on bullet properties
    let damage = this.player.getDamage()

    // Check for critical hit
    if (bulletSprite.isCriticalHit()) {
      damage = this.player.getDamageWithCrit(true)
      // TODO: Show crit damage number (yellow/bigger)
    }

    // Apply piercing damage reduction if bullet has hit enemies before
    const hitCount = bulletSprite.getHitCount()
    if (hitCount > 0 && bulletSprite.getMaxPierces() > 0) {
      damage = this.player.getPiercingDamage(hitCount)
    }

    // Damage enemy
    const killed = enemySprite.takeDamage(damage)

    // Apply fire DOT if bullet has fire damage
    const fireDamage = bulletSprite.getFireDamage()
    if (fireDamage > 0 && !killed) {
      enemySprite.applyFireDamage(fireDamage, 2000) // 2 second burn
    }

    // Check if bullet should be deactivated or continue (piercing/ricochet)
    const shouldDeactivate = bulletSprite.onHit()

    // Handle ricochet - find nearest enemy and redirect
    if (!shouldDeactivate && bulletSprite.getBounceCount() < bulletSprite.getMaxBounces()) {
      const nearestEnemy = this.findNearestEnemyExcluding(bulletSprite.x, bulletSprite.y, enemySprite)
      if (nearestEnemy) {
        bulletSprite.redirectTo(nearestEnemy.x, nearestEnemy.y)
      } else {
        // No target for ricochet, deactivate
        bulletSprite.setActive(false)
        bulletSprite.setVisible(false)
      }
    } else if (shouldDeactivate) {
      // Deactivate bullet
      bulletSprite.setActive(false)
      bulletSprite.setVisible(false)
    }
    // else: bullet continues (piercing)

    // Update boss health bar if this is the boss
    const isBoss = this.boss && enemySprite === (this.boss as unknown as Enemy)
    if (isBoss && !killed) {
      this.scene.get('UIScene').events.emit('updateBossHealth', this.boss!.getHealth(), this.boss!.getMaxHealth())
    }

    if (killed) {
      // Track kill
      this.enemiesKilled++

      // Add XP to player (boss gives 10 XP)
      const xpGain = isBoss ? 10 : 1
      const leveledUp = this.player.addXP(xpGain)
      this.updateXPUI()

      if (leveledUp) {
        this.handleLevelUp()
      }

      // Clear boss reference if boss was killed
      if (isBoss) {
        this.boss = null
        this.scene.get('UIScene').events.emit('hideBossHealth')
      }

      // Remove enemy from group and destroy
      enemySprite.destroy()

      // Check if room is cleared
      this.checkRoomCleared()
    }
  }

  private updateXPUI() {
    const xpPercentage = this.player.getXPPercentage()
    const level = this.player.getLevel()
    this.scene.get('UIScene').events.emit('updateXP', xpPercentage, level)
  }

  private handleLevelUp() {
    console.log('GameScene: handleLevelUp called')
    
    // Pause game physics
    this.physics.pause()

    // Hide joystick so it doesn't block the UI
    if (this.joystick) {
      console.log('GameScene: hiding joystick')
      this.joystick.hide()
    }

    // Clean up any existing listeners to prevent multiple applications
    this.game.events.off('abilitySelected')

    // Listen for ability selection using global game events (more reliable than scene events)
    this.game.events.once('abilitySelected', (abilityId: string) => {
      console.log('GameScene: received abilitySelected', abilityId)
      try {
        this.applyAbility(abilityId)
        console.log('GameScene: resuming physics and showing joystick')
        this.physics.resume()
        if (this.joystick) {
          this.joystick.show()
        }
      } catch (error) {
        console.error('GameScene: Error applying ability:', error)
        this.physics.resume() // Resume anyway to prevent soft-lock
        if (this.joystick) {
          this.joystick.show()
        }
      }
    })

    // Launch level up scene with ability choices
    // Use launch instead of start to run in parallel
    if (this.scene.isActive('LevelUpScene')) {
      console.log('GameScene: LevelUpScene already active, restarting it')
      this.scene.stop('LevelUpScene')
    }
    
    this.scene.launch('LevelUpScene', {
      playerLevel: this.player.getLevel(),
    })
  }

  private applyAbility(abilityId: string) {
    switch (abilityId) {
      case 'front_arrow':
        this.player.addFrontArrow()
        break
      case 'multishot':
        this.player.addMultishot()
        break
      case 'attack_speed':
        this.player.addAttackSpeedBoost(0.25) // +25%
        break
      case 'attack_boost':
        this.player.addDamageBoost(0.30) // +30%
        break
      case 'piercing':
        this.player.addPiercing()
        break
      case 'ricochet':
        this.player.addRicochet()
        break
      case 'fire_damage':
        this.player.addFireDamage()
        break
      case 'crit_boost':
        this.player.addCritBoost()
        break
    }
    console.log(`Applied ability: ${abilityId}`)
  }

  private enemyBulletHitPlayer(
    player: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject
  ) {
    if (this.isGameOver) return

    const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite
    const playerSprite = player as Player

    // Deactivate bullet regardless of invincibility
    bulletSprite.setActive(false)
    bulletSprite.setVisible(false)

    // Try to damage player (respects invincibility)
    const damageTaken = playerSprite.takeDamage(10)
    if (!damageTaken) return

    // Update UI
    this.updatePlayerHealthUI(playerSprite)

    // Check for death
    if (playerSprite.getHealth() <= 0) {
      this.triggerGameOver()
      return
    }

    // Flash player during invincibility
    this.startInvincibilityFlash(playerSprite)

    console.log(`Player hit by bullet! Health: ${playerSprite.getHealth()}`)
  }

  private enemyHitPlayer(
    player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ) {
    if (this.isGameOver) return

    const playerSprite = player as Player
    const enemySprite = enemy as Enemy

    // Try to damage player (respects invincibility)
    const damageTaken = playerSprite.takeDamage(5)
    if (!damageTaken) return

    // Update UI
    this.updatePlayerHealthUI(playerSprite)

    // Check for death
    if (playerSprite.getHealth() <= 0) {
      this.triggerGameOver()
      return
    }

    // Flash player during invincibility
    this.startInvincibilityFlash(playerSprite)

    // Push player back slightly
    const angle = Phaser.Math.Angle.Between(
      enemySprite.x,
      enemySprite.y,
      playerSprite.x,
      playerSprite.y
    )
    const knockbackForce = 150
    playerSprite.setVelocity(
      Math.cos(angle) * knockbackForce,
      Math.sin(angle) * knockbackForce
    )

    console.log(`Player hit by enemy! Health: ${playerSprite.getHealth()}`)
  }

  private updatePlayerHealthUI(player: Player) {
    const healthPercentage = (player.getHealth() / player.getMaxHealth()) * 100

    // Emit event to UIScene
    this.scene.get('UIScene').events.emit('updateHealth', healthPercentage)
  }

  private startInvincibilityFlash(player: Player) {
    // Create flashing effect during invincibility
    let flashCount = 0
    const maxFlashes = 5
    const flashInterval = 100

    const flash = () => {
      if (flashCount >= maxFlashes || !player.active || !player.isPlayerInvincible()) {
        player.clearTint()
        player.setAlpha(1)
        return
      }

      // Alternate between red tint and transparent
      if (flashCount % 2 === 0) {
        player.setTint(0xff0000)
        player.setAlpha(0.7)
      } else {
        player.clearTint()
        player.setAlpha(1)
      }

      flashCount++
      this.time.delayedCall(flashInterval, flash)
    }

    flash()
  }

  private triggerGameOver() {
    if (this.isGameOver) return

    this.isGameOver = true
    console.log('Game Over! Enemies killed:', this.enemiesKilled)

    // Stop player movement
    this.player.setVelocity(0, 0)

    // Flash player red and fade out
    this.player.setTint(0xff0000)

    // Clean up joystick
    if (this.joystick) {
      this.joystick.destroy()
    }

    // Brief delay before showing game over screen
    this.time.delayedCall(500, () => {
      // Stop UIScene
      this.scene.stop('UIScene')

      // Launch game over scene with stats
      this.scene.launch('GameOverScene', {
        roomsCleared: this.currentRoom - 1,
        enemiesKilled: this.enemiesKilled,
      })
    })
  }

  private findNearestEnemy(): Enemy | null {
    let nearestEnemy: Enemy | null = null
    let nearestDistance = Infinity

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy
      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        e.x,
        e.y
      )

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = e
      }
    })

    return nearestEnemy
  }

  /**
   * Find nearest enemy to a position, excluding a specific enemy
   * Used for ricochet targeting
   */
  private findNearestEnemyExcluding(x: number, y: number, exclude: Enemy): Enemy | null {
    let nearestEnemy: Enemy | null = null
    let nearestDistance = Infinity

    this.enemies.getChildren().forEach((enemy) => {
      const e = enemy as Enemy

      // Skip the excluded enemy
      if (e === exclude) return

      const distance = Phaser.Math.Distance.Between(x, y, e.x, e.y)

      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestEnemy = e
      }
    })

    return nearestEnemy
  }

  private shootAtEnemy(enemy: Enemy) {
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      enemy.x,
      enemy.y
    )

    const bulletSpeed = 400

    // Gather ability options for bullets
    const bulletOptions = {
      maxPierces: this.player.getPiercingLevel(),
      maxBounces: this.player.getRicochetBounces(),
      fireDamage: this.player.getFireDamage(),
      isCrit: this.player.rollCrit(), // Roll crit for main projectile
    }

    // Main projectile
    this.bulletPool.spawn(this.player.x, this.player.y, angle, bulletSpeed, bulletOptions)

    // Front Arrow: Extra forward projectiles with slight spread
    const extraProjectiles = this.player.getExtraProjectiles()
    if (extraProjectiles > 0) {
      const spreadAngle = 0.1 // ~6 degrees spread between extra arrows
      for (let i = 0; i < extraProjectiles; i++) {
        // Alternate left and right
        const offset = ((i % 2 === 0 ? 1 : -1) * Math.ceil((i + 1) / 2)) * spreadAngle
        // Each extra projectile rolls its own crit
        const extraOptions = { ...bulletOptions, isCrit: this.player.rollCrit() }
        this.bulletPool.spawn(this.player.x, this.player.y, angle + offset, bulletSpeed, extraOptions)
      }
    }

    // Multishot: Side projectiles at 45 degrees
    const multishotCount = this.player.getMultishotCount()
    if (multishotCount > 0) {
      const sideAngle = Math.PI / 4 // 45 degrees
      for (let i = 0; i < multishotCount; i++) {
        // Add projectiles at increasing angles
        const angleOffset = sideAngle * (i + 1)
        // Each multishot projectile rolls its own crit
        const multishotOptions1 = { ...bulletOptions, isCrit: this.player.rollCrit() }
        const multishotOptions2 = { ...bulletOptions, isCrit: this.player.rollCrit() }
        this.bulletPool.spawn(this.player.x, this.player.y, angle + angleOffset, bulletSpeed, multishotOptions1)
        this.bulletPool.spawn(this.player.x, this.player.y, angle - angleOffset, bulletSpeed, multishotOptions2)
      }
    }

    this.lastShotTime = this.time.now
  }

  private getEffectiveFireRate(): number {
    // Base fire rate modified by player's attack speed
    return this.fireRate / this.player.getAttackSpeed()
  }

  update(time: number, delta: number) {
    // Skip update if game is over
    if (this.isGameOver) return

    if (this.player) {
      this.player.update(time, delta)

      const maxVelocity = 200
      let vx = 0
      let vy = 0

      // Virtual joystick has priority
      if (this.joystickForce > 0) {
        // Convert angle and force to velocity
        // nipplejs uses mathematical angles (counter-clockwise from right)
        // Screen Y-axis is inverted (positive = down), so negate sin
        vx = Math.cos(this.joystickAngle) * this.joystickForce * maxVelocity
        vy = -Math.sin(this.joystickAngle) * this.joystickForce * maxVelocity
      }
      // Fallback to keyboard controls for desktop testing
      else if (this.cursors) {
        if (this.cursors.left?.isDown) vx = -maxVelocity
        if (this.cursors.right?.isDown) vx = maxVelocity
        if (this.cursors.up?.isDown) vy = -maxVelocity
        if (this.cursors.down?.isDown) vy = maxVelocity
      }

      this.player.setVelocity(vx, vy)

      // CORE MECHANIC: Auto-fire when player is stationary
      if (!this.player.isPlayerMoving()) {
        if (time - this.lastShotTime > this.getEffectiveFireRate()) {
          const nearestEnemy = this.findNearestEnemy()
          if (nearestEnemy) {
            this.shootAtEnemy(nearestEnemy)
          }
        }
      }

      // Update enemies and handle fire DOT deaths
      const enemyChildren = this.enemies.getChildren()
      enemyChildren.forEach((enemy) => {
        const e = enemy as Enemy
        if (e && e.active) {
          const diedFromFire = e.update(time, delta, this.player.x, this.player.y)

          if (diedFromFire) {
            // Enemy died from fire DOT - handle like bullet kill
            this.enemiesKilled++

            // Add XP to player (check if boss)
            const isBoss = this.boss && e === (this.boss as unknown as Enemy)
            const xpGain = isBoss ? 10 : 1
            const leveledUp = this.player.addXP(xpGain)
            this.updateXPUI()

            if (leveledUp) {
              this.handleLevelUp()
            }

            // Clear boss reference if boss died
            if (isBoss) {
              this.boss = null
              this.scene.get('UIScene').events.emit('hideBossHealth')
            }

            // Remove enemy
            e.destroy()

            // Check if room cleared
            this.checkRoomCleared()
          }
        }
      })
    }
  }

  shutdown() {
    // Clean up joystick when scene shuts down
    if (this.joystick) {
      this.joystick.destroy()
    }
  }
}
