import Phaser from "phaser";
import { saveManager } from "../../systems/SaveManager";

/**
 * Event handlers for tutorial system events
 */
export interface TutorialEventHandlers {
  /** Called when the tutorial is shown (pause physics) */
  onTutorialShown: () => void;
  /** Called when the tutorial is dismissed (resume physics) */
  onTutorialDismissed: () => void;
}

/**
 * Configuration for TutorialSystem
 */
export interface TutorialSystemConfig {
  scene: Phaser.Scene;
  eventHandlers: TutorialEventHandlers;
}

/**
 * TutorialSystem - Manages the first-time player tutorial overlay
 *
 * Extracted from GameScene to provide focused tutorial handling.
 * Shows a tutorial overlay explaining the core mechanics for new players.
 */
export class TutorialSystem {
  private scene: Phaser.Scene;
  private eventHandlers: TutorialEventHandlers;
  private _isShowing: boolean = false;
  private tutorialContainer: Phaser.GameObjects.Container | null = null;

  constructor(config: TutorialSystemConfig) {
    this.scene = config.scene;
    this.eventHandlers = config.eventHandlers;
  }

  /**
   * Whether the tutorial overlay is currently visible
   */
  get isShowing(): boolean {
    return this._isShowing;
  }

  /**
   * Show the tutorial overlay for first-time players
   * Should only be called if saveManager.isTutorialCompleted() returns false
   */
  showTutorial(): void {
    const width = this.scene.cameras.main.width;
    const height = this.scene.cameras.main.height;

    // Mark tutorial as showing and notify parent to pause physics
    this._isShowing = true;
    this.eventHandlers.onTutorialShown();

    // Create tutorial container
    const container = this.scene.add.container(0, 0);
    container.setDepth(1000);
    this.tutorialContainer = container;

    // Semi-transparent overlay
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    container.add(overlay);

    // Title
    const title = this.scene.add
      .text(width / 2, 80, "HOW TO PLAY", {
        fontSize: "28px",
        color: "#FFD700",
        fontStyle: "bold",
        stroke: "#000000",
        strokeThickness: 3,
      })
      .setOrigin(0.5);
    container.add(title);

    // Instructions
    const instructions = [
      { icon: "🕹️", text: "Use the joystick to MOVE", color: "#4a9eff" },
      { icon: "🏃", text: "Moving = DODGING (no shooting)", color: "#ff6b6b" },
      { icon: "🎯", text: "Stand STILL to AUTO-SHOOT", color: "#44ff88" },
      { icon: "⬆️", text: "Level up = Choose an ABILITY", color: "#ffaa00" },
      { icon: "🚪", text: "Clear rooms to PROGRESS", color: "#aa88ff" },
    ];

    let yPos = 160;
    instructions.forEach((inst) => {
      const iconText = this.scene.add
        .text(50, yPos, inst.icon, {
          fontSize: "28px",
        })
        .setOrigin(0, 0.5);

      const descText = this.scene.add
        .text(90, yPos, inst.text, {
          fontSize: "16px",
          color: inst.color,
          stroke: "#000000",
          strokeThickness: 2,
        })
        .setOrigin(0, 0.5);

      container.add([iconText, descText]);
      yPos += 55;
    });

    // Core mechanic highlight box
    const highlightY = yPos + 30;
    const highlightBox = this.scene.add.rectangle(width / 2, highlightY, width - 40, 70, 0x333355);
    highlightBox.setStrokeStyle(2, 0x4a9eff);
    container.add(highlightBox);

    const coreText = this.scene.add
      .text(width / 2, highlightY - 12, "THE CORE MECHANIC:", {
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5);
    container.add(coreText);

    const mechanic = this.scene.add
      .text(width / 2, highlightY + 12, "STOP to SHOOT • MOVE to DODGE", {
        fontSize: "18px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    container.add(mechanic);

    // Start button
    const startY = height - 100;
    const startButton = this.scene.add
      .text(width / 2, startY, "TAP TO START", {
        fontSize: "22px",
        color: "#ffffff",
        backgroundColor: "#4a9eff",
        padding: { x: 30, y: 15 },
      })
      .setOrigin(0.5);
    startButton.setInteractive({ useHandCursor: true });
    container.add(startButton);

    // Pulse animation on start button
    this.scene.tweens.add({
      targets: startButton,
      scale: { from: 1, to: 1.05 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    // Skip text
    const skipText = this.scene.add
      .text(width / 2, startY + 50, "Tap anywhere to begin", {
        fontSize: "12px",
        color: "#888888",
      })
      .setOrigin(0.5);
    container.add(skipText);

    // Handle tap to dismiss
    const dismissTutorial = () => {
      // Mark tutorial as completed
      saveManager.completeTutorial();
      this._isShowing = false;

      // Animate out
      this.scene.tweens.add({
        targets: container,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          container.destroy();
          this.tutorialContainer = null;
          // Notify parent to resume physics
          this.eventHandlers.onTutorialDismissed();
        },
      });
    };

    // Make overlay and button clickable
    overlay.setInteractive();
    overlay.on("pointerdown", dismissTutorial);
    startButton.on("pointerdown", dismissTutorial);
  }

  /**
   * Clean up the tutorial system
   */
  destroy(): void {
    if (this.tutorialContainer) {
      this.tutorialContainer.destroy();
      this.tutorialContainer = null;
    }
    this._isShowing = false;
  }
}
