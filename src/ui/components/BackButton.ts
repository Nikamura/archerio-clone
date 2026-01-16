import Phaser from "phaser";
import { audioManager } from "../../systems/AudioManager";

/**
 * Configuration for BackButton
 */
export interface BackButtonConfig {
  scene: Phaser.Scene;
  x?: number;
  y?: number;
  targetScene?: string;
  onBack?: () => void;
  text?: string;
  depth?: number;
  width?: number;
  height?: number;
  backgroundColor?: number;
  hoverColor?: number;
  textColor?: string;
  fontSize?: string;
  playSound?: boolean;
}

/**
 * BackButton - Reusable back button component
 *
 * Provides a styled back button with hover effects and optional scene transition.
 * Used across 9+ scenes.
 */
export function createBackButton(config: BackButtonConfig): Phaser.GameObjects.Container {
  const {
    scene,
    x = scene.cameras.main.width / 2,
    y = scene.cameras.main.height - 25,
    targetScene,
    onBack,
    text = "< BACK",
    depth = 20,
    backgroundColor = 0x444444,
    hoverColor = 0x666666,
    textColor = "#ffffff",
    fontSize = "16px",
    playSound = true,
  } = config;

  const container = scene.add.container(x, y);
  container.setDepth(depth);

  // Create button text with background
  const buttonText = scene.add
    .text(0, 0, text, {
      fontSize,
      color: textColor,
      backgroundColor: `#${backgroundColor.toString(16).padStart(6, "0")}`,
      padding: { x: 20, y: 8 },
    })
    .setOrigin(0.5)
    .setInteractive({ useHandCursor: true });

  container.add(buttonText);

  // Hover effects
  buttonText.on("pointerover", () => {
    buttonText.setStyle({
      backgroundColor: `#${hoverColor.toString(16).padStart(6, "0")}`,
    });
  });

  buttonText.on("pointerout", () => {
    buttonText.setStyle({
      backgroundColor: `#${backgroundColor.toString(16).padStart(6, "0")}`,
    });
  });

  // Click handler
  buttonText.on("pointerdown", () => {
    if (playSound) {
      audioManager.playMenuSelect();
    }

    if (onBack) {
      onBack();
    } else if (targetScene) {
      scene.scene.start(targetScene);
    }
  });

  return container;
}

/**
 * Create a footer background for back button area
 */
export function createBackButtonFooter(
  scene: Phaser.Scene,
  width: number,
  height: number,
  footerHeight: number = 50,
  backgroundColor: number = 0x1a1a2e,
  depth: number = 20,
): Phaser.GameObjects.Rectangle {
  const footer = scene.add.rectangle(
    width / 2,
    height - footerHeight / 2,
    width,
    footerHeight,
    backgroundColor,
  );
  footer.setDepth(depth);
  return footer;
}

export default createBackButton;
