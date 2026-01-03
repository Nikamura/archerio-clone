import Phaser from 'phaser'
import Joystick from '../ui/Joystick'
import type Player from '../entities/Player'

export interface InputVelocity {
  vx: number
  vy: number
}

/**
 * InputController handles all player input (joystick and keyboard).
 * Extracted from GameScene to centralize input handling.
 */
export class InputController {
  private scene: Phaser.Scene
  private player: Player

  // Keyboard controls
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: {
    W: Phaser.Input.Keyboard.Key
    A: Phaser.Input.Keyboard.Key
    S: Phaser.Input.Keyboard.Key
    D: Phaser.Input.Keyboard.Key
  }

  // Virtual joystick
  private joystick!: Joystick
  private joystickAngle: number = 0
  private joystickForce: number = 0
  private lastJoystickMoveTime: number = 0

  // Stuck detection
  private readonly JOYSTICK_STUCK_TIMEOUT = 500

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene
    this.player = player
    this.setupInput()
  }

  /**
   * Set up keyboard and joystick input handlers
   */
  private setupInput(): void {
    // Keyboard controls for desktop testing (arrow keys + WASD)
    this.cursors = this.scene.input.keyboard!.createCursorKeys()
    this.wasdKeys = {
      W: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    }

    // Create virtual joystick
    this.joystick = new Joystick(this.scene)
    const gameContainer = this.scene.game.canvas.parentElement
    if (gameContainer) {
      this.joystick.create(gameContainer)

      // Set joystick callbacks
      this.joystick.setOnMove((angle: number, force: number) => {
        this.joystickAngle = angle
        this.joystickForce = force
        this.lastJoystickMoveTime = this.scene.time.now
      })

      this.joystick.setOnEnd(() => {
        this.joystickForce = 0
        this.lastJoystickMoveTime = 0
      })
    }
  }

  /**
   * Check for stuck joystick state and reset if needed
   */
  checkStuckState(time: number): void {
    if (this.joystickForce > 0 && this.lastJoystickMoveTime > 0) {
      const timeSinceLastInput = time - this.lastJoystickMoveTime
      const anyPointerDown = this.scene.input.pointer1?.isDown || this.scene.input.pointer2?.isDown
      if (timeSinceLastInput > this.JOYSTICK_STUCK_TIMEOUT && !anyPointerDown) {
        this.joystickForce = 0
        this.lastJoystickMoveTime = 0
      }
    }
  }

  /**
   * Check if there is any active movement input
   */
  hasMovementInput(): boolean {
    return this.joystickForce > 0 ||
      this.cursors?.left?.isDown || this.cursors?.right?.isDown ||
      this.cursors?.up?.isDown || this.cursors?.down?.isDown ||
      this.wasdKeys?.A?.isDown || this.wasdKeys?.D?.isDown ||
      this.wasdKeys?.W?.isDown || this.wasdKeys?.S?.isDown
  }

  /**
   * Get the current movement velocity based on input
   */
  getVelocity(baseVelocity: number): InputVelocity {
    const maxVelocity = baseVelocity * this.player.getMovementSpeedMultiplier()
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
    // Fallback to keyboard controls for desktop testing (arrows + WASD)
    else if (this.cursors || this.wasdKeys) {
      if (this.cursors?.left?.isDown || this.wasdKeys?.A?.isDown) vx = -maxVelocity
      if (this.cursors?.right?.isDown || this.wasdKeys?.D?.isDown) vx = maxVelocity
      if (this.cursors?.up?.isDown || this.wasdKeys?.W?.isDown) vy = -maxVelocity
      if (this.cursors?.down?.isDown || this.wasdKeys?.S?.isDown) vy = maxVelocity
    }

    return { vx, vy }
  }

  /**
   * Reset joystick state to prevent stuck input
   */
  reset(): void {
    console.log('InputController: Resetting joystick state')
    this.joystickForce = 0
    this.joystickAngle = 0
    this.lastJoystickMoveTime = 0

    // Also reset the joystick UI if it exists
    if (this.joystick) {
      this.joystick.reset()
    }

    // Stop player movement immediately
    if (this.player && this.player.body) {
      this.player.setVelocity(0, 0)
    }
  }

  /**
   * Hide the joystick UI
   */
  hide(): void {
    if (this.joystick) {
      this.joystick.hide()
    }
  }

  /**
   * Show the joystick UI
   */
  show(): void {
    if (this.joystick) {
      this.joystick.show()
    }
  }

  /**
   * Destroy the input controller and clean up
   */
  destroy(): void {
    if (this.joystick) {
      this.joystick.destroy()
      this.joystick = null!
    }
  }
}
