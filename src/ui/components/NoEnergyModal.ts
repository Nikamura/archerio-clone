import Phaser from "phaser";
import { currencyManager } from "../../systems/CurrencyManager";
import { audioManager } from "../../systems/AudioManager";

export interface NoEnergyModalConfig {
  scene: Phaser.Scene;
  onWatchAd: () => void;
}

export interface NoEnergyModalResult {
  destroy: () => void;
}

/**
 * NoEnergyModal - Shows when player has no energy to start a game
 * Offers option to watch ad for energy refill
 */
export function showNoEnergyModal(config: NoEnergyModalConfig): NoEnergyModalResult {
  const { scene, onWatchAd } = config;
  const width = scene.cameras.main.width;
  const height = scene.cameras.main.height;

  const elements: Phaser.GameObjects.GameObject[] = [];

  // Create semi-transparent overlay
  const overlay = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
  overlay.setDepth(100);
  elements.push(overlay);

  // Create message container
  const messageBox = scene.add.rectangle(width / 2, height / 2, 280, 180, 0x222222, 1);
  messageBox.setStrokeStyle(2, 0xff4444);
  messageBox.setDepth(101);
  elements.push(messageBox);

  // No energy icon and title
  const title = scene.add.text(width / 2, height / 2 - 60, "⚡ No Energy!", {
    fontSize: "22px",
    color: "#ff4444",
    fontStyle: "bold",
  });
  title.setOrigin(0.5);
  title.setDepth(102);
  elements.push(title);

  // Description text
  const timeString = currencyManager.getFormattedTimeUntilNextEnergy();
  const desc = scene.add.text(width / 2, height / 2 - 30, `Next energy in: ${timeString}`, {
    fontSize: "14px",
    color: "#cccccc",
  });
  desc.setOrigin(0.5);
  desc.setDepth(102);
  elements.push(desc);

  // Watch Ad button
  const watchAdBg = scene.add.rectangle(width / 2, height / 2 + 10, 200, 40, 0x4a9eff, 1);
  watchAdBg.setStrokeStyle(2, 0x6bb6ff);
  watchAdBg.setDepth(102);
  watchAdBg.setInteractive({ useHandCursor: true });
  elements.push(watchAdBg);

  const watchAdText = scene.add.text(width / 2, height / 2 + 10, "📺 Watch Ad for +1 Energy", {
    fontSize: "14px",
    color: "#ffffff",
    fontStyle: "bold",
  });
  watchAdText.setOrigin(0.5);
  watchAdText.setDepth(103);
  elements.push(watchAdText);

  // Hover effects for button
  watchAdBg.on("pointerover", () => {
    watchAdBg.setFillStyle(0x6bb6ff);
  });
  watchAdBg.on("pointerout", () => {
    watchAdBg.setFillStyle(0x4a9eff);
  });

  // Tap to dismiss text
  const dismissText = scene.add.text(width / 2, height / 2 + 60, "Tap outside to dismiss", {
    fontSize: "12px",
    color: "#888888",
  });
  dismissText.setOrigin(0.5);
  dismissText.setDepth(102);
  elements.push(dismissText);

  const destroy = () => {
    elements.forEach((el) => el.destroy());
  };

  // Click to show mock ad
  watchAdBg.on("pointerdown", () => {
    audioManager.playMenuSelect();
    destroy();
    onWatchAd();
  });

  // Make overlay interactive to dismiss
  overlay.setInteractive();
  overlay.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    const boxBounds = messageBox.getBounds();
    if (!boxBounds.contains(pointer.x, pointer.y)) {
      destroy();
    }
  });

  return { destroy };
}
