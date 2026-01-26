import Phaser from "phaser";
import Joystick from "../../ui/Joystick";

/**
 * Input result returned by InputSystem.update()
 */
export interface InputResult {
  /** Horizontal velocity component (-1 to 1) */
  velocityX: number;
  /** Vertical velocity component (-1 to 1) */
  velocityY: number;
  /** Whether the player should be shooting (stationary with nearby enemy) */
  isShooting: boolean;
  /** Whether any input was detected this frame */
  hasInput: boolean;
}

/**
 * Configuration for InputSystem
 */
export interface InputSystemConfig {
  scene: Phaser.Scene;
  /** Movement speed multiplier */
  moveSpeed?: number;
  /** Joystick container element (if null, created automatically) */
  joystickContainer?: HTMLElement;
  /** Minimum joystick force to register movement */
  deadZone?: number;
}

/**
 * InputSystem - Handles player input from keyboard and touch joystick
 *
 * Extracted from GameScene to provide a reusable input handling system.
 * Supports keyboard (WASD/Arrow keys) and virtual joystick for mobile.
 */
export class InputSystem {
  private scene: Phaser.Scene;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasdKeys: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  } | null = null;

  private joystick: Joystick | null = null;
  private joystickAngle: number = 0;
  private joystickForce: number = 0;
  private lastJoystickMoveTime: number = 0;

  private moveSpeed: number;
  private deadZone: number;

  private readonly JOYSTICK_STUCK_TIMEOUT = 500; // ms

  private isDestroyed: boolean = false;

  constructor(config: InputSystemConfig) {
    this.scene = config.scene;
    this.moveSpeed = config.moveSpeed ?? 200;
    this.deadZone = config.deadZone ?? 0.15;

    this.setupKeyboard();
    this.setupJoystick(config.joystickContainer);
    this.setupVisibilityHandlers();
  }

  /**
   * Setup keyboard input (WASD and arrow keys)
   */
  private setupKeyboard(): void {
    if (!this.scene.input.keyboard) return;

    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasdKeys = {
      W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  /**
   * Setup virtual joystick for touch input
   */
  private setupJoystick(container?: HTMLElement): void {
    this.joystick = new Joystick(this.scene);
    const joystickContainer =
      container || document.getElementById("game-container") || document.body;
    this.joystick.create(joystickContainer);

    this.joystick.setOnMove((angle: number, force: number) => {
      this.joystickAngle = angle;
      this.joystickForce = force;
      this.lastJoystickMoveTime = this.scene.time.now;
    });

    this.joystick.setOnEnd(() => {
      this.joystickForce = 0;
      this.joystickAngle = 0;
    });
  }

  /**
   * Setup handlers for browser visibility changes
   */
  private setupVisibilityHandlers(): void {
    const handleVisibilityChange = () => {
      if (document.hidden && this.scene.scene.isActive()) {
        this.reset();
      }
    };

    const handleBlur = () => {
      if (this.scene.scene.isActive()) {
        this.reset();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    // Cleanup on scene shutdown
    this.scene.events.once("shutdown", () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    });
  }

  /**
   * Update input state and return current input result
   */
  update(): InputResult {
    if (this.isDestroyed) {
      return { velocityX: 0, velocityY: 0, isShooting: false, hasInput: false };
    }

    let velocityX = 0;
    let velocityY = 0;
    let hasInput = false;

    // Check for stuck joystick state
    // Only reset if joystick reports force > 0 but is NOT actively being touched
    // (which indicates a true stuck state, not a player holding steady)
    const currentTime = this.scene.time.now;
    const isJoystickActivelyTouched = this.joystick?.getIsActive() ?? false;
    if (
      this.joystickForce > 0 &&
      this.lastJoystickMoveTime > 0 &&
      !isJoystickActivelyTouched &&
      currentTime - this.lastJoystickMoveTime > this.JOYSTICK_STUCK_TIMEOUT
    ) {
      this.reset();
    }

    // Keyboard input (WASD and arrows)
    if (this.cursors && this.wasdKeys) {
      if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
        velocityX = -1;
        hasInput = true;
      } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
        velocityX = 1;
        hasInput = true;
      }

      if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
        velocityY = -1;
        hasInput = true;
      } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
        velocityY = 1;
        hasInput = true;
      }
    }

    // Joystick input (overrides keyboard if active)
    if (this.joystickForce > this.deadZone) {
      // Convert angle to velocity components
      // Note: joystick uses mathematical angles (counter-clockwise from right)
      velocityX = Math.cos(this.joystickAngle) * this.joystickForce;
      velocityY = -Math.sin(this.joystickAngle) * this.joystickForce; // Negate Y for screen coordinates
      hasInput = true;
    }

    // Normalize diagonal movement
    if (velocityX !== 0 && velocityY !== 0) {
      const length = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      velocityX /= length;
      velocityY /= length;
    }

    // Player shoots when stationary (no movement input)
    const isShooting = !hasInput;

    return {
      velocityX,
      velocityY,
      isShooting,
      hasInput,
    };
  }

  /**
   * Get movement velocity scaled by move speed
   */
  getMovementVelocity(): { x: number; y: number } {
    const input = this.update();
    return {
      x: input.velocityX * this.moveSpeed,
      y: input.velocityY * this.moveSpeed,
    };
  }

  /**
   * Reset joystick and input state
   */
  reset(): void {
    this.joystickForce = 0;
    this.joystickAngle = 0;
    this.lastJoystickMoveTime = 0;

    if (this.joystick) {
      this.joystick.reset();
    }
  }

  /**
   * Hide the joystick UI
   */
  hide(): void {
    if (this.joystick) {
      this.joystick.hide();
    }
  }

  /**
   * Show the joystick UI
   */
  show(): void {
    if (this.joystick) {
      this.joystick.show();
    }
  }

  /**
   * Set movement speed
   */
  setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }

  /**
   * Set a callback to check if joystick creation should be blocked at a point.
   * Used to prevent joystick activation when tapping on walls.
   */
  setBlockedAtPointCallback(callback: (x: number, y: number) => boolean): void {
    if (this.joystick) {
      this.joystick.setBlockedAtPointCallback(callback);
    }
  }

  /**
   * Destroy the input system and cleanup resources
   */
  destroy(): void {
    this.isDestroyed = true;

    if (this.joystick) {
      this.joystick.destroy();
      this.joystick = null;
    }
  }
}

export default InputSystem;
