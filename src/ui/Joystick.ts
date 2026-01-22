// Phaser-native virtual joystick implementation
// Uses pre-rendered sprites instead of redrawing Graphics every frame for better performance

// Joystick configuration
const JOYSTICK_CONFIG = {
  // Dead zone - ignore input below this threshold (0-1)
  // Higher value = more tolerance for resting finger without movement
  DEAD_ZONE: 0.25,
  // Base circle radius
  BASE_RADIUS: 60,
  // Thumb circle radius
  THUMB_RADIUS: 25,
  // Maximum distance thumb can move from center
  MAX_DISTANCE: 50,
  // Colors
  BASE_COLOR: 0x4a9eff,
  BASE_ALPHA: 0.3,
  THUMB_COLOR: 0x4a9eff,
  THUMB_ALPHA: 0.6,
  // Touch zone - 0 = entire screen, 0.5 = bottom 50% only
  TOUCH_ZONE_TOP_RATIO: 0,
};

export default class Joystick {
  private scene: Phaser.Scene;
  private baseSprite: Phaser.GameObjects.Image | null = null;
  private thumbSprite: Phaser.GameObjects.Image | null = null;
  private baseX: number = 0;
  private baseY: number = 0;
  private isActive: boolean = false;
  private pointerId: number = -1;
  private onMove: ((angle: number, force: number) => void) | null = null;
  private onEnd: (() => void) | null = null;
  private isVisible: boolean = true;
  private isCreated: boolean = false;
  private isBlockedAtPoint: ((x: number, y: number) => boolean) | null = null;
  private texturesGenerated: boolean = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Set a callback to check if joystick creation should be blocked at a point.
   * Used to prevent joystick activation when tapping on walls.
   */
  setBlockedAtPointCallback(callback: (x: number, y: number) => boolean): void {
    this.isBlockedAtPoint = callback;
  }

  /**
   * Generate joystick textures once (called on first create)
   */
  private generateTextures(): void {
    if (this.texturesGenerated || this.scene.textures.exists("joystick_base")) {
      return;
    }

    // Generate base texture
    const baseSize = JOYSTICK_CONFIG.BASE_RADIUS * 2 + 4;
    const baseGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    baseGraphics.fillStyle(JOYSTICK_CONFIG.BASE_COLOR, JOYSTICK_CONFIG.BASE_ALPHA);
    baseGraphics.fillCircle(baseSize / 2, baseSize / 2, JOYSTICK_CONFIG.BASE_RADIUS);
    baseGraphics.lineStyle(2, JOYSTICK_CONFIG.BASE_COLOR, JOYSTICK_CONFIG.BASE_ALPHA + 0.2);
    baseGraphics.strokeCircle(baseSize / 2, baseSize / 2, JOYSTICK_CONFIG.BASE_RADIUS);
    baseGraphics.generateTexture("joystick_base", baseSize, baseSize);
    baseGraphics.destroy();

    // Generate thumb texture
    const thumbSize = JOYSTICK_CONFIG.THUMB_RADIUS * 2 + 4;
    const thumbGraphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    thumbGraphics.fillStyle(JOYSTICK_CONFIG.THUMB_COLOR, JOYSTICK_CONFIG.THUMB_ALPHA);
    thumbGraphics.fillCircle(thumbSize / 2, thumbSize / 2, JOYSTICK_CONFIG.THUMB_RADIUS);
    thumbGraphics.lineStyle(2, JOYSTICK_CONFIG.THUMB_COLOR, JOYSTICK_CONFIG.THUMB_ALPHA + 0.2);
    thumbGraphics.strokeCircle(thumbSize / 2, thumbSize / 2, JOYSTICK_CONFIG.THUMB_RADIUS);
    thumbGraphics.generateTexture("joystick_thumb", thumbSize, thumbSize);
    thumbGraphics.destroy();

    this.texturesGenerated = true;
  }

  create(_container: HTMLElement) {
    if (this.isCreated) return;

    // Generate textures once
    this.generateTextures();

    // Create sprite objects for base and thumb
    this.baseSprite = this.scene.add.image(0, 0, "joystick_base");
    this.thumbSprite = this.scene.add.image(0, 0, "joystick_thumb");

    // Set high depth to render above game objects
    this.baseSprite.setDepth(1000);
    this.thumbSprite.setDepth(1001);

    // Initially hidden until touch starts
    this.baseSprite.setVisible(false);
    this.thumbSprite.setVisible(false);

    // Set up input handlers
    this.setupInputHandlers();

    this.isCreated = true;
    console.log("Joystick created (sprite-based)");
  }

  private setupInputHandlers() {
    // Handle pointer down - start joystick
    this.scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.isVisible) return;

