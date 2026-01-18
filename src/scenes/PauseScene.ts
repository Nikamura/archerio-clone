/**
 * PauseScene - Unified pause menu overlay
 *
 * Provides pause functionality with resume, game options, and quit.
 * Appears as a modal overlay on top of the frozen GameScene.
 */

import Phaser from "phaser";
import { audioManager } from "../systems/AudioManager";
import { saveManager } from "../systems/SaveManager";

const DURATION = {
  FAST: 200,
  NORMAL: 300,
};

const EASING = {
  EASE_OUT: "Power2.easeOut",
  EASE_IN: "Power2.easeIn",
};

export default class PauseScene extends Phaser.Scene {
  private overlay!: Phaser.GameObjects.Rectangle;
  private modalContainer!: Phaser.GameObjects.Container;
  private isClosing: boolean = false;
  private autoLevelIndicator!: Phaser.GameObjects.Arc;
  private autoRoomIndicator!: Phaser.GameObjects.Arc;

  constructor() {
    super({ key: "PauseScene" });
  }

  create(): void {
    this.isClosing = false;
    const { width, height } = this.cameras.main;

    // Enable input
    this.input.enabled = true;
    this.input.setTopOnly(false);
    this.scene.bringToTop();

    // Dark overlay
    this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    this.overlay.setInteractive();
    this.tweens.add({
      targets: this.overlay,
      alpha: 0.7,
      duration: DURATION.FAST,
      ease: EASING.EASE_OUT,
    });

    // Modal container
    this.modalContainer = this.add.container(width / 2, height / 2);
    this.modalContainer.setScale(0.8);
    this.modalContainer.setAlpha(0);

    // Panel dimensions
    const panelWidth = 280;
    const panelHeight = 340;

    // Panel background
    const panelBg = this.add.graphics();
    panelBg.fillStyle(0x1a1a2e, 1);
    panelBg.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    panelBg.lineStyle(3, 0x4a9eff);
    panelBg.strokeRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 16);
    this.modalContainer.add(panelBg);

    // Title
    const title = this.add
      .text(0, -panelHeight / 2 + 30, "PAUSED", {
        fontSize: "28px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.modalContainer.add(title);

    // Divider
    const divider = this.add.rectangle(0, -panelHeight / 2 + 55, panelWidth - 40, 2, 0x444466);
    this.modalContainer.add(divider);

    // Buttons and options
    const buttonWidth = 200;
    const buttonHeight = 44;
    const toggleHeight = 36;
    let currentY = -100;

    // Resume button (green, primary action)
    this.createButton(0, currentY, buttonWidth, buttonHeight, "RESUME", 0x44aa44, () =>
      this.handleResume(),
    );
    currentY += 55;

    // Toggle options section
    const optionsLabel = this.add
      .text(0, currentY - 5, "OPTIONS", {
        fontSize: "11px",
        color: "#666688",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.modalContainer.add(optionsLabel);
    currentY += 20;

    // Auto Level Up toggle
    this.autoLevelIndicator = this.createToggleRow(
      0,
      currentY,
      buttonWidth,
      toggleHeight,
      "⚡ Auto Level Up",
      saveManager.getAutoLevelUp(),
      () => {
        const newState = saveManager.toggleAutoLevelUp();
        this.autoLevelIndicator.setFillStyle(newState ? 0x00ff88 : 0x444444);
      },
    );
    currentY += toggleHeight + 6;

    // Auto Room Advance toggle
    this.autoRoomIndicator = this.createToggleRow(
      0,
      currentY,
      buttonWidth,
      toggleHeight,
      "⏩ Auto Room Advance",
      saveManager.getAutoRoomAdvance(),
      () => {
        const newState = saveManager.toggleAutoRoomAdvance();
        this.autoRoomIndicator.setFillStyle(newState ? 0x00ff88 : 0x444444);
      },
    );
    currentY += toggleHeight + 15;

    // Quit to Menu button (red, destructive)
    this.createButton(0, currentY, buttonWidth, buttonHeight, "QUIT TO MENU", 0xaa4444, () =>
      this.handleQuit(),
    );

    // Tip text
    const tipText = this.add
      .text(0, panelHeight / 2 - 25, "Your progress will be saved", {
        fontSize: "11px",
        color: "#666666",
      })
      .setOrigin(0.5);
    this.modalContainer.add(tipText);

    // Animate modal in
    this.tweens.add({
      targets: this.modalContainer,
      scale: 1,
      alpha: 1,
      duration: DURATION.NORMAL,
      ease: "Back.easeOut",
    });

    // ESC key to resume
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.isClosing) {
        this.handleResume();
      }
    });
  }

