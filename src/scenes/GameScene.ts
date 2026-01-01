import Phaser from 'phaser'
import Player from '../entities/Player'
import Enemy from '../entities/Enemy'
import RangedShooterEnemy from '../entities/RangedShooterEnemy'
import SpreaderEnemy from '../entities/SpreaderEnemy'
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

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    const width = this.cameras.main.width
    const height = this.cameras.main.height

    // Create a simple ground color
    this.add.rectangle(0, 0, width * 2, height * 2, 0x3a5f4a).setOrigin(0)

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
      this.bulletHitEnemy,
      undefined,
      this
    )

    // Enemy bullets hit player
    this.physics.add.overlap(
      this.player,
      this.enemyBulletPool,
      this.enemyBulletHitPlayer,
      undefined,
      this
    )

    // Enemies hit player (melee damage)
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.enemyHitPlayer,
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

    console.log('GameScene: Created')
  }

  private spawnEnemies() {
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

    // Spawn 6 enemies (mix of types)
    let spawned = 0
    let attempts = 0
    const maxAttempts = 30
    const enemyTypes = ['melee', 'melee', 'ranged', 'ranged', 'spreader', 'spreader']

    while (spawned < enemyTypes.length && attempts < maxAttempts) {
      const x = Phaser.Math.Between(100, width - 100)
      const y = Phaser.Math.Between(100, height - 100)

      // Don't spawn too close to player
      if (Phaser.Math.Distance.Between(x, y, width / 2, height / 2) > 150) {
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
        if (enemy.body) {
          enemy.body.setCircle(10) // Reduced from 15 to 10 for more precise collision
          enemy.body.setCollideWorldBounds(true)
        }

        this.enemies.add(enemy)
        spawned++
        console.log(`${enemyType} enemy ${spawned} created at ${x}, ${y}`)
      }
      attempts++
    }

    console.log(`Spawned ${spawned} enemies`)
  }

  private bulletHitEnemy(
    bullet: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ) {
    const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite
    const enemySprite = enemy as Enemy

    // Deactivate bullet
    bulletSprite.setActive(false)
    bulletSprite.setVisible(false)

    // Damage enemy
    const killed = enemySprite.takeDamage(10)

    if (killed) {
      // Remove enemy from group and destroy
      enemySprite.destroy()

      // Enemy died, respawn a new one after a delay
      this.time.delayedCall(2000, () => {
        if (this.scene.isActive()) {
          const width = this.cameras.main.width
          const height = this.cameras.main.height
          const x = Phaser.Math.Between(100, width - 100)
          const y = Phaser.Math.Between(100, height - 100)

          const newEnemy = new Enemy(this, x, y)
          this.add.existing(newEnemy)
          this.physics.add.existing(newEnemy)
          this.enemies.add(newEnemy)
        }
      })
    }
  }

  private enemyBulletHitPlayer(
    player: Phaser.GameObjects.GameObject,
    bullet: Phaser.GameObjects.GameObject
  ) {
    const bulletSprite = bullet as Phaser.Physics.Arcade.Sprite
    const playerSprite = player as Player

    // Deactivate bullet
    bulletSprite.setActive(false)
    bulletSprite.setVisible(false)

    // Damage player
    playerSprite.takeDamage(10)

    // Update UI
    this.updatePlayerHealthUI(playerSprite)

    // Flash player
    playerSprite.setTint(0xff0000)
    this.time.delayedCall(100, () => {
      playerSprite.clearTint()
    })

    console.log(`Player hit by bullet! Health: ${playerSprite.getHealth()}`)
  }

  private enemyHitPlayer(
    player: Phaser.GameObjects.GameObject,
    enemy: Phaser.GameObjects.GameObject
  ) {
    const playerSprite = player as Player
    const enemySprite = enemy as Enemy

    // Damage player (melee damage)
    playerSprite.takeDamage(5)

    // Update UI
    this.updatePlayerHealthUI(playerSprite)

    // Flash player
    playerSprite.setTint(0xff0000)
    this.time.delayedCall(100, () => {
      playerSprite.clearTint()
    })

    // Push player back slightly
    const angle = Phaser.Math.Angle.Between(
      enemySprite.x,
      enemySprite.y,
      playerSprite.x,
      playerSprite.y
    )
    const knockbackForce = 100
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

  private shootAtEnemy(enemy: Enemy) {
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      enemy.x,
      enemy.y
    )

    this.bulletPool.spawn(this.player.x, this.player.y, angle, 400)
    this.lastShotTime = this.time.now
  }

  update(time: number, delta: number) {
    if (this.player) {
      this.player.update(time, delta)

      const maxVelocity = 200
      let vx = 0
      let vy = 0

      // Virtual joystick has priority
      if (this.joystickForce > 0) {
        // Convert angle and force to velocity
        vx = Math.cos(this.joystickAngle) * this.joystickForce * maxVelocity
        vy = Math.sin(this.joystickAngle) * this.joystickForce * maxVelocity
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
        if (time - this.lastShotTime > this.fireRate) {
          const nearestEnemy = this.findNearestEnemy()
          if (nearestEnemy) {
            this.shootAtEnemy(nearestEnemy)
          }
        }
      }

      // Update enemies
      const enemyChildren = this.enemies.getChildren()
      enemyChildren.forEach((enemy) => {
        const e = enemy as Enemy
        if (e && e.active) {
          e.update(time, delta, this.player.x, this.player.y)
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