      // Only activate if touch is in the bottom portion of screen (below buttons)
      const touchZoneTop = this.scene.scale.height * JOYSTICK_CONFIG.TOUCH_ZONE_TOP_RATIO;
      if (pointer.y < touchZoneTop) return;

      // Only activate if no joystick is currently active
      if (this.isActive) return;

      // Check if the touch point is blocked (e.g., on a wall)
      if (this.isBlockedAtPoint && this.isBlockedAtPoint(pointer.x, pointer.y)) {
        return;
      }

      this.isActive = true;
      this.pointerId = pointer.id;
      this.baseX = pointer.x;
      this.baseY = pointer.y;

      // Position joystick sprites at touch position
      this.baseSprite?.setPosition(this.baseX, this.baseY);
      this.thumbSprite?.setPosition(this.baseX, this.baseY);

      this.baseSprite?.setVisible(true);
      this.thumbSprite?.setVisible(true);
    });

    // Handle pointer move - update joystick
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.isActive || pointer.id !== this.pointerId) return;

      this.updateThumbPosition(pointer.x, pointer.y);
    });

    // Handle pointer up - end joystick
    this.scene.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (!this.isActive || pointer.id !== this.pointerId) return;

      this.deactivate();
    });

    // Handle pointer out of bounds
    this.scene.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      if (!this.isActive || pointer.id !== this.pointerId) return;

      this.deactivate();
    });

    // Handle game out of focus
    this.scene.input.on("gameout", () => {
      if (this.isActive) {
        this.deactivate();
      }
    });
  }

  private updateThumbPosition(pointerX: number, pointerY: number) {
    // Calculate distance and angle from base center
    const dx = pointerX - this.baseX;
    const dy = pointerY - this.baseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(-dy, dx); // Negative dy because screen Y is inverted

    // Clamp distance to max
    const clampedDistance = Math.min(distance, JOYSTICK_CONFIG.MAX_DISTANCE);

    // Calculate thumb position
    const thumbX = this.baseX + Math.cos(Math.atan2(dy, dx)) * clampedDistance;
    const thumbY = this.baseY + Math.sin(Math.atan2(dy, dx)) * clampedDistance;

    // Move thumb sprite to new position (no redraw needed!)
    this.thumbSprite?.setPosition(thumbX, thumbY);

    // Calculate force (0-1)
    let force = clampedDistance / JOYSTICK_CONFIG.MAX_DISTANCE;

    // Apply dead zone
    if (force < JOYSTICK_CONFIG.DEAD_ZONE) {
      force = 0;
    } else {
      // Remap force from dead zone to 1.0 range
      force = (force - JOYSTICK_CONFIG.DEAD_ZONE) / (1 - JOYSTICK_CONFIG.DEAD_ZONE);
    }

    // Call the move callback
    if (this.onMove) {
      this.onMove(angle, force);
    }
  }

  private deactivate() {
    this.isActive = false;
    this.pointerId = -1;

    // Hide joystick
    this.baseSprite?.setVisible(false);
    this.thumbSprite?.setVisible(false);

    // Call end callback
    if (this.onEnd) {
      this.onEnd();
    }
  }

  setOnMove(callback: (angle: number, force: number) => void) {
    this.onMove = callback;
  }

  setOnEnd(callback: () => void) {
    this.onEnd = callback;
  }

  hide() {
    this.isVisible = false;

    // Deactivate if currently active
    if (this.isActive) {
      this.deactivate();
    }

    // Hide sprites
    this.baseSprite?.setVisible(false);
    this.thumbSprite?.setVisible(false);

    console.log("Joystick: hidden");
  }

  show() {
    this.isVisible = true;
    console.log("Joystick: shown");
  }

  destroy() {
    // Deactivate first
    if (this.isActive) {
      this.deactivate();
    }

    // Remove input listeners
    this.scene.input.off("pointerdown");
    this.scene.input.off("pointermove");
    this.scene.input.off("pointerup");
    this.scene.input.off("pointerupoutside");
    this.scene.input.off("gameout");

    // Destroy sprite objects
    if (this.baseSprite) {
      this.baseSprite.destroy();
      this.baseSprite = null;
    }

    if (this.thumbSprite) {
      this.thumbSprite.destroy();
      this.thumbSprite = null;
    }

    this.isCreated = false;
    this.onMove = null;
    this.onEnd = null;
  }

  /**
   * Force reset the joystick state
   * Useful for recovering from stuck input states
   */
  reset() {
    if (this.isActive) {
      this.deactivate();
    }

    // Notify callbacks with zero values
    if (this.onMove) {
      this.onMove(0, 0);
    }
    if (this.onEnd) {
      this.onEnd();
    }
  }
}