  private createToggleRow(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    initialState: boolean,
    onToggle: () => void,
  ): Phaser.GameObjects.Arc {
    const rowContainer = this.add.container(x, y);

    // Row background
    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
    rowContainer.add(bg);

    // Label text
    const text = this.add
      .text(-width / 2 + 15, 0, label, {
        fontSize: "13px",
        color: "#cccccc",
      })
      .setOrigin(0, 0.5);
    rowContainer.add(text);

    // Toggle indicator
    const indicator = this.add.circle(width / 2 - 20, 0, 6, initialState ? 0x00ff88 : 0x444444);
    rowContainer.add(indicator);

    // Interactive zone
    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    rowContainer.add(hitArea);

    // Hover effects
    hitArea.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(0x333366, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
    });

    hitArea.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(0x222244, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
    });

    hitArea.on("pointerdown", () => {
      audioManager.playMenuSelect();
      onToggle();
    });

    this.modalContainer.add(rowContainer);
    return indicator;
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    color: number,
    onClick: () => void,
  ): void {
    const buttonContainer = this.add.container(x, y);

    // Button background
    const bg = this.add.graphics();
    bg.fillStyle(color, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
    buttonContainer.add(bg);

    // Button text
    const text = this.add
      .text(0, 0, label, {
        fontSize: "16px",
        color: "#ffffff",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    buttonContainer.add(text);

    // Interactive zone
    const hitArea = this.add.rectangle(0, 0, width, height, 0x000000, 0);
    hitArea.setInteractive({ useHandCursor: true });
    buttonContainer.add(hitArea);

    // Hover effects
    hitArea.on("pointerover", () => {
      bg.clear();
      bg.fillStyle(Phaser.Display.Color.ValueToColor(color).lighten(20).color, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      buttonContainer.setScale(1.02);
    });

    hitArea.on("pointerout", () => {
      bg.clear();
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 8);
      buttonContainer.setScale(1);
    });

    hitArea.on("pointerdown", () => {
      audioManager.playMenuSelect();
      onClick();
    });

    this.modalContainer.add(buttonContainer);
  }

  private handleResume(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    // Animate out
    this.tweens.add({
      targets: this.overlay,
      alpha: 0,
      duration: DURATION.FAST,
      ease: EASING.EASE_IN,
    });

    this.tweens.add({
      targets: this.modalContainer,
      scale: 0.8,
      alpha: 0,
      duration: DURATION.FAST,
      ease: EASING.EASE_IN,
      onComplete: () => {
        // Resume GameScene and close PauseScene
        this.scene.resume("GameScene");
        this.scene.stop("PauseScene");
      },
    });
  }

  private handleQuit(): void {
    if (this.isClosing) return;
    this.isClosing = true;

    // Emit event for GameScene to handle quit (go to GameOver or MainMenu)
    this.game.events.emit("quitFromPause");

    // Animate out
    this.tweens.add({
      targets: [this.overlay, this.modalContainer],
      alpha: 0,
      duration: DURATION.FAST,
      ease: EASING.EASE_IN,
      onComplete: () => {
        this.scene.stop("PauseScene");
      },
    });
  }

  shutdown(): void {
    // Cleanup
    this.input.keyboard?.off("keydown-ESC");
  }
}
